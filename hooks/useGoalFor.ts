import { type GoalSnapshot, resolveGoalFor } from "@/lib/goalHistory";
import { useGoalHistoryStore } from "@/stores/useGoalHistoryStore";
import { useProfileStore } from "@/stores/useProfileStore";
import { useMemo } from "react";

/**
 * Goals that applied on `date` (history entry, else live profile, else null).
 * Selects the raw `entries`/`profile` references and resolves in a memo: a
 * selector calling getGoalFor would build a new object every call and
 * re-render forever.
 */
export function useGoalFor(date: string): GoalSnapshot | null {
  const entries = useGoalHistoryStore((s) => s.entries);
  const profile = useProfileStore((s) => s.profile);
  return useMemo(() => resolveGoalFor(entries, profile, date), [entries, profile, date]);
}
