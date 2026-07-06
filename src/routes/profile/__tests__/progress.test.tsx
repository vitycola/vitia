/** @jest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

jest.mock("@/src/components/ProgressEntrySheet", () => ({
  ProgressEntrySheet: ({
    mode,
    onClose,
    existingPhotos,
  }: {
    mode: string;
    onClose: () => void;
    existingPhotos?: { id: string; url: string }[];
  }) => (
    <div>
      <span>ProgressEntrySheet:{mode}</span>
      {(existingPhotos ?? []).map((photo) => (
        <img key={photo.id} src={photo.url} alt="mock existing" />
      ))}
      <button type="button" onClick={onClose}>
        CloseSheet
      </button>
    </div>
  ),
}));

// jsdom does not implement URL.createObjectURL/revokeObjectURL.
if (!URL.createObjectURL) URL.createObjectURL = jest.fn(() => "blob:mock-url");
if (!URL.revokeObjectURL) URL.revokeObjectURL = jest.fn();

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
    (URL.createObjectURL as jest.Mock).mockReturnValue("blob:mock-url");
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

  it("renders the '+' entry point as a small icon-only button (no full-width label)", () => {
    render(<ProgressRoute />);

    const button = screen.getByRole("button", { name: "Añadir progreso" });
    // Icon-only: no visible "Añadir progreso" text node inside the button,
    // only the accessible name via aria-label.
    expect(button.textContent).toBe("");
  });

  it("renders DOM order as [+ button] -> [segmented filter] -> [dashboard grid]", () => {
    render(<ProgressRoute />);

    const addButton = screen.getByRole("button", { name: "Añadir progreso" });
    const filterButton = screen.getByRole("button", { name: "Semana" });
    const grid = screen.getByText("Calorías").closest(".grid.grid-cols-2");

    expect(grid).not.toBeNull();
    // addButton precedes filterButton in document order
    expect(
      addButton.compareDocumentPosition(filterButton) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    // filterButton precedes the dashboard grid in document order
    expect(
      filterButton.compareDocumentPosition(grid as Element) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it("passes existingPhotos converted to object URLs to the sheet when a record exists for today", () => {
    mockProgressState = {
      current: {
        id: "e1",
        date: "2026-01-01",
        weightKg: 70,
        photos: [
          { id: "p1", blob: new Blob(["a"]), mimeType: "image/png" },
          { id: "p2", blob: new Blob(["b"]), mimeType: "image/png" },
        ],
      },
      selectedRange: "week",
    };

    render(<ProgressRoute />);

    fireEvent.click(screen.getByRole("button", { name: "Añadir progreso" }));

    expect(screen.getAllByRole("img")).toHaveLength(2);
  });
});
