/** @jest-environment jsdom */
/**
 * Unit tests for useMeasurementsDashboard — fetch+shape hook for the
 * Progress > Medidas dashboard. Mocks the repo so only hook wiring (window
 * selection per range, VM shaping, metric refiltering) is under test; the
 * pure bucketing/sparse-filtering math is covered exhaustively in
 * lib/__tests__/measurementsDashboard.test.ts.
 *
 * NOTE: rollingWindow()'s default `today` parameter binds directly to the
 * module-local todayISO within lib/date.ts, so overriding the `todayISO`
 * export via jest.mock does not affect rollingWindow's internal call (a
 * pre-existing limitation shared by hooks/__tests__/useCalorieDashboard.test.ts).
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
import { useMeasurementsDashboard } from "../useMeasurementsDashboard";

const mockGetRange = progressRepo.getRange as jest.Mock;

const today = todayISO();
const weekStart = startOfWeek(today);
const weekEnd = weekDays(weekStart)[6];
const monthWindow = rollingWindow(30, today);
const threeMonthWindow = rollingWindow(90, today);

describe("useMeasurementsDashboard", () => {
  beforeEach(() => {
    mockGetRange.mockReset();
  });

  it("week range: fetches the calendar-week window", async () => {
    mockGetRange.mockResolvedValue([]);

    const { result } = renderHook(() => useMeasurementsDashboard("week", "waistCm"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockGetRange).toHaveBeenCalledWith(weekStart, weekEnd);
  });

  it("month range: fetches a rolling 30-day window", async () => {
    mockGetRange.mockResolvedValue([]);

    const { result } = renderHook(() => useMeasurementsDashboard("month", "waistCm"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockGetRange).toHaveBeenCalledWith(monthWindow.from, monthWindow.to);
  });

  it("3month range: fetches a rolling 90-day window", async () => {
    mockGetRange.mockResolvedValue([]);

    const { result } = renderHook(() => useMeasurementsDashboard("3month", "waistCm"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockGetRange).toHaveBeenCalledWith(threeMonthWindow.from, threeMonthWindow.to);
  });

  it("keeps only rows where the active metric is logged (sparse points)", async () => {
    const day1 = weekStart;
    const day2 = addDays(weekStart, 1);
    const day3 = addDays(weekStart, 2);

    mockGetRange.mockResolvedValue([
      { date: day1, waistCm: 90, hipCm: null },
      { date: day2, waistCm: null, hipCm: 100 },
      { date: day3, waistCm: 89, hipCm: null },
    ]);

    const { result } = renderHook(() => useMeasurementsDashboard("week", "waistCm"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.points).toEqual([
      { date: day1, value: 90 },
      { date: day3, value: 89 },
    ]);
  });

  it("refilters the same fetched entries when metric changes, without a new getRange call", async () => {
    const day1 = weekStart;
    const day2 = addDays(weekStart, 1);

    mockGetRange.mockResolvedValue([
      { date: day1, waistCm: 90, hipCm: 100 },
      { date: day2, waistCm: null, hipCm: 101 },
    ]);

    const { result, rerender } = renderHook(
      ({ metric }) => useMeasurementsDashboard("week", metric),
      { initialProps: { metric: "waistCm" as const } }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockGetRange).toHaveBeenCalledTimes(1);

    rerender({ metric: "hipCm" as const });

    expect(mockGetRange).toHaveBeenCalledTimes(1);
    expect(result.current.points).toEqual([
      { date: day1, value: 100 },
      { date: day2, value: 101 },
    ]);
  });

  it("re-fetches when the range argument changes", async () => {
    mockGetRange.mockResolvedValue([]);

    const { result, rerender } = renderHook(
      ({ range }) => useMeasurementsDashboard(range, "waistCm"),
      { initialProps: { range: "week" as const } }
    );

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

    const { result } = renderHook(() => useMeasurementsDashboard("month", "waistCm"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.window).toEqual(monthWindow);
  });

  it("derives renderState 'empty' when zero points are logged in the window", async () => {
    mockGetRange.mockResolvedValue([]);

    const { result } = renderHook(() => useMeasurementsDashboard("week", "waistCm"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.renderState).toBe("empty");
  });

  it("derives renderState 'single' when exactly one point is logged", async () => {
    mockGetRange.mockResolvedValue([{ date: today, waistCm: 90 }]);

    const { result } = renderHook(() => useMeasurementsDashboard("week", "waistCm"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.renderState).toBe("single");
  });

  it("exposes sparse overlayRows in descending date order for the active metric", async () => {
    const day1 = weekStart;
    const day2 = addDays(weekStart, 1);
    const day3 = addDays(weekStart, 2);

    mockGetRange.mockResolvedValue([
      { date: day1, waistCm: 90 },
      { date: day2, waistCm: null },
      { date: day3, waistCm: 89 },
    ]);

    const { result } = renderHook(() => useMeasurementsDashboard("week", "waistCm"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.overlayRows).toEqual([
      { date: day3, value: 89 },
      { date: day1, value: 90 },
    ]);
  });

  it("exposes latest and delta derived from the sparse points", async () => {
    const day1 = weekStart;
    const day3 = addDays(weekStart, 2);

    mockGetRange.mockResolvedValue([
      { date: day1, waistCm: 90 },
      { date: day3, waistCm: 88.5 },
    ]);

    const { result } = renderHook(() => useMeasurementsDashboard("week", "waistCm"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.latest).toBe(88.5);
    expect(result.current.delta).toBe(-1.5);
  });
});
