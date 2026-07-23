/** @jest-environment jsdom */
import type { ScrubSeriesPoint } from "@/lib/scrubChart";
import { act, renderHook } from "@testing-library/react";
import { useChartScrub } from "../useChartScrub";

const RECT = { left: 0, width: 100 };

/** Evenly-spaced fixture (xFraction 0, 0.25, 0.5, 0.75, 1 for 5 points) — index-uniform and geometry-uniform snapping coincide here by construction, matching the old `pointCount`-only behavior these tests were written against. */
function makeEvenSeries(count: number): ScrubSeriesPoint[] {
  return Array.from({ length: count }, (_, i) => ({
    date: `2026-01-${String(i + 1).padStart(2, "0")}`,
    value: i,
    xFraction: count === 1 ? 0.5 : i / (count - 1),
    yFraction: 0,
  }));
}

const EVEN_SERIES = makeEvenSeries(5);

/**
 * Unevenly-spaced fixture reproducing the verify report's counter-example:
 * a cluster of consecutive logged days (Jan 1-4) followed by a large gap to
 * a single point 3 months later (day 90 = 2026-04-01). Real per-point
 * xFractions are date-proportional across that 89-day window, NOT spread
 * evenly across the 5 array indices.
 */
const UNEVEN_SERIES: ScrubSeriesPoint[] = [
  { date: "2026-01-01", value: 70, xFraction: 0, yFraction: 0 },
  { date: "2026-01-02", value: 71, xFraction: 1 / 89, yFraction: 0.25 },
  { date: "2026-01-03", value: 72, xFraction: 2 / 89, yFraction: 0.5 },
  { date: "2026-01-04", value: 73, xFraction: 3 / 89, yFraction: 0.75 },
  { date: "2026-04-01", value: 74, xFraction: 1, yFraction: 1 },
];

describe("useChartScrub", () => {
  it("defaults activeIndex to the last (latest) point when there is data", () => {
    const { result } = renderHook(() =>
      useChartScrub({ series: EVEN_SERIES, getPlotRect: () => RECT })
    );

    expect(result.current.activeIndex).toBe(4);
    expect(result.current.isScrubbing).toBe(false);
  });

  it("activeIndex is null when there are zero points", () => {
    const { result } = renderHook(() => useChartScrub({ series: [], getPlotRect: () => RECT }));

    expect(result.current.activeIndex).toBeNull();
  });

  it("snaps activeIndex to the nearest point index while dragging", () => {
    const { result } = renderHook(() =>
      useChartScrub({ series: EVEN_SERIES, getPlotRect: () => RECT })
    );

    act(() => result.current.onPointerDown({ clientX: 0 }));
    expect(result.current.activeIndex).toBe(0);
    expect(result.current.isScrubbing).toBe(true);

    act(() => result.current.onPointerMove({ clientX: 50 }));
    expect(result.current.activeIndex).toBe(2);

    act(() => result.current.onPointerMove({ clientX: 100 }));
    expect(result.current.activeIndex).toBe(4);
  });

  it("works identically whether driven by touch or mouse — the hook only reads clientX", () => {
    const touch = renderHook(() => useChartScrub({ series: EVEN_SERIES, getPlotRect: () => RECT }));
    const mouse = renderHook(() => useChartScrub({ series: EVEN_SERIES, getPlotRect: () => RECT }));

    act(() => {
      touch.result.current.onPointerDown({ clientX: 30 });
      mouse.result.current.onPointerDown({ clientX: 30 });
    });

    expect(touch.result.current.activeIndex).toBe(mouse.result.current.activeIndex);
  });

  it("clamps to the last point when dragging past the right edge", () => {
    const { result } = renderHook(() =>
      useChartScrub({ series: EVEN_SERIES, getPlotRect: () => RECT })
    );

    act(() => result.current.onPointerDown({ clientX: 0 }));
    act(() => result.current.onPointerMove({ clientX: 500 }));

    expect(result.current.activeIndex).toBe(4);
  });

  it("clamps to the first point when dragging past the left edge", () => {
    const { result } = renderHook(() =>
      useChartScrub({ series: EVEN_SERIES, getPlotRect: () => RECT })
    );

    act(() => result.current.onPointerDown({ clientX: 100 }));
    act(() => result.current.onPointerMove({ clientX: -500 }));

    expect(result.current.activeIndex).toBe(0);
  });

  it("pointerup persists the last snapped state and clears isScrubbing", () => {
    const { result } = renderHook(() =>
      useChartScrub({ series: EVEN_SERIES, getPlotRect: () => RECT })
    );

    act(() => result.current.onPointerDown({ clientX: 20 }));
    act(() => result.current.onPointerMove({ clientX: 60 })); // xFraction 0.6, nearest even-spaced point is index 2 (xFraction 0.5, distance 0.1)
    act(() => result.current.onPointerUp());

    expect(result.current.isScrubbing).toBe(false);
    expect(result.current.activeIndex).toBe(2);
  });

  it("onPointerMove before any onPointerDown is a no-op", () => {
    const { result } = renderHook(() =>
      useChartScrub({ series: EVEN_SERIES, getPlotRect: () => RECT })
    );

    act(() => result.current.onPointerMove({ clientX: 100 }));

    expect(result.current.activeIndex).toBe(4); // still the default (last point)
    expect(result.current.isScrubbing).toBe(false);
  });

  it("handles down/move/up dispatched back-to-back with no render flush in between (stale-closure regression, mirrors useSwipeReveal)", () => {
    const { result } = renderHook(() =>
      useChartScrub({ series: EVEN_SERIES, getPlotRect: () => RECT })
    );

    act(() => {
      result.current.onPointerDown({ clientX: 0 });
      result.current.onPointerMove({ clientX: 50 });
      result.current.onPointerUp();
    });

    expect(result.current.activeIndex).toBe(2);
    expect(result.current.isScrubbing).toBe(false);
  });

  it("snaps by REAL per-point date-proportional geometry, not uniform index spacing, for unevenly-spaced dates", () => {
    const { result } = renderHook(() =>
      useChartScrub({ series: UNEVEN_SERIES, getPlotRect: () => RECT })
    );

    // Drag to the true geometric midpoint of the plot (clientX 50 of a 100px-wide rect -> xFraction 0.5).
    act(() => result.current.onPointerDown({ clientX: 50 }));

    // Real geometry: index 3 (2026-01-04, xFraction 3/89≈0.034) is the nearest point to
    // xFraction 0.5 (distance ≈0.466 vs. every other point's distance >= 0.477).
    // The old buggy uniform-index formula (Math.round(0.5 * (5-1)) = 2) would have
    // snapped to index 2 (2026-01-03) instead — a wrong point, since it ignores the
    // huge real-date gap between index 3 and the final point at 2026-04-01.
    expect(result.current.activeIndex).toBe(3);
  });
});
