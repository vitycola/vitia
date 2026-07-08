import * as progressRepo from "@/db/repos/progress";
import { resolveDashboardWindow } from "@/lib/date";
import type { DashboardRange, LinePoint, RenderState, WeightEntryRow } from "@/lib/weightDashboard";
import {
  buildLine,
  buildOverlayRows,
  deltaFromFirst,
  latestValue,
  toPoints,
} from "@/lib/weightDashboard";
import { useEffect, useMemo, useState } from "react";

export interface WeightDashboardVM {
  points: { date: string; value: number }[];
  linePoints: LinePoint[];
  renderState: RenderState;
  overlayRows: { date: string; value: number }[];
  latest: number | null;
  delta: number | null;
  window: { from: string; to: string };
  isLoading: boolean;
}

/**
 * Fetch+shape hook for the Progress > Peso dashboard. Mirrors
 * useMeasurementsDashboard's fetch pattern minus the metric param: resolves
 * the window for the active range, calls progressRepo.getRange, and derives
 * sparse points + line data + overlay rows via the pure functions in
 * lib/weightDashboard.ts.
 */
export function useWeightDashboard(range: DashboardRange): WeightDashboardVM {
  const [rows, setRows] = useState<WeightEntryRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const window = useMemo(() => resolveDashboardWindow(range), [range]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    async function fetchRows() {
      const result = await progressRepo.getRange(window.from, window.to);
      if (cancelled) return;
      setRows(result as unknown as WeightEntryRow[]);
      setIsLoading(false);
    }

    void fetchRows();

    return () => {
      cancelled = true;
    };
  }, [window]);

  return useMemo(() => {
    const points = toPoints(rows);
    const { points: linePoints, renderState } = buildLine(range, points, window.from, window.to);
    const overlayRows = buildOverlayRows(rows);
    const latest = latestValue(points);
    const delta = deltaFromFirst(points);

    return {
      points,
      linePoints,
      renderState,
      overlayRows,
      latest,
      delta,
      window,
      isLoading,
    };
  }, [rows, range, window, isLoading]);
}
