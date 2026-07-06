/** @jest-environment jsdom */
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import type { BarDatum } from "@/lib/calorieDashboard";
import { CalorieBarChart } from "../CalorieBarChart";

function makeBars(count: number, kcal = 2000): BarDatum[] {
  return Array.from({ length: count }, (_, i) => ({
    key: `bar-${i}`,
    label: `bar-${i}`,
    kcal,
    imputed: true,
  }));
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
});
