/** @jest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

type RenderState = "empty" | "single" | "line";

interface MockVM {
  points: { date: string; value: number }[];
  linePoints: { key: string; label: string; value: number | null }[];
  renderState: RenderState;
  latest: number | null;
  delta: number | null;
  window: { from: string; to: string };
  isLoading: boolean;
}

const mockVM: MockVM = {
  points: [
    { date: "2026-07-01", value: 80 },
    { date: "2026-07-03", value: 78.5 },
  ],
  linePoints: [
    { key: "2026-07-01", label: "2026-07-01", value: 80 },
    { key: "2026-07-03", label: "2026-07-03", value: 78.5 },
  ],
  renderState: "line",
  latest: 78.5,
  delta: -1.5,
  window: { from: "2026-06-30", to: "2026-07-06" },
  isLoading: false,
};

const mockUseWeightDashboard = jest.fn((_range: string): MockVM => mockVM);

jest.mock("@/hooks/useWeightDashboard", () => ({
  useWeightDashboard: (range: string) => mockUseWeightDashboard(range),
}));

jest.mock("@/db/repos/progress", () => ({
  getRange: jest.fn().mockResolvedValue([]),
}));

import { WeightCard } from "../WeightCard";

describe("WeightCard", () => {
  beforeEach(() => {
    mockUseWeightDashboard.mockClear();
    mockUseWeightDashboard.mockReturnValue(mockVM);
  });

  it("calls the hook with the range prop only, no metric arg", () => {
    render(<WeightCard range="week" />);
    expect(mockUseWeightDashboard).toHaveBeenCalledWith("week");
  });

  it("renders the chart via the hook's renderState", () => {
    render(<WeightCard range="week" />);
    expect(screen.getByTestId("weight-line")).toBeInTheDocument();
  });

  it("whole card tap opens the fullscreen scrub chart", () => {
    render(<WeightCard range="week" />);

    fireEvent.click(screen.getByRole("button", { name: "Ver historial de peso" }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("renders the latest value with a kg unit", () => {
    render(<WeightCard range="week" />);
    expect(screen.getByText(/78,5\s*kg/)).toBeInTheDocument();
  });

  it("renders the delta caption when at least 2 points exist", () => {
    render(<WeightCard range="week" />);
    expect(screen.getByText(/desde inicio/)).toBeInTheDocument();
  });

  it("shows an em dash and no delta caption when there is no data", () => {
    mockUseWeightDashboard.mockReturnValue({
      ...mockVM,
      points: [],
      renderState: "empty" as const,
      linePoints: [],
      latest: null,
      delta: null,
    });

    render(<WeightCard range="week" />);

    expect(
      screen.getByText(
        (_content, element) => element?.tagName === "P" && element.textContent === "— kg"
      )
    ).toBeInTheDocument();
    expect(screen.queryByText(/desde inicio/)).not.toBeInTheDocument();
  });

  it("renders no metric-picker chevron, dropdown, or metric-switching control", () => {
    render(<WeightCard range="week" />);

    expect(screen.queryByRole("button", { name: /cambiar/i })).not.toBeInTheDocument();
    expect(screen.queryAllByRole("button")).toHaveLength(1);
  });
});
