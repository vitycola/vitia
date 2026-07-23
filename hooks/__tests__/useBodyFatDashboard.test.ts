/** @jest-environment jsdom */
/**
 * Unit tests for useBodyFatDashboard — fetch+shape hook for the
 * Progress > % Grasa dashboard. Mocks the repo so only hook wiring (window
 * selection per range, VM shaping) is under test; the pure bucketing/sparse-
 * filtering math is covered exhaustively in lib/__tests__/bodyFatDashboard.test.ts.
 *
 * NOTE: rollingWindow()'s default `today` parameter binds directly to the
 * module-local todayISO within lib/date.ts, so overriding the `todayISO`
 * export via jest.mock does not affect rollingWindow's internal call (a
 * pre-existing limitation shared by hooks/__tests__/useWeightDashboard.test.ts).
 * Rather than hardcode a date, this suite resolves the actual "today" and
 * derives expected windows/logged-dates from lib/date's own helpers, so it
 * is not wall-clock-fragile.
 */
import { act, renderHook, waitFor } from "@testing-library/react";

jest.mock("@/db/repos/progress", () => ({
  getRange: jest.fn(),
}));

import * as progressRepo from "@/db/repos/progress";
import { addDays, rollingWindow, startOfWeek, todayISO, weekDays } from "@/lib/date";
import { useBodyFatDashboard } from "../useBodyFatDashboard";

const mockGetRange = progressRepo.getRange as jest.Mock;

const today = todayISO();
const weekStart = startOfWeek(today);
const weekEnd = weekDays(weekStart)[6];
const monthWindow = rollingWindow(30, today);
const threeMonthWindow = rollingWindow(90, today);

describe("useBodyFatDashboard", () => {
  beforeEach(() => {
    mockGetRange.mockReset();
  });

  it("week range: fetches the calendar-week window", async () => {
    mockGetRange.mockResolvedValue([]);

    const { result } = renderHook(() => useBodyFatDashboard("week"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockGetRange).toHaveBeenCalledWith(weekStart, weekEnd);
  });

  it("month range: fetches a rolling 30-day window", async () => {
    mockGetRange.mockResolvedValue([]);

    const { result } = renderHook(() => useBodyFatDashboard("month"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockGetRange).toHaveBeenCalledWith(monthWindow.from, monthWindow.to);
  });

  it("3month range: fetches a rolling 90-day window", async () => {
    mockGetRange.mockResolvedValue([]);

    const { result } = renderHook(() => useBodyFatDashboard("3month"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockGetRange).toHaveBeenCalledWith(threeMonthWindow.from, threeMonthWindow.to);
  });

  it("keeps only rows where bodyFatPct is logged (sparse points)", async () => {
    const day1 = weekStart;
    const day2 = addDays(weekStart, 1);
    const day3 = addDays(weekStart, 2);

    mockGetRange.mockResolvedValue([
      { date: day1, bodyFatPct: 22.4 },
      { date: day2, bodyFatPct: null },
      { date: day3, bodyFatPct: 21.1 },
    ]);

    const { result } = renderHook(() => useBodyFatDashboard("week"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.points).toEqual([
      { date: day1, value: 22.4 },
      { date: day3, value: 21.1 },
    ]);
  });

  it("re-fetches when the range argument changes", async () => {
    mockGetRange.mockResolvedValue([]);

    const { result, rerender } = renderHook(({ range }) => useBodyFatDashboard(range), {
      initialProps: { range: "week" as const },
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockGetRange).toHaveBeenCalledTimes(1);

    act(() => {
      rerender({ range: "month" as const });
    });

    await waitFor(() => expect(mockGetRange).toHaveBeenCalledTimes(2));
    expect(mockGetRange).toHaveBeenLastCalledWith(monthWindow.from, monthWindow.to);
  });

  it("exposes the resolved window {from, to} in the returned VM", async () => {
    mockGetRange.mockResolvedValue([]);

    const { result } = renderHook(() => useBodyFatDashboard("month"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.window).toEqual(monthWindow);
  });

  it("derives renderState 'empty' when zero points are logged in the window", async () => {
    mockGetRange.mockResolvedValue([]);

    const { result } = renderHook(() => useBodyFatDashboard("week"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.renderState).toBe("empty");
  });

  it("derives renderState 'empty' when every row in range has bodyFatPct null", async () => {
    mockGetRange.mockResolvedValue([
      { date: weekStart, bodyFatPct: null },
      { date: addDays(weekStart, 1), bodyFatPct: null },
    ]);

    const { result } = renderHook(() => useBodyFatDashboard("week"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.renderState).toBe("empty");
    expect(result.current.latest).toBeNull();
  });

  it("derives renderState 'single' when exactly one point is logged", async () => {
    mockGetRange.mockResolvedValue([{ date: today, bodyFatPct: 22.4 }]);

    const { result } = renderHook(() => useBodyFatDashboard("week"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.renderState).toBe("single");
  });

  it("exposes latest and delta derived from the sparse points", async () => {
    const day1 = weekStart;
    const day3 = addDays(weekStart, 2);

    mockGetRange.mockResolvedValue([
      { date: day1, bodyFatPct: 22.4 },
      { date: day3, bodyFatPct: 21.1 },
    ]);

    const { result } = renderHook(() => useBodyFatDashboard("week"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.latest).toBe(21.1);
    expect(result.current.delta).toBeCloseTo(-1.3);
  });
});
