/** @jest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

const mockVM = {
  points: [
    { date: "2026-07-01", value: 82 },
    { date: "2026-07-03", value: 80 },
  ],
  linePoints: [],
  renderState: "line" as const,
  latest: 80,
  delta: -2,
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

import { MeasurementsScrubOverlay } from "../MeasurementsScrubOverlay";

describe("MeasurementsScrubOverlay", () => {
  beforeEach(() => {
    mockUseMeasurementsDashboard.mockClear();
    mockUseMeasurementsDashboard.mockReturnValue(mockVM);
  });

  it("forwards initialRange and the selected metric to useMeasurementsDashboard", () => {
    render(<MeasurementsScrubOverlay initialRange="month" metric="waistCm" onClose={jest.fn()} />);
    expect(mockUseMeasurementsDashboard).toHaveBeenCalledWith("month", "waistCm");
  });

  it("renders as a dialog titled with the selected metric's label", () => {
    render(<MeasurementsScrubOverlay initialRange="week" metric="waistCm" onClose={jest.fn()} />);
    expect(screen.getByRole("dialog", { name: "Cintura" })).toBeInTheDocument();
  });

  it("titles the dialog differently for a different metric — tooltip shows only the selected field", () => {
    render(<MeasurementsScrubOverlay initialRange="week" metric="hipCm" onClose={jest.fn()} />);
    expect(screen.getByRole("dialog", { name: "Cadera" })).toBeInTheDocument();
  });

  it("shows the value with a cm unit in the tooltip", () => {
    render(<MeasurementsScrubOverlay initialRange="week" metric="waistCm" onClose={jest.fn()} />);
    expect(screen.getByText(/80\s*cm/)).toBeInTheDocument();
  });

  it("re-derives the dashboard when the in-view range switcher changes range, keeping the same metric", () => {
    render(<MeasurementsScrubOverlay initialRange="week" metric="waistCm" onClose={jest.fn()} />);

    mockUseMeasurementsDashboard.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "3 meses" }));

    expect(mockUseMeasurementsDashboard).toHaveBeenCalledWith("3month", "waistCm");
  });
});
