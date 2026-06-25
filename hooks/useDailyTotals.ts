import type { MealEntry } from "@/db/schema";
import type { MealType } from "@/types";
import { useMemo } from "react";

export interface MealTotals {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface DailyTotals extends MealTotals {
  byMeal: Record<MealType, MealTotals>;
}

const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

function emptyTotals(): MealTotals {
  return { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 };
}

function sumEntries(entries: MealEntry[]): MealTotals {
  return entries.reduce(
    (acc, e) => ({
      calories: acc.calories + e.calories,
      proteinG: acc.proteinG + e.proteinG,
      carbsG: acc.carbsG + e.carbsG,
      fatG: acc.fatG + e.fatG,
    }),
    emptyTotals()
  );
}

/**
 * Pure derived selector: compute daily totals and per-meal subtotals
 * from a flat list of MealEntry rows.
 *
 * Wrapped in useMemo so screens that subscribe to this hook
 * only recompute when `entries` reference changes.
 */
export function useDailyTotals(entries: MealEntry[]): DailyTotals {
  return useMemo(() => {
    const byMeal = Object.fromEntries(
      MEAL_TYPES.map((meal) => [meal, sumEntries(entries.filter((e) => e.mealType === meal))])
    ) as Record<MealType, MealTotals>;

    const total = sumEntries(entries);

    return { ...total, byMeal };
  }, [entries]);
}
