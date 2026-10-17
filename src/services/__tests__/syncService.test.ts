const mockUpsert = jest.fn();
const mockGetSession = jest.fn();
const mockFrom = jest.fn(() => ({ upsert: mockUpsert }));
jest.mock("@/src/lib/supabase", () => ({
  isSyncEnabled: jest.fn(),
  getSupabaseClient: () => ({
    from: mockFrom,
    auth: { getSession: mockGetSession },
  }),
}));

const mockDexie = {
  mealEntries: { getByDate: jest.fn(), insert: jest.fn() },
};
jest.mock("@/db/client", () => ({
  db: {},
  get dexieAdapter() {
    return mockDexie;
  },
}));
jest.mock("@/db/schema", () => ({ mealEntries: {} }));
jest.mock("drizzle-orm", () => ({ eq: jest.fn() }));

const mockGetAll = jest.fn();
jest.mock("@/db/repos/mealEntries", () => ({ getAll: (...a: unknown[]) => mockGetAll(...a) }));
const mockGetProfile = jest.fn();
const mockUpsertProfile = jest.fn();
const mockReplaceProfile = jest.fn();
jest.mock("@/db/repos/profile", () => ({
  getProfile: (...a: unknown[]) => mockGetProfile(...a),
  upsertProfile: (...a: unknown[]) => mockUpsertProfile(...a),
  replaceProfileFromRemote: (...a: unknown[]) => mockReplaceProfile(...a),
}));
jest.mock("@/stores/useDayStore", () => ({
  useDayStore: { getState: () => ({ loadEntries: jest.fn() }) },
}));
jest.mock("@/stores/useProfileStore", () => ({
  useProfileStore: { getState: () => ({ load: jest.fn() }) },
}));

const mockCleanupDemoData = jest.fn();
jest.mock("@/src/services/demoCleanup", () => ({
  cleanupDemoData: (...a: unknown[]) => mockCleanupDemoData(...a),
}));

const mockDrain = jest.fn();
const mockRemove = jest.fn();
jest.mock("@/src/services/syncQueue", () => ({
  drain: (...a: unknown[]) => mockDrain(...a),
  remove: (...a: unknown[]) => mockRemove(...a),
}));

const authSubscribers: Array<(s: { status: string; userId: string | null }) => void> = [];
let authState: { status: string; userId: string | null } = {
  status: "authed",
  userId: "user-1",
};
jest.mock("@/src/stores/useAuthStore", () => ({
  useAuthStore: {
    getState: () => authState,
    subscribe: (fn: (s: typeof authState) => void) => {
      authSubscribers.push(fn);
      return () => {};
    },
  },
}));

import { isSyncEnabled } from "@/src/lib/supabase";
import {
  backfillMealEntries,
  bindSyncToAuth,
  flush,
  reconcile,
  resetDemoWarningForTests,
  start,
  stop,
  sync,
} from "@/src/services/syncService";

const mockedIsSyncEnabled = isSyncEnabled as jest.Mock;

function makeEntry(i: number) {
  return {
    id: `e${i}`,
    userId: null,
    date: "2025-01-01",
    mealType: "lunch",
    foodId: "f",
    foodName: "Food",
    quantityG: 100,
    calories: 100,
    proteinG: 1,
    carbsG: 1,
    fatG: 1,
    loggedAt: "2025-01-01T10:00:00.000Z",
    updatedAt: null,
  };
}

let store: Record<string, string>;
let warnSpy: jest.SpyInstance;
let errorSpy: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  authSubscribers.length = 0;
  authState = { status: "authed", userId: "user-1" };
  store = {};
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
  };
  (globalThis as { window?: unknown }).window = {
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  };
  (globalThis as { document?: unknown }).document = {
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    visibilityState: "visible",
  };
  mockedIsSyncEnabled.mockReturnValue(true);
  mockUpsert.mockResolvedValue({ error: null });
  mockGetSession.mockResolvedValue({ data: { session: { user: { id: "user-1" } } } });
  mockDrain.mockResolvedValue([]);
  mockGetAll.mockResolvedValue([]);
  mockGetProfile.mockResolvedValue(null);
  mockDexie.mealEntries.getByDate.mockResolvedValue([]);
  mockFrom.mockImplementation(() => ({ upsert: mockUpsert }));
  warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
  errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  stop();
  warnSpy.mockRestore();
  errorSpy.mockRestore();
});

describe("flush", () => {
  it("normalizes legacy camelCase queue rows before upserting", async () => {
    mockDrain.mockResolvedValue([
      {
        id: "q1",
        table: "meal_entries",
        op: "upsert",
        row: JSON.stringify({ ...makeEntry(1), user_id: "user-1" }),
        userId: "user-1",
        updatedAt: "x",
      },
    ]);

    await flush();

    const [payload, options] = mockUpsert.mock.calls[0];
    expect(payload).toMatchObject({
      id: "e1",
      user_id: "user-1",
      meal_type: "lunch",
      food_name: "Food",
      quantity_g: 100,
    });
    expect(payload).not.toHaveProperty("mealType");
    expect(payload).not.toHaveProperty("userId");
    expect(options).toEqual({ onConflict: "id" });
    expect(mockRemove).toHaveBeenCalledWith("q1");
  });

  it("keeps the op in the queue when the upsert fails", async () => {
    mockUpsert.mockResolvedValue({ error: { message: "boom" } });
    mockDrain.mockResolvedValue([
      {
        id: "q1",
        table: "meal_entries",
        op: "upsert",
        row: JSON.stringify(makeEntry(1)),
        userId: "user-1",
        updatedAt: "x",
      },
    ]);

    await flush();

    expect(mockRemove).not.toHaveBeenCalled();
  });
});

describe("backfillMealEntries", () => {
  it("batches in chunks of 500 using the session user id", async () => {
    mockGetAll.mockResolvedValue(Array.from({ length: 1200 }, (_, i) => makeEntry(i)));

    await expect(backfillMealEntries("user-1")).resolves.toBe(true);

    expect(mockUpsert).toHaveBeenCalledTimes(3);
    expect(mockUpsert.mock.calls.map((c) => c[0].length)).toEqual([500, 500, 200]);
    expect(mockUpsert.mock.calls[0][0][0].user_id).toBe("user-1");
    expect(mockUpsert.mock.calls[0][1]).toEqual({ onConflict: "id", ignoreDuplicates: true });
    expect(store["vitia:sync:mealEntriesBackfilled:user-1"]).toBe("1");
  });

  it("stamps unowned rows with the session user id", async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: "session-user" } } } });
    mockGetAll.mockResolvedValue([{ ...makeEntry(1), userId: null }]);

    await backfillMealEntries("session-user");

    expect(mockUpsert.mock.calls[0][0][0].user_id).toBe("session-user");
  });

  it("is idempotent once the done flag is set", async () => {
    mockGetAll.mockResolvedValue([makeEntry(1)]);

    await backfillMealEntries("user-1");
    await backfillMealEntries("user-1");

    expect(mockUpsert).toHaveBeenCalledTimes(1);
  });

  it("stops at the first failed batch and does not set the done flag", async () => {
    mockGetAll.mockResolvedValue(Array.from({ length: 1200 }, (_, i) => makeEntry(i)));
    mockUpsert
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: { message: "rls" } });

    await expect(backfillMealEntries("user-1")).resolves.toBe(false);

    expect(mockUpsert).toHaveBeenCalledTimes(2);
    expect(store["vitia:sync:mealEntriesBackfilled:user-1"]).toBeUndefined();
  });

  it("does nothing without an authenticated session", async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });

    await expect(backfillMealEntries("user-1")).resolves.toBe(false);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("is a no-op when sync is disabled", async () => {
    mockedIsSyncEnabled.mockReturnValue(false);

    await expect(backfillMealEntries("user-1")).resolves.toBe(false);
    expect(mockGetAll).not.toHaveBeenCalled();
  });
});

describe("start / bindSyncToAuth", () => {
  it("does nothing when sync is disabled", () => {
    mockedIsSyncEnabled.mockReturnValue(false);

    start("user-1");
    const unsubscribe = bindSyncToAuth();
    unsubscribe();

    expect(window.addEventListener).not.toHaveBeenCalled();
    expect(mockDrain).not.toHaveBeenCalled();
    expect(authSubscribers).toHaveLength(0);
  });

  it("starts once per user and is idempotent", async () => {
    start("user-1");
    start("user-1");

    expect(window.addEventListener).toHaveBeenCalledTimes(1);
    await new Promise((r) => setTimeout(r, 0));
    expect(mockDrain).toHaveBeenCalledTimes(1);
  });

  it("starts on an authed session and stops on sign out", () => {
    bindSyncToAuth();
    expect(window.addEventListener).toHaveBeenCalledTimes(1);

    authSubscribers[0]({ status: "anon", userId: null });
    expect(window.removeEventListener).toHaveBeenCalledTimes(1);
  });
});

function queuedOp(id: string, userId: string, row: object = makeEntry(1)) {
  return {
    id,
    table: "meal_entries",
    op: "upsert",
    row: JSON.stringify(row),
    userId,
    updatedAt: "x",
  };
}

describe("flush guards", () => {
  it("skips ops queued by another user without warning", async () => {
    mockDrain.mockResolvedValue([queuedOp("q1", "other-user"), queuedOp("q2", "user-1")]);

    await flush();

    expect(mockUpsert).toHaveBeenCalledTimes(1);
    expect(mockRemove).toHaveBeenCalledTimes(1);
    expect(mockRemove).toHaveBeenCalledWith("q2");
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("upserts edits without ignoreDuplicates", async () => {
    mockDrain.mockResolvedValue([queuedOp("q1", "user-1")]);

    await flush();

    expect(mockUpsert.mock.calls[0][1]).not.toHaveProperty("ignoreDuplicates");
  });

  it("does not drain the same ops twice for overlapping calls", async () => {
    mockDrain.mockResolvedValue([queuedOp("q1", "user-1")]);

    await Promise.all([flush(), flush(), flush()]);

    expect(mockDrain).toHaveBeenCalledTimes(1);
    expect(mockUpsert).toHaveBeenCalledTimes(1);
  });

  it("stops processing ops once sync is stopped (user switch)", async () => {
    mockDrain.mockResolvedValue([queuedOp("q1", "user-1"), queuedOp("q2", "user-1")]);
    mockUpsert.mockImplementationOnce(async () => {
      stop();
      return { error: null };
    });

    await flush();

    expect(mockUpsert).toHaveBeenCalledTimes(1);
  });
});

describe("backfill ownership", () => {
  it("uploads only rows with a null or matching userId", async () => {
    mockGetAll.mockResolvedValue([
      { ...makeEntry(1), userId: null },
      { ...makeEntry(2), userId: "user-1" },
      { ...makeEntry(3), userId: "other-user" },
    ]);

    await backfillMealEntries("user-1");

    expect(mockUpsert.mock.calls[0][0].map((r: { id: string }) => r.id)).toEqual(["e1", "e2"]);
  });
});

describe("reconcile", () => {
  const remoteProfile = {
    user_id: "user-1",
    age: 31,
    height_cm: 180,
    weight_kg: 79,
    sex: "male",
    activity_level: "very_active",
    goal: "maintain",
    calorie_goal: 2600,
    protein_goal_g: 150,
    carbs_goal_g: 300,
    fat_goal_g: 70,
    use_manual_goals: false,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-03-01T00:00:00.000Z",
  };

  function mockRemote(opts: {
    profile?: unknown;
    profileError?: unknown;
    entries?: unknown[];
    entriesError?: unknown;
  }) {
    mockFrom.mockImplementation(((table: string) => {
      if (table === "users_profile") {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: opts.profile ?? null,
                error: opts.profileError ?? (opts.profile ? null : { code: "PGRST116" }),
              }),
            }),
          }),
          upsert: mockUpsert,
        };
      }
      return {
        select: () => ({
          eq: async () => ({ data: opts.entries ?? [], error: opts.entriesError ?? null }),
        }),
        upsert: mockUpsert,
      };
    }) as never);
  }

  it("pulls a newer remote profile without enqueueing and keeps its updatedAt", async () => {
    mockRemote({ profile: remoteProfile });
    mockGetProfile.mockResolvedValue({
      id: 1,
      userId: "user-1",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    await reconcile("user-1");

    expect(mockUpsertProfile).not.toHaveBeenCalled();
    expect(mockReplaceProfile).toHaveBeenCalledTimes(1);
    expect(mockReplaceProfile.mock.calls[0][0]).toMatchObject({
      heightCm: 180,
      updatedAt: "2026-03-01T00:00:00.000Z",
    });
  });

  it("pulls remote meal entries mapped to the local shape", async () => {
    mockRemote({
      entries: [
        {
          id: "r1",
          user_id: "user-1",
          date: "2026-01-01",
          meal_type: "dinner",
          food_id: "f",
          food_name: "Soup",
          quantity_g: 200,
          calories: 100,
          protein_g: 5,
          carbs_g: 10,
          fat_g: 2,
          logged_at: "2026-01-01T20:00:00.000Z",
          updated_at: null,
        },
      ],
    });

    await reconcile("user-1");

    expect(mockDexie.mealEntries.insert).toHaveBeenCalledWith(
      expect.objectContaining({ id: "r1", mealType: "dinner", foodName: "Soup", quantityG: 200 })
    );
  });

  it("warns when pushing entries fails and does not push rows of other users", async () => {
    mockRemote({});
    mockDexie.mealEntries.getByDate.mockImplementation(async (d: string) =>
      d === new Date().toISOString().slice(0, 10)
        ? [
            { ...makeEntry(1), userId: "user-1" },
            { ...makeEntry(2), userId: "other-user" },
          ]
        : []
    );
    mockUpsert.mockResolvedValue({ error: { message: "rls" } });

    await reconcile("user-1");

    expect(mockUpsert.mock.calls[0][0].map((r: { id: string }) => r.id)).toEqual(["e1"]);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("meal_entries push failed"),
      expect.anything()
    );
  });

  it("does not ingest remote demo rows locally", async () => {
    const remote = (id: string, food_id: string) => ({
      id,
      user_id: "user-1",
      date: "2025-01-01",
      meal_type: "lunch",
      food_id,
      food_name: "X",
      quantity_g: 1,
      calories: 1,
      protein_g: 1,
      carbs_g: 1,
      fat_g: 1,
      logged_at: "2025-01-01T10:00:00.000Z",
      updated_at: null,
    });
    mockRemote({ entries: [remote("r-demo", "demo-food-salad"), remote("r-real", "off-1")] });

    await reconcile("user-1");

    const inserted = mockDexie.mealEntries.insert.mock.calls.map((c) => c[0].id);
    expect(inserted).toEqual(["r-real"]);
  });

  it("never pushes demo meal entries in the 30-day push", async () => {
    mockRemote({});
    mockDexie.mealEntries.getByDate.mockImplementation(async (d: string) =>
      d === new Date().toISOString().slice(0, 10)
        ? [{ ...makeEntry(1), foodId: "demo-food-salad" }, makeEntry(2)]
        : []
    );

    await reconcile("user-1");

    expect(mockUpsert.mock.calls[0][0].map((r: { id: string }) => r.id)).toEqual(["e2"]);
  });

  it("warns when the remote entries fetch fails", async () => {
    mockRemote({ entriesError: { message: "boom" } });

    await reconcile("user-1");

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("meal_entries fetch failed"),
      expect.anything()
    );
  });

  it("does not push a local profile owned by another user", async () => {
    mockRemote({});
    mockGetProfile.mockResolvedValue({
      id: 1,
      userId: "other-user",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    await reconcile("user-1");

    expect(mockUpsert).not.toHaveBeenCalled();
  });
});

describe("demo data protection", () => {
  const demoEntry = { ...makeEntry(1), foodId: "demo-food-oatmeal", foodName: "Yogur griego" };

  it("backfill skips demo entries", async () => {
    mockGetAll.mockResolvedValue([demoEntry, makeEntry(2)]);

    await backfillMealEntries("user-1");

    expect(mockUpsert.mock.calls[0][0].map((r: { id: string }) => r.id)).toEqual(["e2"]);
  });

  it("flush drops queued demo ops (snake_case and legacy camelCase) without upserting", async () => {
    const op = (id: string, row: unknown) => ({
      id,
      table: "meal_entries",
      op: "upsert",
      row: JSON.stringify(row),
      userId: "user-1",
      updatedAt: "x",
    });
    mockDrain.mockResolvedValue([
      op("q-snake", { id: "e1", food_id: "demo-food-salad", user_id: "user-1" }),
      op("q-camel", demoEntry),
      op("q-real", makeEntry(3)),
    ]);

    await flush();

    expect(mockRemove).toHaveBeenCalledWith("q-snake");
    expect(mockRemove).toHaveBeenCalledWith("q-camel");
    expect(mockRemove).toHaveBeenCalledWith("q-real");
    expect(mockUpsert).toHaveBeenCalledTimes(1);
    expect(mockUpsert.mock.calls[0][0].id).toBe("e3");
  });

  describe("kill switch (seed marker present)", () => {
    beforeEach(() => {
      store["vitia.demoSeed"] = "v1";
    });

    it("blocks start, bindSyncToAuth, sync, flush, backfill and reconcile", async () => {
      start("user-1");
      const unsubscribe = bindSyncToAuth();
      unsubscribe();
      await flush();
      await expect(backfillMealEntries("user-1")).resolves.toBe(false);
      await reconcile("user-1");
      await sync("user-1");

      expect(window.addEventListener).not.toHaveBeenCalled();
      expect(authSubscribers).toHaveLength(0);
      expect(mockGetSession).not.toHaveBeenCalled();
      expect(mockDrain).not.toHaveBeenCalled();
      expect(mockGetAll).not.toHaveBeenCalled();
      expect(mockUpsert).not.toHaveBeenCalled();
      expect(mockGetProfile).not.toHaveBeenCalled();
      expect(mockCleanupDemoData).not.toHaveBeenCalled();
    });

    it("also engages when only the seed-started marker exists", async () => {
      Reflect.deleteProperty(store, "vitia.demoSeed");
      store["vitia.demoSeedStarted"] = "1";

      await sync("user-1");

      expect(mockGetSession).not.toHaveBeenCalled();
      expect(mockDrain).not.toHaveBeenCalled();
    });

    it("warns once per boot that sync is disabled, without clearing markers", async () => {
      resetDemoWarningForTests();

      await flush();
      await flush();
      await reconcile("user-1");

      const calls = warnSpy.mock.calls.filter((c) => String(c[0]).includes("demo seed"));
      expect(calls).toHaveLength(1);
      expect(String(calls[0][0])).toContain("vitia.demoSeedStarted");
      expect(store["vitia.demoSeed"]).toBe("v1");
    });

    it("never pushes a demo profile on reconcile", async () => {
      mockGetProfile.mockResolvedValue({
        id: 1,
        userId: null,
        updatedAt: "2026-01-01T00:00:00.000Z",
      });

      await reconcile("user-1");

      expect(mockUpsert).not.toHaveBeenCalled();
    });
  });

  it("sync runs the demo cleanup before flushing when a session exists", async () => {
    const order: string[] = [];
    mockCleanupDemoData.mockImplementation(async () => {
      order.push("cleanup");
    });
    mockDrain.mockImplementation(async () => {
      order.push("drain");
      return [];
    });

    await sync("user-1");

    expect(order.slice(0, 2)).toEqual(["cleanup", "drain"]);
  });
});
