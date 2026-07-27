/**
 * Pure data-shaping functions for the Progress > Medidas dashboard.
 * No DB/DOM access — all inputs (rows, date range, metric) are passed in
 * explicitly so these are fully unit-testable. Mirrors the shape of
 * lib/calorieDashboard.ts, diverging where measurements are structurally
 * different: sparse (logged-days-only) points, carry-forward 3-month
 * bucketing (never averaged), and a line (not bar) render.
 */

import { addDays, splitBuckets } from "@/lib/date";

export type DashboardRange = "week" | "month" | "3month";

export type MetricKey = "waistCm" | "hipCm" | "neckCm" | "chestCm" | "armCm" | "thighCm";

export const METRICS: { key: MetricKey; label: string }[] = [
  { key: "waistCm", label: "Cintura" },
  { key: "hipCm", label: "Cadera" },
  { key: "neckCm", label: "Cuello" },
  { key: "chestCm", label: "Pecho" },
  { key: "armCm", label: "Brazo" },
  { key: "thighCm", label: "Muslo" },
];

export interface MeasurementEntryRow {
  date: string;
  waistCm: number | null;
  hipCm: number | null;
  neckCm: number | null;
  chestCm: number | null;
  armCm: number | null;
  thighCm: number | null;
}

export interface MeasurementPoint {
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
 * Map ProgressEntry-like rows to sparse MeasurementPoint[], keeping ONLY
 * rows where the active metric's field is non-null. Ascending by date.
 */
export function toPoints(rows: MeasurementEntryRow[], metric: MetricKey): MeasurementPoint[] {
  return rows
    .filter((row) => row[metric] != null)
    .map((row) => ({ date: row.date, value: row[metric] as number }))
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
  points: MeasurementPoint[],
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
 * value of the most recent logged MeasurementPoint whose date <=
 * bucket_i.to, searched across the FULL window (not restricted to points
 * inside the bucket). If no logged point exists at/before bucket_i.to,
 * value_i = null (only possible for leading buckets before the first-ever
 * log).
 */
export function carryForwardBuckets(
  points: MeasurementPoint[],
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
    return { label: relativeBucketLabelFor(index), value };
  });
}

// Local copy of Calorías' relative bucket labels — no re-export needed since
// lib/date.ts already exposes relativeBucketLabel with the identical mapping.
function relativeBucketLabelFor(index: number): string {
  const LABELS = ["Hace 61-90 días", "Hace 31-60 días", "Últimos 30 días"];
  return LABELS[index];
}

/** The most recent logged value, or null when there are no points. */
export function latestValue(points: MeasurementPoint[]): number | null {
  if (points.length === 0) return null;
  return points[points.length - 1].value;
}

/**
 * Difference between the last and first point's value, or null when fewer
 * than 2 points exist (no meaningful delta to show).
 */
export function deltaFromFirst(points: MeasurementPoint[]): number | null {
  if (points.length < 2) return null;
  return points[points.length - 1].value - points[0].value;
}

/**
 * Resolve the {from, to} fetch window for a given dashboard range —
 * IDENTICAL semantics to Calorías' resolveWindow so selectedRange never
 * diverges between cards. Exposed here for reuse/testing; addDays is used
 * directly by the hook via lib/date's rollingWindow/startOfWeek/weekDays.
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
