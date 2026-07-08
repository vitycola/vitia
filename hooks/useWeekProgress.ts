import { getLoggedTotalsByDateRange } from "@/db/repos/mealEntries";
import type { DayTotals } from "@/db/repos/mealEntries";
import { todayISO, weekDays } from "@/lib/date";
import { useDayStore } from "@/stores/useDayStore";
import { useProfileStore } from "@/stores/useProfileStore";
import { useEffect, useMemo, useState } from "react";

export type DayStatus = "empty" | "partial" | "complete";

/**
 * Goals-met threshold — calories only within [90 %, 110 %] of goal.
 * Macros have their own per-macro bars (HeaderMacroRow/CalorieCard) and are
 * not part of the day-status gate.
 */
const CAL_LOW = 0.9;
const CAL_HIGH = 1.1;

function goalsMet(totals: DayTotals, calorieGoal: number): boolean {
  return totals.calories >= calorieGoal * CAL_LOW && totals.calories <= calorieGoal * CAL_HIGH;
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
 * Future days always resolve to "empty".
 *
 * Re-fetches whenever `weekStart` changes or the current-day entries list
 * reference changes (live dot refresh after logging).
 */
export function useWeekProgress(weekStart: string): Record<string, DayStatus> {
  const [totalsMap, setTotalsMap] = useState<Map<string, DayTotals>>(new Map());

  const profile = useProfileStore((s) => s.profile);

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

  return useMemo(() => {
    const today = todayISO();
    const calorieGoal = profile?.calorieGoal ?? 0;
    const goalsConfigured = calorieGoal > 0;

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

      // Data logged — check goals
      if (goalsConfigured && goalsMet(totals, calorieGoal)) {
        result[day] = "complete";
      } else {
        result[day] = "partial";
      }
    }

    return result;
  }, [days, totalsMap, profile]);
}
