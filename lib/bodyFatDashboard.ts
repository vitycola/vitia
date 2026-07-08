/**
 * Pure data-shaping functions for the Progress > % Grasa dashboard.
 * No DB/DOM access — all inputs (rows, date range) are passed in
 * explicitly so these are fully unit-testable. Mirrors the shape of
 * lib/weightDashboard.ts, parameterized to a single hardcoded metric
 * (bodyFatPct) instead of a MetricKey union: sparse (logged-days-only)
 * points, carry-forward 3-month bucketing (never averaged), and a line
 * (not bar) render.
 */

import { addDays, relativeBucketLabel, splitBuckets } from "@/lib/date";

export type DashboardRange = "week" | "month" | "3month";

export const BODY_FAT_UNIT = "%" as const;

export interface BodyFatEntryRow {
  date: string;
  bodyFatPct: number | null;
}

export interface BodyFatPoint {
  date: string;
  value: number;
}

export interface LinePoint {
  key: string;
  label: string;
  value: number | null;
}

export type RenderState = "empty" | "single" | "line";

export interface LineResult {
  points: LinePoint[];
  renderState: RenderState;
}

const BUCKET_SIZE = 30;

/**
 * Map ProgressEntry-like rows to sparse BodyFatPoint[], keeping ONLY rows
 * where bodyFatPct is non-null. Ascending by date.
 */
export function toPoints(rows: BodyFatEntryRow[]): BodyFatPoint[] {
  return rows
    .filter((row) => row.bodyFatPct != null)
    .map((row) => ({ date: row.date, value: row.bodyFatPct as number }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/**
 * Build the line dataset for a given range:
 * - week/month: one LinePoint PER LOGGED point only (not one-per-calendar-day
 *   like Calorías bars) — sparse, date-proportional X is derived by the chart.
 * - 3month: exactly 3 LinePoint, one per 30-day bucket, using CARRY-FORWARD
 *   (never averaging) — see carryForwardBuckets.
 *
 * renderState is derived from the count of non-null values actually drawable:
 * 0 -> "empty", 1 -> "single", >=2 -> "line".
 */
export function buildLine(
  range: DashboardRange,
  points: BodyFatPoint[],
  from: string,
  to: string
): LineResult {
  if (range === "3month") {
    const buckets = carryForwardBuckets(points, from, to);
    const linePoints: LinePoint[] = buckets.map((bucket, index) => ({
      key: `bucket-${index}`,
      label: bucket.label,
      value: bucket.value,
    }));
    const drawableCount = linePoints.filter((p) => p.value !== null).length;
    return { points: linePoints, renderState: renderStateFor(drawableCount) };
  }

  const linePoints: LinePoint[] = points.map((point) => ({
    key: point.date,
    label: point.date,
    value: point.value,
  }));

  return { points: linePoints, renderState: renderStateFor(linePoints.length) };
}

function renderStateFor(drawableCount: number): RenderState {
  if (drawableCount === 0) return "empty";
  if (drawableCount === 1) return "single";
  return "line";
}

/**
 * Build the 3 relative-labeled buckets (oldest -> newest) for the 3-Month
 * range using CARRY-FORWARD, NOT averaging: for bucket i, value_i = the
 * value of the most recent logged BodyFatPoint whose date <= bucket_i.to,
 * searched across the FULL window (not restricted to points inside the
 * bucket). If no logged point exists at/before bucket_i.to, value_i = null
 * (only possible for leading buckets before the first-ever log).
 */
export function carryForwardBuckets(
  points: BodyFatPoint[],
  from: string,
  to: string
): { label: string; value: number | null }[] {
  const sorted = [...points].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const buckets = splitBuckets(from, to, BUCKET_SIZE);

  return buckets.map((bucket, index) => {
    let value: number | null = null;
    for (const point of sorted) {
      if (point.date <= bucket.to) {
        value = point.value;
      } else {
        break;
      }
    }
    return { label: relativeBucketLabel(index), value };
  });
}

/**
 * Build the historical-overlay row list: sparse (logged days only, never a
 * zero/placeholder row for unlogged days). Rows are DESCENDING date order
 * (most recent first).
 */
export function buildOverlayRows(rows: BodyFatEntryRow[]): { date: string; value: number }[] {
  return toPoints(rows)
    .map((point) => ({ date: point.date, value: point.value }))
    .reverse();
}

/** The most recent logged value, or null when there are no points. */
export function latestValue(points: BodyFatPoint[]): number | null {
  if (points.length === 0) return null;
  return points[points.length - 1].value;
}

/**
 * Difference between the last and first point's value, or null when fewer
 * than 2 points exist (no meaningful delta to show).
 */
export function deltaFromFirst(points: BodyFatPoint[]): number | null {
  if (points.length < 2) return null;
  return points[points.length - 1].value - points[0].value;
}

/**
 * Resolve the {from, to} fetch window for a given dashboard range —
 * IDENTICAL semantics to Calorías'/Medidas' resolveWindow so selectedRange
 * never diverges between cards.
 */
export function windowSpanDays(from: string, to: string): number {
  let count = 0;
  let cursor = from;
  while (cursor < to) {
    cursor = addDays(cursor, 1);
    count += 1;
  }
  return count;
}
