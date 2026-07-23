import * as progressRepo from "@/db/repos/progress";
import type {
  BodyFatEntryRow,
  DashboardRange,
  LinePoint,
  RenderState,
} from "@/lib/bodyFatDashboard";
import { buildLine, deltaFromFirst, latestValue, toPoints } from "@/lib/bodyFatDashboard";
import { rollingWindow, startOfWeek, todayISO, weekDays } from "@/lib/date";
import { useEffect, useMemo, useState } from "react";

export interface BodyFatDashboardVM {
  points: { date: string; value: number }[];
  linePoints: LinePoint[];
  renderState: RenderState;
  latest: number | null;
  delta: number | null;
  window: { from: string; to: string };
  isLoading: boolean;
}

/**
 * Resolve the {from, to} fetch window for a given dashboard range —
 * IDENTICAL semantics to Calorías'/Medidas' resolveWindow so the shared
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
 * Fetch+shape hook for the Progress > % Grasa dashboard. Mirrors
 * useWeightDashboard's fetch pattern: resolves the window for the active
 * range, calls progressRepo.getRange, and derives sparse points + line data
 * via the pure functions in lib/bodyFatDashboard.ts. `points` also feeds
 * `BodyFatScrubOverlay`'s `buildScrubSeries` for the fullscreen scrub chart
 * (issue #63) — there is no separate overlay-row shaping here anymore (the
 * previous bottom-sheet list overlay and its `buildOverlayRows` were
 * removed).
 */
export function useBodyFatDashboard(range: DashboardRange): BodyFatDashboardVM {
  const [rows, setRows] = useState<BodyFatEntryRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const window = useMemo(() => resolveWindow(range), [range]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    async function fetchRows() {
      const result = await progressRepo.getRange(window.from, window.to);
      if (cancelled) return;
      setRows(result as unknown as BodyFatEntryRow[]);
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
  }, [rows, range, window, isLoading]);
}
