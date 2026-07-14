import type { AIFoodItem } from "@/types/aiFood";

export interface ScaledMacros {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

/**
 * Proportionally scale AIFoodItem macros to a new quantity.
 * Guards against division by zero when item.quantity is 0.
 */
export function scaleAiMacros(item: AIFoodItem, qty: number): ScaledMacros {
  if (item.quantity === 0 || qty === 0) {
    return { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  }
  const ratio = qty / item.quantity;
  return {
    kcal: item.kcal * ratio,
    protein: item.protein * ratio,
    carbs: item.carbs * ratio,
    fat: item.fat * ratio,
  };
}
