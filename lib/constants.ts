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

/**
 * Calorie goal tolerance band — within [90 %, 110 %] counts as "on target".
 * Shared by the day-status dot (useWeekProgress) and the calorie ring
 * (CalorieCard) so both use the same definition of "on target".
 */
export const CAL_GOAL_LOW = 0.9;
export const CAL_GOAL_HIGH = 1.1;
