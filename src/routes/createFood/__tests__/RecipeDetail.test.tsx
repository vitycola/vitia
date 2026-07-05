/** @jest-environment jsdom */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import type { Food, FoodIngredient } from "@/db/schema";

const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({ foodId: "tortilla" }),
}));

const mockGetById = jest.fn();
const mockGetByIds = jest.fn();
const mockGetIngredients = jest.fn();
const mockUpsertIngredients = jest.fn();
jest.mock("@/db/repos/foods", () => ({
  getById: (...args: unknown[]) => mockGetById(...args),
  getByIds: (...args: unknown[]) => mockGetByIds(...args),
  getIngredients: (...args: unknown[]) => mockGetIngredients(...args),
  upsertIngredients: (...args: unknown[]) => mockUpsertIngredients(...args),
}));

import { useRecipeBuilderStore } from "@/stores/useRecipeBuilderStore";
import { RecipeDetailRoute } from "../RecipeDetail";

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

function makeIngredientRow(overrides: Partial<FoodIngredient> = {}): FoodIngredient {
  return {
    id: "ing-1",
    parentFoodId: "tortilla",
    ingredientFoodId: "huevo",
    weightG: 100,
    position: 0,
    createdAt: "2024-01-01",
    ...overrides,
  } as FoodIngredient;
}

describe("RecipeDetailRoute", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockGetById.mockReset();
    mockGetByIds.mockReset();
    mockGetIngredients.mockReset();
    mockUpsertIngredients.mockReset();
    useRecipeBuilderStore.getState().clear();
    mockGetById.mockResolvedValue(makeFood({ id: "tortilla", name: "Tortilla casera" }));
  });

  it("loads the recipe and renders each resolved ingredient with its weight", async () => {
    mockGetIngredients.mockResolvedValue([
      makeIngredientRow({ ingredientFoodId: "huevo", weightG: 100 }),
    ]);
    mockGetByIds.mockResolvedValue([makeFood({ id: "huevo", name: "Huevo" })]);

    render(<RecipeDetailRoute />);

    await waitFor(() => expect(screen.getByText("Huevo")).toBeInTheDocument());
    expect(screen.getByDisplayValue("100")).toBeInTheDocument();
  });

  it("renders a fallback label for a dangling ingredient instead of crashing", async () => {
    mockGetIngredients.mockResolvedValue([
      makeIngredientRow({ ingredientFoodId: "deleted-food", weightG: 50 }),
    ]);
    mockGetByIds.mockResolvedValue([]); // the referenced food no longer exists

    render(<RecipeDetailRoute />);

    await waitFor(() => expect(screen.getByText("Ingrediente no disponible")).toBeInTheDocument());
    expect(mockUpsertIngredients).not.toHaveBeenCalled();
  });

  it("editing a resolved ingredient's weight updates the live macro preview", async () => {
    mockGetIngredients.mockResolvedValue([
      makeIngredientRow({ ingredientFoodId: "huevo", weightG: 100 }),
    ]);
    mockGetByIds.mockResolvedValue([makeFood({ id: "huevo", name: "Huevo" })]);

    render(<RecipeDetailRoute />);
    await waitFor(() => expect(screen.getByText("Huevo")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/peso.*huevo/i), { target: { value: "50" } });

    expect(useRecipeBuilderStore.getState().ingredients[0].weightG).toBe(50);
  });

  it("saving calls upsertIngredients with only the resolved ingredients", async () => {
    mockGetIngredients.mockResolvedValue([
      makeIngredientRow({ id: "ing-1", ingredientFoodId: "huevo", weightG: 100, position: 0 }),
      makeIngredientRow({
        id: "ing-2",
        ingredientFoodId: "deleted-food",
        weightG: 50,
        position: 1,
      }),
    ]);
    mockGetByIds.mockResolvedValue([makeFood({ id: "huevo", name: "Huevo" })]);
    mockUpsertIngredients.mockResolvedValue(undefined);

    render(<RecipeDetailRoute />);
    await waitFor(() => expect(screen.getByText("Huevo")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => expect(mockUpsertIngredients).toHaveBeenCalledTimes(1));
    expect(mockUpsertIngredients).toHaveBeenCalledWith("tortilla", [
      { ingredientFoodId: "huevo", weightG: 100, position: 0 },
    ]);
    expect(mockNavigate).toHaveBeenCalledWith("/search?created=tortilla");
  });

  it("cancel navigates back without saving", async () => {
    mockGetIngredients.mockResolvedValue([]);
    mockGetByIds.mockResolvedValue([]);

    render(<RecipeDetailRoute />);
    await waitFor(() => expect(screen.getByText("Tortilla casera")).toBeInTheDocument());

    fireEvent.click(screen.getByText("Cancelar"));

    expect(mockNavigate).toHaveBeenCalledWith(-1);
    expect(mockUpsertIngredients).not.toHaveBeenCalled();
  });
});
