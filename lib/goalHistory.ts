/**
 * Pure helpers for the versioned calorie/macro goal history.
 * Dates are device-local YYYY-MM-DD strings (see lib/date.ts), so plain
 * string comparison orders them chronologically.
 */

import { goalEditorSchema } from "@/lib/goalSchema";

/** Owner marker for history recorded while signed out (no auth user id). */
export const LOCAL_GOAL_OWNER = "local";

/** The goal fields tracked by the history. */
export interface GoalSnapshot {
  calorieGoal: number;
  proteinGoalG: number;
  carbsGoalG: number;
  fatGoalG: number;
  useManualGoals: boolean;
}

/**
 * Pick the history entry that applies to `date`: the one with the greatest
 * effectiveFrom <= date. A date before every entry resolves to the earliest
 * entry (history was seeded after those days were logged). Returns null for an
 * empty history so the caller can fall back to the live profile goals.
 * Does not mutate the input and accepts unsorted history.
 */
export function goalForDate<T extends { effectiveFrom: string }>(
  history: readonly T[],
  date: string
): T | null {
  let applicable: T | null = null;
  let earliest: T | null = null;

  for (const entry of history) {
    if (earliest === null || entry.effectiveFrom < earliest.effectiveFrom) earliest = entry;
    if (
      entry.effectiveFrom <= date &&
      (applicable === null || entry.effectiveFrom > applicable.effectiveFrom)
    ) {
      applicable = entry;
    }
  }

  return applicable ?? earliest;
}

/** True when every tracked goal field is identical. */
export function goalsEqual(a: GoalSnapshot, b: GoalSnapshot): boolean {
  return (
    a.calorieGoal === b.calorieGoal &&
    a.proteinGoalG === b.proteinGoalG &&
    a.carbsGoalG === b.carbsGoalG &&
    a.fatGoalG === b.fatGoalG &&
    a.useManualGoals === b.useManualGoals
  );
}

/** Extract only the tracked goal fields from a profile-like object. */
export function pickGoals(source: GoalSnapshot): GoalSnapshot {
  return {
    calorieGoal: source.calorieGoal,
    proteinGoalG: source.proteinGoalG,
    carbsGoalG: source.carbsGoalG,
    fatGoalG: source.fatGoalG,
    useManualGoals: source.useManualGoals,
  };
}

/**
 * Goals that applied on `date`: the history entry covering it, else the live
 * profile goals, else null (no history and no profile). Single home of the
 * fallback so the store and the React hooks cannot drift apart.
 */
export function resolveGoalFor(
  entries: readonly (GoalSnapshot & { effectiveFrom: string })[],
  profile: GoalSnapshot | null | undefined,
  date: string
): GoalSnapshot | null {
  const entry = goalForDate(entries, date);
  if (entry) return pickGoals(entry);
  return profile ? pickGoals(profile) : null;
}

/**
 * Epoch ms of a stored timestamp: an ISO string, a Postgres-style one with a
 * bare "+00"/"-05" offset, or SQLite's "YYYY-MM-DD HH:MM:SS" (UTC, no zone),
 * which Date.parse alone would read as local time. NaN when unparseable.
 */
export function parseTimestampMs(timestamp: string): number {
  const match = timestamp.match(
    /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)(Z|[+-]\d{2}(?::?\d{2})?)?$/i
  );
  if (!match) return Number.NaN;

  const [, date, time, zone] = match;
  let offset = "Z";
  if (zone && zone.toUpperCase() !== "Z") {
    const digits = zone.slice(1).replace(":", "");
    offset = `${zone[0]}${digits.slice(0, 2)}:${digits.slice(2) || "00"}`;
  }
  // Date.parse only accepts up to millisecond precision reliably.
  const normalizedTime = time.replace(/(\.\d{3})\d+/, "$1");
  return Date.parse(`${date}T${normalizedTime}${offset}`);
}

/**
 * Convert a stored timestamp into the device-local YYYY-MM-DD date.
 * Returns null if unparseable.
 */
export function timestampToLocalDate(timestamp: string): string | null {
  const ms = parseTimestampMs(timestamp);
  if (Number.isNaN(ms)) return null;

  const parsed = new Date(ms);
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** True for a real calendar date written as YYYY-MM-DD. */
export function isValidISODate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** A goal_history row pulled from the cloud, before validation. */
export interface UntrustedGoalHistoryRow {
  effective_from?: unknown;
  calorie_goal?: unknown;
  protein_goal_g?: unknown;
  carbs_goal_g?: unknown;
  fat_goal_g?: unknown;
  use_manual_goals?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
}

/**
 * True when a pulled row is safe to store: a real YYYY-MM-DD effective_from,
 * finite goals within the ranges the goal editor enforces, a boolean flag and
 * parseable timestamps.
 */
export function isValidRemoteGoalHistory(row: UntrustedGoalHistoryRow): boolean {
  if (!isValidISODate(row.effective_from)) return false;
  const numbers = [row.calorie_goal, row.protein_goal_g, row.carbs_goal_g, row.fat_goal_g];
  if (!numbers.every((n) => typeof n === "number" && Number.isFinite(n))) return false;
  if (typeof row.use_manual_goals !== "boolean") return false;
  if (typeof row.created_at !== "string" || typeof row.updated_at !== "string") return false;
  if (Number.isNaN(parseTimestampMs(row.updated_at))) return false;
  return goalEditorSchema.safeParse({
    calorieGoal: row.calorie_goal,
    proteinGoalG: row.protein_goal_g,
    carbsGoalG: row.carbs_goal_g,
    fatGoalG: row.fat_goal_g,
  }).success;
}
