/** @jest-environment jsdom */
import type { ScrubSeriesPoint } from "@/lib/scrubChart";
import { fireEvent, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import { FullscreenScrubChart } from "../FullscreenScrubChart";

const SERIES: ScrubSeriesPoint[] = [
  { date: "2026-06-01", value: 80, xFraction: 0, yFraction: 0 },
  { date: "2026-06-15", value: 78.4, xFraction: 0.5, yFraction: 1 },
  { date: "2026-06-30", value: 79, xFraction: 1, yFraction: 0.5 },
];

const SINGLE_SERIES: ScrubSeriesPoint[] = [
  { date: "2026-06-15", value: 78.4, xFraction: 0.5, yFraction: 0 },
];

// 10 evenly-spaced points — enough that "one label per point" would be
// obviously illegible, exercising pickAxisTicks' default maxTicks=4.
const MANY_SERIES: ScrubSeriesPoint[] = Array.from({ length: 10 }, (_, i) => ({
  date: `2026-01-${String(i + 1).padStart(2, "0")}`,
  value: 70 + i,
  xFraction: i / 9,
  yFraction: i / 9,
}));

function formatValue(value: number): string {
  return value.toLocaleString("es-AR", { maximumFractionDigits: 1 });
}

beforeAll(() => {
  jest.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    left: 0,
    top: 0,
    right: 100,
    bottom: 100,
    width: 100,
    height: 100,
    x: 0,
    y: 0,
    toJSON: () => {},
  } as DOMRect);
});

/**
 * jsdom in this environment has no native `PointerEvent` constructor, so
 * `fireEvent.pointerDown(el, { clientX })` falls back to the base `Event`
 * class, which silently drops `clientX` (it's not a base Event property).
 * Dispatching a `MouseEvent` with the pointer event's type name instead
 * gives React a native event that DOES carry `clientX`, and React dispatches
 * by `.type`, so the component's onPointerDown/Move/Up handlers still fire.
 */
function firePointer(el: Element, type: "pointerdown" | "pointermove" | "pointerup", clientX = 0) {
  fireEvent(el, new MouseEvent(type, { clientX, bubbles: true, cancelable: true }));
}

describe("FullscreenScrubChart", () => {
  it("renders as a dialog with the given title as aria-label", () => {
    render(
      <FullscreenScrubChart
        title="Peso"
        series={SERIES}
        renderState="line"
        unit="kg"
        formatValue={formatValue}
        range="week"
        onRangeChange={jest.fn()}
        onClose={jest.fn()}
      />
    );

    expect(screen.getByRole("dialog", { name: "Peso" })).toBeInTheDocument();
  });

  it("shows an empty state and no chart when renderState is empty", () => {
    render(
      <FullscreenScrubChart
        title="Peso"
        series={[]}
        renderState="empty"
        unit="kg"
        formatValue={formatValue}
        range="week"
        onRangeChange={jest.fn()}
        onClose={jest.fn()}
      />
    );

    expect(screen.getByText("Sin datos")).toBeInTheDocument();
    expect(screen.queryByTestId("scrub-line")).not.toBeInTheDocument();
    expect(screen.queryByTestId("scrub-indicator")).not.toBeInTheDocument();
  });

  it("renders a single dot with no connecting line for a single-point series", () => {
    render(
      <FullscreenScrubChart
        title="Peso"
        series={SINGLE_SERIES}
        renderState="single"
        unit="kg"
        formatValue={formatValue}
        range="week"
        onRangeChange={jest.fn()}
        onClose={jest.fn()}
      />
    );

    expect(screen.getByTestId("scrub-dot")).toBeInTheDocument();
    expect(screen.queryByTestId("scrub-line")).not.toBeInTheDocument();
  });

  it("calls onClose when the close (X) control is activated", () => {
    const onClose = jest.fn();
    render(
      <FullscreenScrubChart
        title="Peso"
        series={SERIES}
        renderState="line"
        unit="kg"
        formatValue={formatValue}
        range="week"
        onRangeChange={jest.fn()}
        onClose={onClose}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /cerrar/i }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders exactly one close control (no back-chevron)", () => {
    render(
      <FullscreenScrubChart
        title="Peso"
        series={SERIES}
        renderState="line"
        unit="kg"
        formatValue={formatValue}
        range="week"
        onRangeChange={jest.fn()}
        onClose={jest.fn()}
      />
    );

    expect(screen.getAllByRole("button", { name: /cerrar|anterior|siguiente/i })).toHaveLength(1);
  });

  it("calls onRangeChange when a range tab is tapped", () => {
    const onRangeChange = jest.fn();
    render(
      <FullscreenScrubChart
        title="Peso"
        series={SERIES}
        renderState="line"
        unit="kg"
        formatValue={formatValue}
        range="week"
        onRangeChange={onRangeChange}
        onClose={jest.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "3 meses" }));

    expect(onRangeChange).toHaveBeenCalledWith("3month");
  });

  it("clears scrub state when the range prop changes (parent re-derives series)", () => {
    const { rerender } = render(
      <FullscreenScrubChart
        title="Peso"
        series={SERIES}
        renderState="line"
        unit="kg"
        formatValue={formatValue}
        range="week"
        onRangeChange={jest.fn()}
        onClose={jest.fn()}
      />
    );

    // Scrub to the first point (clientX 0 of a 100px-wide plot).
    const plot = screen.getByTestId("scrub-plot");
    firePointer(plot, "pointerdown", 0);
    expect(within(screen.getByTestId("scrub-tooltip")).getByText(/1 jun/)).toBeInTheDocument();

    const monthSeries: ScrubSeriesPoint[] = [
      { date: "2026-07-01", value: 77, xFraction: 0, yFraction: 0 },
      { date: "2026-07-20", value: 76, xFraction: 1, yFraction: 1 },
    ];

    rerender(
      <FullscreenScrubChart
        title="Peso"
        series={monthSeries}
        renderState="line"
        unit="kg"
        formatValue={formatValue}
        range="month"
        onRangeChange={jest.fn()}
        onClose={jest.fn()}
      />
    );

    // Defaults back to the last point of the new series, not the previous scrub selection.
    expect(within(screen.getByTestId("scrub-tooltip")).getByText(/20 jul/)).toBeInTheDocument();
  });

  it("scrubbing updates the tooltip with the snapped point's date, value, and unit", () => {
    render(
      <FullscreenScrubChart
        title="Peso"
        series={SERIES}
        renderState="line"
        unit="kg"
        formatValue={formatValue}
        range="week"
        onRangeChange={jest.fn()}
        onClose={jest.fn()}
      />
    );

    const plot = screen.getByTestId("scrub-plot");
    firePointer(plot, "pointerdown", 50); // middle point: 2026-06-15, 78.4

    const tooltip = within(screen.getByTestId("scrub-tooltip"));
    expect(tooltip.getByText(/15 jun/)).toBeInTheDocument();
    expect(tooltip.getByText(/78,4\s*kg/)).toBeInTheDocument();
  });

  it("renders a dashed vertical indicator at the snapped point while scrubbing", () => {
    render(
      <FullscreenScrubChart
        title="Peso"
        series={SERIES}
        renderState="line"
        unit="kg"
        formatValue={formatValue}
        range="week"
        onRangeChange={jest.fn()}
        onClose={jest.fn()}
      />
    );

    const plot = screen.getByTestId("scrub-plot");
    firePointer(plot, "pointerdown", 0);

    expect(screen.getByTestId("scrub-indicator")).toBeInTheDocument();
  });

  describe("X-axis date tick labels", () => {
    it("renders a small number of date labels for a many-point series, never one per point", () => {
      render(
        <FullscreenScrubChart
          title="Peso"
          series={MANY_SERIES}
          renderState="line"
          unit="kg"
          formatValue={formatValue}
          range="3month"
          onRangeChange={jest.fn()}
          onClose={jest.fn()}
        />
      );

      const ticks = screen.getAllByTestId("scrub-axis-tick");
      expect(ticks.length).toBeLessThan(MANY_SERIES.length);
      expect(ticks.length).toBe(4); // pickAxisTicks' default maxTicks
    });

    it("start-aligns the first (leftmost) tick and end-aligns the last (rightmost) tick", () => {
      render(
        <FullscreenScrubChart
          title="Peso"
          series={MANY_SERIES}
          renderState="line"
          unit="kg"
          formatValue={formatValue}
          range="3month"
          onRangeChange={jest.fn()}
          onClose={jest.fn()}
        />
      );

      const ticks = screen.getAllByTestId("scrub-axis-tick");
      const first = ticks[0];
      const last = ticks[ticks.length - 1];

      expect(first).toHaveStyle({ textAlign: "left" });
      expect(last).toHaveStyle({ textAlign: "right" });
    });

    it("renders no axis-tick row for the empty state", () => {
      render(
        <FullscreenScrubChart
          title="Peso"
          series={[]}
          renderState="empty"
          unit="kg"
          formatValue={formatValue}
          range="week"
          onRangeChange={jest.fn()}
          onClose={jest.fn()}
        />
      );

      expect(screen.queryAllByTestId("scrub-axis-tick")).toHaveLength(0);
    });

    it("renders no axis-tick row for the single-point state", () => {
      render(
        <FullscreenScrubChart
          title="Peso"
          series={SINGLE_SERIES}
          renderState="single"
          unit="kg"
          formatValue={formatValue}
          range="week"
          onRangeChange={jest.fn()}
          onClose={jest.fn()}
        />
      );

      expect(screen.queryAllByTestId("scrub-axis-tick")).toHaveLength(0);
    });
  });

  describe("inline on-chart tooltip", () => {
    it("anchors the tooltip centered over a mid-chart active point", () => {
      render(
        <FullscreenScrubChart
          title="Peso"
          series={SERIES}
          renderState="line"
          unit="kg"
          formatValue={formatValue}
          range="week"
          onRangeChange={jest.fn()}
          onClose={jest.fn()}
        />
      );

      const plot = screen.getByTestId("scrub-plot");
      firePointer(plot, "pointerdown", 50); // SERIES[1], xFraction 0.5

      const tooltip = screen.getByTestId("scrub-tooltip");
      expect(tooltip.style.left).toBe("50%");
      expect(tooltip.style.transform).toContain("-50%");
    });

    it("flip-aligns (clamps) the tooltip at the leftmost point so it never overflows negative", () => {
      render(
        <FullscreenScrubChart
          title="Peso"
          series={SERIES}
          renderState="line"
          unit="kg"
          formatValue={formatValue}
          range="week"
          onRangeChange={jest.fn()}
          onClose={jest.fn()}
        />
      );

      const plot = screen.getByTestId("scrub-plot");
      firePointer(plot, "pointerdown", 0); // SERIES[0], xFraction 0

      const tooltip = screen.getByTestId("scrub-tooltip");
      expect(tooltip.style.left).toBe("0%");
      // No negative shift — left-aligned to the point, not centered/right-aligned.
      expect(tooltip.style.transform).not.toContain("-50%");
      expect(tooltip.style.transform).not.toContain("-100%");
    });

    it("flip-aligns (clamps) the tooltip at the rightmost point so it never overflows the right edge", () => {
      render(
        <FullscreenScrubChart
          title="Peso"
          series={SERIES}
          renderState="line"
          unit="kg"
          formatValue={formatValue}
          range="week"
          onRangeChange={jest.fn()}
          onClose={jest.fn()}
        />
      );

      const plot = screen.getByTestId("scrub-plot");
      firePointer(plot, "pointerdown", 100); // SERIES[2], xFraction 1

      const tooltip = screen.getByTestId("scrub-tooltip");
      expect(tooltip.style.left).toBe("100%");
      expect(tooltip.style.transform).toContain("-100%");
    });

    it("moves the tooltip's on-chart position when the active point changes", () => {
      render(
        <FullscreenScrubChart
          title="Peso"
          series={SERIES}
          renderState="line"
          unit="kg"
          formatValue={formatValue}
          range="week"
          onRangeChange={jest.fn()}
          onClose={jest.fn()}
        />
      );

      const plot = screen.getByTestId("scrub-plot");

      firePointer(plot, "pointerdown", 0);
      const leftPosition = screen.getByTestId("scrub-tooltip").style.left;

      firePointer(plot, "pointermove", 100);
      const rightPosition = screen.getByTestId("scrub-tooltip").style.left;

      expect(leftPosition).not.toBe(rightPosition);
    });
  });
});
