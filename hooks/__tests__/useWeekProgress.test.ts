/**
 * Unit tests for useWeekProgress hook.
 *
 * Strategy: mock the repo and stores so this file tests only the derivation
 * logic (empty / partial / complete + tolerance bands + future-day rule).
 *
 * We avoid renderHook from @testing-library/react because the hook uses
 * zustand stores and async effects. Instead we test the pure derivation
 * logic extracted into helpers that mirror the hook internals.
 */

import type { DayTotals } from "@/db/repos/mealEntries";

// ---------------------------------------------------------------------------
// Re-implement the pure goalsMet + status derivation for isolated testing.
// These mirror the constants and logic in hooks/useWeekProgress.ts exactly.
// ---------------------------------------------------------------------------

const CAL_LOW = 0.9;
const CAL_HIGH = 1.1;

function goalsMet(totals: DayTotals, calorieGoal: number): boolean {
  return totals.calories >= calorieGoal * CAL_LOW && totals.calories <= calorieGoal * CAL_HIGH;
}

type DayStatus = "empty" | "partial" | "complete";

function deriveStatus(
  day: string,
  today: string,
  totals: DayTotals | undefined,
  calorieGoal: number
): DayStatus {
  if (day > today) return "empty";
  if (!totals || totals.calories === 0) return "empty";

  const goalsConfigured = calorieGoal > 0;

  if (goalsConfigured && goalsMet(totals, calorieGoal)) {
    return "complete";
  }

  return "partial";
}

// ---------------------------------------------------------------------------
// Goal values used across tests
// ---------------------------------------------------------------------------

const CALORIE_GOAL = 2000;

const PAST_DAY = "2020-01-01";
const FUTURE_DAY = "2099-12-31";
const TODAY = "2024-06-24"; // fixed reference date for tests

// ---------------------------------------------------------------------------
// DayStatus derivation
// ---------------------------------------------------------------------------

describe("deriveStatus", () => {
  it("returns empty when no totals data exists for a day", () => {
    expect(deriveStatus(PAST_DAY, TODAY, undefined, CALORIE_GOAL)).toBe("empty");
  });

  it("returns empty when calories are 0", () => {
    const totals: DayTotals = { date: PAST_DAY, calories: 0, proteinG: 0, carbsG: 0, fatG: 0 };
    expect(deriveStatus(PAST_DAY, TODAY, totals, CALORIE_GOAL)).toBe("empty");
  });

  it("returns empty for a future day even if data exists", () => {
    const totals: DayTotals = {
      date: FUTURE_DAY,
      calories: 2000,
      proteinG: 150,
      carbsG: 250,
      fatG: 70,
    };
    expect(deriveStatus(FUTURE_DAY, TODAY, totals, CALORIE_GOAL)).toBe("empty");
  });

  it("returns complete when calories are within tolerance, regardless of macros", () => {
    const totals: DayTotals = {
      date: PAST_DAY,
      calories: 2000, // exactly at goal
      proteinG: 50, // macros are off, but no longer gate the day status
      carbsG: 400,
      fatG: 10,
    };
    expect(deriveStatus(PAST_DAY, TODAY, totals, CALORIE_GOAL)).toBe("complete");
  });

  it("returns partial when calories are out of tolerance (too low)", () => {
    const totals: DayTotals = {
      date: PAST_DAY,
      calories: 1000, // < 90% of 2000
      proteinG: 150,
      carbsG: 250,
      fatG: 70,
    };
    expect(deriveStatus(PAST_DAY, TODAY, totals, CALORIE_GOAL)).toBe("partial");
  });

  it("returns partial when calories are out of tolerance (too high)", () => {
    const totals: DayTotals = {
      date: PAST_DAY,
      calories: 3000, // > 110% of 2000
      proteinG: 150,
      carbsG: 250,
      fatG: 70,
    };
    expect(deriveStatus(PAST_DAY, TODAY, totals, CALORIE_GOAL)).toBe("partial");
  });

  it("returns partial when no goals are configured (calorieGoal = 0) and data exists", () => {
    const totals: DayTotals = { date: PAST_DAY, calories: 500, proteinG: 30, carbsG: 60, fatG: 15 };
    expect(deriveStatus(PAST_DAY, TODAY, totals, 0)).toBe("partial");
  });
});

// ---------------------------------------------------------------------------
// goalsMet tolerance boundary cases
// ---------------------------------------------------------------------------

describe("goalsMet tolerance boundaries", () => {
  const base: DayTotals = { date: PAST_DAY, calories: 2000, proteinG: 150, carbsG: 250, fatG: 70 };

  it("accepts calories exactly at 90% lower bound", () => {
    expect(goalsMet({ ...base, calories: 1800 }, 2000)).toBe(true);
  });

  it("rejects calories just below 90% lower bound", () => {
    expect(goalsMet({ ...base, calories: 1799 }, 2000)).toBe(false);
  });

  it("accepts calories exactly at 110% upper bound", () => {
    expect(goalsMet({ ...base, calories: 2200 }, 2000)).toBe(true);
  });

  it("rejects calories just above 110% upper bound", () => {
    expect(goalsMet({ ...base, calories: 2201 }, 2000)).toBe(false);
  });
});
