/** @jest-environment jsdom */
/**
 * Tests for useWeekProgress: the pure deriveWeekStatus / goalsMet (empty /
 * partial / complete, tolerance bands, future-day rule, per-day goals) and one
 * renderHook test that the hook follows goal-history changes without remount.
 */
import { act, renderHook, waitFor } from "@testing-library/react";

const mockGetTotals = jest.fn();
jest.mock("@/db/repos/mealEntries", () => ({
  getLoggedTotalsByDateRange: (...a: unknown[]) => mockGetTotals(...a),
}));

// Minimal real zustand stores: the real ones drag in Dexie, auth and sync.
jest.mock("@/stores/useGoalHistoryStore", () => {
  const { create } = require("zustand");
  return { useGoalHistoryStore: create(() => ({ entries: [] })) };
});
jest.mock("@/stores/useProfileStore", () => {
  const { create } = require("zustand");
  return { useProfileStore: create(() => ({ profile: null })) };
});
jest.mock("@/stores/useDayStore", () => {
  const { create } = require("zustand");
  return { useDayStore: create(() => ({ entries: [] })) };
});

import type { DayTotals } from "@/db/repos/mealEntries";
import { deriveWeekStatus, goalsMet, useWeekProgress } from "@/hooks/useWeekProgress";
import { useGoalHistoryStore } from "@/stores/useGoalHistoryStore";
import { useProfileStore } from "@/stores/useProfileStore";

const PAST_DAY = "2020-01-01";
const FUTURE_DAY = "2099-12-31";
const TODAY = "2024-06-24"; // fixed reference date for tests

const totalsOf = (date: string, calories: number): DayTotals => ({
  date,
  calories,
  proteinG: 0,
  carbsG: 0,
  fatG: 0,
});

/** Status of a single day against a fixed goal. */
function statusOf(day: string, totals: DayTotals | undefined, goal: number) {
  const map = new Map(totals ? [[day, totals]] : []);
  return deriveWeekStatus([day], TODAY, map, () => goal)[day];
}

describe("deriveWeekStatus", () => {
  it("returns empty when no totals data exists for a day", () => {
    expect(statusOf(PAST_DAY, undefined, 2000)).toBe("empty");
  });

  it("returns empty when calories are 0", () => {
    expect(statusOf(PAST_DAY, totalsOf(PAST_DAY, 0), 2000)).toBe("empty");
  });

  it("returns empty for a future day even if data exists, without looking up a goal", () => {
    const goalFor = jest.fn(() => 2000);
    const map = new Map([[FUTURE_DAY, totalsOf(FUTURE_DAY, 2000)]]);
    expect(deriveWeekStatus([FUTURE_DAY], TODAY, map, goalFor)[FUTURE_DAY]).toBe("empty");
    expect(goalFor).not.toHaveBeenCalled();
  });

  it("returns complete when calories are within tolerance, regardless of macros", () => {
    const totals = { ...totalsOf(PAST_DAY, 2000), proteinG: 50, carbsG: 400, fatG: 10 };
    expect(statusOf(PAST_DAY, totals, 2000)).toBe("complete");
  });

  it("returns partial when calories are out of tolerance (too low)", () => {
    expect(statusOf(PAST_DAY, totalsOf(PAST_DAY, 1000), 2000)).toBe("partial");
  });

  it("returns partial when calories are out of tolerance (too high)", () => {
    expect(statusOf(PAST_DAY, totalsOf(PAST_DAY, 3000), 2000)).toBe("partial");
  });

  it("returns partial when no goals are configured (goal = 0) and data exists", () => {
    expect(statusOf(PAST_DAY, totalsOf(PAST_DAY, 500), 0)).toBe("partial");
  });

  it("judges each day against the goal that applied on that date", () => {
    const days = ["2026-10-23", "2026-10-24"];
    const goalFor = (d: string) => (d < "2026-10-24" ? 1700 : 1600);
    const map = new Map(days.map((d) => [d, totalsOf(d, 1500)]));
    // 1500 is 88% of 1700 (partial) but 94% of 1600 (complete).
    expect(deriveWeekStatus(days, "2030-01-01", map, goalFor)).toEqual({
      "2026-10-23": "partial",
      "2026-10-24": "complete",
    });
  });
});

describe("goalsMet tolerance boundaries", () => {
  const at = (calories: number) => totalsOf(PAST_DAY, calories);

  it("accepts calories exactly at 90% lower bound", () => {
    expect(goalsMet(at(1800), 2000)).toBe(true);
  });

  it("rejects calories just below 90% lower bound", () => {
    expect(goalsMet(at(1799), 2000)).toBe(false);
  });

  it("accepts calories exactly at 110% upper bound", () => {
    expect(goalsMet(at(2200), 2000)).toBe(true);
  });

  it("rejects calories just above 110% upper bound", () => {
    expect(goalsMet(at(2201), 2000)).toBe(false);
  });
});

describe("useWeekProgress", () => {
  const WEEK_START = "2020-01-06"; // Monday
  const LOGGED_DAY = "2020-01-08";
  const entry = (effectiveFrom: string, calorieGoal: number) => ({
    effectiveFrom,
    calorieGoal,
    proteinGoalG: 150,
    carbsGoalG: 250,
    fatGoalG: 70,
    useManualGoals: false,
  });

  beforeEach(() => {
    mockGetTotals.mockResolvedValue([totalsOf(LOGGED_DAY, 1500)]);
    useGoalHistoryStore.setState({ entries: [] } as never);
    useProfileStore.setState({ profile: entry("2020-01-01", 1700) } as never);
  });

  it("flips the dot when the goal history changes, without remounting", async () => {
    const { result } = renderHook(() => useWeekProgress(WEEK_START));

    // Empty history: the live profile goal (1700) applies -> 1500 is 88%.
    await waitFor(() => expect(result.current[LOGGED_DAY]).toBe("partial"));

    // History says the goal was 1600 on that day -> 1500 is 94%.
    act(() => {
      useGoalHistoryStore.setState({ entries: [entry("2020-01-01", 1600)] } as never);
    });
    expect(result.current[LOGGED_DAY]).toBe("complete");
  });
});
