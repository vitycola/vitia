/** @jest-environment jsdom */
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import type { LinePoint } from "@/lib/weightDashboard";
import { WeightLineChart } from "../WeightLineChart";

function point(overrides: Partial<LinePoint> = {}): LinePoint {
  return { key: "d1", label: "d1", value: 90, ...overrides };
}

describe("WeightLineChart", () => {
  it("renderState 'empty': renders centered 'Sin datos' text, no SVG line or dot", () => {
    render(<WeightLineChart points={[]} renderState="empty" />);

    expect(screen.getByText("Sin datos")).toBeInTheDocument();
    expect(screen.queryByTestId("weight-line")).not.toBeInTheDocument();
    expect(screen.queryByTestId("weight-dot")).not.toBeInTheDocument();
  });

  it("renderState 'single': renders exactly one accent dot, no polyline", () => {
    render(<WeightLineChart points={[point()]} renderState="single" />);

    expect(screen.queryByText("Sin datos")).not.toBeInTheDocument();
    expect(screen.getAllByTestId("weight-dot")).toHaveLength(1);
    expect(screen.queryByTestId("weight-line")).not.toBeInTheDocument();
  });

  it("renderState 'line': renders a single polyline connecting only the real (non-null) points", () => {
    const points: LinePoint[] = [
      point({ key: "d1", value: 90 }),
      point({ key: "d2", value: 89 }),
      point({ key: "d3", value: 88 }),
    ];

    render(<WeightLineChart points={points} renderState="line" />);

    expect(screen.getByTestId("weight-line")).toBeInTheDocument();
    expect(screen.queryByText("Sin datos")).not.toBeInTheDocument();
  });

  it("renders the chart with the correct aria-label", () => {
    const points: LinePoint[] = [point({ key: "d1", value: 90 }), point({ key: "d2", value: 89 })];

    render(<WeightLineChart points={points} renderState="line" />);

    expect(screen.getByRole("img", { name: "Gráfico de peso" })).toBeInTheDocument();
  });

  it("renderState 'line' with a leading null bucket: the null point is omitted from the polyline", () => {
    const points: LinePoint[] = [
      point({ key: "bucket-0", value: null }),
      point({ key: "bucket-1", value: 90 }),
      point({ key: "bucket-2", value: 89 }),
    ];

    render(<WeightLineChart points={points} renderState="line" />);

    const polyline = screen.getByTestId("weight-line");
    const coordCount = (polyline.getAttribute("points") ?? "").trim().split(/\s+/).length;
    expect(coordCount).toBe(2);
  });

  it("does not fabricate a per-day cell — X position is date-proportional, not index-proportional", () => {
    const points: LinePoint[] = [
      point({ key: "2026-01-01", value: 90 }),
      point({ key: "2026-01-02", value: 89 }),
      point({ key: "2026-01-10", value: 88 }),
    ];

    render(
      <WeightLineChart
        points={points}
        renderState="line"
        window={{ from: "2026-01-01", to: "2026-01-10" }}
      />
    );

    const polyline = screen.getByTestId("weight-line");
    const coords = (polyline.getAttribute("points") ?? "")
      .trim()
      .split(/\s+/)
      .map((pair) => Number(pair.split(",")[0]));

    expect(coords).toHaveLength(3);
    const [x0, x1, x2] = coords;
    const firstGap = x1 - x0;
    const secondGap = x2 - x1;

    expect(secondGap).toBeGreaterThan(firstGap * 6);
    expect(secondGap / firstGap).toBeCloseTo(8, 0);
  });
});
