import type { Food } from "@/db/schema";
import type { CookingBasis } from "@/lib/cookingConversion";
import { create } from "zustand";

/**
 * In-progress ingredients-based recipe being built across two routes:
 * `/create-food/ingredients` (the builder) and `/create-food/ingredients/add`
 * (the picker, which pushes a new ingredient back here). A zustand store is
 * used instead of router location state so state survives the round trip
 * through the picker route, mirroring `useMealClipboardStore`'s cross-route
 * state pattern.
 */
export interface RecipeIngredient {
  food: Food;
  weightG: number;
  /** Undefined = user has not chosen a basis for this ingredient yet.
   * Per-ingredient (not per-recipe) because each ingredient has its own
   * category, factor, and dataBasis (design D4 surface 2). */
  basis?: CookingBasis;
}

interface RecipeBuilderState {
  ingredients: RecipeIngredient[];
  /** Name and category live here too — local component state would reset on
   * the unmount/remount that happens when the ingredient picker route pushes
   * and pops, losing what the user already typed. */
  name: string;
  category: string | null;
}

interface RecipeBuilderActions {
  addIngredient: (food: Food, weightG?: number) => void;
  updateWeight: (foodId: string, weightG: number) => void;
  setIngredientBasis: (foodId: string, basis: CookingBasis) => void;
  removeIngredient: (foodId: string) => void;
  setName: (name: string) => void;
  setCategory: (category: string) => void;
  clear: () => void;
}

export const useRecipeBuilderStore = create<RecipeBuilderState & RecipeBuilderActions>()((set) => ({
  ingredients: [],
  name: "",
  category: null,

  addIngredient: (food, weightG = 100) =>
    set((state) => ({ ingredients: [...state.ingredients, { food, weightG }] })),

  updateWeight: (foodId, weightG) =>
    set((state) => ({
      ingredients: state.ingredients.map((i) => (i.food.id === foodId ? { ...i, weightG } : i)),
    })),

  setIngredientBasis: (foodId, basis) =>
    set((state) => ({
      ingredients: state.ingredients.map((i) => (i.food.id === foodId ? { ...i, basis } : i)),
    })),

  removeIngredient: (foodId) =>
    set((state) => ({
      ingredients: state.ingredients.filter((i) => i.food.id !== foodId),
    })),

  setName: (name) => set({ name }),
  setCategory: (category) => set({ category }),

  clear: () => set({ ingredients: [], name: "", category: null }),
}));
