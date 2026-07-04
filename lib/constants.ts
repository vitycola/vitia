import type { MealType } from "@/types";

export const MEAL_EMOJI: Record<MealType, string> = {
  breakfast: "🍳",
  lunch: "🍽️",
  dinner: "🌙",
  snack: "🍎",
};

/** Shared Spanish display labels for meal types — single source of truth. */
export const MEAL_LABELS: Record<MealType, string> = {
  breakfast: "Desayuno",
  lunch: "Almuerzo",
  dinner: "Cena",
  snack: "Merienda",
};

/** Fixed display order for meal-type sections across the app. */
export const MEAL_ORDER: MealType[] = ["breakfast", "lunch", "dinner", "snack"];
