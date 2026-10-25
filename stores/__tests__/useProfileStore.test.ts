/**
 * Tests for stores/useProfileStore.ts — revertToAutomaticGoals().
 *
 * `@/db/repos/profile` transitively imports `db/client.ts`, which uses
 * `import.meta.url` (Vite-only syntax) ts-jest cannot parse. Mock it
 * directly, mirroring the pattern in useFoodSearchStore.test.ts.
 */
jest.mock("@/db/repos/progress", () => ({
  getRange: jest.fn(),
}));

jest.mock("@/db/repos/profile", () => ({
  getProfile: jest.fn(),
  upsertProfile: jest.fn(),
}));

const mockSyncEnabled = false;
jest.mock("@/src/lib/supabase", () => ({ isSyncEnabled: () => mockSyncEnabled }));
jest.mock("@/src/services/demoGuard", () => ({ isDemoDevice: () => false }));
const mockAuthUserId: string | null = null;
jest.mock("@/src/stores/useAuthStore", () => ({
  useAuthStore: { getState: () => ({ userId: mockAuthUserId }) },
}));

// In-memory goal history (same-day overwrite, like the real repos).
const mockGoalRows = new Map<string, Record<string, unknown>>();
jest.mock("@/db/repos/goalHistory", () => ({
  list: jest.fn(async () =>
    [...mockGoalRows.values()].sort((a, b) =>
      (a.effectiveFrom as string).localeCompare(b.effectiveFrom as string)
    )
  ),
  record: jest.fn(async (data: Record<string, unknown>) => {
    mockGoalRows.set(data.effectiveFrom as string, data);
    return data;
  }),
}));
jest.mock("@/db/repos/mealEntries", () => ({
  getAll: jest.fn(async () => []),
}));

let mockToday = "2026-03-10";
jest.mock("@/lib/date", () => ({
  ...jest.requireActual("@/lib/date"),
  todayISO: () => mockToday,
}));

import * as goalHistoryRepo from "@/db/repos/goalHistory";
import * as profileRepo from "@/db/repos/profile";
import * as progressRepo from "@/db/repos/progress";
// Imported after mocks so the store module picks up the mocked deps.
import { computeAutoGoals } from "@/lib/nutrition";
import { useProfileStore } from "@/stores/useProfileStore";

const mockedUpsertProfile = profileRepo.upsertProfile as jest.MockedFunction<
  typeof profileRepo.upsertProfile
>;

const mockedGetProfile = profileRepo.getProfile as jest.MockedFunction<
  typeof profileRepo.getProfile
>;
const mockedGetRange = progressRepo.getRange as jest.MockedFunction<typeof progressRepo.getRange>;

function weighIn(date: string, weightKg: number | null) {
  return { date, weightKg } as Awaited<ReturnType<typeof progressRepo.getRange>>[number];
}

const manualProfile = {
  id: 1,
  userId: null,
  age: 30,
  heightCm: 175,
  weightKg: 70,
  sex: "male" as const,
  activityLevel: "moderately_active" as const,
  goal: "maintain" as const,
  calorieGoal: 9999,
  proteinGoalG: 999,
  carbsGoalG: 999,
  fatGoalG: 999,
  useManualGoals: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("useProfileStore.revertToAutomaticGoals", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGoalRows.clear();
    useProfileStore.setState({ profile: null, hasProfile: false, isLoading: false });
  });

  it("is a no-op when there is no profile", async () => {
    await useProfileStore.getState().revertToAutomaticGoals();

    expect(mockedUpsertProfile).not.toHaveBeenCalled();
  });

  it("recomputes goals from the profile and persists useManualGoals: false", async () => {
    useProfileStore.setState({ profile: manualProfile, hasProfile: true, isLoading: false });

    const recomputed = {
      ...manualProfile,
      calorieGoal: 2308,
      proteinGoalG: 173,
      carbsGoalG: 231,
      fatGoalG: 77,
      useManualGoals: false,
    };
    mockedUpsertProfile.mockResolvedValue(recomputed);

    await useProfileStore.getState().revertToAutomaticGoals();

    expect(mockedUpsertProfile).toHaveBeenCalledTimes(1);
    const arg = mockedUpsertProfile.mock.calls[0][0];
    expect(arg.useManualGoals).toBe(false);
    // Recomputed values must differ from the stale manual ones.
    expect(arg.calorieGoal).not.toBe(manualProfile.calorieGoal);
    expect(arg.proteinGoalG).not.toBe(manualProfile.proteinGoalG);
    expect(arg.carbsGoalG).not.toBe(manualProfile.carbsGoalG);
    expect(arg.fatGoalG).not.toBe(manualProfile.fatGoalG);

    // Store state reflects the upsert result (freshly recomputed, not stale manual values).
    expect(useProfileStore.getState().profile).toEqual(recomputed);
  });

  it("does not rely on recalcFromProfile's useManualGoals guard (recomputes directly)", async () => {
    useProfileStore.setState({ profile: manualProfile, hasProfile: true, isLoading: false });
    mockedUpsertProfile.mockResolvedValue({ ...manualProfile, useManualGoals: false });

    await useProfileStore.getState().revertToAutomaticGoals();

    // upsertProfile must be called even though useManualGoals was true going in —
    // proving the guard at recalcFromProfile's line 129 was not (mis)reused.
    expect(mockedUpsertProfile).toHaveBeenCalledWith(
      expect.objectContaining({ useManualGoals: false })
    );
  });
});

describe("useProfileStore.syncWeightFromProgress", () => {
  const TODAY = "2026-03-10";
  const autoProfile = { ...manualProfile, weightKg: 82, calorieGoal: 2198, useManualGoals: false };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGoalRows.clear();
    useProfileStore.setState({ profile: null, hasProfile: false, isLoading: false });
    mockedUpsertProfile.mockImplementation(async (data) => ({ ...autoProfile, ...data }));
    mockedGetRange.mockResolvedValue([]);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("does not overwrite a profile change that lands while progress is being read", async () => {
    useProfileStore.setState({ profile: autoProfile, hasProfile: true });
    mockedGetRange.mockImplementation(async () => {
      // Concurrent edit (e.g. saveProfile) lands during the await.
      useProfileStore.setState({ profile: { ...autoProfile, age: 41, goal: "lose_weight" } });
      return [weighIn("2026-03-05", 81.2)];
    });

    expect(await useProfileStore.getState().syncWeightFromProgress(TODAY)).toBe(true);

    const arg = mockedUpsertProfile.mock.calls[0][0];
    expect(arg.age).toBe(41);
    expect(arg.goal).toBe("lose_weight");
    expect(arg.weightKg).toBe(81.2);
  });

  it("skips the write when a concurrent change already set the latest weight", async () => {
    useProfileStore.setState({ profile: autoProfile, hasProfile: true });
    mockedGetRange.mockImplementation(async () => {
      useProfileStore.setState({ profile: { ...autoProfile, weightKg: 81.2 } });
      return [weighIn("2026-03-05", 81.2)];
    });

    expect(await useProfileStore.getState().syncWeightFromProgress(TODAY)).toBe(false);
    expect(mockedUpsertProfile).not.toHaveBeenCalled();
  });

  it("is a no-op without a profile", async () => {
    mockedGetRange.mockResolvedValue([weighIn("2026-03-01", 80)]);

    expect(await useProfileStore.getState().syncWeightFromProgress(TODAY)).toBe(false);
    expect(mockedUpsertProfile).not.toHaveBeenCalled();
  });

  it("keeps the profile weight when there are no weigh-ins", async () => {
    useProfileStore.setState({ profile: autoProfile, hasProfile: true });
    mockedGetRange.mockResolvedValue([weighIn("2026-03-01", null)]);

    expect(await useProfileStore.getState().syncWeightFromProgress(TODAY)).toBe(false);
    expect(mockedUpsertProfile).not.toHaveBeenCalled();
  });

  it("does not write when the weight is unchanged (prevents sync loops)", async () => {
    useProfileStore.setState({ profile: autoProfile, hasProfile: true });
    mockedGetRange.mockResolvedValue([weighIn("2026-03-01", 82)]);

    expect(await useProfileStore.getState().syncWeightFromProgress(TODAY)).toBe(false);
    expect(mockedUpsertProfile).not.toHaveBeenCalled();
  });

  it("persists the latest weight and recomputes goals in a single write", async () => {
    useProfileStore.setState({ profile: autoProfile, hasProfile: true });
    mockedGetRange.mockResolvedValue([weighIn("2026-01-01", 82), weighIn("2026-03-05", 81.2)]);

    expect(await useProfileStore.getState().syncWeightFromProgress(TODAY)).toBe(true);

    expect(mockedUpsertProfile).toHaveBeenCalledTimes(1);
    const arg = mockedUpsertProfile.mock.calls[0][0];
    expect(arg.weightKg).toBe(81.2);
    expect(arg.calorieGoal).not.toBe(2198);
    expect(arg.useManualGoals).toBe(false);
    expect(useProfileStore.getState().profile?.weightKg).toBe(81.2);
  });

  it("does not let an older-dated entry override a newer one", async () => {
    useProfileStore.setState({ profile: { ...autoProfile, weightKg: 81.2 }, hasProfile: true });
    mockedGetRange.mockResolvedValue([weighIn("2026-01-01", 90), weighIn("2026-03-05", 81.2)]);

    expect(await useProfileStore.getState().syncWeightFromProgress(TODAY)).toBe(false);
  });

  it("falls back to the previous weigh-in once the latest is gone", async () => {
    useProfileStore.setState({ profile: { ...autoProfile, weightKg: 81.2 }, hasProfile: true });
    mockedGetRange.mockResolvedValue([weighIn("2026-01-01", 82)]);

    expect(await useProfileStore.getState().syncWeightFromProgress(TODAY)).toBe(true);
    expect(mockedUpsertProfile.mock.calls[0][0].weightKg).toBe(82);
  });

  it("ignores future-dated weigh-ins, then applies them once their day arrives", async () => {
    useProfileStore.setState({ profile: autoProfile, hasProfile: true });
    mockedGetRange.mockResolvedValue([weighIn("2026-03-20", 79)]);

    expect(await useProfileStore.getState().syncWeightFromProgress(TODAY)).toBe(false);
    expect(await useProfileStore.getState().syncWeightFromProgress("2026-03-20")).toBe(true);
    expect(mockedUpsertProfile.mock.calls[0][0].weightKg).toBe(79);
  });

  it("syncs the weight but leaves manual goals untouched", async () => {
    useProfileStore.setState({ profile: manualProfile, hasProfile: true });
    mockedGetRange.mockResolvedValue([weighIn("2026-03-05", 81.2)]);

    expect(await useProfileStore.getState().syncWeightFromProgress(TODAY)).toBe(true);

    expect(mockedUpsertProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        weightKg: 81.2,
        calorieGoal: 9999,
        proteinGoalG: 999,
        carbsGoalG: 999,
        fatGoalG: 999,
        useManualGoals: true,
      })
    );
  });

  describe("load()", () => {
    it("heals a stale profile weight using the latest weigh-in", async () => {
      jest.spyOn(console, "log").mockImplementation(() => {});
      mockedGetProfile.mockResolvedValue(autoProfile);
      mockedGetRange.mockResolvedValue([weighIn("2026-01-01", 81.2)]);

      await useProfileStore.getState().load();

      expect(mockedUpsertProfile).toHaveBeenCalledTimes(1);
      expect(useProfileStore.getState().profile?.weightKg).toBe(81.2);
    });

    it("does not write when the profile weight already matches", async () => {
      jest.spyOn(console, "log").mockImplementation(() => {});
      mockedGetProfile.mockResolvedValue(autoProfile);
      mockedGetRange.mockResolvedValue([weighIn("2026-01-01", 82)]);

      await useProfileStore.getState().load();

      expect(mockedUpsertProfile).not.toHaveBeenCalled();
      expect(useProfileStore.getState().profile?.weightKg).toBe(82);
    });
  });
});

describe("useProfileStore goal history recording", () => {
  const input = {
    age: 30,
    heightCm: 175,
    weightKg: 70,
    sex: "male" as const,
    activityLevel: "moderately_active" as const,
    goal: "maintain" as const,
  };
  const autoProfile = { ...manualProfile, calorieGoal: 2308, useManualGoals: false };
  const record = goalHistoryRepo.record as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGoalRows.clear();
    mockToday = "2026-03-10";
    useProfileStore.setState({ profile: null, hasProfile: false, isLoading: false });
    mockedGetProfile.mockResolvedValue(null);
    mockedUpsertProfile.mockImplementation(async (data) => ({ ...autoProfile, ...data }));
    mockedGetRange.mockResolvedValue([]);
  });

  it("records the initial entry when the first profile is created (onboarding)", async () => {
    await useProfileStore.getState().saveProfile(input);

    expect(record).toHaveBeenCalledTimes(1);
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ effectiveFrom: "2026-03-10", useManualGoals: false }),
      "local"
    );
  });

  it("seeds the persisted previous goals when saveProfile runs before the store is loaded", async () => {
    // Store not hydrated (profile: null) but a profile already exists on disk
    mockedGetProfile.mockResolvedValueOnce(autoProfile);

    await useProfileStore.getState().saveProfile({ ...input, goal: "gain_muscle" });

    expect(mockGoalRows.get("2025-12-31")?.calorieGoal).toBe(autoProfile.calorieGoal);
    expect(mockGoalRows.get("2026-03-10")?.calorieGoal).not.toBe(autoProfile.calorieGoal);
  });

  it("records when saveProfile changes the computed goals", async () => {
    useProfileStore.setState({ profile: autoProfile, hasProfile: true, isLoading: false });

    await useProfileStore.getState().saveProfile({ ...input, goal: "gain_muscle" });

    expect(mockGoalRows.get("2026-03-10")).toEqual(
      expect.objectContaining({ calorieGoal: expect.any(Number), useManualGoals: false })
    );
    expect(mockGoalRows.get("2026-03-10")?.calorieGoal).not.toBe(autoProfile.calorieGoal);
  });

  it("does not record when saveProfile yields the same goals as before", async () => {
    const sameGoals = { ...autoProfile, ...computeAutoGoals(input), useManualGoals: false };
    useProfileStore.setState({ profile: sameGoals, hasProfile: true, isLoading: false });

    await useProfileStore.getState().saveProfile(input);

    expect(record).not.toHaveBeenCalled();
  });

  it("records a manual override with useManualGoals = true", async () => {
    useProfileStore.setState({ profile: autoProfile, hasProfile: true, isLoading: false });

    await useProfileStore.getState().overrideGoals({
      calorieGoal: 1800,
      proteinGoalG: 140,
      carbsGoalG: 150,
      fatGoalG: 60,
    });

    expect(mockGoalRows.get("2026-03-10")).toEqual(
      expect.objectContaining({ calorieGoal: 1800, useManualGoals: true })
    );
  });

  it("does not record an override that re-submits the same manual goals", async () => {
    const manual = { ...manualProfile };
    useProfileStore.setState({ profile: manual, hasProfile: true, isLoading: false });

    await useProfileStore.getState().overrideGoals({
      calorieGoal: manual.calorieGoal,
      proteinGoalG: manual.proteinGoalG,
      carbsGoalG: manual.carbsGoalG,
      fatGoalG: manual.fatGoalG,
    });

    expect(record).not.toHaveBeenCalled();
  });

  it("overwrites the same day's entry on a second change the same day", async () => {
    useProfileStore.setState({ profile: autoProfile, hasProfile: true, isLoading: false });

    await useProfileStore.getState().overrideGoals({
      calorieGoal: 1800,
      proteinGoalG: 140,
      carbsGoalG: 150,
      fatGoalG: 60,
    });
    await useProfileStore.getState().overrideGoals({
      calorieGoal: 1700,
      proteinGoalG: 140,
      carbsGoalG: 150,
      fatGoalG: 60,
    });

    expect(mockGoalRows.get("2026-03-10")?.calorieGoal).toBe(1700);
    // Seed of the pre-change goals + today's single entry (no duplicate for today)
    expect([...mockGoalRows.keys()]).toEqual(["2025-12-31", "2026-03-10"]);
  });

  it("records a new entry on a different day", async () => {
    useProfileStore.setState({ profile: autoProfile, hasProfile: true, isLoading: false });
    await useProfileStore.getState().overrideGoals({
      calorieGoal: 1800,
      proteinGoalG: 140,
      carbsGoalG: 150,
      fatGoalG: 60,
    });

    mockToday = "2026-03-11";
    await useProfileStore.getState().revertToAutomaticGoals();

    expect(mockGoalRows.get("2026-03-10")?.calorieGoal).toBe(1800);
    expect(mockGoalRows.get("2026-03-11")).toEqual(
      expect.objectContaining({ useManualGoals: false })
    );
  });

  it("records when revertToAutomaticGoals flips manual goals back to automatic", async () => {
    useProfileStore.setState({ profile: manualProfile, hasProfile: true, isLoading: false });

    await useProfileStore.getState().revertToAutomaticGoals();

    expect(mockGoalRows.get("2026-03-10")).toEqual(
      expect.objectContaining({ useManualGoals: false })
    );
  });

  it("records when a weight sync recalculates automatic goals", async () => {
    useProfileStore.setState({
      profile: { ...autoProfile, weightKg: 82 },
      hasProfile: true,
      isLoading: false,
    });
    mockedGetRange.mockResolvedValue([weighIn("2026-03-09", 95)]);

    await useProfileStore.getState().syncWeightFromProgress("2026-03-10");

    expect(mockGoalRows.get("2026-03-10")?.calorieGoal).not.toBe(autoProfile.calorieGoal);
    // The pre-change goals are preserved as the seeded entry
    expect(mockGoalRows.get("2025-12-31")?.calorieGoal).toBe(autoProfile.calorieGoal);
  });

  it("does not record when a weight sync leaves manual goals untouched", async () => {
    useProfileStore.setState({ profile: manualProfile, hasProfile: true, isLoading: false });
    mockedGetRange.mockResolvedValue([weighIn("2026-03-09", 95)]);

    await useProfileStore.getState().syncWeightFromProgress("2026-03-10");

    expect(mockedUpsertProfile).toHaveBeenCalledTimes(1);
    expect(record).not.toHaveBeenCalled();
  });

  it("still saves the profile when recording the history fails", async () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    record.mockRejectedValueOnce(new Error("disk full"));

    await useProfileStore.getState().saveProfile(input);

    expect(useProfileStore.getState().hasProfile).toBe(true);
    errorSpy.mockRestore();
  });
});
