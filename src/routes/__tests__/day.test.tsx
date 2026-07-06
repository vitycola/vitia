/** @jest-environment jsdom */
/**
 * Day screen integration tests — progress-log entry point (spec: "Day screen
 * entry point reflects record existence").
 *
 * Heavy child components (MealSection, CalorieCard, HeaderMacroRow,
 * WeekCalendarHeader, GoalEditorSheet, ProgressEntrySheet) and all stores are
 * mocked so only the add-progress-button / edit-summary-widget wiring is
 * under test.
 */
import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";

// jsdom does not implement URL.createObjectURL/revokeObjectURL.
if (!URL.createObjectURL) URL.createObjectURL = jest.fn(() => "blob:mock-url");
if (!URL.revokeObjectURL) URL.revokeObjectURL = jest.fn();

jest.mock("@/src/components/CalorieCard", () => ({ CalorieCard: () => <div>CalorieCard</div> }));
jest.mock("@/src/components/GoalEditorSheet", () => ({
  GoalEditorSheet: () => <div>GoalEditorSheet</div>,
}));
jest.mock("@/src/components/HeaderMacroRow", () => ({
  HeaderMacroRow: () => <div>HeaderMacroRow</div>,
}));
jest.mock("@/src/components/MealSection", () => ({ MealSection: () => <div>MealSection</div> }));
jest.mock("@/src/components/WeekCalendarHeader", () => ({
  WeekCalendarHeader: () => <div>WeekCalendarHeader</div>,
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

const mockUseDayStore = jest.fn();
jest.mock("@/stores/useDayStore", () => ({
  useDayStore: (...args: unknown[]) => mockUseDayStore(...args),
}));

const mockUseProfileStore = jest.fn();
jest.mock("@/stores/useProfileStore", () => {
  const fn = (...args: unknown[]) => mockUseProfileStore(...args);
  fn.getState = () => mockUseProfileStore();
  return { useProfileStore: fn };
});

const mockLoadByDate = jest.fn();
const mockSaveEntry = jest.fn();
const mockDeleteEntry = jest.fn();
let mockProgressState: { current: unknown; isLoading: boolean } = {
  current: null,
  isLoading: false,
};
jest.mock("@/stores/useProgressStore", () => ({
  useProgressStore: (...args: unknown[]) => {
    const state = {
      ...mockProgressState,
      loadByDate: mockLoadByDate,
      saveEntry: mockSaveEntry,
      deleteEntry: mockDeleteEntry,
    };
    const selector = args[0] as ((s: typeof state) => unknown) | undefined;
    return selector ? selector(state) : state;
  },
}));

import { DayScreen } from "../day";

const baseDayState = {
  selectedDate: "2026-01-01",
  entries: [],
  loadEntries: jest.fn(),
  setDate: jest.fn(),
  deleteEntry: jest.fn(),
  repeatMeal: jest.fn(),
  pasteEntries: jest.fn(),
  clearMeal: jest.fn(),
};

const baseProfile = {
  profile: {
    calorieGoal: 2000,
    proteinGoalG: 150,
    carbsGoalG: 250,
    fatGoalG: 70,
    sex: "male",
    heightCm: 180,
  },
  load: jest.fn().mockResolvedValue(undefined),
  overrideGoals: jest.fn(),
};

function renderDayScreen() {
  const { MemoryRouter } = jest.requireActual("react-router-dom");
  return render(
    <MemoryRouter>
      <DayScreen />
    </MemoryRouter>
  );
}

describe("DayScreen — progress-log entry point", () => {
  const originalConfirm = window.confirm;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseDayStore.mockReturnValue(baseDayState);
    mockUseProfileStore.mockReturnValue(baseProfile);
    mockProgressState = { current: null, isLoading: false };
    (URL.createObjectURL as jest.Mock).mockReturnValue("blob:mock-url");
  });

  afterEach(() => {
    window.confirm = originalConfirm;
  });

  it("shows the 'Añadir progreso' button after the meals loop when no record exists for the day", () => {
    renderDayScreen();

    expect(screen.getByText("Añadir progreso")).toBeInTheDocument();
  });

  it("tapping 'Añadir progreso' opens the sheet in create mode", () => {
    renderDayScreen();

    fireEvent.click(screen.getByText("Añadir progreso"));

    expect(screen.getByText("ProgressEntrySheet:create")).toBeInTheDocument();
  });

  it("shows an edit-summary widget instead of the button when a record exists", () => {
    mockProgressState = {
      current: {
        id: "e1",
        date: "2026-01-01",
        weightKg: 70,
        neckCm: null,
        waistCm: null,
        hipCm: null,
        bodyFatPct: null,
        notes: null,
        photos: [],
      },
      isLoading: false,
    };

    renderDayScreen();

    expect(screen.queryByText("Añadir progreso")).not.toBeInTheDocument();
    expect(screen.getByText(/70/)).toBeInTheDocument();
  });

  it("shows a distinct pencil (edit) button and trash (delete) button as separate elements", () => {
    mockProgressState = {
      current: {
        id: "e1",
        date: "2026-01-01",
        weightKg: 70,
        neckCm: null,
        waistCm: null,
        hipCm: null,
        bodyFatPct: null,
        notes: null,
        photos: [],
      },
      isLoading: false,
    };

    renderDayScreen();

    const editButton = screen.getByRole("button", { name: "Editar progreso" });
    const deleteButton = screen.getByRole("button", { name: "Eliminar progreso" });
    expect(editButton).toBeInTheDocument();
    expect(deleteButton).toBeInTheDocument();
    expect(editButton).not.toBe(deleteButton);
  });

  it("tapping the pencil icon opens the sheet pre-filled in edit mode", () => {
    mockProgressState = {
      current: {
        id: "e1",
        date: "2026-01-01",
        weightKg: 70,
        neckCm: null,
        waistCm: null,
        hipCm: null,
        bodyFatPct: null,
        notes: null,
        photos: [],
      },
      isLoading: false,
    };

    renderDayScreen();

    fireEvent.click(screen.getByRole("button", { name: "Editar progreso" }));

    expect(screen.getByText("ProgressEntrySheet:edit")).toBeInTheDocument();
  });

  it("tapping the trash icon prompts for confirmation and, when confirmed, deletes the entry", async () => {
    window.confirm = jest.fn(() => true);
    mockDeleteEntry.mockResolvedValue(undefined);
    mockProgressState = {
      current: {
        id: "e1",
        date: "2026-01-01",
        weightKg: 70,
        neckCm: null,
        waistCm: null,
        hipCm: null,
        bodyFatPct: null,
        notes: null,
        photos: [],
      },
      isLoading: false,
    };

    renderDayScreen();

    fireEvent.click(screen.getByRole("button", { name: "Eliminar progreso" }));

    expect(window.confirm).toHaveBeenCalledTimes(1);
    await Promise.resolve(); // flush the async delete handler's microtask
    expect(mockDeleteEntry).toHaveBeenCalledWith("2026-01-01");
  });

  it("does not delete when the confirmation is canceled", () => {
    window.confirm = jest.fn(() => false);
    mockProgressState = {
      current: {
        id: "e1",
        date: "2026-01-01",
        weightKg: 70,
        neckCm: null,
        waistCm: null,
        hipCm: null,
        bodyFatPct: null,
        notes: null,
        photos: [],
      },
      isLoading: false,
    };

    renderDayScreen();

    fireEvent.click(screen.getByRole("button", { name: "Eliminar progreso" }));

    expect(window.confirm).toHaveBeenCalledTimes(1);
    expect(mockDeleteEntry).not.toHaveBeenCalled();
  });

  it("reverts to the 'Añadir progreso' button after the widget's record is gone", () => {
    mockProgressState = { current: null, isLoading: false };

    renderDayScreen();

    expect(screen.getByText("Añadir progreso")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Eliminar progreso" })).not.toBeInTheDocument();
  });

  it("passes existingPhotos converted to object URLs to the sheet", () => {
    mockProgressState = {
      current: {
        id: "e1",
        date: "2026-01-01",
        weightKg: 70,
        neckCm: null,
        waistCm: null,
        hipCm: null,
        bodyFatPct: null,
        notes: null,
        photos: [
          { id: "p1", blob: new Blob(["a"]), mimeType: "image/png" },
          { id: "p2", blob: new Blob(["b"]), mimeType: "image/png" },
        ],
      },
      isLoading: false,
    };

    renderDayScreen();

    fireEvent.click(screen.getByRole("button", { name: "Editar progreso" }));

    expect(screen.getAllByRole("img")).toHaveLength(2);
  });

  it("calls loadByDate with the selected date on mount", () => {
    renderDayScreen();
    expect(mockLoadByDate).toHaveBeenCalledWith("2026-01-01");
  });
});
