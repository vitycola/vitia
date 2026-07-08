/** @jest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";

const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => mockNavigate,
}));

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

jest.mock("@/src/components/CalorieDashboardCard", () => ({
  CalorieDashboardCard: ({ range }: { range: string }) => (
    <div data-testid="calorie-dashboard-card">Calorías:{range}</div>
  ),
}));

jest.mock("@/src/components/MeasurementsCard", () => ({
  MeasurementsCard: ({ range }: { range: string }) => (
    <div data-testid="measurements-card">Medidas:{range}</div>
  ),
}));

jest.mock("@/src/components/WeightCard", () => ({
  WeightCard: ({ range }: { range: string }) => <div data-testid="weight-card">Peso:{range}</div>,
}));

jest.mock("@/src/components/BodyFatCard", () => ({
  BodyFatCard: ({ range }: { range: string }) => (
    <div data-testid="bodyfat-card">%Grasa:{range}</div>
  ),
}));

// jsdom does not implement URL.createObjectURL/revokeObjectURL.
if (!URL.createObjectURL) URL.createObjectURL = jest.fn(() => "blob:mock-url");
if (!URL.revokeObjectURL) URL.revokeObjectURL = jest.fn();

let mockGalleryVM: {
  months: Array<{ key: string; label: string; items: Array<{ entry: { date: string } }> }>;
  isLoading: boolean;
};
jest.mock("@/hooks/useProgressPhotoGallery", () => ({
  useProgressPhotoGallery: () => mockGalleryVM,
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
    mockGalleryVM = { months: [], isLoading: false };
    (URL.createObjectURL as jest.Mock).mockReturnValue("blob:mock-url");
  });

  it("renders the full-width Calorías card above a 3-column Peso/%Grasa/Medidas row", () => {
    const { container } = render(
      <MemoryRouter>
        <ProgressRoute />
      </MemoryRouter>
    );

    expect(screen.getByTestId("calorie-dashboard-card")).toBeInTheDocument();
    expect(screen.getByText("Peso")).toBeInTheDocument();
    expect(screen.getByText("% Grasa")).toBeInTheDocument();
    expect(screen.getByTestId("weight-card")).toBeInTheDocument();
    expect(screen.getByTestId("bodyfat-card")).toBeInTheDocument();
    expect(screen.getByTestId("measurements-card")).toBeInTheDocument();

    const grid = container.querySelector(".grid.grid-cols-3");
    expect(grid).not.toBeNull();
    expect(grid?.children).toHaveLength(3);
    // Calorías is NOT one of the 3-column grid's children — it renders full-width above it.
    expect(grid?.contains(screen.getByTestId("calorie-dashboard-card"))).toBe(false);
  });

  it("does not render PhotoStubCard", () => {
    render(
      <MemoryRouter>
        <ProgressRoute />
      </MemoryRouter>
    );

    expect(screen.queryByText(/agregar foto de progreso/i)).not.toBeInTheDocument();
  });

  it("renders the Semana/Mes/3 meses segmented filter", () => {
    render(
      <MemoryRouter>
        <ProgressRoute />
      </MemoryRouter>
    );

    expect(screen.getByRole("button", { name: "Semana" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mes" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "3 meses" })).toBeInTheDocument();
  });

  it("clicking a filter option updates selectedRange state only — no query/chart side effect", () => {
    render(
      <MemoryRouter>
        <ProgressRoute />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Mes" }));

    expect(mockSetRange).toHaveBeenCalledWith("month");
    expect(mockSetRange).toHaveBeenCalledTimes(1);
    // No chart/dashboard content is asserted because none is expected to exist.
  });

  it("clicking each option maps to the correct DashboardRange value", () => {
    render(
      <MemoryRouter>
        <ProgressRoute />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Semana" }));
    expect(mockSetRange).toHaveBeenCalledWith("week");

    fireEvent.click(screen.getByRole("button", { name: "3 meses" }));
    expect(mockSetRange).toHaveBeenCalledWith("3month");
  });

  it("renders a '+' button that opens ProgressEntrySheet in create mode when no record exists", () => {
    render(
      <MemoryRouter>
        <ProgressRoute />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Añadir progreso" }));

    expect(screen.getByText("ProgressEntrySheet:create")).toBeInTheDocument();
  });

  it("opens ProgressEntrySheet in edit mode when a record already exists for today", () => {
    mockProgressState = {
      current: { id: "e1", date: "2026-01-01", weightKg: 70, photos: [] },
      selectedRange: "week",
    };

    render(
      <MemoryRouter>
        <ProgressRoute />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Añadir progreso" }));

    expect(screen.getByText("ProgressEntrySheet:edit")).toBeInTheDocument();
  });

  it("renders the '+' entry point as a small icon-only button (no full-width label)", () => {
    render(
      <MemoryRouter>
        <ProgressRoute />
      </MemoryRouter>
    );

    const button = screen.getByRole("button", { name: "Añadir progreso" });
    // Icon-only: no visible "Añadir progreso" text node inside the button,
    // only the accessible name via aria-label.
    expect(button.textContent).toBe("");
  });

  it("renders DOM order as [+ button] -> [segmented filter] -> [dashboard grid]", () => {
    render(
      <MemoryRouter>
        <ProgressRoute />
      </MemoryRouter>
    );

    const addButton = screen.getByRole("button", { name: "Añadir progreso" });
    const filterButton = screen.getByRole("button", { name: "Semana" });
    const grid = screen.getByText("Peso").closest(".grid.grid-cols-3");

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

  it("renders the '+' button and the segmented filter as siblings in one shared row, above the dashboard grid", () => {
    render(
      <MemoryRouter>
        <ProgressRoute />
      </MemoryRouter>
    );

    const addButton = screen.getByRole("button", { name: "Añadir progreso" });
    const filterButton = screen.getByRole("button", { name: "Semana" });
    const filterContainer = filterButton.parentElement; // the segmented-filter row div
    const grid = screen.getByText("Peso").closest(".grid.grid-cols-3");

    // The "+" button and the filter container must be DIRECT siblings inside
    // one shared row — not two separately stacked rows under a generic page
    // wrapper. This means addButton's parent must be the SAME element as
    // filterContainer's parent, and that parent must contain only these two
    // as its row children (not the dashboard grid too).
    const sharedRow = addButton.parentElement;
    expect(sharedRow).not.toBeNull();
    expect(sharedRow).toBe(filterContainer?.parentElement);
    expect(sharedRow?.contains(grid as Element)).toBe(false);

    // The shared row still precedes the dashboard grid in document order.
    expect(
      (sharedRow as Element).compareDocumentPosition(grid as Element) &
        Node.DOCUMENT_POSITION_FOLLOWING
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

    render(
      <MemoryRouter>
        <ProgressRoute />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Añadir progreso" }));

    expect(screen.getAllByRole("img")).toHaveLength(2);
  });

  describe("Fotos de progreso entry-point card (spec: Entry-Point Card Placement and Content)", () => {
    it("renders as the LAST element of the content column, after CalorieDashboardCard and the 3-column grid", () => {
      const { container } = render(
        <MemoryRouter>
          <ProgressRoute />
        </MemoryRouter>
      );

      const contentColumn = container.firstElementChild as Element;
      const card = screen.getByTestId("photos-entry-card");
      const grid = screen.getByText("Peso").closest(".grid.grid-cols-3") as Element;

      expect(contentColumn.lastElementChild).toBe(card);
      expect(grid.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it("shows an empty-state message when no photos have ever been uploaded", () => {
      mockGalleryVM = { months: [], isLoading: false };

      render(
        <MemoryRouter>
          <ProgressRoute />
        </MemoryRouter>
      );

      expect(screen.getByTestId("photos-entry-card")).toHaveTextContent(
        /aún no hay fotos de progreso/i
      );
    });

    it("shows the total photo count and most recent upload date when photos exist", () => {
      mockGalleryVM = {
        months: [
          {
            key: "2026-07",
            label: "Julio 2026",
            items: [{ entry: { date: "2026-07-05" } }, { entry: { date: "2026-07-01" } }],
          },
          {
            key: "2026-06",
            label: "Junio 2026",
            items: [{ entry: { date: "2026-06-01" } }],
          },
        ],
        isLoading: false,
      };

      render(
        <MemoryRouter>
          <ProgressRoute />
        </MemoryRouter>
      );

      const card = screen.getByTestId("photos-entry-card");
      expect(card).toHaveTextContent("3");
      expect(card.textContent).toMatch(/5 jul/i);
    });

    it("navigates to /profile/progress/photos when tapped, regardless of photo state", () => {
      render(
        <MemoryRouter>
          <ProgressRoute />
        </MemoryRouter>
      );

      fireEvent.click(screen.getByTestId("photos-entry-card"));

      expect(mockNavigate).toHaveBeenCalledWith("/profile/progress/photos");
    });
  });
});
