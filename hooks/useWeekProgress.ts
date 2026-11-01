import { getLoggedTotalsByDateRange } from "@/db/repos/mealEntries";
import type { DayTotals } from "@/db/repos/mealEntries";
import { CAL_GOAL_HIGH, CAL_GOAL_LOW } from "@/lib/constants";
import { todayISO, weekDays } from "@/lib/date";
import { resolveGoalFor } from "@/lib/goalHistory";
import { useDayStore } from "@/stores/useDayStore";
import { useGoalHistoryStore } from "@/stores/useGoalHistoryStore";
import { useProfileStore } from "@/stores/useProfileStore";
import { useEffect, useMemo, useState } from "react";

export type DayStatus = "empty" | "partial" | "complete";

/**
 * Goals-met check — calories only within [90 %, 110 %] of goal (see
 * CAL_GOAL_LOW/HIGH). Macros have their own per-macro bars
 * (HeaderMacroRow/CalorieCard) and are not part of the day-status gate.
 */
export function goalsMet(totals: DayTotals, calorieGoal: number): boolean {
  return (
    totals.calories >= calorieGoal * CAL_GOAL_LOW && totals.calories <= calorieGoal * CAL_GOAL_HIGH
  );
}

/**
 * Pure status derivation. `goalFor` returns the calorie goal that applied on
 * a given date (0 when none), so each day is judged against its own goal.
 * Future days resolve to "empty" without a goal lookup.
 */
export function deriveWeekStatus(
  days: readonly string[],
  today: string,
  totalsMap: ReadonlyMap<string, DayTotals>,
  goalFor: (date: string) => number
): Record<string, DayStatus> {
  const result: Record<string, DayStatus> = {};

  for (const day of days) {
    // Future days always show as empty regardless of data
    if (day > today) {
      result[day] = "empty";
      continue;
    }

    const totals = totalsMap.get(day);

    if (!totals || totals.calories === 0) {
      result[day] = "empty";
      continue;
    }

    // Data logged — check the goal that applied on that day
    const calorieGoal = goalFor(day);
    result[day] = calorieGoal > 0 && goalsMet(totals, calorieGoal) ? "complete" : "partial";
  }

  return result;
}

/**
 * Derives the logging status for each day in the week starting on `weekStart`
 * (ISO date of the Monday).
 *
 * Returns a Record<isoDate, DayStatus>:
 *   - "empty"    — no meal entries for the day
 *   - "partial"  — entries logged but goals not met (or goals not set but
 *                  calories > 0)
 *   - "complete" — entries logged AND goals met
 *
 * Future days always resolve to "empty". Each day is judged against the goal
 * active on that date (goal history), falling back to the live profile goal.
 *
 * Re-fetches whenever `weekStart` changes or the current-day entries list
 * reference changes (live dot refresh after logging).
 */
export function useWeekProgress(weekStart: string): Record<string, DayStatus> {
  const [totalsMap, setTotalsMap] = useState<Map<string, DayTotals>>(new Map());

  const profile = useProfileStore((s) => s.profile);
  const historyEntries = useGoalHistoryStore((s) => s.entries);

  // Invalidation counter — increments whenever the entries list changes so the
  // effect re-fetches fresh totals after the user logs food.
  const entriesVersion = useDayStore((s) => s.entries.length);

  const days = useMemo(() => weekDays(weekStart), [weekStart]);
  const weekEnd = days[6];

  // biome-ignore lint/correctness/useExhaustiveDependencies: entriesVersion is an intentional invalidation trigger
  useEffect(() => {
    let cancelled = false;

    async function fetchTotals() {
      const rows = await getLoggedTotalsByDateRange(weekStart, weekEnd);
      if (cancelled) return;
      const map = new Map<string, DayTotals>();
      for (const row of rows) {
        map.set(row.date, row);
      }
      setTotalsMap(map);
    }

    void fetchTotals();

    return () => {
      cancelled = true;
    };
  }, [weekStart, weekEnd, entriesVersion]);

  return useMemo(
    () =>
      deriveWeekStatus(
        days,
        todayISO(),
        totalsMap,
        (d) => resolveGoalFor(historyEntries, profile, d)?.calorieGoal ?? 0
      ),
    [days, totalsMap, historyEntries, profile]
  );
}
