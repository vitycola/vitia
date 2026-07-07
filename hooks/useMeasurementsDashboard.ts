import * as progressRepo from "@/db/repos/progress";
import { rollingWindow, startOfWeek, todayISO, weekDays } from "@/lib/date";
import type {
  DashboardRange,
  LinePoint,
  MeasurementEntryRow,
  MetricKey,
  RenderState,
} from "@/lib/measurementsDashboard";
import {
  buildLine,
  buildOverlayRows,
  deltaFromFirst,
  latestValue,
  toPoints,
} from "@/lib/measurementsDashboard";
import { useEffect, useMemo, useState } from "react";

export interface MeasurementsDashboardVM {
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
 * Resolve the {from, to} fetch window for a given dashboard range —
 * IDENTICAL semantics to Calorías' resolveWindow so the shared
 * `selectedRange` never diverges between cards.
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
 * Fetch+shape hook for the Progress > Medidas dashboard. Mirrors
 * useCalorieDashboard's fetch pattern: resolves the window for the active
 * range, calls progressRepo.getRange, and derives sparse points + line data
 * + overlay rows via the pure functions in lib/measurementsDashboard.ts.
 * Switching the active metric refilters the same fetched entries — no new
 * getRange call is required.
 */
export function useMeasurementsDashboard(
  range: DashboardRange,
  metric: MetricKey
): MeasurementsDashboardVM {
  const [rows, setRows] = useState<MeasurementEntryRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const window = useMemo(() => resolveWindow(range), [range]);

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
    const overlayRows = buildOverlayRows(rows, metric);
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
  }, [rows, range, metric, window, isLoading]);
}
