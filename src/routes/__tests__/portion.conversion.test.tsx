/** @jest-environment jsdom */
/**
 * Tests for the functional crudo/cocido conversion toggle on the diary
 * logging screen (src/routes/portion.tsx). Repurposes the pre-existing
 * display-only crudo/cocido <select> into a real conversion control wired to
 * canConvert/directionFor/convertWeight (design D4, spec: Conversion Applied
 * at Diary Logging).
 *
 * Does not re-test unrelated portion-screen behavior already covered by
 * portion.options-menu.test.tsx.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import type { Food } from "@/db/schema";

const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({ foodId: "food-1" }),
  useSearchParams: () => [new URLSearchParams()],
}));

const mockGetById = jest.fn();
const mockGetIngredients = jest.fn();
jest.mock("@/db/repos/foods", () => ({
  getById: (...args: unknown[]) => mockGetById(...args),
  getIngredients: (...args: unknown[]) => mockGetIngredients(...args),
}));

jest.mock("@/hooks/useFavorite", () => ({
  useFavorite: () => ({
    isFavorite: false,
    meals: [],
    loading: false,
    setMeals: jest.fn(),
    remove: jest.fn(),
  }),
}));

const mockAddEntry = jest.fn();
const mockUpdateEntry = jest.fn();
jest.mock("@/stores/useDayStore", () => ({
  useDayStore: () => ({
    addEntry: (...args: unknown[]) => mockAddEntry(...args),
    updateEntry: (...args: unknown[]) => mockUpdateEntry(...args),
    entries: [],
  }),
}));

import { PortionRoute } from "../portion";

function makeFood(overrides: Partial<Food> = {}): Food {
  return {
    id: "food-1",
    name: "Garbanzos secos",
    brand: null,
    caloriesPer100g: 100,
    proteinPer100g: 10,
    carbsPer100g: 20,
    fatPer100g: 1,
    servingSizeG: 100,
    source: "custom",
    category: "legumbres", // COOKING_FACTORS.legumbres = 2.2
    dataBasis: "crudo",
    offProductCode: null,
    nameNormalized: "garbanzos secos",
    imageUrl: null,
    createdAt: "2024-01-01",
    ...overrides,
  } as Food;
}

describe("PortionRoute — crudo/cocido conversion toggle", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockGetById.mockReset();
    mockGetIngredients.mockReset();
    mockAddEntry.mockReset();
    mockUpdateEntry.mockReset();
  });

  it("shows the crudo/cocido toggle when canConvert is true (known factor + resolved basis)", async () => {
    mockGetById.mockResolvedValue(makeFood());
    mockGetIngredients.mockResolvedValue([]);

    render(<PortionRoute />);

    await waitFor(() => expect(screen.getByLabelText(/tipo de peso/i)).toBeInTheDocument());
  });

  it("hides the toggle when the category has no known factor (fail-closed)", async () => {
    mockGetById.mockResolvedValue(makeFood({ category: "bebidas", dataBasis: null }));
    mockGetIngredients.mockResolvedValue([]);

    render(<PortionRoute />);

    await waitFor(() => expect(screen.getByText("Garbanzos secos")).toBeInTheDocument());
    expect(screen.queryByLabelText(/tipo de peso/i)).not.toBeInTheDocument();
  });

  it("hides the toggle when dataBasis is unresolved even with a known factor (fail-closed)", async () => {
    mockGetById.mockResolvedValue(makeFood({ category: "legumbres", dataBasis: null }));
    mockGetIngredients.mockResolvedValue([]);

    render(<PortionRoute />);

    await waitFor(() => expect(screen.getByText("Garbanzos secos")).toBeInTheDocument());
    expect(screen.queryByLabelText(/tipo de peso/i)).not.toBeInTheDocument();
  });

  it("converts cocido-entered weight to crudo-basis grams before persisting quantityG and macros", async () => {
    mockGetById.mockResolvedValue(makeFood()); // dataBasis: crudo, factor 2.2
    mockGetIngredients.mockResolvedValue([]);

    render(<PortionRoute />);
    await waitFor(() => expect(screen.getByLabelText(/tipo de peso/i)).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/cantidad/i), { target: { value: "220" } });
    fireEvent.change(screen.getByLabelText(/tipo de peso/i), { target: { value: "cocido" } });

    fireEvent.click(screen.getByRole("button", { name: /^añadir a desayuno$/i }));

    await waitFor(() => expect(mockAddEntry).toHaveBeenCalledTimes(1));
    const [entry] = mockAddEntry.mock.calls[0];
    // 220 g cocido -> crudo = 220 / 2.2 = 100 g crudo
    expect(entry.quantityG).toBeCloseTo(100, 6);
    // Macros computed from the converted (crudo-basis) grams, matching the
    // food's crudo-basis per-100g data: 100g * caloriesPer100g(100)/100 = 100
    expect(entry.calories).toBeCloseTo(100, 6);
  });

  it("logs raw entered grams unchanged when the entered basis already matches the stored basis", async () => {
    mockGetById.mockResolvedValue(makeFood()); // dataBasis: crudo
    mockGetIngredients.mockResolvedValue([]);

    render(<PortionRoute />);
    await waitFor(() => expect(screen.getByLabelText(/tipo de peso/i)).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/cantidad/i), { target: { value: "150" } });
    // Toggle defaults to "crudo" already — matches stored basis, no conversion.
    fireEvent.click(screen.getByRole("button", { name: /^añadir a desayuno$/i }));

    await waitFor(() => expect(mockAddEntry).toHaveBeenCalledTimes(1));
    const [entry] = mockAddEntry.mock.calls[0];
    expect(entry.quantityG).toBe(150);
  });

  it("logs entered grams unchanged (no conversion) for a food where canConvert is false — regression check", async () => {
    mockGetById.mockResolvedValue(makeFood({ category: "bebidas", dataBasis: null }));
    mockGetIngredients.mockResolvedValue([]);

    render(<PortionRoute />);
    await waitFor(() => expect(screen.getByText("Garbanzos secos")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/cantidad/i), { target: { value: "330" } });
    fireEvent.click(screen.getByRole("button", { name: /^añadir a desayuno$/i }));

    await waitFor(() => expect(mockAddEntry).toHaveBeenCalledTimes(1));
    const [entry] = mockAddEntry.mock.calls[0];
    expect(entry.quantityG).toBe(330);
  });
});
