/**
 * Pure data-shaping functions for the Progress > Calorías dashboard.
 * No DB/DOM access — all inputs (rows, date range) are passed in explicitly
 * so these are fully unit-testable.
 *
 * Averaging rule (all ranges): the denominator is the COUNT of imputed rows
 * (days with a `DayTotals` row), never the number of calendar days in the
 * window. A day absent from `getLoggedTotalsByDateRange` is excluded from
 * both numerator and denominator — it is not a zero.
 */

import { enumerateDays, relativeBucketLabel, splitBuckets } from "@/lib/date";

export type DashboardRange = "week" | "month" | "3month";

export interface DayTotals {
  date: string;
  calories: number;
}

export interface BarDatum {
  key: string;
  label: string;
  kcal: number;
  imputed: boolean;
}

const BUCKET_SIZE = 30;

/**
 * Average daily calories across imputed rows only. Returns null when there
 * are no imputed rows (avoids dividing by zero / rendering NaN).
 */
export function imputedAverage(rows: DayTotals[]): number | null {
  if (rows.length === 0) return null;
  const sum = rows.reduce((acc, row) => acc + row.calories, 0);
  return sum / rows.length;
}

/**
 * Build the bar dataset for a given range:
 * - week/month: one BarDatum per calendar day in [from, to]. Absent days
 *   render as a zero/empty bar (imputed=false), never omitted.
 * - 3month: exactly 3 BarDatum, one per 30-day bucket, using the bucket's
 *   imputed-only average (or 0 when the bucket has no imputed days).
 */
export function buildBars(
  range: DashboardRange,
  byDate: Map<string, number>,
  from: string,
  to: string
): BarDatum[] {
  if (range === "3month") {
    const buckets = splitBuckets(from, to, BUCKET_SIZE);
    return buckets.map((bucket, index) => {
      const rows = enumerateDays(bucket.from, bucket.to)
        .filter((date) => byDate.has(date))
        .map((date) => ({ date, calories: byDate.get(date) as number }));
      const average = imputedAverage(rows);
      return {
        key: `bucket-${index}`,
        label: relativeBucketLabel(index),
        kcal: average ?? 0,
        imputed: average !== null,
      };
    });
  }

  return enumerateDays(from, to).map((date) => {
    const kcal = byDate.get(date);
    return {
      key: date,
      label: date,
      kcal: kcal ?? 0,
      imputed: kcal !== undefined,
    };
  });
}

/**
 * Build the 3 relative-labeled buckets (oldest → newest) for the 3-Month
 * range, with imputed-only averaging per bucket. Used directly by
 * `buildBars("3month", ...)` and exposed separately for testing/reuse.
 */
export function buildBuckets(
  rows: DayTotals[],
  from: string,
  to: string
): { label: string; average: number | null }[] {
  const byDate = new Map(rows.map((row) => [row.date, row.calories]));
  const buckets = splitBuckets(from, to, BUCKET_SIZE);

  return buckets.map((bucket, index) => {
    const bucketRows = enumerateDays(bucket.from, bucket.to)
      .filter((date) => byDate.has(date))
      .map((date) => ({ date, calories: byDate.get(date) as number }));
    return {
      label: relativeBucketLabel(index),
      average: imputedAverage(bucketRows),
    };
  });
}

/**
 * Build the historical-overlay row list: exactly one row per calendar day
 * in [from, to], daily granularity always (even for the 3-Month window,
 * which is never re-bucketed in the overlay). Absent days render as
 * `{ kcal: 0 }` — never omitted — so row count always equals window size.
 *
 * Rows are returned in DESCENDING date order (most recent/`to` first,
 * oldest/`from` last) so the overlay reads newest-first.
 */
export function buildOverlayRows(
  from: string,
  to: string,
  byDate: Map<string, number>
): { date: string; kcal: number }[] {
  return enumerateDays(from, to)
    .map((date) => ({
      date,
      kcal: byDate.get(date) ?? 0,
    }))
    .reverse();
}
