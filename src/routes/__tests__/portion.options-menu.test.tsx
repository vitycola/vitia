/** @jest-environment jsdom */
/**
 * Focused tests for the "options menu" (three dots, next to the favorite
 * toggle) added to the portion screen so created foods can be edited from
 * their detail view. Does not re-test the pre-existing portion/logging
 * behavior (quantity, meal picker, add/update entry) — out of scope here.
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

jest.mock("@/stores/useDayStore", () => ({
  useDayStore: () => ({
    addEntry: jest.fn(),
    updateEntry: jest.fn(),
    entries: [],
  }),
}));

import { PortionRoute } from "../portion";

function makeFood(overrides: Partial<Food> = {}): Food {
  return {
    id: "food-1",
    name: "Tortilla con queso",
    brand: null,
    caloriesPer100g: 200,
    proteinPer100g: 15,
    carbsPer100g: 2,
    fatPer100g: 15,
    servingSizeG: 100,
    source: "custom",
    category: "huevos",
    offProductCode: null,
    nameNormalized: "tortilla con queso",
    imageUrl: null,
    createdAt: "2024-01-01",
    ...overrides,
  } as Food;
}

describe("PortionRoute — options menu (three dots)", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockGetById.mockReset();
    mockGetIngredients.mockReset();
  });

  it("does not show the options menu for a non-custom (OFF-sourced) food", async () => {
    mockGetById.mockResolvedValue(makeFood({ source: "openfoodfacts" }));
    mockGetIngredients.mockResolvedValue([]);

    render(<PortionRoute />);

    await waitFor(() => expect(screen.getByText("Tortilla con queso")).toBeInTheDocument());
    expect(screen.queryByLabelText("Más opciones")).not.toBeInTheDocument();
  });

  it("shows the options menu for a custom (created) food", async () => {
    mockGetById.mockResolvedValue(makeFood({ source: "custom" }));
    mockGetIngredients.mockResolvedValue([]);

    render(<PortionRoute />);

    await waitFor(() => expect(screen.getByLabelText("Más opciones")).toBeInTheDocument());
  });

  it("tapping the menu then 'Editar' navigates to the recipe editor for a composite food", async () => {
    mockGetById.mockResolvedValue(makeFood({ source: "custom" }));
    mockGetIngredients.mockResolvedValue([
      { id: "i1", parentFoodId: "food-1", ingredientFoodId: "huevo", weightG: 100, position: 0 },
    ]);

    render(<PortionRoute />);
    await waitFor(() => expect(screen.getByLabelText("Más opciones")).toBeInTheDocument());

    fireEvent.click(screen.getByLabelText("Más opciones"));
    fireEvent.click(screen.getByText("Editar"));

    expect(mockNavigate).toHaveBeenCalledWith("/create-food/food-1/edit");
  });

  it("tapping the menu then 'Editar' navigates to the manual editor for a manual (non-composite) food", async () => {
    mockGetById.mockResolvedValue(makeFood({ source: "custom" }));
    mockGetIngredients.mockResolvedValue([]);

    render(<PortionRoute />);
    await waitFor(() => expect(screen.getByLabelText("Más opciones")).toBeInTheDocument());

    fireEvent.click(screen.getByLabelText("Más opciones"));
    fireEvent.click(screen.getByText("Editar"));

    expect(mockNavigate).toHaveBeenCalledWith("/create-food/manual/food-1");
  });

  it("shows Editar option for a meal entry whose food has source: ai", async () => {
    mockGetById.mockResolvedValue(makeFood({ source: "ai" }));
    mockGetIngredients.mockResolvedValue([]);

    render(<PortionRoute />);

    await waitFor(() => expect(screen.getByLabelText("Más opciones")).toBeInTheDocument());
  });

  it("does not introduce editability for source: openfoodfacts or generic", async () => {
    mockGetById.mockResolvedValue(makeFood({ source: "generic" }));
    mockGetIngredients.mockResolvedValue([]);

    render(<PortionRoute />);

    await waitFor(() => expect(screen.getByText("Tortilla con queso")).toBeInTheDocument());
    expect(screen.queryByLabelText("Más opciones")).not.toBeInTheDocument();
  });
});
