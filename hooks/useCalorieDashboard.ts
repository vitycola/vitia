import { getLoggedTotalsByDateRange } from "@/db/repos/mealEntries";
import { buildBars, buildOverlayRows, imputedAverage } from "@/lib/calorieDashboard";
import type { BarDatum, DashboardRange } from "@/lib/calorieDashboard";
import { resolveDashboardWindow } from "@/lib/date";
import { useProfileStore } from "@/stores/useProfileStore";
import { useEffect, useMemo, useState } from "react";

export interface CalorieDashboardVM {
  bars: BarDatum[];
  average: number | null;
  total: number;
  goalLine: number;
  window: { from: string; to: string };
  isLoading: boolean;
  /**
   * Daily kcal rows for the same window/granularity as the chart, for the
   * historical overlay (spec: "Historical Overlay Window Mapping"). Always
   * daily granularity, even for 3month — never re-bucketed. Absent days are
   * 0 kcal, never omitted, so length always equals the window's day count.
   */
  overlayRows: { date: string; kcal: number }[];
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

  const window = useMemo(() => resolveDashboardWindow(range), [range]);

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
    const overlayRows = buildOverlayRows(window.from, window.to, byDate);

    return { bars, average, total, goalLine, window, isLoading, overlayRows };
  }, [rows, range, window, profile, isLoading]);
}
