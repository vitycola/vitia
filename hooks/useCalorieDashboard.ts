import { getLoggedTotalsByDateRange } from "@/db/repos/mealEntries";
import { buildBars, imputedAverage } from "@/lib/calorieDashboard";
import type { BarDatum, DashboardRange } from "@/lib/calorieDashboard";
import { rollingWindow, startOfWeek, todayISO, weekDays } from "@/lib/date";
import { useProfileStore } from "@/stores/useProfileStore";
import { useEffect, useMemo, useState } from "react";

export interface CalorieDashboardVM {
  bars: BarDatum[];
  average: number | null;
  total: number;
  goalLine: number;
  window: { from: string; to: string };
  isLoading: boolean;
}

/**
 * Resolve the {from, to} fetch window for a given dashboard range:
 * - week: the calendar week (Mon–Sun) containing today, same convention as
 *   `useWeekProgress.ts`.
 * - month: rolling 30-day window ending today.
 * - 3month: rolling 90-day window ending today (further split into 3
 *   30-day buckets by `buildBars`).
 */
function resolveWindow(range: DashboardRange): { from: string; to: string } {
  if (range === "week") {
    const weekStart = startOfWeek(todayISO());
    const days = weekDays(weekStart);
    return { from: days[0], to: days[6] };
  }
  if (range === "month") {
    return rollingWindow(30);
  }
  return rollingWindow(90);
}

/**
 * Fetch+shape hook for the Progress > Calorías dashboard. Mirrors
 * `useWeekProgress.ts`'s fetch pattern: resolves the window for the active
 * range, calls `getLoggedTotalsByDateRange`, and derives bars + imputed-only
 * average + goal line via the pure functions in `lib/calorieDashboard.ts`.
 */
export function useCalorieDashboard(range: DashboardRange): CalorieDashboardVM {
  const [rows, setRows] = useState<{ date: string; calories: number }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const profile = useProfileStore((s) => s.profile);

  const window = useMemo(() => resolveWindow(range), [range]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    async function fetchRows() {
      const result = await getLoggedTotalsByDateRange(window.from, window.to);
      if (cancelled) return;
      setRows(result);
      setIsLoading(false);
    }

    void fetchRows();

    return () => {
      cancelled = true;
    };
  }, [window]);

  return useMemo(() => {
    const byDate = new Map(rows.map((row) => [row.date, row.calories]));
    const bars = buildBars(range, byDate, window.from, window.to);
    const average = imputedAverage(rows);
    const total = rows.reduce((acc, row) => acc + row.calories, 0);
    const goalLine = profile?.calorieGoal ?? 2000;

    return { bars, average, total, goalLine, window, isLoading };
  }, [rows, range, window, profile, isLoading]);
}
