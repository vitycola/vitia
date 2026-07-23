import type { ScrubPoint, ScrubSeriesPoint } from "@/lib/scrubChart";
import { buildScrubSeries, nearestIndex, pickAxisTicks } from "@/lib/scrubChart";

describe("buildScrubSeries", () => {
  it("returns one series point per logged point for a 90-day (3-month) window — never carry-forward buckets", () => {
    const points: ScrubPoint[] = [
      { date: "2026-04-25", value: 10 },
      { date: "2026-05-20", value: 12 },
      { date: "2026-06-15", value: 8 },
      { date: "2026-07-23", value: 15 },
    ];
    const window = { from: "2026-04-25", to: "2026-07-23" }; // 90-day span

    const series = buildScrubSeries(points, window);

    expect(series).toHaveLength(4);
    expect(series.map((p) => p.date)).toEqual(points.map((p) => p.date));
    expect(series.map((p) => p.value)).toEqual(points.map((p) => p.value));
  });

  it("returns an empty array for zero points", () => {
    expect(buildScrubSeries([], { from: "2026-01-01", to: "2026-01-07" })).toEqual([]);
  });

  it("centers a single point at xFraction 0.5, with yFraction 0 (no range to normalize against)", () => {
    const series = buildScrubSeries([{ date: "2026-01-04", value: 70 }], {
      from: "2026-01-01",
      to: "2026-01-07",
    });

    expect(series).toHaveLength(1);
    expect(series[0].xFraction).toBe(0.5);
    expect(series[0].yFraction).toBe(0);
  });

  it("spaces points date-proportionally across the window, not by index", () => {
    const series = buildScrubSeries(
      [
        { date: "2026-01-01", value: 10 },
        { date: "2026-01-03", value: 20 }, // 2/6 through the window
        { date: "2026-01-07", value: 30 },
      ],
      { from: "2026-01-01", to: "2026-01-07" } // 6-day span
    );

    expect(series[0].xFraction).toBe(0);
    expect(series[1].xFraction).toBeCloseTo(2 / 6);
    expect(series[2].xFraction).toBe(1);
  });

  it("normalizes yFraction so the min value is 0 and the max value is 1", () => {
    const series = buildScrubSeries(
      [
        { date: "2026-01-01", value: 60 },
        { date: "2026-01-02", value: 80 },
        { date: "2026-01-03", value: 70 },
      ],
      { from: "2026-01-01", to: "2026-01-03" }
    );

    expect(series[0].yFraction).toBe(0);
    expect(series[1].yFraction).toBe(1);
    expect(series[2].yFraction).toBe(0.5);
  });
});

describe("nearestIndex", () => {
  const series = buildScrubSeries(
    [
      { date: "2026-01-01", value: 10 },
      { date: "2026-01-03", value: 20 },
      { date: "2026-01-07", value: 30 },
    ],
    { from: "2026-01-01", to: "2026-01-07" }
  );

  it("returns -1 for an empty series", () => {
    expect(nearestIndex([], 0.5)).toBe(-1);
  });

  it("returns 0 for a single-point series regardless of xFraction", () => {
    const single = buildScrubSeries([{ date: "2026-01-04", value: 70 }], {
      from: "2026-01-01",
      to: "2026-01-07",
    });
    expect(nearestIndex(single, 0)).toBe(0);
    expect(nearestIndex(single, 1)).toBe(0);
  });

  it("snaps to the exact point when xFraction matches", () => {
    expect(nearestIndex(series, 2 / 6)).toBe(1);
  });

  it("snaps to whichever point is closer", () => {
    expect(nearestIndex(series, 0.1)).toBe(0); // closer to 0 than to 2/6≈0.333
    expect(nearestIndex(series, 0.9)).toBe(2); // closer to 1 than to 2/6
  });

  it("clamps to the last point when dragging past the right edge", () => {
    expect(nearestIndex(series, 5)).toBe(2);
  });

  it("clamps to the first point when dragging past the left edge", () => {
    expect(nearestIndex(series, -5)).toBe(0);
  });
});

describe("pickAxisTicks", () => {
  function makeSeries(count: number): ScrubSeriesPoint[] {
    return Array.from({ length: count }, (_, i) => ({
      date: `day-${i}`,
      value: i,
      xFraction: count === 1 ? 0.5 : i / (count - 1),
      yFraction: 0,
    }));
  }

  it("returns an empty array for an empty series", () => {
    expect(pickAxisTicks([], 4)).toEqual([]);
  });

  it("returns a single tick (index 0) for a single-point series", () => {
    expect(pickAxisTicks(makeSeries(1), 4)).toEqual([0]);
  });

  it("returns [0, 1] for a 2-point series", () => {
    expect(pickAxisTicks(makeSeries(2), 4)).toEqual([0, 1]);
  });

  it("returns maxTicks evenly-spaced indices for a many-point series, always including first and last", () => {
    const series = makeSeries(90); // mirrors buildScrubSeries' 3-month fixture shape

    const ticks = pickAxisTicks(series, 4);

    expect(ticks).toHaveLength(4);
    expect(ticks[0]).toBe(0);
    expect(ticks[ticks.length - 1]).toBe(89);
    // Roughly evenly spaced, not clustered.
    const gaps = ticks.slice(1).map((t, i) => t - ticks[i]);
    for (const gap of gaps) {
      expect(gap).toBeGreaterThan(20);
    }
  });

  it("never returns duplicate indices", () => {
    const ticks = pickAxisTicks(makeSeries(90), 4);
    expect(new Set(ticks).size).toBe(ticks.length);
  });

  it("never returns one index per point for a large series", () => {
    const series = makeSeries(90);
    const ticks = pickAxisTicks(series, 4);
    expect(ticks.length).toBeLessThan(series.length);
  });

  it("respects a custom maxTicks", () => {
    const ticks = pickAxisTicks(makeSeries(90), 3);
    expect(ticks).toHaveLength(3);
    expect(ticks[0]).toBe(0);
    expect(ticks[2]).toBe(89);
  });
});
