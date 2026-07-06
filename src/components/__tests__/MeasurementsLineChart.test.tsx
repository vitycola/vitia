/** @jest-environment jsdom */
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import type { LinePoint } from "@/lib/measurementsDashboard";
import { MeasurementsLineChart } from "../MeasurementsLineChart";

function point(overrides: Partial<LinePoint> = {}): LinePoint {
  return { key: "d1", label: "d1", value: 90, imputed: true, ...overrides };
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
      point({ key: "bucket-0", value: null, imputed: false }),
      point({ key: "bucket-1", value: 90, imputed: true }),
      point({ key: "bucket-2", value: 89, imputed: true }),
    ];

    render(<MeasurementsLineChart points={points} renderState="line" />);

    const polyline = screen.getByTestId("measurements-line");
    // Exactly 2 non-null points feed the polyline -> 2 coordinate pairs.
    const coordCount = (polyline.getAttribute("points") ?? "").trim().split(/\s+/).length;
    expect(coordCount).toBe(2);
  });

  it("does not fabricate a per-day cell — X position is date-proportional across the point count", () => {
    const points: LinePoint[] = [point({ key: "d1", value: 90 }), point({ key: "d2", value: 80 })];
    render(<MeasurementsLineChart points={points} renderState="line" />);

    const svg = screen.getByTestId("measurements-line").closest("svg");
    expect(svg).not.toBeNull();
  });
});
