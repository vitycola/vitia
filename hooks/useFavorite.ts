/**
 * Meal-aware favorite hook for a single food.
 * A food may be favorited under multiple meal types (or unassigned, mealType
 * = null). Removal is always whole-food: remove() deletes every row for
 * (userId, foodId), regardless of how many meal types it was assigned to.
 */

import * as favoritesRepo from "@/db/repos/favorites";
import { useAuthStore } from "@/src/stores/useAuthStore";
import type { MealType } from "@/types";
import { useEffect, useState } from "react";

export interface UseFavoriteResult {
  isFavorite: boolean;
  meals: (MealType | null)[];
  loading: boolean;
  setMeals: (mealTypes: MealType[]) => Promise<void>;
  remove: () => Promise<void>;
}

export function useFavorite(foodId: string | null): UseFavoriteResult {
  const userId = useAuthStore((s) => s.userId);
  const [meals, setMealsState] = useState<(MealType | null)[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!foodId) {
      setMealsState([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    favoritesRepo
      .getMealsForFood(foodId, userId)
      .then((result) => {
        if (!cancelled) setMealsState(result);
      })
      .catch(() => {
        if (!cancelled) setMealsState([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [foodId, userId]);

  async function setMeals(mealTypes: MealType[]): Promise<void> {
    if (!foodId) return;
    await favoritesRepo.setMeals(foodId, userId, mealTypes);
    const updated = await favoritesRepo.getMealsForFood(foodId, userId);
    setMealsState(updated);
  }

  /** Whole-food removal — deletes every row for (userId, foodId), no context arg. */
  async function remove(): Promise<void> {
    if (!foodId) return;
    await favoritesRepo.removeAllMeals(foodId, userId);
    setMealsState([]);
  }

  return {
    isFavorite: meals.length > 0,
    meals,
    loading,
    setMeals,
    remove,
  };
}
