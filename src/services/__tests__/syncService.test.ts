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
const mockGoalList = jest.fn();
const mockGoalReplace = jest.fn();
const mockGoalAdopt = jest.fn();
const mockGoalRemove = jest.fn();
jest.mock("@/db/repos/goalHistory", () => ({
  adoptLocalOwned: (...a: unknown[]) => mockGoalAdopt(...a),
  remove: (...a: unknown[]) => mockGoalRemove(...a),
  list: (...a: unknown[]) => mockGoalList(...a),
  replaceFromRemote: (...a: unknown[]) => mockGoalReplace(...a),
}));
jest.mock("@/stores/useGoalHistoryStore", () => ({
  useGoalHistoryStore: { getState: () => ({ load: jest.fn() }) },
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
let enqueueListener: (() => void) | null = null;
jest.mock("@/src/services/syncQueue", () => ({
  drain: (...a: unknown[]) => mockDrain(...a),
  remove: (...a: unknown[]) => mockRemove(...a),
  setOnEnqueue: (cb: (() => void) | null) => {
    enqueueListener = cb;
  },
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
import { canSeedGoalHistory } from "@/src/services/goalHistoryService";
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

/**
 * Installs a per-table supabase fake. goal_history always resolves to an empty
 * remote so tests focused on other tables don't have to model it.
 */
function mockFromTables(impl: (table: string) => unknown) {
  mockFrom.mockImplementation(((table: string) =>
    table === "goal_history"
      ? {
          select: () => ({ eq: async () => ({ data: [], error: null }) }),
          upsert: mockUpsert,
        }
      : impl(table)) as never);
}

let store: Record<string, string>;
let warnSpy: jest.SpyInstance;
let errorSpy: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  authSubscribers.length = 0;
  enqueueListener = null;
  authState = { status: "authed", userId: "user-1" };
  store = {};
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
    removeItem: (k: string) => {
      delete store[k];
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
  mockGoalList.mockResolvedValue([]);
  mockGoalAdopt.mockResolvedValue(undefined);
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
    goalHistory?: unknown[];
    goalHistoryError?: unknown;
  }) {
    mockFrom.mockImplementation(((table: string) => {
      if (table === "goal_history") {
        return {
          select: () => ({
            eq: async () => ({
              data: opts.goalHistory ?? [],
              error: opts.goalHistoryError ?? null,
            }),
          }),
          upsert: mockUpsert,
        };
      }
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

  describe("goal_history", () => {
    const remoteGoal = (effective_from: string, updated_at: string, calorie_goal = 2000) => ({
      user_id: "user-1",
      effective_from,
      calorie_goal,
      protein_goal_g: 150,
      carbs_goal_g: 200,
      fat_goal_g: 60,
      use_manual_goals: false,
      created_at: updated_at,
      updated_at,
    });
    const localGoal = (effectiveFrom: string, updatedAt: string, calorieGoal = 2000) => ({
      effectiveFrom,
      userId: "user-1",
      calorieGoal,
      proteinGoalG: 150,
      carbsGoalG: 200,
      fatGoalG: 60,
      useManualGoals: false,
      createdAt: updatedAt,
      updatedAt,
    });
    const goalUpserts = () =>
      mockUpsert.mock.calls.filter(
        ([, options]) => options?.onConflict === "user_id,effective_from"
      );

    it("pulls remote-only days without enqueueing", async () => {
      mockRemote({ goalHistory: [remoteGoal("2026-02-01", "2026-02-01T00:00:00.000Z")] });

      await reconcile("user-1");

      expect(mockGoalReplace).toHaveBeenCalledTimes(1);
      expect(mockGoalReplace.mock.calls[0][0]).toEqual([
        expect.objectContaining({
          effectiveFrom: "2026-02-01",
          userId: "user-1",
          updatedAt: "2026-02-01T00:00:00.000Z",
        }),
      ]);
      expect(goalUpserts()).toHaveLength(0);
    });

    it("pushes local-only days, one remote row per effective_from", async () => {
      mockRemote({});
      mockGoalList.mockResolvedValue([
        localGoal("2026-01-01", "2026-01-01T00:00:00.000Z"),
        localGoal("2026-02-01", "2026-02-01T00:00:00.000Z"),
      ]);

      await reconcile("user-1");

      expect(goalUpserts()).toHaveLength(1);
      const [rows, options] = goalUpserts()[0];
      expect(options).toEqual({ onConflict: "user_id,effective_from" });
      expect(rows.map((r: { effective_from: string }) => r.effective_from)).toEqual([
        "2026-01-01",
        "2026-02-01",
      ]);
      expect(rows[0].user_id).toBe("user-1");
      expect(mockGoalReplace).not.toHaveBeenCalled();
    });

    it("resolves a day present on both sides by newest updated_at", async () => {
      mockRemote({
        goalHistory: [
          remoteGoal("2026-01-01", "2026-03-01T00:00:00.000Z", 2500), // remote newer
          remoteGoal("2026-02-01", "2026-01-01T00:00:00.000Z", 1900), // local newer
        ],
      });
      mockGoalList.mockResolvedValue([
        localGoal("2026-01-01", "2026-02-01T00:00:00.000Z", 2000),
        localGoal("2026-02-01", "2026-02-15T00:00:00.000Z", 2100),
      ]);

      await reconcile("user-1");

      expect(mockGoalReplace.mock.calls[0][0]).toEqual([
        expect.objectContaining({ effectiveFrom: "2026-01-01", calorieGoal: 2500 }),
      ]);
      const [rows] = goalUpserts()[0];
      expect(rows).toEqual([
        expect.objectContaining({ effective_from: "2026-02-01", calorie_goal: 2100 }),
      ]);
    });

    it("only reads the session user's local history (never another account's rows)", async () => {
      mockRemote({});

      await reconcile("user-1");

      expect(mockGoalList).toHaveBeenCalledWith("user-1");
      expect(mockGoalList).not.toHaveBeenCalledWith();
    });

    it("always adopts signed-out history per day, whatever the cloud/local state", async () => {
      mockRemote({ goalHistory: [remoteGoal("2026-02-01", "2026-02-01T00:00:00.000Z")] });
      mockGoalList.mockResolvedValue([localGoal("2026-01-01", "2026-01-01T00:00:00.000Z")]);

      await reconcile("user-1");

      expect(mockGoalAdopt).toHaveBeenCalledWith("user-1");
    });

    it("adopts before reading the user's history so adopted days are pushed", async () => {
      mockRemote({});
      const order: string[] = [];
      mockGoalAdopt.mockImplementation(async () => void order.push("adopt"));
      mockGoalList.mockImplementation(async () => {
        order.push("list");
        return [];
      });

      await reconcile("user-1");

      expect(order[0]).toBe("adopt");
    });

    it("after the pull, drops a pending seed when the cloud has history", async () => {
      store["vitia:goalHistory:pendingSeed:user-1"] = "2026-01-01";
      mockRemote({ goalHistory: [remoteGoal("2026-02-01", "2026-02-01T00:00:00.000Z")] });
      mockGoalList.mockResolvedValue([localGoal("2026-01-01", "2026-01-01T00:00:00.000Z")]);

      await reconcile("user-1");

      expect(mockGoalRemove).toHaveBeenCalledWith("2026-01-01", "user-1");
      expect(store["vitia:goalHistory:pendingSeed:user-1"]).toBeUndefined();
    });

    it("keeps (and pushes) a pending seed when the cloud is empty", async () => {
      store["vitia:goalHistory:pendingSeed:user-1"] = "2026-01-01";
      mockRemote({});
      mockGoalList.mockResolvedValue([localGoal("2026-01-01", "2026-01-01T00:00:00.000Z")]);

      await reconcile("user-1");

      expect(mockGoalRemove).not.toHaveBeenCalled();
      expect(store["vitia:goalHistory:pendingSeed:user-1"]).toBeUndefined();
      expect(goalUpserts()[0][0]).toEqual([
        expect.objectContaining({ effective_from: "2026-01-01" }),
      ]);
    });

    it("re-gates seeding after a same-user sign-out / sign-in", async () => {
      mockRemote({});
      start("user-1");
      await reconcile("user-1");
      expect(canSeedGoalHistory()).toBe(true);

      stop(); // sign-out (auth -> anon)
      expect(canSeedGoalHistory()).toBe(false);
    });

    it("compares a zone-less local timestamp as UTC, not local time (non-UTC TZ)", async () => {
      // 12:00 UTC on both sides. Read as local time (UTC-3) the zone-less local
      // value would look 3h NEWER and wrongly overwrite the remote row.
      mockRemote({
        goalHistory: [remoteGoal("2026-02-01", "2026-02-01T12:00:00.000Z", 2500)],
      });
      mockGoalList.mockResolvedValue([localGoal("2026-02-01", "2026-02-01 12:00:00", 2000)]);

      await reconcile("user-1");

      expect(goalUpserts()).toHaveLength(0);
      expect(mockGoalReplace).not.toHaveBeenCalled();

      // 12:00 UTC local vs 11:00 UTC remote: local is genuinely newer and wins.
      mockRemote({
        goalHistory: [remoteGoal("2026-02-01", "2026-02-01T11:00:00.000Z", 2500)],
      });
      await reconcile("user-1");
      expect(goalUpserts()).toHaveLength(1);
    });

    it("drops malformed remote rows with a warning and keeps the valid ones", async () => {
      mockRemote({
        goalHistory: [
          remoteGoal("2026-02-01", "2026-02-01T00:00:00.000Z"),
          remoteGoal("2026-02-30", "2026-02-01T00:00:00.000Z"),
          { ...remoteGoal("2026-03-01", "2026-03-01T00:00:00.000Z"), calorie_goal: -5 },
          { ...remoteGoal("2026-04-01", "2026-04-01T00:00:00.000Z"), protein_goal_g: "150" },
          remoteGoal("2026-05-01", "not a date"),
          { ...remoteGoal("2026-06-01", "2026-06-01T00:00:00.000Z"), user_id: "someone-else" },
        ],
      });

      await reconcile("user-1");

      expect(mockGoalReplace.mock.calls[0][0]).toEqual([
        expect.objectContaining({ effectiveFrom: "2026-02-01" }),
      ]);
      expect(warnSpy).toHaveBeenCalledTimes(5);
    });

    it("keeps reconciling meal entries when the goal_history fetch fails", async () => {
      mockRemote({ goalHistoryError: { message: "boom" } });

      await reconcile("user-1");

      expect(mockGoalReplace).not.toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
    });

    it("upserts queued goal_history ops on (user_id, effective_from)", async () => {
      mockDrain.mockResolvedValue([
        {
          id: "q1",
          table: "goal_history",
          op: "upsert",
          row: JSON.stringify(remoteGoal("2026-02-01", "2026-02-01T00:00:00.000Z")),
          userId: "user-1",
          updatedAt: "2026-02-01T00:00:00.000Z",
        },
      ]);

      await flush();

      const [payload, options] = mockUpsert.mock.calls[0];
      expect(payload).toMatchObject({ user_id: "user-1", effective_from: "2026-02-01" });
      expect(options).toEqual({ onConflict: "user_id,effective_from" });
      expect(mockRemove).toHaveBeenCalledWith("q1");
    });
  });

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

describe("flush ordering and compaction", () => {
  const calls: string[] = [];
  let failDelete: ((label: string) => boolean) | null = null;

  beforeEach(() => {
    failDelete = null;
  });

  function mockRemoteWithDelete() {
    calls.length = 0;
    mockUpsert.mockImplementation(async (payload: { id: string }) => {
      calls.push(`upsert:${payload.id}`);
      return { error: null };
    });
    mockFrom.mockImplementation((() => ({
      upsert: mockUpsert,
      delete: () => {
        const filters: Record<string, string> = {};
        const idx = calls.push("delete:?") - 1;
        const label = () =>
          filters.id ? `delete:${filters.id}` : `bulk:${filters.date}:${filters.meal_type}`;
        const makeChain = (
          result: { error: unknown } = { error: null }
        ): Promise<unknown> & { eq: (k: string, v: string) => unknown } =>
          Object.assign(Promise.resolve(result), {
            eq: (k: string, v: string) => {
              filters[k] = v;
              calls[idx] = label();
              return makeChain(failDelete?.(label()) ? { error: { message: "boom" } } : undefined);
            },
          });
        return makeChain();
      },
    })) as never);
  }

  const op = (
    id: string,
    kind: "upsert" | "delete",
    updatedAt: string,
    row: object,
    userId = "user-1"
  ) => ({
    id,
    table: "meal_entries",
    op: kind,
    row: JSON.stringify(row),
    userId,
    updatedAt,
  });

  const up = (qid: string, rowId: string, t: string) =>
    op(qid, "upsert", t, { ...makeEntry(1), id: rowId });

  it("never sends a superseded upsert and deletes after the surviving ops in order", async () => {
    mockRemoteWithDelete();
    mockDrain.mockResolvedValue([
      op("c", "delete", "2026-01-01T00:00:03.000Z", { id: "X" }),
      up("b", "Y", "2026-01-01T00:00:02.000Z"),
      up("a", "X", "2026-01-01T00:00:01.000Z"),
    ]);

    await flush();

    expect(calls).toEqual(["upsert:Y", "delete:X"]);
    expect(mockRemove).toHaveBeenCalledWith("a");
    expect(mockRemove.mock.calls.map((c) => c[0]).sort()).toEqual(["a", "b", "c"]);
  });

  it("sends a bulk delete after earlier ops and drops matching upserts", async () => {
    mockRemoteWithDelete();
    mockDrain.mockResolvedValue([
      op("z", "delete", "2026-01-01T00:00:05.000Z", {
        date: "2025-01-01",
        meal_type: "lunch",
        bulk: true,
      }),
      up("a", "X", "2026-01-01T00:00:01.000Z"),
    ]);

    await flush();

    expect(calls).toEqual(["bulk:2025-01-01:lunch"]);
    expect(mockRemove).toHaveBeenCalledWith("a");
  });

  it("keeps a failing op queued while the others proceed", async () => {
    mockRemoteWithDelete();
    mockUpsert.mockImplementation(async (payload: { id: string }) => {
      calls.push(`upsert:${payload.id}`);
      return payload.id === "A" ? { error: { message: "boom" } } : { error: null };
    });
    mockDrain.mockResolvedValue([
      up("q1", "A", "2026-01-01T00:00:01.000Z"),
      up("q2", "B", "2026-01-01T00:00:02.000Z"),
    ]);

    await flush();

    expect(calls).toEqual(["upsert:A", "upsert:B"]);
    expect(mockRemove).toHaveBeenCalledTimes(1);
    expect(mockRemove).toHaveBeenCalledWith("q2");
  });

  it("a failed single delete holds back later upserts of the same row", async () => {
    mockRemoteWithDelete();
    failDelete = (l) => l === "delete:X";
    mockDrain.mockResolvedValue([
      op("d", "delete", "2026-01-01T00:00:02.000Z", { id: "X" }),
      up("uX", "X", "2026-01-01T00:00:03.000Z"),
      op("uY", "upsert", "2026-01-01T00:00:04.000Z", {
        ...makeEntry(2),
        id: "Y",
        mealType: "dinner",
      }),
    ]);

    await flush();

    expect(calls).toEqual(["delete:X", "upsert:Y"]);
    expect(mockRemove.mock.calls.map((c) => c[0])).toEqual(["uY"]);
  });

  it("a failed bulk delete holds back later upserts of that slot only", async () => {
    mockRemoteWithDelete();
    failDelete = (l) => l.startsWith("bulk:");
    mockDrain.mockResolvedValue([
      op("bulk", "delete", "2026-01-01T00:00:02.000Z", {
        date: "2025-01-01",
        meal_type: "lunch",
        bulk: true,
      }),
      up("sameSlot", "A", "2026-01-01T00:00:03.000Z"),
      op("otherSlot", "upsert", "2026-01-01T00:00:04.000Z", {
        ...makeEntry(2),
        id: "B",
        mealType: "dinner",
      }),
    ]);

    await flush();

    expect(calls).toEqual(["bulk:2025-01-01:lunch", "upsert:B"]);
    expect(mockRemove.mock.calls.map((c) => c[0])).toEqual(["otherSlot"]);
  });

  it("never sends or compacts another user's ops in a shuffled multi-user queue", async () => {
    mockRemoteWithDelete();
    mockDrain.mockResolvedValue([
      op("o2", "delete", "2026-01-01T00:00:03.000Z", { id: "X" }, "other-user"),
      up("m2", "Y", "2026-01-01T00:00:02.000Z"),
      op("o1", "upsert", "2026-01-01T00:00:01.000Z", { ...makeEntry(1), id: "X" }, "other-user"),
      up("m1", "X", "2026-01-01T00:00:01.000Z"),
    ]);

    await flush();

    expect(calls).toEqual(["upsert:X", "upsert:Y"]);
    expect(mockRemove.mock.calls.map((c) => c[0])).toEqual(["m1", "m2"]);
  });

  it("sends only one upsert when two edits of a row share a timestamp", async () => {
    mockRemoteWithDelete();
    mockDrain.mockResolvedValue([
      up("b", "X", "2026-01-01T00:00:01.000Z"),
      up("a", "X", "2026-01-01T00:00:01.000Z"),
    ]);

    await flush();

    expect(calls).toEqual(["upsert:X"]);
    expect(mockRemove.mock.calls.map((c) => c[0]).sort()).toEqual(["a", "b"]);
  });

  it("logs and continues when removing a superseded op fails", async () => {
    mockRemoteWithDelete();
    mockRemove.mockRejectedValueOnce(new Error("idb"));
    mockDrain.mockResolvedValue([
      up("a", "X", "2026-01-01T00:00:01.000Z"),
      op("d", "delete", "2026-01-01T00:00:02.000Z", { id: "X" }),
    ]);

    await flush();

    expect(warnSpy).toHaveBeenCalled();
    expect(calls).toEqual(["delete:X"]);
    expect(mockRemove).toHaveBeenCalledWith("d");
  });
});

describe("flush after writes (debounced)", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  async function startAndSettle() {
    start("user-1");
    await jest.advanceTimersByTimeAsync(0);
    mockDrain.mockClear();
  }

  it("registers a listener on start and unregisters on stop", () => {
    start("user-1");
    expect(enqueueListener).toBeInstanceOf(Function);
    stop();
    expect(enqueueListener).toBeNull();
  });

  it("collapses several enqueues within the window into one flush", async () => {
    await startAndSettle();

    enqueueListener?.();
    await jest.advanceTimersByTimeAsync(300);
    enqueueListener?.();
    enqueueListener?.();
    await jest.advanceTimersByTimeAsync(799);
    expect(mockDrain).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(2);

    expect(mockDrain).toHaveBeenCalledTimes(1);
  });

  it("cancels the pending flush on stop", async () => {
    await startAndSettle();

    enqueueListener?.();
    stop();
    await jest.advanceTimersByTimeAsync(2000);

    expect(mockDrain).not.toHaveBeenCalled();
  });

  it("runs a follow-up flush for ops enqueued during an in-flight flush", async () => {
    await startAndSettle();
    let release: () => void = () => {};
    mockDrain.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = () => resolve([]);
        })
    );

    enqueueListener?.();
    await jest.advanceTimersByTimeAsync(900); // first flush now blocked in drain
    expect(mockDrain).toHaveBeenCalledTimes(1);

    enqueueListener?.(); // enqueue while the flush is in flight
    await jest.advanceTimersByTimeAsync(900);
    expect(mockDrain).toHaveBeenCalledTimes(1); // still waiting on the first

    release();
    await jest.advanceTimersByTimeAsync(0);
    await jest.advanceTimersByTimeAsync(0);

    expect(mockDrain).toHaveBeenCalledTimes(2);
  });

  it("flushes within the max wait even when writes never pause", async () => {
    await startAndSettle();

    for (let t = 0; t < 4500; t += 500) {
      enqueueListener?.();
      await jest.advanceTimersByTimeAsync(500);
    }
    expect(mockDrain).not.toHaveBeenCalled();

    for (let t = 0; t < 1000 && mockDrain.mock.calls.length === 0; t += 100) {
      enqueueListener?.();
      await jest.advanceTimersByTimeAsync(100);
    }

    expect(mockDrain).toHaveBeenCalledTimes(1);
  });

  it("does not run a stale follow-up flush after stop() and restart", async () => {
    await startAndSettle();
    let release: () => void = () => {};
    mockDrain.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = () => resolve([]);
        })
    );
    enqueueListener?.();
    await jest.advanceTimersByTimeAsync(900);
    enqueueListener?.();
    await jest.advanceTimersByTimeAsync(900); // marks a follow-up as wanted

    stop();
    start("user-1"); // joins the in-flight flush
    release();
    await jest.advanceTimersByTimeAsync(0);
    await jest.advanceTimersByTimeAsync(0);
    await jest.advanceTimersByTimeAsync(0);

    expect(mockDrain).toHaveBeenCalledTimes(1);
  });

  it("collapses two enqueue bursts during one in-flight flush into one follow-up", async () => {
    await startAndSettle();
    let release: () => void = () => {};
    mockDrain.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = () => resolve([]);
        })
    );
    enqueueListener?.();
    await jest.advanceTimersByTimeAsync(900);

    enqueueListener?.();
    await jest.advanceTimersByTimeAsync(900);
    enqueueListener?.();
    await jest.advanceTimersByTimeAsync(900);

    release();
    for (let i = 0; i < 5; i++) await jest.advanceTimersByTimeAsync(0);

    expect(mockDrain).toHaveBeenCalledTimes(2);
  });
});

describe("reconcile with pending deletes", () => {
  function remoteRow(id: string, mealType = "lunch", date = "2026-01-01") {
    return {
      id,
      user_id: "user-1",
      date,
      meal_type: mealType,
      food_id: "f",
      food_name: "Food",
      quantity_g: 100,
      calories: 100,
      protein_g: 1,
      carbs_g: 1,
      fat_g: 1,
      logged_at: "2026-01-01T10:00:00.000Z",
      updated_at: null,
    };
  }

  function mockEntries(entries: unknown[]) {
    mockFromTables(((table: string) =>
      table === "users_profile"
        ? {
            select: () => ({
              eq: () => ({ single: async () => ({ data: null, error: { code: "PGRST116" } }) }),
            }),
            upsert: mockUpsert,
          }
        : {
            select: () => ({ eq: async () => ({ data: entries, error: null }) }),
            upsert: mockUpsert,
          }) as never);
  }

  const del = (id: string, row: object, userId = "user-1") => ({
    id,
    table: "meal_entries",
    op: "delete",
    row: JSON.stringify(row),
    userId,
    updatedAt: "2026-01-01T00:00:00.000Z",
  });

  it("does not re-insert a remote row with a pending single delete", async () => {
    mockEntries([remoteRow("zombie"), remoteRow("keep")]);
    mockDrain.mockResolvedValue([del("q1", { id: "zombie" })]);

    await reconcile("user-1");

    const inserted = mockDexie.mealEntries.insert.mock.calls.map((c) => c[0].id);
    expect(inserted).toEqual(["keep"]);
  });

  it("does not re-insert rows matching a pending bulk delete", async () => {
    mockEntries([
      remoteRow("a", "lunch", "2026-01-01"),
      remoteRow("b", "dinner", "2026-01-01"),
      remoteRow("c", "lunch", "2026-01-02"),
    ]);
    mockDrain.mockResolvedValue([
      del("q1", { date: "2026-01-01", meal_type: "lunch", bulk: true }),
    ]);

    await reconcile("user-1");

    const inserted = mockDexie.mealEntries.insert.mock.calls.map((c) => c[0].id).sort();
    expect(inserted).toEqual(["b", "c"]);
  });

  it("still inserts a remote-only row when no delete is pending", async () => {
    mockEntries([remoteRow("r1")]);

    await reconcile("user-1");

    expect(mockDexie.mealEntries.insert).toHaveBeenCalledWith(
      expect.objectContaining({ id: "r1" })
    );
  });

  it("ignores pending deletes owned by another user", async () => {
    mockEntries([remoteRow("r1")]);
    mockDrain.mockResolvedValue([del("q1", { id: "r1" }, "other-user")]);

    await reconcile("user-1");

    expect(mockDexie.mealEntries.insert).toHaveBeenCalledTimes(1);
  });

  it("honours a pending bulk delete with a legacy camelCase mealType", async () => {
    mockEntries([remoteRow("a", "lunch", "2026-01-01"), remoteRow("b", "dinner", "2026-01-01")]);
    mockDrain.mockResolvedValue([del("q1", { date: "2026-01-01", mealType: "lunch", bulk: true })]);

    await reconcile("user-1");

    expect(mockDexie.mealEntries.insert.mock.calls.map((c) => c[0].id)).toEqual(["b"]);
  });

  it("does not resurrect a row whose delete was delivered mid-reconcile", async () => {
    // The delete is still queued until the remote fetch happens, then "flushed".
    let fetched = false;
    mockFromTables(((table: string) =>
      table === "users_profile"
        ? {
            select: () => ({
              eq: () => ({ single: async () => ({ data: null, error: { code: "PGRST116" } }) }),
            }),
            upsert: mockUpsert,
          }
        : {
            select: () => ({
              eq: async () => {
                fetched = true;
                return { data: [remoteRow("zombie")], error: null };
              },
            }),
            upsert: mockUpsert,
          }) as never);
    mockDrain.mockImplementation(async () => (fetched ? [] : [del("q1", { id: "zombie" })]));

    await reconcile("user-1");

    expect(mockDexie.mealEntries.insert).not.toHaveBeenCalled();
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("runs one flush after a reconcile when flushes were requested during it", async () => {
    start("user-1");
    for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0));
    mockDrain.mockClear();

    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    mockFromTables(((table: string) =>
      table === "users_profile"
        ? {
            select: () => ({
              eq: () => ({ single: async () => ({ data: null, error: { code: "PGRST116" } }) }),
            }),
            upsert: mockUpsert,
          }
        : {
            select: () => ({
              eq: async () => {
                await gate;
                return { data: [], error: null };
              },
            }),
            upsert: mockUpsert,
          }) as never);

    const running = reconcile("user-1");
    for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0));
    expect(mockDrain).toHaveBeenCalledTimes(1); // pending-delete snapshot only

    await flush();
    await flush();
    expect(mockDrain).toHaveBeenCalledTimes(1); // flushes held back

    release();
    await running;
    for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0));

    // snapshot before + snapshot after + exactly one deferred flush
    expect(mockDrain).toHaveBeenCalledTimes(3);
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

  it("sync runs the demo cleanup and flushes again when it removed rows", async () => {
    const order: string[] = [];
    mockCleanupDemoData.mockImplementation(async () => {
      order.push("cleanup");
      return 2;
    });
    mockDrain.mockImplementation(async () => {
      order.push("drain");
      return [];
    });

    await sync("user-1");

    expect(mockCleanupDemoData).toHaveBeenCalledWith("user-1");
    expect(order.slice(0, 3)).toEqual(["drain", "cleanup", "drain"]);
  });
});
