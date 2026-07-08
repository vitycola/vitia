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

/**
 * Macro goal tolerance band — wider than calories since hitting an exact
 * macro split is harder. Shared by the macro bars in CalorieCard and
 * HeaderMacroRow.
 */
export const MACRO_GOAL_LOW = 0.85;
export const MACRO_GOAL_HIGH = 1.15;

/** Shared "on target" green used by calorie/macro bars once within tolerance. */
export const ON_TARGET_COLOR = "#22C55E";

export function isWithinGoalRange(
  consumed: number,
  goal: number,
  low: number,
  high: number
): boolean {
  return goal > 0 && consumed >= goal * low && consumed <= goal * high;
}
