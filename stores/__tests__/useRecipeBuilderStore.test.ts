import type { Food } from "@/db/schema";
import { useRecipeBuilderStore } from "@/stores/useRecipeBuilderStore";

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
    category: "legumbres",
    dataBasis: "crudo",
    offProductCode: null,
    nameNormalized: "garbanzos secos",
    imageUrl: null,
    createdAt: "2024-01-01",
    ...overrides,
  } as Food;
}

describe("useRecipeBuilderStore — per-ingredient basis", () => {
  beforeEach(() => {
    useRecipeBuilderStore.getState().clear();
  });

  it("addIngredient defaults basis to undefined (user has not chosen)", () => {
    useRecipeBuilderStore.getState().addIngredient(makeFood());
    const [ingredient] = useRecipeBuilderStore.getState().ingredients;
    expect(ingredient.basis).toBeUndefined();
  });

  it("setIngredientBasis sets the basis for a specific ingredient by foodId", () => {
    useRecipeBuilderStore.getState().addIngredient(makeFood({ id: "food-1" }));
    useRecipeBuilderStore.getState().addIngredient(makeFood({ id: "food-2" }));

    useRecipeBuilderStore.getState().setIngredientBasis("food-1", "cocido");

    const ingredients = useRecipeBuilderStore.getState().ingredients;
    expect(ingredients.find((i) => i.food.id === "food-1")?.basis).toBe("cocido");
    expect(ingredients.find((i) => i.food.id === "food-2")?.basis).toBeUndefined();
  });

  it("clear() resets ingredients (and any basis selections) along with name/category", () => {
    useRecipeBuilderStore.getState().addIngredient(makeFood());
    useRecipeBuilderStore.getState().setIngredientBasis("food-1", "crudo");

    useRecipeBuilderStore.getState().clear();

    expect(useRecipeBuilderStore.getState().ingredients).toEqual([]);
  });
});
