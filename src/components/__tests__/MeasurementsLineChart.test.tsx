/** @jest-environment jsdom */
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import type { LinePoint } from "@/lib/measurementsDashboard";
import { MeasurementsLineChart } from "../MeasurementsLineChart";

function point(overrides: Partial<LinePoint> = {}): LinePoint {
  return { key: "d1", label: "d1", value: 90, ...overrides };
}

describe("MeasurementsLineChart", () => {
  it("renderState 'empty': renders centered 'Sin datos' text, no SVG line or dot", () => {
    render(<MeasurementsLineChart points={[]} renderState="empty" />);

    expect(screen.getByText("Sin datos")).toBeInTheDocument();
    expect(screen.queryByTestId("measurements-line")).not.toBeInTheDocument();
    expect(screen.queryByTestId("measurements-dot")).not.toBeInTheDocument();
  });

  it("renderState 'single': renders exactly one accent dot, no polyline", () => {
    render(<MeasurementsLineChart points={[point()]} renderState="single" />);

    expect(screen.queryByText("Sin datos")).not.toBeInTheDocument();
    expect(screen.getAllByTestId("measurements-dot")).toHaveLength(1);
    expect(screen.queryByTestId("measurements-line")).not.toBeInTheDocument();
  });

  it("renderState 'line': renders a single polyline connecting only the real (non-null) points", () => {
    const points: LinePoint[] = [
      point({ key: "d1", value: 90 }),
      point({ key: "d2", value: 89 }),
      point({ key: "d3", value: 88 }),
    ];

    render(<MeasurementsLineChart points={points} renderState="line" />);

    expect(screen.getByTestId("measurements-line")).toBeInTheDocument();
    expect(screen.queryByText("Sin datos")).not.toBeInTheDocument();
  });

  it("renderState 'line' with a leading null bucket: the null point is omitted from the polyline", () => {
    const points: LinePoint[] = [
      point({ key: "bucket-0", value: null }),
      point({ key: "bucket-1", value: 90 }),
      point({ key: "bucket-2", value: 89 }),
    ];

    render(<MeasurementsLineChart points={points} renderState="line" />);

    const polyline = screen.getByTestId("measurements-line");
    // Exactly 2 non-null points feed the polyline -> 2 coordinate pairs.
    const coordCount = (polyline.getAttribute("points") ?? "").trim().split(/\s+/).length;
    expect(coordCount).toBe(2);
  });

  it("does not fabricate a per-day cell — X position is date-proportional, not index-proportional", () => {
    // Window spans 10 days (day 0 .. day 9). Points logged at day 0, day 1,
    // and day 9 — an uneven 1-day gap followed by an 8-day gap. If X were
    // spaced by array index (the bug), both gaps would render identically
    // (each 1/2 of VIEW_WIDTH = 50 units). Date-proportional spacing must
    // render the second gap ~8x wider than the first.
    const points: LinePoint[] = [
      point({ key: "2026-01-01", value: 90 }),
      point({ key: "2026-01-02", value: 89 }),
      point({ key: "2026-01-10", value: 88 }),
    ];

    render(
      <MeasurementsLineChart
        points={points}
        renderState="line"
        window={{ from: "2026-01-01", to: "2026-01-10" }}
      />
    );

    const polyline = screen.getByTestId("measurements-line");
    const coords = (polyline.getAttribute("points") ?? "")
      .trim()
      .split(/\s+/)
      .map((pair) => Number(pair.split(",")[0]));

    expect(coords).toHaveLength(3);
    const [x0, x1, x2] = coords;
    const firstGap = x1 - x0;
    const secondGap = x2 - x1;

    // Index-based spacing would make firstGap === secondGap (both 50 units).
    // Date-proportional spacing must make secondGap ~8x firstGap (1-day vs
    // 8-day gap out of a 9-day span).
    expect(secondGap).toBeGreaterThan(firstGap * 6);
    expect(secondGap / firstGap).toBeCloseTo(8, 0);
  });
});
