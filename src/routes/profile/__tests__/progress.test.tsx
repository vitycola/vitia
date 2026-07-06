/** @jest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

jest.mock("@/src/components/ProgressEntrySheet", () => ({
  ProgressEntrySheet: ({ mode, onClose }: { mode: string; onClose: () => void }) => (
    <div>
      <span>ProgressEntrySheet:{mode}</span>
      <button type="button" onClick={onClose}>
        CloseSheet
      </button>
    </div>
  ),
}));

const mockSetRange = jest.fn();
const mockLoadByDate = jest.fn();
let mockProgressState: { current: unknown; selectedRange: string } = {
  current: null,
  selectedRange: "week",
};
jest.mock("@/stores/useProgressStore", () => ({
  useProgressStore: (...args: unknown[]) => {
    const state = {
      ...mockProgressState,
      setRange: mockSetRange,
      loadByDate: mockLoadByDate,
      saveEntry: jest.fn(),
    };
    const selector = args[0] as ((s: typeof state) => unknown) | undefined;
    return selector ? selector(state) : state;
  },
}));

import { ProgressRoute } from "../progress";

describe("ProgressRoute", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockProgressState = { current: null, selectedRange: "week" };
  });

  it("renders all 4 empty-state cards inside a 2x2 grid", () => {
    const { container } = render(<ProgressRoute />);

    expect(screen.getByText("Calorías")).toBeInTheDocument();
    expect(screen.getByText("Peso")).toBeInTheDocument();
    expect(screen.getByText("% Grasa")).toBeInTheDocument();
    expect(screen.getByText("Medidas")).toBeInTheDocument();

    const grid = container.querySelector(".grid.grid-cols-2");
    expect(grid).not.toBeNull();
    expect(grid?.children).toHaveLength(4);
  });

  it("does not render PhotoStubCard", () => {
    render(<ProgressRoute />);

    expect(screen.queryByText(/agregar foto de progreso/i)).not.toBeInTheDocument();
  });

  it("renders the Semana/Mes/3 meses segmented filter", () => {
    render(<ProgressRoute />);

    expect(screen.getByRole("button", { name: "Semana" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mes" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "3 meses" })).toBeInTheDocument();
  });

  it("clicking a filter option updates selectedRange state only — no query/chart side effect", () => {
    render(<ProgressRoute />);

    fireEvent.click(screen.getByRole("button", { name: "Mes" }));

    expect(mockSetRange).toHaveBeenCalledWith("month");
    expect(mockSetRange).toHaveBeenCalledTimes(1);
    // No chart/dashboard content is asserted because none is expected to exist.
  });

  it("clicking each option maps to the correct DashboardRange value", () => {
    render(<ProgressRoute />);

    fireEvent.click(screen.getByRole("button", { name: "Semana" }));
    expect(mockSetRange).toHaveBeenCalledWith("week");

    fireEvent.click(screen.getByRole("button", { name: "3 meses" }));
    expect(mockSetRange).toHaveBeenCalledWith("3month");
  });

  it("renders a '+' button that opens ProgressEntrySheet in create mode when no record exists", () => {
    render(<ProgressRoute />);

    fireEvent.click(screen.getByRole("button", { name: "Añadir progreso" }));

    expect(screen.getByText("ProgressEntrySheet:create")).toBeInTheDocument();
  });

  it("opens ProgressEntrySheet in edit mode when a record already exists for today", () => {
    mockProgressState = {
      current: { id: "e1", date: "2026-01-01", weightKg: 70, photos: [] },
      selectedRange: "week",
    };

    render(<ProgressRoute />);

    fireEvent.click(screen.getByRole("button", { name: "Añadir progreso" }));

    expect(screen.getByText("ProgressEntrySheet:edit")).toBeInTheDocument();
  });
});
