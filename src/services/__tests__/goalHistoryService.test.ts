const mockStore = new Map<string, Record<string, unknown>>();
jest.mock("@/db/repos/goalHistory", () => ({
  list: jest.fn(async () =>
    [...mockStore.values()].sort((a, b) =>
      (a.effectiveFrom as string).localeCompare(b.effectiveFrom as string)
    )
  ),
  remove: jest.fn(async (day: string) => {
    mockStore.delete(day);
  }),
  // Same-day overwrite, like the real repos
  record: jest.fn(async (data: Record<string, unknown>) => {
    mockStore.set(data.effectiveFrom as string, data);
    return data;
  }),
}));

let mockSyncEnabled = false;
jest.mock("@/src/lib/supabase", () => ({ isSyncEnabled: () => mockSyncEnabled }));
jest.mock("@/src/services/demoGuard", () => ({ isDemoDevice: () => false }));
let mockAuthUserId: string | null = null;
jest.mock("@/src/stores/useAuthStore", () => ({
  useAuthStore: { getState: () => ({ userId: mockAuthUserId }) },
}));

const mockGetAllMeals = jest.fn();
jest.mock("@/db/repos/mealEntries", () => ({
  getAll: (...a: unknown[]) => mockGetAllMeals(...a),
}));

import * as goalHistoryRepo from "@/db/repos/goalHistory";
import type { UserProfile } from "@/db/schema";
import {
  backfillGoalHistory,
  markGoalHistoryReconciled,
  recordGoalChange,
  repairGoalGap,
  resetGoalHistoryReconciledForTests,
  resolvePendingGoalSeed,
} from "@/src/services/goalHistoryService";

const profile: UserProfile = {
  id: 1,
  userId: null,
  age: 30,
  heightCm: 175,
  weightKg: 70,
  sex: "male",
  activityLevel: "moderately_active",
  goal: "maintain",
  calorieGoal: 2200,
  proteinGoalG: 150,
  carbsGoalG: 250,
  fatGoalG: 70,
  useManualGoals: false,
  createdAt: "2026-01-15T12:00:00.000Z",
  updatedAt: "2026-01-15T12:00:00.000Z",
};

const meal = (date: string) => ({ date });

const mockLocalStorage = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => mockLocalStorage.get(k) ?? null,
  setItem: (k: string, v: string) => void mockLocalStorage.set(k, v),
  removeItem: (k: string) => void mockLocalStorage.delete(k),
};

beforeEach(() => {
  mockLocalStorage.clear();
  jest.clearAllMocks();
  mockStore.clear();
  mockSyncEnabled = false;
  mockAuthUserId = null;
  resetGoalHistoryReconciledForTests();
  mockGetAllMeals.mockResolvedValue([]);
});

describe("backfillGoalHistory", () => {
  it("seeds one entry with the current goals dated at the earliest meal entry", async () => {
    mockGetAllMeals.mockResolvedValue([meal("2026-03-02"), meal("2026-02-10"), meal("2026-02-20")]);

    expect(await backfillGoalHistory(profile)).toBe(true);

    expect(goalHistoryRepo.record).toHaveBeenCalledTimes(1);
    expect(goalHistoryRepo.record).toHaveBeenCalledWith(
      {
        effectiveFrom: "2026-02-10",
        calorieGoal: 2200,
        proteinGoalG: 150,
        carbsGoalG: 250,
        fatGoalG: 70,
        useManualGoals: false,
      },
      "local"
    );
  });

  it("falls back to the profile createdAt local date when there are no meal entries", async () => {
    await backfillGoalHistory(profile);

    expect(goalHistoryRepo.record).toHaveBeenCalledWith(
      expect.objectContaining({ effectiveFrom: "2026-01-15" }),
      "local"
    );
  });

  it("is idempotent: does nothing once the history has an entry", async () => {
    await backfillGoalHistory(profile);
    const second = await backfillGoalHistory({ ...profile, calorieGoal: 1800 });

    expect(second).toBe(false);
    expect(goalHistoryRepo.record).toHaveBeenCalledTimes(1);
    expect(mockStore.size).toBe(1);
  });
});

describe("recordGoalChange", () => {
  it("records the initial entry for a first-ever profile (no previous)", async () => {
    expect(await recordGoalChange(null, profile, "2026-03-10")).toBe(true);

    expect(goalHistoryRepo.record).toHaveBeenCalledWith(
      expect.objectContaining({ effectiveFrom: "2026-03-10", calorieGoal: 2200 }),
      "local"
    );
  });

  it("does not record when the goals did not change", async () => {
    const next = { ...profile, weightKg: 71, updatedAt: "2026-03-10T00:00:00.000Z" };

    expect(await recordGoalChange(profile, next, "2026-03-10")).toBe(false);
    expect(goalHistoryRepo.record).not.toHaveBeenCalled();
  });

  it("records when any tracked goal field changes", async () => {
    for (const patch of [
      { calorieGoal: 2300 },
      { proteinGoalG: 160 },
      { carbsGoalG: 260 },
      { fatGoalG: 80 },
      { useManualGoals: true },
    ]) {
      mockStore.clear();
      jest.clearAllMocks();
      expect(await recordGoalChange(profile, { ...profile, ...patch }, "2026-03-10")).toBe(true);
    }
  });

  it("keeps the pre-change goals by seeding them before the first change of an existing user", async () => {
    mockGetAllMeals.mockResolvedValue([meal("2026-02-01")]);

    await recordGoalChange(profile, { ...profile, calorieGoal: 2600 }, "2026-03-10");

    expect([...mockStore.values()]).toEqual([
      expect.objectContaining({ effectiveFrom: "2026-02-01", calorieGoal: 2200 }),
      expect.objectContaining({ effectiveFrom: "2026-03-10", calorieGoal: 2600 }),
    ]);
  });

  it("overwrites the same day's entry on a second change", async () => {
    const second = { ...profile, calorieGoal: 2600 };
    await recordGoalChange(profile, second, "2026-03-10");
    await recordGoalChange(second, { ...second, calorieGoal: 2800 }, "2026-03-10");

    const today = mockStore.get("2026-03-10");
    expect(today).toEqual(expect.objectContaining({ calorieGoal: 2800 }));
    expect([...mockStore.keys()].filter((k) => k === "2026-03-10")).toHaveLength(1);
  });
});

describe("seeding on a signed-in device (fresh-device guard)", () => {
  beforeEach(() => {
    mockSyncEnabled = true;
    mockAuthUserId = "user-1";
  });

  it("does not seed before the first goal_history reconcile completed", async () => {
    expect(await backfillGoalHistory(profile)).toBe(false);
    expect(goalHistoryRepo.record).not.toHaveBeenCalled();
  });

  it("seeds (idempotently) once the reconcile completed for that user", async () => {
    markGoalHistoryReconciled("user-1");

    expect(await backfillGoalHistory(profile)).toBe(true);
    expect(await backfillGoalHistory(profile)).toBe(false);
    expect(goalHistoryRepo.record).toHaveBeenCalledTimes(1);
  });

  it("does not trust a reconcile that completed for a different user", async () => {
    markGoalHistoryReconciled("someone-else");

    expect(await backfillGoalHistory(profile)).toBe(false);
  });

  it("still records a real goal change; the previous goals are kept only as a pending seed", async () => {
    await recordGoalChange(profile, { ...profile, calorieGoal: 2600 }, "2026-03-10");

    expect([...mockStore.keys()]).toEqual(["2026-01-15", "2026-03-10"]);
  });

  it("seeds freely when sync is disabled even if a user id exists", async () => {
    mockSyncEnabled = false;

    expect(await backfillGoalHistory(profile)).toBe(true);
  });
});

describe("repairGoalGap", () => {
  const seed = () =>
    mockStore.set("2026-01-01", {
      effectiveFrom: "2026-01-01",
      calorieGoal: 2200,
      proteinGoalG: 150,
      carbsGoalG: 250,
      fatGoalG: 70,
      useManualGoals: false,
    });

  it("records a corrective entry for today when the latest entry differs from the profile", async () => {
    seed();

    expect(await repairGoalGap({ ...profile, calorieGoal: 2500 }, "2026-03-10")).toBe(true);

    expect(mockStore.get("2026-03-10")).toEqual(expect.objectContaining({ calorieGoal: 2500 }));
  });

  it("does nothing when the latest entry already matches the profile", async () => {
    seed();

    expect(await repairGoalGap(profile, "2026-03-10")).toBe(false);
    expect(goalHistoryRepo.record).not.toHaveBeenCalled();
  });

  it("does nothing on an empty history (that is backfill's job)", async () => {
    expect(await repairGoalGap(profile, "2026-03-10")).toBe(false);
  });
});

describe("pre-reconcile goal change on a signed-in device (pending seed)", () => {
  const changed = { ...profile, calorieGoal: 2600 };

  beforeEach(() => {
    mockSyncEnabled = true;
    mockAuthUserId = "user-1";
    mockGetAllMeals.mockResolvedValue([meal("2026-02-01")]);
  });

  it("persists the pre-change goals locally, without enqueueing, instead of losing them", async () => {
    await recordGoalChange(profile, changed, "2026-03-10");

    expect(mockStore.get("2026-02-01")).toEqual(expect.objectContaining({ calorieGoal: 2200 }));
    expect(mockStore.get("2026-03-10")).toEqual(expect.objectContaining({ calorieGoal: 2600 }));
    const seedCall = (goalHistoryRepo.record as jest.Mock).mock.calls.find(
      ([data]) => data.effectiveFrom === "2026-02-01"
    );
    expect(seedCall?.[2]).toEqual({ enqueue: false });
    const realCall = (goalHistoryRepo.record as jest.Mock).mock.calls.find(
      ([data]) => data.effectiveFrom === "2026-03-10"
    );
    expect(realCall?.[2]?.enqueue).not.toBe(false);
  });

  it("drops the pending seed after the pull when the cloud already has history", async () => {
    await recordGoalChange(profile, changed, "2026-03-10");

    await resolvePendingGoalSeed("user-1", true);

    expect(mockStore.has("2026-02-01")).toBe(false);
    expect(mockStore.has("2026-03-10")).toBe(true);
  });

  it("keeps the pending seed as the earliest entry when the cloud is empty", async () => {
    await recordGoalChange(profile, changed, "2026-03-10");

    await resolvePendingGoalSeed("user-1", false);

    expect(mockStore.has("2026-02-01")).toBe(true);
    // Resolved: a later pull with history must not delete it any more
    await resolvePendingGoalSeed("user-1", true);
    expect(mockStore.has("2026-02-01")).toBe(true);
  });

  it("does nothing when there is no pending seed", async () => {
    mockStore.set("2026-01-01", { effectiveFrom: "2026-01-01" });

    await resolvePendingGoalSeed("user-1", true);

    expect(mockStore.has("2026-01-01")).toBe(true);
  });

  it("does not create a pending seed dated on/after the change day (the real entry covers it)", async () => {
    mockGetAllMeals.mockResolvedValue([meal("2026-03-10")]);

    await recordGoalChange(profile, changed, "2026-03-10");

    expect([...mockStore.keys()]).toEqual(["2026-03-10"]);
  });
});

describe("owner is captured once per operation", () => {
  it("keeps list/record on the starting owner even if the auth user changes mid-operation", async () => {
    mockAuthUserId = "user-a";
    mockGetAllMeals.mockImplementation(async () => {
      mockAuthUserId = "user-b"; // sign-in switch during the seed's meal read
      return [meal("2026-02-01")];
    });

    await recordGoalChange(profile, { ...profile, calorieGoal: 2600 }, "2026-03-10");

    const owners = [
      ...(goalHistoryRepo.list as jest.Mock).mock.calls.map((c) => c[0]),
      ...(goalHistoryRepo.record as jest.Mock).mock.calls.map((c) => c[1]),
    ];
    expect(owners.length).toBeGreaterThan(0);
    expect(new Set(owners)).toEqual(new Set(["user-a"]));
  });
});

describe("repairGoalGap with a future-dated entry", () => {
  it("compares against the entry active today, not the last array element", async () => {
    mockStore.set("2026-01-01", {
      effectiveFrom: "2026-01-01",
      calorieGoal: 2200,
      proteinGoalG: 150,
      carbsGoalG: 250,
      fatGoalG: 70,
      useManualGoals: false,
    });
    mockStore.set("2026-06-01", {
      effectiveFrom: "2026-06-01",
      calorieGoal: 3000,
      proteinGoalG: 150,
      carbsGoalG: 250,
      fatGoalG: 70,
      useManualGoals: false,
    });

    expect(await repairGoalGap(profile, "2026-03-10")).toBe(false);
    expect(await repairGoalGap(profile, "2026-03-10")).toBe(false);
    expect(goalHistoryRepo.record).not.toHaveBeenCalled();
  });
});
