/**
 * Tests for stores/useGoalHistoryStore.ts. Repos are mocked (db/client uses
 * Vite-only syntax); the profile store is replaced by a minimal real zustand
 * store so the subscription wiring is exercised.
 */
const mockRows = new Map<string, Record<string, unknown>>();
jest.mock("@/db/repos/goalHistory", () => ({
  list: jest.fn(async () =>
    [...mockRows.values()].sort((a, b) =>
      (a.effectiveFrom as string).localeCompare(b.effectiveFrom as string)
    )
  ),
  record: jest.fn(async (data: Record<string, unknown>) => {
    mockRows.set(data.effectiveFrom as string, data);
    return data;
  }),
}));

const mockSyncEnabled = false;
jest.mock("@/src/lib/supabase", () => ({ isSyncEnabled: () => mockSyncEnabled }));
jest.mock("@/src/services/demoGuard", () => ({ isDemoDevice: () => false }));
jest.mock("@/src/stores/useAuthStore", () => {
  const { create } = require("zustand");
  return { useAuthStore: create(() => ({ userId: null })) };
});

const mockGetAllMeals = jest.fn();
jest.mock("@/db/repos/mealEntries", () => ({
  getAll: (...a: unknown[]) => mockGetAllMeals(...a),
}));

jest.mock("@/stores/useProfileStore", () => {
  const { create } = require("zustand");
  return { useProfileStore: create(() => ({ profile: null })) };
});

import * as goalHistoryRepo from "@/db/repos/goalHistory";
import { useAuthStore } from "@/src/stores/useAuthStore";
import { useGoalHistoryStore } from "@/stores/useGoalHistoryStore";
import { useProfileStore } from "@/stores/useProfileStore";

const profile = {
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

const setProfile = (p: typeof profile | null) =>
  (useProfileStore as unknown as { setState: (s: object) => void }).setState({ profile: p });

const entry = (effectiveFrom: string, calorieGoal: number) => ({
  effectiveFrom,
  userId: null,
  calorieGoal,
  proteinGoalG: 100,
  carbsGoalG: 100,
  fatGoalG: 50,
  useManualGoals: false,
  createdAt: "x",
  updatedAt: "x",
});

beforeEach(() => {
  jest.clearAllMocks();
  mockRows.clear();
  mockGetAllMeals.mockResolvedValue([]);
  setProfile(null);
  useGoalHistoryStore.setState({ entries: [], isLoading: false });
});

describe("useGoalHistoryStore.load", () => {
  it("loads existing entries without backfilling", async () => {
    mockRows.set("2026-02-01", {
      ...entry("2026-02-01", 2200),
      proteinGoalG: 150,
      carbsGoalG: 250,
      fatGoalG: 70,
    });
    setProfile(profile);
    jest.clearAllMocks();

    await useGoalHistoryStore.getState().load();

    expect(useGoalHistoryStore.getState().entries).toHaveLength(1);
    expect(goalHistoryRepo.record).not.toHaveBeenCalled();
  });

  it("backfills from the profile when the history is empty, only once", async () => {
    mockGetAllMeals.mockResolvedValue([{ date: "2026-02-05" }]);
    setProfile(profile);
    jest.clearAllMocks();

    await useGoalHistoryStore.getState().load();
    await useGoalHistoryStore.getState().load();

    expect(goalHistoryRepo.record).toHaveBeenCalledTimes(1);
    expect(useGoalHistoryStore.getState().entries).toEqual([
      expect.objectContaining({ effectiveFrom: "2026-02-05", calorieGoal: 2200 }),
    ]);
  });

  it("records a corrective entry when the profile goals drifted from the latest entry", async () => {
    mockRows.set("2026-01-01", entry("2026-01-01", 1500));
    setProfile(profile);
    jest.clearAllMocks();

    await useGoalHistoryStore.getState().load();

    expect(goalHistoryRepo.record).toHaveBeenCalledTimes(1);
    expect(useGoalHistoryStore.getState().entries).toHaveLength(2);
    expect(useGoalHistoryStore.getState().entries[1]).toEqual(
      expect.objectContaining({ calorieGoal: 2200 })
    );
  });

  it("stays empty when there is neither history nor profile", async () => {
    await useGoalHistoryStore.getState().load();

    expect(useGoalHistoryStore.getState().entries).toEqual([]);
    expect(goalHistoryRepo.record).not.toHaveBeenCalled();
  });
});

describe("useGoalHistoryStore.getGoalFor", () => {
  it("returns the goals active on the given date", async () => {
    mockRows.set("2026-01-01", entry("2026-01-01", 2000));
    mockRows.set("2026-03-01", entry("2026-03-01", 2400));
    await useGoalHistoryStore.getState().load();

    expect(useGoalHistoryStore.getState().getGoalFor("2026-02-10")?.calorieGoal).toBe(2000);
    expect(useGoalHistoryStore.getState().getGoalFor("2026-03-01")?.calorieGoal).toBe(2400);
    expect(useGoalHistoryStore.getState().getGoalFor("2025-01-01")?.calorieGoal).toBe(2000);
  });

  it("returns only the tracked goal fields", async () => {
    mockRows.set("2026-01-01", entry("2026-01-01", 2000));
    await useGoalHistoryStore.getState().load();

    expect(useGoalHistoryStore.getState().getGoalFor("2026-01-01")).toEqual({
      calorieGoal: 2000,
      proteinGoalG: 100,
      carbsGoalG: 100,
      fatGoalG: 50,
      useManualGoals: false,
    });
  });

  it("falls back to the live profile goals when the history is empty", () => {
    setProfile(profile);
    useGoalHistoryStore.setState({ entries: [] });

    expect(useGoalHistoryStore.getState().getGoalFor("2026-02-10")).toEqual({
      calorieGoal: 2200,
      proteinGoalG: 150,
      carbsGoalG: 250,
      fatGoalG: 70,
      useManualGoals: false,
    });
  });

  it("returns null when there is no history and no profile", () => {
    expect(useGoalHistoryStore.getState().getGoalFor("2026-02-10")).toBeNull();
  });
});

describe("useGoalHistoryStore profile subscription", () => {
  it("reloads when the profile goals change", async () => {
    setProfile(profile);
    await useGoalHistoryStore.getState().load();
    mockRows.set("2026-03-10", entry("2026-03-10", 1800));

    setProfile({ ...profile, calorieGoal: 1800 });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(useGoalHistoryStore.getState().entries.map((e) => e.effectiveFrom)).toContain(
      "2026-03-10"
    );
  });

  it("does not reload when only non-goal profile fields change", async () => {
    setProfile(profile);
    await useGoalHistoryStore.getState().load();
    jest.clearAllMocks();

    setProfile({ ...profile, weightKg: 71 });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(goalHistoryRepo.list).not.toHaveBeenCalled();
  });
});

describe("useGoalHistoryStore auth subscription", () => {
  it("reloads when the auth user changes (new owner's history)", async () => {
    await useGoalHistoryStore.getState().load();
    jest.clearAllMocks();

    (useAuthStore as unknown as { setState: (s: object) => void }).setState({ userId: "user-x" });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(goalHistoryRepo.list).toHaveBeenCalled();
  });
});
