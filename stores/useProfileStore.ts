import * as profileRepo from "@/db/repos/profile";
import type { UserProfile } from "@/db/schema";
import { computeBMR, computeTDEE, deriveCalorieGoal, deriveMacros } from "@/lib/nutrition";
import type { ActivityLevel, Goal, Sex } from "@/types";
import { create } from "zustand";

// ── Input type for saving a profile ───────────────────────────────────
export interface ProfileInput {
  age: number;
  heightCm: number;
  weightKg: number;
  sex: Sex;
  activityLevel: ActivityLevel;
  goal: Goal;
}

// ── Manual goal override ───────────────────────────────────────────────
export interface ManualGoals {
  calorieGoal: number;
  proteinGoalG: number;
  carbsGoalG: number;
  fatGoalG: number;
}

// ── Store shape ────────────────────────────────────────────────────────
interface ProfileState {
  profile: UserProfile | null;
  hasProfile: boolean;
  isLoading: boolean;
}

interface ProfileActions {
  /** Hydrate store from SQLite. Call at app boot. */
  load: () => Promise<void>;
  /**
   * Reload the profile from the local DB.
   * Alias for load(); called by SyncService after reconcile.
   */
  reload: () => Promise<void>;
  /**
   * Compute TDEE + macros from the input, persist to SQLite, and
   * update in-memory state. Clears any manual goal override.
   */
  saveProfile: (input: ProfileInput) => Promise<void>;
  /**
   * Persist manual goal values and set useManualGoals = true.
   * Subsequent recalcFromProfile() calls will be no-ops.
   */
  overrideGoals: (goals: ManualGoals) => Promise<void>;
  /**
   * Re-derive calorie + macro goals from the current profile.
   * No-op when useManualGoals is true (manual values are preserved).
   */
  recalcFromProfile: () => Promise<void>;
  /**
   * Clear a manual goal override and recompute calorie + macro goals from
   * the current profile in one atomic operation (recompute + persist
   * useManualGoals=false together).
   *
   * Deliberately does NOT flip useManualGoals and then delegate to
   * recalcFromProfile(): that action reads useManualGoals from the current
   * profile and no-ops while the flag is still true (see its guard above),
   * so a flip-then-delegate sequence would silently do nothing. This action
   * recomputes directly instead.
   */
  revertToAutomaticGoals: () => Promise<void>;
}

export const useProfileStore = create<ProfileState & ProfileActions>()((set, get) => ({
  // ── Initial state ──────────────────────────────────────────────────
  profile: null,
  hasProfile: false,
  isLoading: false,

  // ── Actions ────────────────────────────────────────────────────────
  load: async () => {
    set({ isLoading: true });
    try {
      const profile = await profileRepo.getProfile();
      console.log("[profileStore] load() getProfile result:", profile);
      set({ profile, hasProfile: profile !== null, isLoading: false });
    } catch (err) {
      console.error("[profileStore] load() getProfile FAILED", err);
      set({ isLoading: false });
    }
  },

  reload: async () => {
    // Alias for load() — called by SyncService after cloud reconcile
    const store = useProfileStore.getState();
    await store.load();
  },

  saveProfile: async (input: ProfileInput) => {
    const bmr = computeBMR(input);
    const tdee = computeTDEE(bmr, input.activityLevel);
    const calorieGoal = deriveCalorieGoal(tdee, input.goal);
    const { proteinG, carbsG, fatG } = deriveMacros(calorieGoal);

    const profile = await profileRepo.upsertProfile({
      age: input.age,
      heightCm: input.heightCm,
      weightKg: input.weightKg,
      sex: input.sex,
      activityLevel: input.activityLevel,
      goal: input.goal,
      calorieGoal,
      proteinGoalG: proteinG,
      carbsGoalG: carbsG,
      fatGoalG: fatG,
      useManualGoals: false,
    });

    set({ profile, hasProfile: true });
  },

  overrideGoals: async (goals: ManualGoals) => {
    const current = get().profile;
    if (!current) return;

    const profile = await profileRepo.upsertProfile({
      age: current.age,
      heightCm: current.heightCm,
      weightKg: current.weightKg,
      sex: current.sex,
      activityLevel: current.activityLevel,
      goal: current.goal,
      calorieGoal: goals.calorieGoal,
      proteinGoalG: goals.proteinGoalG,
      carbsGoalG: goals.carbsGoalG,
      fatGoalG: goals.fatGoalG,
      useManualGoals: true,
    });

    set({ profile });
  },

  recalcFromProfile: async () => {
    const current = get().profile;
    // No-op when manual goals are active or no profile exists.
    if (!current || current.useManualGoals) return;

    const bmr = computeBMR(current);
    const tdee = computeTDEE(bmr, current.activityLevel);
    const calorieGoal = deriveCalorieGoal(tdee, current.goal);
    const { proteinG, carbsG, fatG } = deriveMacros(calorieGoal);

    const profile = await profileRepo.upsertProfile({
      age: current.age,
      heightCm: current.heightCm,
      weightKg: current.weightKg,
      sex: current.sex,
      activityLevel: current.activityLevel,
      goal: current.goal,
      calorieGoal,
      proteinGoalG: proteinG,
      carbsGoalG: carbsG,
      fatGoalG: fatG,
      useManualGoals: false,
    });

    set({ profile });
  },

  revertToAutomaticGoals: async () => {
    const current = get().profile;
    if (!current) return;

    const bmr = computeBMR(current);
    const tdee = computeTDEE(bmr, current.activityLevel);
    const calorieGoal = deriveCalorieGoal(tdee, current.goal);
    const { proteinG, carbsG, fatG } = deriveMacros(calorieGoal);

    const profile = await profileRepo.upsertProfile({
      age: current.age,
      heightCm: current.heightCm,
      weightKg: current.weightKg,
      sex: current.sex,
      activityLevel: current.activityLevel,
      goal: current.goal,
      calorieGoal,
      proteinGoalG: proteinG,
      carbsGoalG: carbsG,
      fatGoalG: fatG,
      useManualGoals: false,
    });

    set({ profile });
  },
}));
