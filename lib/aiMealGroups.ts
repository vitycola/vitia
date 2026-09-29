import { MEAL_LABELS, MEAL_ORDER } from "@/lib/constants";
import type { MealType } from "@/types";
import type { AIFoodItem } from "@/types/aiFood";

export interface MealGroup {
  /** null for items without a meal tag (e.g. photo results). */
  mealType: MealType | null;
  /** null when the group has no header. */
  label: string | null;
  /** Indices into the original results array. */
  indices: number[];
}

/**
 * Groups results by meal in canonical order, preserving original indices so the
 * store's index-keyed selections and quantities stay valid. Untagged items are
 * collected in one trailing group without a header.
 */
export function groupResultsByMeal(results: AIFoodItem[]): MealGroup[] {
  const groups: MealGroup[] = [];
  for (const mealType of MEAL_ORDER) {
    const indices = results.flatMap((r, i) => (r.mealType === mealType ? [i] : []));
    if (indices.length > 0) groups.push({ mealType, label: MEAL_LABELS[mealType], indices });
  }
  const untagged = results.flatMap((r, i) => (r.mealType ? [] : [i]));
  if (untagged.length > 0) groups.push({ mealType: null, label: null, indices: untagged });
  return groups;
}
