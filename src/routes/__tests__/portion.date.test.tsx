/** @jest-environment jsdom */
/**
 * Tests that PortionRoute dates a NEW entry with the day selected in
 * useDayStore (not today), and leaves an EDITED entry's own date untouched.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import type { Food } from "@/db/schema";

let mockSearch = "";
const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({ foodId: "food-1" }),
  useSearchParams: () => [new URLSearchParams(mockSearch)],
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

const SELECTED_DATE = "2026-09-20";
const mockAddEntry = jest.fn();
const mockUpdateEntry = jest.fn();
let mockEntries: unknown[] = [];
jest.mock("@/stores/useDayStore", () => ({
  useDayStore: () => ({
    addEntry: (...args: unknown[]) => mockAddEntry(...args),
    updateEntry: (...args: unknown[]) => mockUpdateEntry(...args),
    entries: mockEntries,
    selectedDate: SELECTED_DATE,
  }),
}));

import { PortionRoute } from "../portion";

function makeFood(): Food {
  return {
    id: "food-1",
    name: "Garbanzos secos",
    brand: null,
    caloriesPer100g: 100,
    proteinPer100g: 10,
    carbsPer100g: 20,
    fatPer100g: 1,
    servingSizeG: 100,
    source: "generic",
    category: null,
    dataBasis: null,
    offProductCode: null,
    nameNormalized: "garbanzos secos",
    imageUrl: null,
    createdAt: "2024-01-01",
  } as Food;
}

describe("PortionRoute — entry date", () => {
  beforeEach(() => {
    mockSearch = "";
    mockEntries = [];
    mockNavigate.mockReset();
    mockAddEntry.mockReset();
    mockUpdateEntry.mockReset();
    mockGetById.mockReset().mockResolvedValue(makeFood());
    mockGetIngredients.mockReset().mockResolvedValue([]);
  });

  it("create mode: saves the new entry on the selected day, not today", async () => {
    render(<PortionRoute />);
    await waitFor(() => expect(screen.getByText("Garbanzos secos")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /^añadir a desayuno$/i }));

    await waitFor(() => expect(mockAddEntry).toHaveBeenCalledTimes(1));
    expect(mockAddEntry).toHaveBeenCalledWith(expect.objectContaining({ date: SELECTED_DATE }));
    expect(mockUpdateEntry).not.toHaveBeenCalled();
  });

  it("edit mode: updates without touching the entry's own date", async () => {
    mockSearch = "entryId=entry-1";
    mockEntries = [
      {
        id: "entry-1",
        date: "2026-08-01",
        mealType: "lunch",
        foodId: "food-1",
        foodName: "Garbanzos secos",
        quantityG: 80,
      },
    ];
    render(<PortionRoute />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /^actualizar$/i })).toBeEnabled()
    );

    fireEvent.click(screen.getByRole("button", { name: /^actualizar$/i }));

    await waitFor(() => expect(mockUpdateEntry).toHaveBeenCalledTimes(1));
    const [id, patch] = mockUpdateEntry.mock.calls[0];
    expect(id).toBe("entry-1");
    expect(patch).not.toHaveProperty("date");
    expect(mockAddEntry).not.toHaveBeenCalled();
  });
});
