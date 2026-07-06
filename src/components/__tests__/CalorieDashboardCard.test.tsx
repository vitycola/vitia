/** @jest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

const mockVM = {
  bars: [
    { key: "d1", label: "d1", kcal: 2000, imputed: true },
    { key: "d2", label: "d2", kcal: 0, imputed: false },
  ],
  average: 2000,
  total: 2000,
  goalLine: 2200,
  window: { from: "2026-07-01", to: "2026-07-02" },
  isLoading: false,
  overlayRows: [
    { date: "2026-07-01", kcal: 2000 },
    { date: "2026-07-02", kcal: 0 },
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

  it("renders the imputed-only average when available", () => {
    render(<CalorieDashboardCard range="week" />);
    expect(screen.getByText("kcal/día promedio").previousElementSibling).toHaveTextContent("2,000");
  });

  it("renders a placeholder when average is null (zero logged days)", () => {
    jest.spyOn(require("@/hooks/useCalorieDashboard"), "useCalorieDashboard").mockReturnValueOnce({
      ...mockVM,
      average: null,
    });

    render(<CalorieDashboardCard range="week" />);

    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders a button/trigger that opens the historical overlay", () => {
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

  it("renders the Calorías title", () => {
    render(<CalorieDashboardCard range="week" />);
    expect(screen.getByText("Calorías")).toBeInTheDocument();
  });
});
