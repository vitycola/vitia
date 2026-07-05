/**
 * Tests for stores/useProfileStore.ts — revertToAutomaticGoals().
 *
 * `@/db/repos/profile` transitively imports `db/client.ts`, which uses
 * `import.meta.url` (Vite-only syntax) ts-jest cannot parse. Mock it
 * directly, mirroring the pattern in useFoodSearchStore.test.ts.
 */
jest.mock("@/db/repos/profile", () => ({
  getProfile: jest.fn(),
  upsertProfile: jest.fn(),
}));

import * as profileRepo from "@/db/repos/profile";
// Imported after mocks so the store module picks up the mocked deps.
import { useProfileStore } from "@/stores/useProfileStore";

const mockedUpsertProfile = profileRepo.upsertProfile as jest.MockedFunction<
  typeof profileRepo.upsertProfile
>;

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
