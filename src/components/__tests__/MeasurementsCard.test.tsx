/** @jest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

const mockVM = {
  points: [
    { date: "2026-07-01", value: 90 },
    { date: "2026-07-03", value: 89 },
  ],
  linePoints: [
    { key: "2026-07-01", label: "2026-07-01", value: 90, imputed: true },
    { key: "2026-07-03", label: "2026-07-03", value: 89, imputed: true },
  ],
  renderState: "line" as const,
  latest: 89,
  delta: -1,
  window: { from: "2026-06-30", to: "2026-07-06" },
  isLoading: false,
};

const mockUseMeasurementsDashboard = jest.fn((_range: string, _metric: string) => mockVM);

jest.mock("@/hooks/useMeasurementsDashboard", () => ({
  useMeasurementsDashboard: (range: string, metric: string) =>
    mockUseMeasurementsDashboard(range, metric),
}));

jest.mock("@/db/repos/progress", () => ({
  getRange: jest.fn().mockResolvedValue([]),
}));

import { MeasurementsCard } from "../MeasurementsCard";

describe("MeasurementsCard", () => {
  beforeEach(() => {
    mockUseMeasurementsDashboard.mockClear();
    mockUseMeasurementsDashboard.mockReturnValue(mockVM);
  });

  it("defaults the active metric to Cintura (waistCm) on mount", () => {
    render(<MeasurementsCard range="week" />);

    expect(screen.getByText("Cintura")).toBeInTheDocument();
    expect(mockUseMeasurementsDashboard).toHaveBeenCalledWith("week", "waistCm");
  });

  it("renders the chart via the hook's renderState", () => {
    render(<MeasurementsCard range="week" />);
    expect(screen.getByTestId("measurements-line")).toBeInTheDocument();
  });

  it("chevron tap opens the metric picker inline without opening the historical overlay", () => {
    render(<MeasurementsCard range="week" />);

    fireEvent.click(screen.getByRole("button", { name: /cintura/i }));

    // Picker items are visible (Cadera, Cuello, Pecho, Brazo, Muslo, Cintura)
    expect(screen.getByText("Cadera")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("card tap outside the chevron opens the historical overlay", () => {
    render(<MeasurementsCard range="week" />);

    fireEvent.click(screen.getByRole("button", { name: "Ver historial de medidas" }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("shows a checkmark next to the active metric in the open picker", () => {
    render(<MeasurementsCard range="week" />);

    fireEvent.click(screen.getByRole("button", { name: /cintura/i }));

    const activeRow = screen.getByRole("button", { name: /^Cintura$/i, hidden: true });
    expect(activeRow).toBeTruthy();
  });

  it("selecting a metric switches the active metric, refetches via the hook, and closes the picker", () => {
    render(<MeasurementsCard range="week" />);

    fireEvent.click(screen.getByRole("button", { name: /cintura/i }));
    fireEvent.click(screen.getByText("Cuello"));

    expect(mockUseMeasurementsDashboard).toHaveBeenLastCalledWith("week", "neckCm");
    expect(screen.queryByText("Cadera")).not.toBeInTheDocument();
  });

  it("selecting a metric does not open the historical overlay", () => {
    render(<MeasurementsCard range="week" />);

    fireEvent.click(screen.getByRole("button", { name: /cintura/i }));
    fireEvent.click(screen.getByText("Cuello"));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders the chevron button with a 32x32px minimum touch target class", () => {
    render(<MeasurementsCard range="week" />);

    const chevronButton = screen.getByRole("button", { name: /cintura/i });
    expect(chevronButton.className).toMatch(/min-h-8/);
    expect(chevronButton.className).toMatch(/min-w-8/);
  });

  it("resets to the default metric on remount (local state, not persisted)", () => {
    const { unmount } = render(<MeasurementsCard range="week" />);

    fireEvent.click(screen.getByRole("button", { name: /cintura/i }));
    fireEvent.click(screen.getByText("Cuello"));
    expect(mockUseMeasurementsDashboard).toHaveBeenLastCalledWith("week", "neckCm");

    unmount();
    render(<MeasurementsCard range="week" />);

    expect(mockUseMeasurementsDashboard).toHaveBeenLastCalledWith("week", "waistCm");
  });
});
