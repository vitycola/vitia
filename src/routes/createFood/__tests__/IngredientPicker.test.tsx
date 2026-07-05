/** @jest-environment jsdom */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import type { Food } from "@/db/schema";

const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

const mockGetCompositeFoodIds = jest.fn();
jest.mock("@/db/repos/foods", () => ({
  getCompositeFoodIds: (...args: unknown[]) => mockGetCompositeFoodIds(...args),
}));

const mockAddIngredient = jest.fn();
jest.mock("@/stores/useRecipeBuilderStore", () => ({
  useRecipeBuilderStore: {
    getState: () => ({ addIngredient: mockAddIngredient }),
  },
}));

// FoodResultRow (reused for result rows) pulls in useFavorite, which touches
// the real DB repo layer (db/client.ts uses import.meta, unsupported by
// ts-jest's CJS transform) — mock it out, same as other route-level tests
// mock DB-touching modules instead of exercising the real data layer.
jest.mock("@/hooks/useFavorite", () => ({
  useFavorite: () => ({
    isFavorite: false,
    meals: [],
    loading: false,
    setMeals: jest.fn(),
    remove: jest.fn(),
  }),
}));

function makeFood(overrides: Partial<Food> = {}): Food {
  return {
    id: "huevo",
    name: "Huevo",
    brand: null,
    caloriesPer100g: 155,
    proteinPer100g: 13,
    carbsPer100g: 1.1,
    fatPer100g: 11,
    servingSizeG: null,
    source: "custom",
    category: null,
    offProductCode: null,
    nameNormalized: "huevo",
    imageUrl: null,
    createdAt: "2024-01-01",
    ...overrides,
  } as Food;
}

let mockResults: Food[] = [];
const mockSearch = jest.fn();
const mockClear = jest.fn();
jest.mock("@/stores/useFoodSearchStore", () => ({
  useFoodSearchStore: () => ({
    results: mockResults.map((f) => ({ ...f, hasMissingData: false })),
    status: mockResults.length > 0 ? "results" : "idle",
    error: null,
    search: mockSearch,
    clear: mockClear,
  }),
}));

import { IngredientPickerRoute } from "../IngredientPicker";

describe("IngredientPickerRoute", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockAddIngredient.mockReset();
    mockGetCompositeFoodIds.mockReset();
    mockGetCompositeFoodIds.mockResolvedValue([]);
    mockSearch.mockReset();
    mockClear.mockReset();
    mockResults = [];
  });

  it("excludes composite foods from the results using getCompositeFoodIds", async () => {
    mockResults = [
      makeFood({ id: "huevo", name: "Huevo" }),
      makeFood({ id: "tortilla", name: "Tortilla (receta)" }),
    ];
    mockGetCompositeFoodIds.mockResolvedValue(["tortilla"]);

    render(<IngredientPickerRoute />);

    await screen.findByText("Huevo");
    await waitFor(() => expect(screen.queryByText("Tortilla (receta)")).not.toBeInTheDocument());
  });

  it("selecting a food adds it to the recipe builder and returns to the builder", async () => {
    mockResults = [makeFood({ id: "huevo", name: "Huevo" })];
    mockGetCompositeFoodIds.mockResolvedValue([]);

    render(<IngredientPickerRoute />);

    const row = await screen.findByText("Huevo");
    fireEvent.click(row);

    expect(mockAddIngredient).toHaveBeenCalledWith(
      expect.objectContaining({ id: "huevo", name: "Huevo" })
    );
    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });
});
