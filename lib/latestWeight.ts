import type { ProgressEntry } from "@/db/schema";

/**
 * Weight of the most recent progress entry (by YYYY-MM-DD date) that has a
 * usable weight and is dated on or before `today` (device-local), or null.
 * Future-dated entries are ignored until their day arrives. Dates are unique
 * per entry, so no further tie-break is needed.
 */
export function pickLatestWeight(
  entries: ReadonlyArray<Pick<ProgressEntry, "date" | "weightKg">>,
  today: string
): number | null {
  let latest: { date: string; weightKg: number } | null = null;
  for (const entry of entries) {
    const w = entry.weightKg;
    if (entry.date > today) continue;
    if (w === null || w === undefined || !Number.isFinite(w) || w <= 0) continue;
    if (latest === null || entry.date > latest.date) latest = { date: entry.date, weightKg: w };
  }
  return latest ? latest.weightKg : null;
}
