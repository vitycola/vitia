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
    { date: "2026-07-01", value: 22.4 },
    { date: "2026-07-03", value: 21.1 },
  ],
  linePoints: [
    { key: "2026-07-01", label: "2026-07-01", value: 22.4 },
    { key: "2026-07-03", label: "2026-07-03", value: 21.1 },
  ],
  renderState: "line",
  latest: 21.1,
  delta: -1.3,
  window: { from: "2026-06-30", to: "2026-07-06" },
  isLoading: false,
};

const mockUseBodyFatDashboard = jest.fn((_range: string): MockVM => mockVM);

jest.mock("@/hooks/useBodyFatDashboard", () => ({
  useBodyFatDashboard: (range: string) => mockUseBodyFatDashboard(range),
}));

jest.mock("@/db/repos/progress", () => ({
  getRange: jest.fn().mockResolvedValue([]),
}));

import { BodyFatCard } from "../BodyFatCard";

describe("BodyFatCard", () => {
  beforeEach(() => {
    mockUseBodyFatDashboard.mockClear();
    mockUseBodyFatDashboard.mockReturnValue(mockVM);
  });

  it("calls the hook with the range prop only, no metric arg", () => {
    render(<BodyFatCard range="week" />);
    expect(mockUseBodyFatDashboard).toHaveBeenCalledWith("week");
  });

  it("renders the chart via the hook's renderState", () => {
    render(<BodyFatCard range="week" />);
    expect(screen.getByTestId("bodyfat-line")).toBeInTheDocument();
  });

  it("whole card tap opens the historical overlay", () => {
    render(<BodyFatCard range="week" />);

    fireEvent.click(screen.getByRole("button", { name: "Ver historial de % grasa" }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("renders the latest value with a % unit", () => {
    render(<BodyFatCard range="week" />);
    expect(screen.getByText(/21,1\s*%/)).toBeInTheDocument();
  });

  it("renders the delta caption when at least 2 points exist", () => {
    render(<BodyFatCard range="week" />);
    expect(screen.getByText(/desde inicio/)).toBeInTheDocument();
  });

  it("shows an em dash and no delta caption when there is no data", () => {
    mockUseBodyFatDashboard.mockReturnValue({
      ...mockVM,
      renderState: "empty" as const,
      linePoints: [],
      latest: null,
      delta: null,
    });

    render(<BodyFatCard range="week" />);

    expect(
      screen.getByText(
        (_content, element) => element?.tagName === "P" && element.textContent === "— %"
      )
    ).toBeInTheDocument();
    expect(screen.queryByText(/desde inicio/)).not.toBeInTheDocument();
  });

  it("renders no metric-picker chevron, dropdown, or metric-switching control", () => {
    render(<BodyFatCard range="week" />);

    expect(screen.queryByRole("button", { name: /cambiar/i })).not.toBeInTheDocument();
    expect(screen.queryAllByRole("button")).toHaveLength(1);
  });

  it("handles a null latest value (all-null bodyFatPct entries) without crashing", () => {
    mockUseBodyFatDashboard.mockReturnValue({
      ...mockVM,
      renderState: "empty" as const,
      linePoints: [],
      latest: null,
      delta: null,
    });

    expect(() => render(<BodyFatCard range="week" />)).not.toThrow();
  });
});
