/** @jest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

const mockVM = {
  points: [
    { date: "2026-07-01", value: 80 },
    { date: "2026-07-03", value: 78.5 },
  ],
  linePoints: [],
  renderState: "line" as const,
  latest: 78.5,
  delta: -1.5,
  window: { from: "2026-06-30", to: "2026-07-06" },
  isLoading: false,
};

const mockUseWeightDashboard = jest.fn((_range: string) => mockVM);

jest.mock("@/hooks/useWeightDashboard", () => ({
  useWeightDashboard: (range: string) => mockUseWeightDashboard(range),
}));

jest.mock("@/db/repos/progress", () => ({
  getRange: jest.fn().mockResolvedValue([]),
}));

import { WeightScrubOverlay } from "../WeightScrubOverlay";

describe("WeightScrubOverlay", () => {
  beforeEach(() => {
    mockUseWeightDashboard.mockClear();
    mockUseWeightDashboard.mockReturnValue(mockVM);
  });

  it("forwards initialRange to useWeightDashboard", () => {
    render(<WeightScrubOverlay initialRange="month" onClose={jest.fn()} />);
    expect(mockUseWeightDashboard).toHaveBeenCalledWith("month");
  });

  it("renders as a dialog titled Peso", () => {
    render(<WeightScrubOverlay initialRange="week" onClose={jest.fn()} />);
    expect(screen.getByRole("dialog", { name: "Peso" })).toBeInTheDocument();
  });

  it("shows the value with a kg unit in the tooltip", () => {
    render(<WeightScrubOverlay initialRange="week" onClose={jest.fn()} />);
    expect(screen.getByText(/78,5\s*kg/)).toBeInTheDocument();
  });

  it("re-derives the dashboard when the in-view range switcher changes range", () => {
    render(<WeightScrubOverlay initialRange="week" onClose={jest.fn()} />);

    mockUseWeightDashboard.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "3 meses" }));

    expect(mockUseWeightDashboard).toHaveBeenCalledWith("3month");
  });
});
