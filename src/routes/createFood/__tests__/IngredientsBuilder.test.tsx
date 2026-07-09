/** @jest-environment jsdom */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import type { Food } from "@/db/schema";

const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

const mockCreateComposite = jest.fn();
const mockUpsertIngredients = jest.fn();
jest.mock("@/db/repos/foods", () => ({
  createComposite: (...args: unknown[]) => mockCreateComposite(...args),
  upsertIngredients: (...args: unknown[]) => mockUpsertIngredients(...args),
}));

jest.mock("@/lib/id", () => ({ generateId: () => "generated-id" }));

import { useRecipeBuilderStore } from "@/stores/useRecipeBuilderStore";
import { IngredientsBuilderRoute } from "../IngredientsBuilder";

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

describe("IngredientsBuilderRoute", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockCreateComposite.mockReset();
    mockUpsertIngredients.mockReset();
    mockCreateComposite.mockResolvedValue({ id: "generated-id" });
    useRecipeBuilderStore.getState().clear();
  });

  it("renders the current ingredients and a live macro preview", () => {
    useRecipeBuilderStore.getState().addIngredient(makeFood({ id: "huevo", name: "Huevo" }), 50);

    render(<IngredientsBuilderRoute />);

    expect(screen.getByText("Huevo")).toBeInTheDocument();
    // 50g of huevo: calories = 155 * 0.5 = 77.5 -> rounded display 78 (or 77)
    expect(screen.getByText(/kcal total/)).toBeInTheDocument();
  });

  it("adding an ingredient updates the displayed sum", () => {
    useRecipeBuilderStore.getState().addIngredient(makeFood({ id: "huevo", name: "Huevo" }), 50);
    useRecipeBuilderStore.getState().addIngredient(
      makeFood({
        id: "queso",
        name: "Queso havarti",
        caloriesPer100g: 350,
        proteinPer100g: 25,
        carbsPer100g: 2,
        fatPer100g: 28,
      }),
      30
    );

    render(<IngredientsBuilderRoute />);

    expect(screen.getByText("Huevo")).toBeInTheDocument();
    expect(screen.getByText("Queso havarti")).toBeInTheDocument();
  });

  it("editing an ingredient's weight recomputes the sum live", () => {
    useRecipeBuilderStore.getState().addIngredient(makeFood({ id: "huevo", name: "Huevo" }), 50);

    render(<IngredientsBuilderRoute />);

    const weightInput = screen.getByLabelText(/peso.*huevo/i) as HTMLInputElement;
    fireEvent.change(weightInput, { target: { value: "100" } });

    expect(useRecipeBuilderStore.getState().ingredients[0].weightG).toBe(100);
  });

  it("removing an ingredient recomputes the sum", () => {
    useRecipeBuilderStore.getState().addIngredient(makeFood({ id: "huevo", name: "Huevo" }), 50);
    useRecipeBuilderStore
      .getState()
      .addIngredient(makeFood({ id: "queso", name: "Queso havarti" }), 30);

    render(<IngredientsBuilderRoute />);

    fireEvent.click(screen.getByLabelText(/eliminar.*huevo/i));

    expect(useRecipeBuilderStore.getState().ingredients).toHaveLength(1);
    expect(screen.queryByText("Huevo")).not.toBeInTheDocument();
    expect(screen.getByText("Queso havarti")).toBeInTheDocument();
  });

  it("blocks save when there are zero ingredients", async () => {
    render(<IngredientsBuilderRoute />);

    fireEvent.change(screen.getByLabelText(/nombre del alimento/i), {
      target: { value: "Tortilla" },
    });
    fireEvent.change(screen.getByLabelText(/^categoría/i), { target: { value: "huevos" } });
    fireEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => expect(screen.getByText(/al menos un ingrediente/i)).toBeInTheDocument());
    expect(mockCreateComposite).not.toHaveBeenCalled();
  });

  it("save persists ingredients + snapshot via createComposite and upsertIngredients", async () => {
    useRecipeBuilderStore.getState().addIngredient(makeFood({ id: "huevo", name: "Huevo" }), 50);
    useRecipeBuilderStore.getState().addIngredient(
      makeFood({
        id: "queso",
        name: "Queso havarti",
        caloriesPer100g: 350,
        proteinPer100g: 25,
        carbsPer100g: 2,
        fatPer100g: 28,
      }),
      30
    );

    render(<IngredientsBuilderRoute />);

    fireEvent.change(screen.getByLabelText(/nombre del alimento/i), {
      target: { value: "Tortilla casera" },
    });
    fireEvent.change(screen.getByLabelText(/^categoría/i), { target: { value: "huevos" } });
    fireEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => expect(mockCreateComposite).toHaveBeenCalledTimes(1));

    const [food, ingredients] = mockCreateComposite.mock.calls[0];
    expect(food).toMatchObject({
      name: "Tortilla casera",
      category: "huevos",
      source: "custom",
    });
    expect(ingredients).toEqual([
      { ingredientFoodId: "huevo", weightG: 50, position: 0 },
      { ingredientFoodId: "queso", weightG: 30, position: 1 },
    ]);
  });

  it("saves successfully without selecting a category (category is optional)", async () => {
    useRecipeBuilderStore.getState().addIngredient(makeFood({ id: "huevo", name: "Huevo" }), 50);

    render(<IngredientsBuilderRoute />);
    fireEvent.change(screen.getByLabelText(/nombre del alimento/i), {
      target: { value: "Huevo solo" },
    });
    fireEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => expect(mockCreateComposite).toHaveBeenCalledTimes(1));
    const [food] = mockCreateComposite.mock.calls[0];
    expect(food).toMatchObject({ name: "Huevo solo", category: null });
  });

  it("navigates to the ingredient picker sub-route to add an ingredient", () => {
    render(<IngredientsBuilderRoute />);

    fireEvent.click(screen.getByRole("button", { name: /añadir ingrediente/i }));

    expect(mockNavigate).toHaveBeenCalledWith("/create-food/ingredients/add");
  });

  describe("per-ingredient crudo/cocido toggle (design D4 surface 2)", () => {
    function makeConvertibleFood(overrides: Partial<Food> = {}): Food {
      return makeFood({
        category: "legumbres", // COOKING_FACTORS.legumbres = 2.2
        dataBasis: "crudo",
        ...overrides,
      });
    }

    it("shows a toggle for an ingredient where canConvert is true", () => {
      useRecipeBuilderStore
        .getState()
        .addIngredient(makeConvertibleFood({ id: "garbanzos", name: "Garbanzos" }), 100);

      render(<IngredientsBuilderRoute />);

      expect(screen.getByLabelText(/tipo de peso.*garbanzos/i)).toBeInTheDocument();
    });

    it("hides the toggle for a non-convertible ingredient (no factor)", () => {
      useRecipeBuilderStore
        .getState()
        .addIngredient(
          makeFood({ id: "huevo", name: "Huevo", category: null, dataBasis: null }),
          50
        );

      render(<IngredientsBuilderRoute />);

      expect(screen.queryByLabelText(/tipo de peso.*huevo/i)).not.toBeInTheDocument();
    });

    it("hides the toggle when dataBasis is unresolved even with a known factor", () => {
      useRecipeBuilderStore
        .getState()
        .addIngredient(
          makeConvertibleFood({ id: "garbanzos", name: "Garbanzos", dataBasis: null }),
          100
        );

      render(<IngredientsBuilderRoute />);

      expect(screen.queryByLabelText(/tipo de peso.*garbanzos/i)).not.toBeInTheDocument();
    });

    it("converts a cocido-weighed convertible ingredient's macro contribution via convertWeight before sumIngredientMacros", async () => {
      // Garbanzos: category legumbres (factor 2.2), dataBasis crudo,
      // caloriesPer100g 100 (matches makeFood's default via override below).
      useRecipeBuilderStore.getState().addIngredient(
        makeConvertibleFood({
          id: "garbanzos",
          name: "Garbanzos",
          caloriesPer100g: 100,
          proteinPer100g: 10,
          carbsPer100g: 20,
          fatPer100g: 1,
        }),
        220 // entered as cocido -> crudo = 220/2.2 = 100g
      );

      render(<IngredientsBuilderRoute />);

      fireEvent.change(screen.getByLabelText(/tipo de peso.*garbanzos/i), {
        target: { value: "cocido" },
      });

      fireEvent.change(screen.getByLabelText(/nombre del alimento/i), {
        target: { value: "Puré de garbanzos" },
      });
      fireEvent.click(screen.getByRole("button", { name: /guardar/i }));

      await waitFor(() => expect(mockCreateComposite).toHaveBeenCalledTimes(1));
      const [food, ingredients] = mockCreateComposite.mock.calls[0];
      // 220g cocido converted to 100g crudo-basis before summing (float division,
      // so weightG is checked with tolerance rather than exact equality).
      expect(ingredients).toHaveLength(1);
      expect(ingredients[0]).toMatchObject({ ingredientFoodId: "garbanzos", position: 0 });
      expect(ingredients[0].weightG).toBeCloseTo(100, 6);
      // 100g crudo-basis of 100 kcal/100g => 100 kcal total, 100% of the recipe.
      expect(food.caloriesPer100g).toBeCloseTo(100, 6);
    });

    it("leaves a non-convertible ingredient's weight unaffected (regression check)", async () => {
      useRecipeBuilderStore
        .getState()
        .addIngredient(
          makeFood({ id: "huevo", name: "Huevo", category: null, dataBasis: null }),
          50
        );

      render(<IngredientsBuilderRoute />);

      fireEvent.change(screen.getByLabelText(/nombre del alimento/i), {
        target: { value: "Huevo solo" },
      });
      fireEvent.click(screen.getByRole("button", { name: /guardar/i }));

      await waitFor(() => expect(mockCreateComposite).toHaveBeenCalledTimes(1));
      const [, ingredients] = mockCreateComposite.mock.calls[0];
      expect(ingredients).toEqual([{ ingredientFoodId: "huevo", weightG: 50, position: 0 }]);
    });
  });

  it("keeps name and category after an unmount/remount, as happens when the ingredient picker route pushes and pops", () => {
    const { unmount } = render(<IngredientsBuilderRoute />);

    fireEvent.change(screen.getByLabelText(/nombre del alimento/i), {
      target: { value: "Tortilla casera" },
    });
    fireEvent.change(screen.getByLabelText(/^categoría/i), { target: { value: "huevos" } });

    // Simulates navigating to /create-food/ingredients/add and back: the
    // route component unmounts and remounts, but cross-route state must
    // survive in the shared store (same as the ingredients list already does).
    unmount();
    render(<IngredientsBuilderRoute />);

    expect(screen.getByDisplayValue("Tortilla casera")).toBeInTheDocument();
    expect(screen.getByLabelText(/^categoría/i)).toHaveValue("huevos");
  });
});
