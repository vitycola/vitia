/**
 * Dispatching favorites repository.
 * Routes calls to Dexie adapter (IndexedDB) or drizzle implementation (OPFS/SQLite)
 * based on the active backend — without touching the pure drizzle files in
 * db/repositories/, which remain backend-agnostic (R6).
 */

import { dexieAdapter } from "@/db/client";
import * as _impl from "@/db/repositories/favorites";
import type { FavoriteMealRow } from "@/db/repositories/favorites";
import type { MealType } from "@/types";

export async function isFavorite(foodId: string, userId: string | null): Promise<boolean> {
  if (dexieAdapter) return dexieAdapter.favorites.isFavorite(foodId, userId);
  return _impl.isFavorite(foodId, userId);
}

/** @deprecated thin wrapper — toggle -> setMeals([]) / removeAllMeals */
export async function toggle(foodId: string, userId: string | null): Promise<boolean> {
  if (dexieAdapter) return dexieAdapter.favorites.toggle(foodId, userId);
  return _impl.toggle(foodId, userId);
}

export async function listFoodIds(userId: string | null): Promise<string[]> {
  if (dexieAdapter) return dexieAdapter.favorites.listFoodIds(userId);
  return _impl.listFoodIds(userId);
}

export async function addMeal(
  foodId: string,
  userId: string | null,
  mealType: MealType | null
): Promise<void> {
  if (dexieAdapter) return dexieAdapter.favorites.addMeal(foodId, userId, mealType);
  return _impl.addMeal(foodId, userId, mealType);
}

export async function removeAllMeals(foodId: string, userId: string | null): Promise<void> {
  if (dexieAdapter) return dexieAdapter.favorites.removeAllMeals(foodId, userId);
  return _impl.removeAllMeals(foodId, userId);
}

export async function setMeals(
  foodId: string,
  userId: string | null,
  mealTypes: MealType[]
): Promise<void> {
  if (dexieAdapter) return dexieAdapter.favorites.setMeals(foodId, userId, mealTypes);
  return _impl.setMeals(foodId, userId, mealTypes);
}

export async function getMealsForFood(
  foodId: string,
  userId: string | null
): Promise<(MealType | null)[]> {
  if (dexieAdapter) return dexieAdapter.favorites.getMealsForFood(foodId, userId);
  return _impl.getMealsForFood(foodId, userId);
}

export async function listWithMeals(userId: string | null): Promise<FavoriteMealRow[]> {
  if (dexieAdapter) return dexieAdapter.favorites.listWithMeals(userId);
  return _impl.listWithMeals(userId);
}
