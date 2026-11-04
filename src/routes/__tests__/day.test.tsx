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
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

// jsdom does not implement URL.createObjectURL/revokeObjectURL.
if (!URL.createObjectURL) URL.createObjectURL = jest.fn(() => "blob:mock-url");
if (!URL.revokeObjectURL) URL.revokeObjectURL = jest.fn();

jest.mock("@/src/components/CalorieCard", () => ({
  CalorieCard: (p: {
    goal: number;
    proteinGoalG: number;
    carbsGoalG: number;
    fatGoalG: number;
  }) => (
    <div
      data-testid="calorie-card"
      data-goals={[p.goal, p.proteinGoalG, p.carbsGoalG, p.fatGoalG].join("/")}
    >
      CalorieCard
    </div>
  ),
}));
jest.mock("@/src/components/GoalEditorSheet", () => ({
  GoalEditorSheet: () => <div>GoalEditorSheet</div>,
}));
jest.mock("@/src/components/HeaderMacroRow", () => ({
  HeaderMacroRow: (p: {
    calorieGoal: number;
    proteinGoalG: number;
    carbsGoalG: number;
    fatGoalG: number;
  }) => (
    <div
      data-testid="header-macro-row"
      data-goals={[p.calorieGoal, p.proteinGoalG, p.carbsGoalG, p.fatGoalG].join("/")}
    >
      HeaderMacroRow
    </div>
  ),
}));
jest.mock("@/src/components/MealSection", () => ({ MealSection: () => <div>MealSection</div> }));
jest.mock("@/src/components/WeekCalendarHeader", () => ({
  WeekCalendarHeader: () => <div>WeekCalendarHeader</div>,
}));
jest.mock("@/src/components/ProgressEntrySheet", () => ({
  ProgressEntrySheet: ({
    mode,
    onClose,
    onSave,
    existingPhotos,
  }: {
    mode: string;
    onClose: () => void;
    onSave: (input: { weightKg: number }) => Promise<void>;
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
      <button type="button" onClick={() => void onSave({ weightKg: 70 })}>
        SaveSheet
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

const mockUseGoalFor = jest.fn();
jest.mock("@/hooks/useGoalFor", () => ({
  useGoalFor: (date: string) => mockUseGoalFor(date),
}));

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

import { DEFAULT_GOALS } from "@/lib/constants";
import { todayISO } from "@/lib/date";
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
    mockUseGoalFor.mockReturnValue(null);
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

describe("DayScreen — date-aware logging", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseProfileStore.mockReturnValue(baseProfile);
    mockProgressState = { current: null, isLoading: false };
    mockSaveEntry.mockResolvedValue(undefined);
  });

  const withDate = (selectedDate: string) =>
    mockUseDayStore.mockReturnValue({ ...baseDayState, selectedDate });

  it("shows the neutral date indicator and no read-only text on a past day", () => {
    withDate("2025-10-05");
    renderDayScreen();

    expect(screen.getByText("Registrando comidas del 5 oct")).toBeInTheDocument();
    expect(screen.queryByText(/solo lectura/i)).not.toBeInTheDocument();
  });

  it("shows the same indicator, without read-only text, on a future day", () => {
    withDate("2099-01-01");
    renderDayScreen();

    expect(screen.getByText("Registrando comidas del 1 ene")).toBeInTheDocument();
    expect(screen.queryByText(/solo lectura/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/anterior/i)).not.toBeInTheDocument();
  });

  it("shows no indicator and no read-only text on today", () => {
    withDate(todayISO());
    renderDayScreen();

    expect(screen.queryByText(/Registrando comidas del/)).not.toBeInTheDocument();
    expect(screen.queryByText(/solo lectura/i)).not.toBeInTheDocument();
  });

  it("disables 'Añadir progreso' with a hint on a future day", () => {
    withDate("2099-01-01");
    renderDayScreen();

    const button = screen.getByRole("button", { name: "Añadir progreso" });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription("No se puede registrar progreso en fechas futuras");
    fireEvent.click(button);
    expect(screen.queryByText("ProgressEntrySheet:create")).not.toBeInTheDocument();
  });

  it("keeps 'Añadir progreso' enabled and without hint on a past day and today", () => {
    withDate("2025-10-05");
    const { unmount } = renderDayScreen();
    expect(screen.getByRole("button", { name: "Añadir progreso" })).toBeEnabled();
    expect(screen.queryByText(/fechas futuras/)).not.toBeInTheDocument();
    unmount();

    withDate(todayISO());
    renderDayScreen();
    expect(screen.getByRole("button", { name: "Añadir progreso" })).toBeEnabled();
  });

  it("saves progress to the selected past date", async () => {
    withDate("2025-10-05");
    renderDayScreen();

    fireEvent.click(screen.getByRole("button", { name: "Añadir progreso" }));
    fireEvent.click(screen.getByText("SaveSheet"));

    await waitFor(() =>
      expect(mockSaveEntry).toHaveBeenCalledWith({ date: "2025-10-05", weightKg: 70 })
    );
  });
});

describe("DayScreen — goals follow the selected date", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseDayStore.mockReturnValue(baseDayState);
    mockUseProfileStore.mockReturnValue(baseProfile);
    mockProgressState = { current: null, isLoading: false };
  });

  it("passes the goals resolved for the selected date to the header and the calorie card", () => {
    mockUseGoalFor.mockImplementation((date: string) =>
      date === "2026-01-01"
        ? { calorieGoal: 1700, proteinGoalG: 120, carbsGoalG: 200, fatGoalG: 60 }
        : { calorieGoal: 1500, proteinGoalG: 110, carbsGoalG: 180, fatGoalG: 50 }
    );

    renderDayScreen();

    expect(mockUseGoalFor).toHaveBeenCalledWith("2026-01-01");
    expect(screen.getByTestId("header-macro-row")).toHaveAttribute("data-goals", "1700/120/200/60");
    expect(screen.getByTestId("calorie-card")).toHaveAttribute("data-goals", "1700/120/200/60");
  });

  it("uses a different goal when another date is selected", () => {
    mockUseGoalFor.mockImplementation((date: string) => ({
      calorieGoal: date === "2026-01-01" ? 1700 : 1500,
      proteinGoalG: 100,
      carbsGoalG: 100,
      fatGoalG: 100,
    }));
    mockUseDayStore.mockReturnValue({ ...baseDayState, selectedDate: "2026-01-02" });

    renderDayScreen();

    expect(screen.getByTestId("calorie-card")).toHaveAttribute("data-goals", "1500/100/100/100");
  });

  it("falls back to DEFAULT_GOALS when no goal resolves", () => {
    mockUseGoalFor.mockReturnValue(null);

    renderDayScreen();

    const { calorieGoal, proteinGoalG, carbsGoalG, fatGoalG } = DEFAULT_GOALS;
    const expected = [calorieGoal, proteinGoalG, carbsGoalG, fatGoalG].join("/");
    expect(screen.getByTestId("header-macro-row")).toHaveAttribute("data-goals", expected);
    expect(screen.getByTestId("calorie-card")).toHaveAttribute("data-goals", expected);
  });
});
