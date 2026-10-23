import type { ProgressEntry, UserProfile } from "@/db/schema";
import { addDays, enumerateDays, rollingWindow } from "./date";

/** Maximum number of days (inclusive) a single export may span. */
export const MAX_EXPORT_DAYS = 366;

export type ExportRange = { from: string; to: string };
export type ExportRangeError = "invalid_order" | "future" | "too_long" | null;

/** Daily meal totals as returned by the meal-entries facade. */
export interface ExportDayTotals {
  date: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface ExportRow {
  date: string;
  /** True iff the day has at least one meal entry. Progress never affects it. */
  logged: boolean;
  caloriesKcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  weightKg: number | null;
  neckCm: number | null;
  chestCm: number | null;
  armCm: number | null;
  waistCm: number | null;
  hipCm: number | null;
  thighCm: number | null;
  bodyFatPct: number | null;
}

export interface ExportTargets {
  calorieKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface ExportModel {
  range: ExportRange;
  rows: ExportRow[];
  targets: ExportTargets | null;
  /** True when at least one progress row falls inside the range. */
  hasProgress: boolean;
}

export interface ExportSummary {
  days: number;
  logged: number;
  unlogged: number;
  hasProgress: boolean;
  avg: { kcal: number; proteinG: number; carbsG: number; fatG: number } | null;
}

/** Validate a range against the export rules. Dates are device-local ISO strings. */
export function validateRange(r: ExportRange, today: string): ExportRangeError {
  if (r.to < r.from) return "invalid_order";
  if (r.from > today || r.to > today) return "future";
  // Latest allowed `to` for this `from` is from + (MAX - 1) days.
  if (r.to > addDays(r.from, MAX_EXPORT_DAYS - 1)) return "too_long";
  return null;
}

/** Rolling window of `days` days ending today (inclusive). */
export function presetRange(days: 7 | 30 | 90, today: string): ExportRange {
  return rollingWindow(days, today);
}

export function exportFileName(r: ExportRange, ext: "csv" | "pdf"): string {
  return `vitia-${r.from}_${r.to}.${ext}`;
}

/**
 * Pure builder: one row per calendar day in the range. Nutrition is filled
 * only on days with meals; body data is filled whenever a progress row exists
 * for that exact date. Missing values are null — never 0, never carried over.
 */
export function buildExportModel(
  range: ExportRange,
  totals: ExportDayTotals[],
  progress: ProgressEntry[],
  profile: UserProfile | null
): ExportModel {
  const totalsByDate = new Map(totals.map((t) => [t.date, t]));
  const progressByDate = new Map(progress.map((p) => [p.date, p]));

  const rows = enumerateDays(range.from, range.to).map((date): ExportRow => {
    const t = totalsByDate.get(date);
    const p = progressByDate.get(date);
    return {
      date,
      logged: t !== undefined,
      caloriesKcal: t ? t.calories : null,
      proteinG: t ? t.proteinG : null,
      carbsG: t ? t.carbsG : null,
      fatG: t ? t.fatG : null,
      weightKg: p?.weightKg ?? null,
      neckCm: p?.neckCm ?? null,
      chestCm: p?.chestCm ?? null,
      armCm: p?.armCm ?? null,
      waistCm: p?.waistCm ?? null,
      hipCm: p?.hipCm ?? null,
      thighCm: p?.thighCm ?? null,
      bodyFatPct: p?.bodyFatPct ?? null,
    };
  });

  return {
    range,
    rows,
    targets: profile
      ? {
          calorieKcal: profile.calorieGoal,
          proteinG: profile.proteinGoalG,
          carbsG: profile.carbsGoalG,
          fatG: profile.fatGoalG,
        }
      : null,
    hasProgress: progress.some((p) => p.date >= range.from && p.date <= range.to),
  };
}

/** Counts and daily averages (logged days only) derived from the same model as the file. */
export function summarize(m: ExportModel): ExportSummary {
  const loggedRows = m.rows.filter((r) => r.logged);
  const logged = loggedRows.length;
  const mean = (pick: (r: ExportRow) => number | null) =>
    loggedRows.reduce((sum, r) => sum + (pick(r) ?? 0), 0) / logged;

  return {
    days: m.rows.length,
    logged,
    unlogged: m.rows.length - logged,
    hasProgress: m.hasProgress,
    avg:
      logged === 0
        ? null
        : {
            kcal: mean((r) => r.caloriesKcal),
            proteinG: mean((r) => r.proteinG),
            carbsG: mean((r) => r.carbsG),
            fatG: mean((r) => r.fatG),
          },
  };
}
