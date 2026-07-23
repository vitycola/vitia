/**
 * Shared, metric-agnostic pure geometry for the fullscreen scrub chart
 * (issue #63). Consumed by WeightScrubOverlay/BodyFatScrubOverlay/
 * MeasurementsScrubOverlay via FullscreenScrubChart — distinct from each
 * *Dashboard.ts's compact `buildLine`, which carry-forward-buckets the
 * 3-month range. Here EVERY range (week/month/3month) renders one series
 * point per actually-logged day — no bucketing, ever (spec: "Per-day,
 * non-bucketed data for every range"). Input points are assumed already
 * sparse (logged-days-only, e.g. via each metric's `toPoints`) — this
 * module derives geometry only, it never filters or fetches.
 */

import { addDays } from "@/lib/date";

export interface ScrubPoint {
  date: string;
  value: number;
}

export interface ScrubSeriesPoint {
  date: string;
  value: number;
  /** 0..1 position within the window, date-proportional (0 = window start, 1 = window end). */
  xFraction: number;
  /** 0..1 position within the series' own value range (0 = min value, 1 = max value). */
  yFraction: number;
}

/** Inclusive day-count from `from` to `to` — local copy of the pattern already duplicated across each *Dashboard.ts's `windowSpanDays`. */
function spanDays(from: string, to: string): number {
  let count = 0;
  let cursor = from;
  while (cursor < to) {
    cursor = addDays(cursor, 1);
    count += 1;
  }
  return count;
}

/**
 * Build the non-bucketed scrub series for `points` within `window`.
 *
 * A single point is centered (xFraction 0.5, yFraction 0) — there's no
 * range to position/normalize against, mirroring the compact *LineChart
 * components' single-dot convention (`x = VIEW_WIDTH / 2`).
 */
export function buildScrubSeries(
  points: ScrubPoint[],
  window: { from: string; to: string }
): ScrubSeriesPoint[] {
  if (points.length === 0) return [];

  if (points.length === 1) {
    return [{ ...points[0], xFraction: 0.5, yFraction: 0 }];
  }

  const totalSpan = spanDays(window.from, window.to) || 1;
  const values = points.map((p) => p.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const valueRange = maxValue - minValue || 1;

  return points.map((point) => ({
    date: point.date,
    value: point.value,
    xFraction: spanDays(window.from, point.date) / totalSpan,
    yFraction: (point.value - minValue) / valueRange,
  }));
}

/**
 * Find the index of the series point whose xFraction is nearest the given
 * xFraction. Naturally clamps drag positions outside [0, 1] (or beyond the
 * series' own span) to the first/last point, since those are the closest
 * points by construction — no separate bounds-check needed (spec: "Drag
 * bounds clamping").
 */
export function nearestIndex(series: ScrubSeriesPoint[], xFraction: number): number {
  if (series.length === 0) return -1;

  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let i = 0; i < series.length; i++) {
    const distance = Math.abs(series[i].xFraction - xFraction);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = i;
    }
  }

  return bestIndex;
}

/**
 * Pick up to `maxTicks` evenly-spaced series INDICES to label on the X axis
 * (always includes first & last when length >= 2). Returns `[]` for an
 * empty series, `[0]` for a single point. Never one-per-point — with up to
 * 90 points (3-month range) that would be illegible (spec: "X-axis date
 * tick labels").
 */
export function pickAxisTicks(series: ScrubSeriesPoint[], maxTicks = 4): number[] {
  const n = series.length;
  if (n === 0) return [];
  if (n === 1) return [0];
  if (n <= maxTicks) return series.map((_, i) => i);

  const ticks: number[] = [];
  for (let i = 0; i < maxTicks; i++) {
    ticks.push(Math.round((i * (n - 1)) / (maxTicks - 1)));
  }
  return Array.from(new Set(ticks));
}
