/**
 * Integration: real goal history service + dispatching repo over a real Dexie
 * adapter (fake-indexeddb). Verifies accounts sharing a device never see each
 * other's goal history, using only normal recording (no direct row writes).
 */
jest.mock("@/db/client", () => {
  const { createDexieAdapter: create } = require("@/src/db/dexie-adapter");
  return { db: {}, dexieAdapter: create(`ownership-${Date.now()}-${Math.random()}`) };
});

let mockAuthUserId: string | null = null;
jest.mock("@/src/stores/useAuthStore", () => ({
  useAuthStore: { getState: () => ({ userId: mockAuthUserId }) },
}));
jest.mock("@/src/lib/supabase", () => ({ isSyncEnabled: () => false }));
jest.mock("@/src/services/demoGuard", () => ({ isDemoDevice: () => false }));
jest.mock("@/db/repos/mealEntries", () => ({ getAll: jest.fn(async () => []) }));

import * as goalHistoryRepo from "@/db/repos/goalHistory";
import type { UserProfile } from "@/db/schema";
import { recordGoalChange } from "@/src/services/goalHistoryService";

const profile = (calorieGoal: number): UserProfile => ({
  id: 1,
  userId: null,
  age: 30,
  heightCm: 175,
  weightKg: 70,
  sex: "male",
  activityLevel: "moderately_active",
  goal: "maintain",
  calorieGoal,
  proteinGoalG: 150,
  carbsGoalG: 250,
  fatGoalG: 70,
  useManualGoals: false,
  createdAt: "2026-01-15T12:00:00.000Z",
  updatedAt: "2026-01-15T12:00:00.000Z",
});

describe("goal history ownership across accounts on one device", () => {
  it("A records, signs out, B signs in: B sees none of A's history and vice versa", async () => {
    mockAuthUserId = "user-a";
    await recordGoalChange(null, profile(2000), "2026-03-01");
    await recordGoalChange(profile(2000), profile(2400), "2026-03-05");
    expect((await goalHistoryRepo.list()).map((e) => e.calorieGoal)).toEqual([2000, 2400]);

    // A signs out: signed-out owner sees nothing of A's
    mockAuthUserId = null;
    expect(await goalHistoryRepo.list()).toEqual([]);

    // B signs in: nothing inherited from A
    mockAuthUserId = "user-b";
    expect(await goalHistoryRepo.list()).toEqual([]);

    await recordGoalChange(null, profile(1500), "2026-03-06");
    expect((await goalHistoryRepo.list()).map((e) => [e.userId, e.calorieGoal])).toEqual([
      ["user-b", 1500],
    ]);

    // A signs back in: own history intact, B's not visible
    mockAuthUserId = "user-a";
    expect((await goalHistoryRepo.list()).map((e) => [e.userId, e.effectiveFrom])).toEqual([
      ["user-a", "2026-03-01"],
      ["user-a", "2026-03-05"],
    ]);
  });

  it("stamps signed-out recordings with the local owner marker", async () => {
    mockAuthUserId = null;
    await recordGoalChange(null, profile(1800), "2026-04-01");

    const [entry] = await goalHistoryRepo.list();
    expect(entry.userId).toBe("local");
  });
});

describe("per-day adoption of signed-out history (real Dexie)", () => {
  it("record between sign-in and reconcile: adopted days merge, the user's own day wins", async () => {
    mockAuthUserId = null;
    await recordGoalChange(null, profile(1800), "2026-05-01"); // signed-out, day D1
    await recordGoalChange(profile(1800), profile(1900), "2026-05-10"); // signed-out, day D2

    mockAuthUserId = "user-c"; // signs in, records BEFORE the reconcile runs
    await recordGoalChange(null, profile(2500), "2026-05-10"); // collides with D2

    await goalHistoryRepo.adoptLocalOwned("user-c"); // what every reconcile does

    expect((await goalHistoryRepo.list("local")).length).toBe(0);
    // 2026-04-01 is the signed-out row left by the earlier test on this shared DB
    expect((await goalHistoryRepo.list()).map((e) => [e.effectiveFrom, e.calorieGoal])).toEqual([
      ["2026-04-01", 1800],
      ["2026-05-01", 1800],
      ["2026-05-10", 2500],
    ]);
  });

  it("same-user re-sign-in with existing history: new signed-out days are adopted, not stranded", async () => {
    mockAuthUserId = "user-d";
    await recordGoalChange(null, profile(2000), "2026-06-01");

    mockAuthUserId = null; // signs out and keeps using the app
    await recordGoalChange(null, profile(2100), "2026-06-15");

    mockAuthUserId = "user-d"; // signs back in; cloud/local history is NOT empty
    await goalHistoryRepo.adoptLocalOwned("user-d");

    expect((await goalHistoryRepo.list("local")).length).toBe(0);
    expect((await goalHistoryRepo.list()).map((e) => [e.effectiveFrom, e.calorieGoal])).toEqual([
      ["2026-06-01", 2000],
      ["2026-06-15", 2100],
    ]);
  });
});
