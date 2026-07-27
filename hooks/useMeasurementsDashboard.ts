import * as progressRepo from "@/db/repos/progress";
import { resolveDashboardWindow } from "@/lib/date";
import type {
  DashboardRange,
  LinePoint,
  MeasurementEntryRow,
  MetricKey,
  RenderState,
} from "@/lib/measurementsDashboard";
import { buildLine, deltaFromFirst, latestValue, toPoints } from "@/lib/measurementsDashboard";
import { useEffect, useMemo, useState } from "react";

export interface MeasurementsDashboardVM {
  points: { date: string; value: number }[];
  linePoints: LinePoint[];
  renderState: RenderState;
  latest: number | null;
  delta: number | null;
  window: { from: string; to: string };
  isLoading: boolean;
}

/**
 * Fetch+shape hook for the Progress > Medidas dashboard. Mirrors
 * useCalorieDashboard's fetch pattern: resolves the window for the active
 * range, calls progressRepo.getRange, and derives sparse points + line data
 * via the pure functions in lib/measurementsDashboard.ts. Switching the
 * active metric refilters the same fetched entries — no new getRange call
 * is required. `points` also feeds `MeasurementsScrubOverlay`'s
 * `buildScrubSeries` for the fullscreen scrub chart (issue #63) — there is
 * no separate overlay-row shaping here anymore (the previous bottom-sheet
 * list overlay and its `buildOverlayRows` were removed).
 */
export function useMeasurementsDashboard(
  range: DashboardRange,
  metric: MetricKey
): MeasurementsDashboardVM {
  const [rows, setRows] = useState<MeasurementEntryRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const window = useMemo(() => resolveDashboardWindow(range), [range]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    async function fetchRows() {
      const result = await progressRepo.getRange(window.from, window.to);
      if (cancelled) return;
      setRows(result as unknown as MeasurementEntryRow[]);
      setIsLoading(false);
    }

    void fetchRows();

    return () => {
      cancelled = true;
    };
  }, [window]);

  return useMemo(() => {
    const points = toPoints(rows, metric);
    const { points: linePoints, renderState } = buildLine(range, points, window.from, window.to);
    const latest = latestValue(points);
    const delta = deltaFromFirst(points);

    return {
      points,
      linePoints,
      renderState,
      latest,
      delta,
      window,
      isLoading,
    };
  }, [rows, range, metric, window, isLoading]);
}
