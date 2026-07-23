/** @jest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

const mockVM = {
  points: [
    { date: "2026-07-01", value: 20 },
    { date: "2026-07-03", value: 18.45 },
  ],
  linePoints: [],
  renderState: "line" as const,
  latest: 18.45,
  delta: -1.55,
  window: { from: "2026-06-30", to: "2026-07-06" },
  isLoading: false,
};

const mockUseBodyFatDashboard = jest.fn((_range: string) => mockVM);

jest.mock("@/hooks/useBodyFatDashboard", () => ({
  useBodyFatDashboard: (range: string) => mockUseBodyFatDashboard(range),
}));

jest.mock("@/db/repos/progress", () => ({
  getRange: jest.fn().mockResolvedValue([]),
}));

import { BodyFatScrubOverlay } from "../BodyFatScrubOverlay";

describe("BodyFatScrubOverlay", () => {
  beforeEach(() => {
    mockUseBodyFatDashboard.mockClear();
    mockUseBodyFatDashboard.mockReturnValue(mockVM);
  });

  it("forwards initialRange to useBodyFatDashboard", () => {
    render(<BodyFatScrubOverlay initialRange="month" onClose={jest.fn()} />);
    expect(mockUseBodyFatDashboard).toHaveBeenCalledWith("month");
  });

  it("renders as a dialog titled % Grasa", () => {
    render(<BodyFatScrubOverlay initialRange="week" onClose={jest.fn()} />);
    expect(screen.getByRole("dialog", { name: "% Grasa" })).toBeInTheDocument();
  });

  it("shows the value with a % unit and 1-decimal formatting in the tooltip", () => {
    render(<BodyFatScrubOverlay initialRange="week" onClose={jest.fn()} />);
    expect(screen.getByText(/18,5\s*%/)).toBeInTheDocument();
  });

  it("re-derives the dashboard when the in-view range switcher changes range", () => {
    render(<BodyFatScrubOverlay initialRange="week" onClose={jest.fn()} />);

    mockUseBodyFatDashboard.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "3 meses" }));

    expect(mockUseBodyFatDashboard).toHaveBeenCalledWith("3month");
  });
});
