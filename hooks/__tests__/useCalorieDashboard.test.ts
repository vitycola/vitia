/** @jest-environment jsdom */
/**
 * Unit tests for useCalorieDashboard — fetch+shape hook for the Progress >
 * Calorías dashboard. Mocks the repo and profile store so only hook wiring
 * (window selection per range, VM shaping) is under test; the pure
 * bucketing/averaging math is covered exhaustively in
 * lib/__tests__/calorieDashboard.test.ts.
 */
import { act, renderHook, waitFor } from "@testing-library/react";

jest.mock("@/db/repos/mealEntries", () => ({
  getLoggedTotalsByDateRange: jest.fn(),
}));

let mockProfile: { calorieGoal?: number } | null = null;
jest.mock("@/stores/useProfileStore", () => ({
  useProfileStore: (selector: (s: { profile: unknown }) => unknown) =>
    selector({ profile: mockProfile }),
}));

import * as mealEntriesRepo from "@/db/repos/mealEntries";
import { useCalorieDashboard } from "../useCalorieDashboard";

const mockGetLoggedTotalsByDateRange = mealEntriesRepo.getLoggedTotalsByDateRange as jest.Mock;

// Pin the system clock instead of mocking `@/lib/date`'s todayISO export:
// rollingWindow()'s `today: string = todayISO()` default parameter calls the
// module-local todayISO directly (a same-file reference, not a re-import), so
// overriding the exported todayISO via jest.mock never reaches rollingWindow's
// internal call — the window silently drifts a day every time the wall clock
// advances. Faking the system time makes the real (un-mocked) todayISO return
// the pinned date everywhere, sidestepping the module-boundary gap entirely.
describe("useCalorieDashboard", () => {
  beforeEach(() => {
    jest.useFakeTimers({ advanceTimers: false });
    jest.setSystemTime(new Date("2026-07-06T12:00:00"));
    mockGetLoggedTotalsByDateRange.mockReset();
    mockProfile = { calorieGoal: 2200 };
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("week range: fetches the calendar-week window and renders 7 bars", async () => {
    mockGetLoggedTotalsByDateRange.mockResolvedValue([
      { date: "2026-07-01", calories: 2100 },
      { date: "2026-07-02", calories: 1900 },
    ]);

    const { result } = renderHook(() => useCalorieDashboard("week"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.bars).toHaveLength(7);
    expect(result.current.goalLine).toBe(2200);
    // 2026-07-06 is itself a Monday -> week is 2026-07-06..2026-07-12
    expect(mockGetLoggedTotalsByDateRange).toHaveBeenCalledWith("2026-07-06", "2026-07-12");
  });

  it("month range: fetches a rolling 30-day window and renders 30 bars", async () => {
    mockGetLoggedTotalsByDateRange.mockResolvedValue([]);

    const { result } = renderHook(() => useCalorieDashboard("month"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.bars).toHaveLength(30);
    expect(mockGetLoggedTotalsByDateRange).toHaveBeenCalledWith("2026-06-07", "2026-07-06");
  });

  it("3month range: fetches a rolling 90-day window and renders 3 bucket bars", async () => {
    mockGetLoggedTotalsByDateRange.mockResolvedValue([]);

    const { result } = renderHook(() => useCalorieDashboard("3month"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.bars).toHaveLength(3);
    expect(mockGetLoggedTotalsByDateRange).toHaveBeenCalledWith("2026-04-08", "2026-07-06");
  });

  it("falls back to goalLine=2000 when profile.calorieGoal is not set", async () => {
    mockProfile = null;
    mockGetLoggedTotalsByDateRange.mockResolvedValue([]);

    const { result } = renderHook(() => useCalorieDashboard("week"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.goalLine).toBe(2000);
  });

  it("computes imputed-only average and total from fetched rows", async () => {
    mockGetLoggedTotalsByDateRange.mockResolvedValue([
      { date: "2026-06-29", calories: 2100 },
      { date: "2026-06-30", calories: 1900 },
    ]);

    const { result } = renderHook(() => useCalorieDashboard("week"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.average).toBe(2000);
    expect(result.current.total).toBe(4000);
  });

  it("returns average=null when zero rows are imputed in the window", async () => {
    mockGetLoggedTotalsByDateRange.mockResolvedValue([]);

    const { result } = renderHook(() => useCalorieDashboard("week"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.average).toBeNull();
    expect(result.current.total).toBe(0);
  });

  it("re-fetches when the range argument changes", async () => {
    mockGetLoggedTotalsByDateRange.mockResolvedValue([]);

    const { result, rerender } = renderHook(({ range }) => useCalorieDashboard(range), {
      initialProps: { range: "week" as const },
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockGetLoggedTotalsByDateRange).toHaveBeenCalledTimes(1);

    act(() => {
      rerender({ range: "month" as const });
    });

    await waitFor(() => expect(mockGetLoggedTotalsByDateRange).toHaveBeenCalledTimes(2));
    expect(mockGetLoggedTotalsByDateRange).toHaveBeenLastCalledWith("2026-06-07", "2026-07-06");
  });

  it("exposes the resolved window {from, to} in the returned VM", async () => {
    mockGetLoggedTotalsByDateRange.mockResolvedValue([]);

    const { result } = renderHook(() => useCalorieDashboard("month"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.window).toEqual({ from: "2026-06-07", to: "2026-07-06" });
  });

  it("exposes overlayRows with one row per day in the window, absent days as 0 kcal", async () => {
    mockGetLoggedTotalsByDateRange.mockResolvedValue([{ date: "2026-07-06", calories: 1800 }]);

    const { result } = renderHook(() => useCalorieDashboard("week"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.overlayRows).toHaveLength(7);
    expect(result.current.overlayRows).toContainEqual({ date: "2026-07-06", kcal: 1800 });
  });
});
