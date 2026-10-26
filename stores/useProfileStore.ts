import * as profileRepo from "@/db/repos/profile";
import * as progressRepo from "@/db/repos/progress";
import type { UserProfile } from "@/db/schema";
import { todayISO } from "@/lib/date";
import { pickLatestWeight } from "@/lib/latestWeight";
import { computeAutoGoals } from "@/lib/nutrition";
import { recordGoalChange } from "@/src/services/goalHistoryService";
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
  /**
   * Keep `profile.weightKg` equal to the latest weigh-in dated on or before
   * `today` (product rule, issue #82). Runs after load()/reload() and after
   * progress entries change. Writes only when the value differs (so it
   * cannot loop); goals are recomputed in the same write unless manual goals
   * are active. Returns true when the profile was updated.
   */
  syncWeightFromProgress: (today?: string) => Promise<boolean>;
}

/**
 * Single choke point for goal history writes: call after every successful
 * profile upsert. Records an entry only when the goals changed (or on the
 * first-ever profile). Never throws — a history failure must not fail the
 * profile save that already succeeded. The app has no error reporter
 * (Sentry/logger), so failures are surfaced with console.error.
 */
async function recordGoalHistory(previous: UserProfile | null, next: UserProfile): Promise<void> {
  try {
    await recordGoalChange(previous, next);
  } catch (err) {
    console.error("[profileStore] recording goal history FAILED", err);
  }
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
      // Heal a profile whose weight diverged from the latest weigh-in.
      try {
        await get().syncWeightFromProgress();
      } catch (err) {
        console.error("[profileStore] syncWeightFromProgress FAILED", err);
      }
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
    // The store may not be hydrated yet: use the persisted profile so the
    // goals that applied before this save are not lost from the history.
    const previous = get().profile ?? (await profileRepo.getProfile()) ?? null;
    const goals = computeAutoGoals(input);

    const profile = await profileRepo.upsertProfile({
      age: input.age,
      heightCm: input.heightCm,
      weightKg: input.weightKg,
      sex: input.sex,
      activityLevel: input.activityLevel,
      goal: input.goal,
      ...goals,
      useManualGoals: false,
    });

    await recordGoalHistory(previous, profile);
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

    await recordGoalHistory(current, profile);
    set({ profile });
  },

  recalcFromProfile: async () => {
    const current = get().profile;
    // No-op when manual goals are active or no profile exists.
    if (!current || current.useManualGoals) return;

    const goals = computeAutoGoals(current);

    const profile = await profileRepo.upsertProfile({
      age: current.age,
      heightCm: current.heightCm,
      weightKg: current.weightKg,
      sex: current.sex,
      activityLevel: current.activityLevel,
      goal: current.goal,
      ...goals,
      useManualGoals: false,
    });

    await recordGoalHistory(current, profile);
    set({ profile });
  },

  syncWeightFromProgress: async (today = todayISO()) => {
    if (!get().profile) return false;

    const entries = await progressRepo.getRange("0000-01-01", "9999-12-31");
    const weightKg = pickLatestWeight(entries, today);

    // Re-read after the await: a concurrent saveProfile/recalc/goal edit must
    // not be overwritten by a stale snapshot.
    const current = get().profile;
    if (!current || weightKg === null || weightKg === current.weightKg) return false;

    const goals = current.useManualGoals
      ? {
          calorieGoal: current.calorieGoal,
          proteinGoalG: current.proteinGoalG,
          carbsGoalG: current.carbsGoalG,
          fatGoalG: current.fatGoalG,
        }
      : computeAutoGoals({ ...current, weightKg });

    const profile = await profileRepo.upsertProfile({
      age: current.age,
      heightCm: current.heightCm,
      weightKg,
      sex: current.sex,
      activityLevel: current.activityLevel,
      goal: current.goal,
      ...goals,
      useManualGoals: current.useManualGoals,
    });

    await recordGoalHistory(current, profile);
    set({ profile });
    return true;
  },

  revertToAutomaticGoals: async () => {
    const current = get().profile;
    if (!current) return;

    const goals = computeAutoGoals(current);

    const profile = await profileRepo.upsertProfile({
      age: current.age,
      heightCm: current.heightCm,
      weightKg: current.weightKg,
      sex: current.sex,
      activityLevel: current.activityLevel,
      goal: current.goal,
      ...goals,
      useManualGoals: false,
    });

    await recordGoalHistory(current, profile);
    set({ profile });
  },
}));
