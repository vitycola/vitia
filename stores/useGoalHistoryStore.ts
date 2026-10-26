import * as goalHistoryRepo from "@/db/repos/goalHistory";
import type { GoalHistoryEntry } from "@/db/schema";
import { type GoalSnapshot, goalForDate, pickGoals } from "@/lib/goalHistory";
import { backfillGoalHistory, repairGoalGap } from "@/src/services/goalHistoryService";
import { useAuthStore } from "@/src/stores/useAuthStore";
import { useProfileStore } from "@/stores/useProfileStore";
import { create } from "zustand";

interface GoalHistoryState {
  entries: GoalHistoryEntry[];
  isLoading: boolean;
}

interface GoalHistoryActions {
  /**
   * Hydrate the active owner's history from the local DB. Seeds it from the
   * current profile when empty, or records a corrective entry when the profile
   * goals drifted from the latest entry (both idempotent, and deferred on a
   * signed-in device until the cloud history has been pulled).
   */
  load: () => Promise<void>;
  /**
   * Goals that applied on `date`. Falls back to the live profile goals when the
   * history has no entry; null only when there is no history and no profile.
   */
  getGoalFor: (date: string) => GoalSnapshot | null;
}

export const useGoalHistoryStore = create<GoalHistoryState & GoalHistoryActions>()((set, get) => ({
  entries: [],
  isLoading: false,

  load: async () => {
    set({ isLoading: true });
    try {
      const profile = useProfileStore.getState().profile;
      if (profile) {
        // Seed an empty history / repair a drifted one, then read the result
        // (another load may have written meanwhile, so always re-list).
        if ((await goalHistoryRepo.list()).length === 0) await backfillGoalHistory(profile);
        else await repairGoalGap(profile);
      }
      const entries = await goalHistoryRepo.list();
      set({ entries, isLoading: false });
    } catch (err) {
      console.error("[goalHistoryStore] load() FAILED", err);
      set({ isLoading: false });
    }
  },

  getGoalFor: (date: string) => {
    const entry = goalForDate(get().entries, date);
    if (entry) return pickGoals(entry);

    const profile = useProfileStore.getState().profile;
    return profile ? pickGoals(profile) : null;
  },
}));

// Keep the history in step with goal edits: the profile store records the
// history entry before it publishes the new profile, so a reload here sees it.
useProfileStore.subscribe((state, prev) => {
  const next = state.profile;
  const before = prev.profile;
  if (!next || (before && pickGoalsKey(before) === pickGoalsKey(next))) return;
  void useGoalHistoryStore.getState().load();
});

// The history is per account: reload when the signed-in user changes.
useAuthStore.subscribe((state, prev) => {
  if (state.userId !== prev.userId) void useGoalHistoryStore.getState().load();
});

function pickGoalsKey(profile: GoalSnapshot): string {
  return JSON.stringify(pickGoals(profile));
}
