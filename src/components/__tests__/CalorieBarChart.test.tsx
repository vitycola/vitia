/** @jest-environment jsdom */
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import type { BarDatum } from "@/lib/calorieDashboard";
import { addDays, rollingWindow, todayISO } from "@/lib/date";
import { CalorieBarChart } from "../CalorieBarChart";

function makeBars(count: number, kcal = 2000): BarDatum[] {
  return Array.from({ length: count }, (_, i) => ({
    key: `bar-${i}`,
    label: `bar-${i}`,
    kcal,
    imputed: true,
  }));
}

/**
 * Build `count` bars keyed by real ISO dates within a rolling window ending
 * today, so day-of-week labels (derived per-bar from `bar.key`) can be
 * asserted against known dates regardless of which weekday the window starts
 * on.
 */
function makeDatedBars(count: number, kcal = 2000): BarDatum[] {
  const { from } = rollingWindow(count);
  return Array.from({ length: count }, (_, i) => {
    const date = addDays(from, i);
    return { key: date, label: date, kcal, imputed: true };
  });
}

const WEEKDAY_INITIALS_BY_GET_DAY = ["D", "L", "M", "X", "J", "V", "S"];

function dayInitialForIsoDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return WEEKDAY_INITIALS_BY_GET_DAY[new Date(year, month - 1, day).getDay()];
}

describe("CalorieBarChart", () => {
  it("renders exactly one bar element per BarDatum (week = 7)", () => {
    render(<CalorieBarChart bars={makeBars(7)} goalLine={2000} />);
    expect(screen.getAllByTestId("calorie-bar")).toHaveLength(7);
  });

  it("renders exactly one bar element per BarDatum (month = 30)", () => {
    render(<CalorieBarChart bars={makeBars(30)} goalLine={2000} />);
    expect(screen.getAllByTestId("calorie-bar")).toHaveLength(30);
  });

  it("renders exactly one bar element per BarDatum (3month = 3)", () => {
    render(<CalorieBarChart bars={makeBars(3)} goalLine={2000} />);
    expect(screen.getAllByTestId("calorie-bar")).toHaveLength(3);
  });

  it("renders a dashed goal reference line", () => {
    render(<CalorieBarChart bars={makeBars(7)} goalLine={2000} />);
    expect(screen.getByTestId("calorie-goal-line")).toBeInTheDocument();
  });

  it("renders empty bars (imputed=false) with reduced visual height/opacity marker", () => {
    const bars: BarDatum[] = [{ key: "d1", label: "d1", kcal: 0, imputed: false }];
    render(<CalorieBarChart bars={bars} goalLine={2000} />);
    const bar = screen.getByTestId("calorie-bar");
    expect(bar).toHaveAttribute("data-imputed", "false");
  });

  it("scales bar height relative to the tallest bar/goal so all bars stay visually comparable", () => {
    const bars: BarDatum[] = [
      { key: "d1", label: "d1", kcal: 1000, imputed: true },
      { key: "d2", label: "d2", kcal: 2000, imputed: true },
    ];
    render(<CalorieBarChart bars={bars} goalLine={2000} />);
    const [first, second] = screen.getAllByTestId("calorie-bar");
    const firstHeight = Number.parseFloat((first as HTMLElement).style.height);
    const secondHeight = Number.parseFloat((second as HTMLElement).style.height);
    expect(secondHeight).toBeGreaterThan(firstHeight);
  });

  describe("week day-of-week labels", () => {
    it("renders 7 day-of-week initial labels derived from each bar's own date", () => {
      const bars = makeDatedBars(7);
      render(<CalorieBarChart bars={bars} goalLine={2000} range="week" />);
      const labels = screen.getAllByTestId("calorie-day-label");
      expect(labels).toHaveLength(7);
      expect(labels.map((l) => l.textContent)).toEqual(
        bars.map((bar) => dayInitialForIsoDate(bar.key))
      );
    });

    it("highlights today's label in accent color with medium weight", () => {
      const today = todayISO();
      const bars = makeDatedBars(7);
      const todayIndex = bars.findIndex((bar) => bar.key === today);

      render(<CalorieBarChart bars={bars} goalLine={2000} range="week" />);
      const labels = screen.getAllByTestId("calorie-day-label");

      labels.forEach((label, index) => {
        if (index === todayIndex) {
          expect(label).toHaveStyle({ color: "#F5A623" });
          expect(label.className).toMatch(/font-medium/);
        } else {
          expect(label).toHaveStyle({ color: "#8E8E93" });
        }
      });
    });

    it("does not render day-of-week labels for the month range", () => {
      render(<CalorieBarChart bars={makeBars(30)} goalLine={2000} range="month" />);
      expect(screen.queryAllByTestId("calorie-day-label")).toHaveLength(0);
    });

    it("does not render day-of-week labels for the 3month range (keeps its own bucket labels)", () => {
      render(<CalorieBarChart bars={makeBars(3)} goalLine={2000} range="3month" />);
      expect(screen.queryAllByTestId("calorie-day-label")).toHaveLength(0);
    });
  });
});
