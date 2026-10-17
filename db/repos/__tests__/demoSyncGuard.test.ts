/**
 * Demo rows and demo devices must never enqueue outbound sync ops.
 * Covers db/repos/mealEntries.ts (insert/update/insertBulk) and db/repos/profile.ts.
 */

const mockDexie = {
  mealEntries: { insert: jest.fn(), update: jest.fn(), insertBulk: jest.fn(), remove: jest.fn() },
  profile: { upsertProfile: jest.fn() },
};
jest.mock("@/db/client", () => ({
  get dexieAdapter() {
    return mockDexie;
  },
}));
jest.mock("@/db/repositories/mealEntries", () => ({}));
jest.mock("@/db/repositories/profile", () => ({}));

jest.mock("@/src/lib/supabase", () => ({ isSyncEnabled: () => true }));

const mockEnqueue = jest.fn();
jest.mock("@/src/services/syncQueue", () => ({
  enqueue: (...a: unknown[]) => mockEnqueue(...a),
}));

jest.mock("@/src/stores/useAuthStore", () => ({
  useAuthStore: { getState: () => ({ userId: "user-1" }) },
}));

import * as mealEntries from "@/db/repos/mealEntries";
import * as profile from "@/db/repos/profile";

let store: Record<string, string>;

function entry(id: string, foodId: string) {
  return {
    id,
    userId: null,
    date: "2025-01-01",
    mealType: "lunch",
    foodId,
    foodName: "Food",
    quantityG: 100,
    calories: 1,
    proteinG: 1,
    carbsG: 1,
    fatG: 1,
    loggedAt: "2025-01-01T10:00:00.000Z",
    updatedAt: null,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  store = {};
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store[k] ?? null,
  };
});

describe("meal entry enqueue guard", () => {
  it("does not enqueue demo entries on insert, update and insertBulk", async () => {
    const demo = entry("d1", "demo-food-salad");
    mockDexie.mealEntries.insert.mockResolvedValue(demo);
    mockDexie.mealEntries.update.mockResolvedValue(demo);
    mockDexie.mealEntries.insertBulk.mockResolvedValue([demo, entry("r1", "off-1")]);

    await mealEntries.insert(demo as never);
    await mealEntries.update("d1", {});
    await mealEntries.insertBulk([demo as never]);

    // Only the real entry from the bulk result is enqueued.
    expect(mockEnqueue).toHaveBeenCalledTimes(1);
    expect(JSON.parse(mockEnqueue.mock.calls[0][0].row).id).toBe("r1");
  });

  it("enqueues real entries normally", async () => {
    mockDexie.mealEntries.insert.mockResolvedValue(entry("r1", "off-1"));

    await mealEntries.insert(entry("r1", "off-1") as never);

    expect(mockEnqueue).toHaveBeenCalledTimes(1);
  });

  it("does not enqueue anything on a demo device", async () => {
    store["vitia.demoSeed"] = "v1";
    mockDexie.mealEntries.insert.mockResolvedValue(entry("r1", "off-1"));

    await mealEntries.insert(entry("r1", "off-1") as never);

    expect(mockEnqueue).not.toHaveBeenCalled();
  });
});

describe("profile enqueue guard", () => {
  const row = {
    id: 1,
    userId: null,
    age: 33,
    heightCm: 178,
    weightKg: 82,
    sex: "male",
    activityLevel: "moderately_active",
    goal: "lose_weight",
    calorieGoal: 2000,
    proteinGoalG: 150,
    carbsGoalG: 200,
    fatGoalG: 60,
    useManualGoals: false,
    updatedAt: "2026-01-01T00:00:00.000Z",
  };

  it("enqueues the profile on a normal device", async () => {
    mockDexie.profile.upsertProfile.mockResolvedValue(row);

    await profile.upsertProfile(row as never);

    expect(mockEnqueue).toHaveBeenCalledTimes(1);
  });

  it("does not enqueue the profile on a demo device", async () => {
    store["vitia.demoSeed"] = "v1";
    mockDexie.profile.upsertProfile.mockResolvedValue(row);

    await profile.upsertProfile(row as never);

    expect(mockEnqueue).not.toHaveBeenCalled();
  });
});
