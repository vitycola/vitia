/**
 * Dispatching meal-entries repository.
 * Routes calls to Dexie adapter (IndexedDB) or drizzle implementation (OPFS/SQLite)
 * based on the active backend — without touching the pure drizzle files in
 * db/repositories/, which remain backend-agnostic (R6).
 */

import { dexieAdapter } from "@/db/client";
import * as _impl from "@/db/repositories/mealEntries";
import type { MealEntry, NewMealEntry } from "@/db/schema";

// Re-export the view type so callers can import it from here
export type { MealEntryView } from "@/db/repositories/mealEntries";

export async function getByDate(date: string): Promise<_impl.MealEntryView[]> {
  if (dexieAdapter) {
    const entries = await dexieAdapter.mealEntries.getByDate(date);
    return entries.map((e) => ({ ...e, brand: null }));
  }
  return _impl.getByDate(date);
}

export async function getByDateAndMeal(
  date: string,
  mealType: MealEntry["mealType"]
): Promise<MealEntry[]> {
  if (dexieAdapter) return dexieAdapter.mealEntries.getByDateAndMeal(date, mealType);
  return _impl.getByDateAndMeal(date, mealType);
}

export async function insert(entry: NewMealEntry): Promise<MealEntry> {
  if (dexieAdapter) return dexieAdapter.mealEntries.insert(entry);
  return _impl.insert(entry);
}

export async function remove(id: string): Promise<void> {
  if (dexieAdapter) return dexieAdapter.mealEntries.remove(id);
  return _impl.remove(id);
}

export async function insertBulk(entries: NewMealEntry[]): Promise<MealEntry[]> {
  if (dexieAdapter) return dexieAdapter.mealEntries.insertBulk(entries);
  return _impl.insertBulk(entries);
}

export async function deleteByDateAndMeal(
  date: string,
  mealType: MealEntry["mealType"]
): Promise<void> {
  if (dexieAdapter) return dexieAdapter.mealEntries.deleteByDateAndMeal(date, mealType);
  return _impl.deleteByDateAndMeal(date, mealType);
}
