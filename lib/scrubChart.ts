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

/**
 * Vertical padding applied to yFraction so the min/max logged values never
 * touch the very top/bottom of the plot (0.15 -> 0.85, not 0 -> 1). Without
 * this, a small real change (e.g. 1kg) stretches to fill the whole chart
 * height and visually reads as a dramatic swing.
 */
const Y_PADDING = 0.15;

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
    yFraction: Y_PADDING + ((point.value - minValue) / valueRange) * (1 - 2 * Y_PADDING),
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
 * Pick up to `maxTicks` series indices to label on the X axis, chosen by
 * real screen POSITION (xFraction), not by array index. Points are
 * date-proportional and often unevenly spaced (e.g. a few old sparse points
 * plus many recent daily ones) — picking evenly-spaced INDICES would
 * cluster several ticks in the same dense region and overlap on screen.
 * Snapping `maxTicks` evenly-spaced target fractions to their nearest real
 * point (reusing `nearestIndex`) and deduping naturally thins out crowded
 * regions instead. Returns `[]` for an empty series, `[0]` for a single
 * point; always includes first & last for length >= 2 (target fractions 0
 * and 1 resolve to the endpoints).
 */
export function pickAxisTicks(series: ScrubSeriesPoint[], maxTicks = 7): number[] {
  const n = series.length;
  if (n === 0) return [];
  if (n === 1) return [0];

  const ticks: number[] = [];
  for (let i = 0; i < maxTicks; i++) {
    const targetFraction = i / (maxTicks - 1);
    ticks.push(nearestIndex(series, targetFraction));
  }
  return Array.from(new Set(ticks)).sort((a, b) => a - b);
}
