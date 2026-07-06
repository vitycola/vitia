/** @jest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

const mockVM = {
  bars: [
    { key: "d1", label: "d1", kcal: 2000, imputed: true },
    { key: "d2", label: "d2", kcal: 0, imputed: false },
  ],
  average: 2000,
  total: 14700,
  goalLine: 2200,
  window: { from: "2026-07-01", to: "2026-07-02" },
  isLoading: false,
  overlayRows: [
    { date: "2026-07-02", kcal: 0 },
    { date: "2026-07-01", kcal: 2000 },
  ],
};

jest.mock("@/hooks/useCalorieDashboard", () => ({
  useCalorieDashboard: jest.fn(() => mockVM),
}));

jest.mock("@/db/repos/mealEntries", () => ({
  getLoggedTotalsByDateRange: jest.fn().mockResolvedValue([]),
}));

import { CalorieDashboardCard } from "../CalorieDashboardCard";

describe("CalorieDashboardCard", () => {
  it("renders the chart with bars from the hook", () => {
    render(<CalorieDashboardCard range="week" />);
    expect(screen.getAllByTestId("calorie-bar")).toHaveLength(2);
  });

  it("renders the Calorías title in sentence case, not uppercase", () => {
    render(<CalorieDashboardCard range="week" />);
    expect(screen.getByText("Calorías")).toBeInTheDocument();
  });

  it("does not render a chevron or 'Ver historial' text inside the header row", () => {
    render(<CalorieDashboardCard range="week" />);
    const header = screen.getByText("Calorías").closest("div");
    expect(header).not.toBeNull();
    expect(header?.textContent).not.toMatch(/ver historial/i);
  });

  it("renders exactly one grouped stats block (period total) instead of 3 stat columns", () => {
    render(<CalorieDashboardCard range="week" />);
    expect(screen.getByText("14.700")).toBeInTheDocument();
    expect(screen.queryByText("total kcal")).not.toBeInTheDocument();
    expect(screen.queryByText("meta kcal")).not.toBeInTheDocument();
    expect(screen.queryByText("2.200")).not.toBeInTheDocument();
  });

  it("renders the week caption combining total-period label and average", () => {
    render(<CalorieDashboardCard range="week" />);
    expect(screen.getByText("total esta semana · 2.000 kcal prom/día")).toBeInTheDocument();
  });

  it("renders the month caption with its own label", () => {
    render(<CalorieDashboardCard range="month" />);
    expect(screen.getByText("total este mes · 2.000 kcal prom/día")).toBeInTheDocument();
  });

  it("renders the 3month caption with its own label and unit", () => {
    render(<CalorieDashboardCard range="3month" />);
    expect(screen.getByText("total últimos 3 meses · 2.000 kcal prom/mes")).toBeInTheDocument();
  });

  it("renders a placeholder in the caption when average is null (zero logged days)", () => {
    jest.spyOn(require("@/hooks/useCalorieDashboard"), "useCalorieDashboard").mockReturnValueOnce({
      ...mockVM,
      average: null,
    });

    render(<CalorieDashboardCard range="week" />);

    expect(screen.getByText("total esta semana · — kcal prom/día")).toBeInTheDocument();
  });

  it("still renders the total number even when average is null", () => {
    jest.spyOn(require("@/hooks/useCalorieDashboard"), "useCalorieDashboard").mockReturnValueOnce({
      ...mockVM,
      average: null,
      total: 0,
    });

    render(<CalorieDashboardCard range="week" />);

    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("renders a 'Ver historial' link below the chart, not in the header", () => {
    render(<CalorieDashboardCard range="week" />);
    const link = screen.getByRole("button", { name: /ver historial/i });
    const chart = screen.getAllByTestId("calorie-bar")[0].closest("div");
    expect(chart).not.toBeNull();
    // The link must appear after the chart in document order.
    expect(
      link.compareDocumentPosition(chart as Node) & Node.DOCUMENT_POSITION_PRECEDING
    ).toBeTruthy();
  });

  it("opens the historical overlay when 'Ver historial' is clicked", () => {
    render(<CalorieDashboardCard range="week" />);

    fireEvent.click(screen.getByRole("button", { name: /ver historial/i }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("closes the overlay when its close control is activated", () => {
    render(<CalorieDashboardCard range="week" />);

    fireEvent.click(screen.getByRole("button", { name: /ver historial/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /cerrar/i }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("passes the active range to the bar chart so week shows day-of-week labels", () => {
    render(<CalorieDashboardCard range="week" />);
    // Week mock VM has 2 bars — day labels only render for range === "week"
    // and the chart derives label count from WEEKDAY_INITIALS (7), so we
    // only assert that at least one label element exists for week range.
    expect(screen.queryAllByTestId("calorie-day-label").length).toBeGreaterThan(0);
  });

  it("does not render day-of-week labels for month range", () => {
    render(<CalorieDashboardCard range="month" />);
    expect(screen.queryAllByTestId("calorie-day-label")).toHaveLength(0);
  });
});
