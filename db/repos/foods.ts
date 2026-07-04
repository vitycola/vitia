/**
 * Dispatching foods repository.
 * Routes calls to Dexie adapter (IndexedDB) or drizzle implementation (OPFS/SQLite)
 * based on the active backend — without touching the pure drizzle files in
 * db/repositories/, which remain backend-agnostic (R6).
 */

import { dexieAdapter } from "@/db/client";
import * as _impl from "@/db/repositories/foods";
import type { Food, NewFood } from "@/db/schema";

export async function searchByName(query: string): Promise<Food[]> {
  if (dexieAdapter) return dexieAdapter.foods.searchByName(query);
  return _impl.searchByName(query);
}

export async function getById(id: string): Promise<Food | null> {
  if (dexieAdapter) return dexieAdapter.foods.getById(id);
  return _impl.getById(id);
}

export async function getByIds(ids: string[]): Promise<Food[]> {
  if (dexieAdapter) return dexieAdapter.foods.getByIds(ids);
  return _impl.getByIds(ids);
}

export async function upsert(food: NewFood): Promise<Food> {
  if (dexieAdapter) return dexieAdapter.foods.upsert(food);
  return _impl.upsert(food);
}

export async function upsertMany(foods: NewFood[]): Promise<Food[]> {
  if (dexieAdapter) return dexieAdapter.foods.upsertMany(foods);
  return _impl.upsertMany(foods);
}

export async function insert(food: NewFood): Promise<Food> {
  if (dexieAdapter) return dexieAdapter.foods.insert(food);
  return _impl.insert(food);
}

export async function getCustomFoods(): Promise<Food[]> {
  if (dexieAdapter) return dexieAdapter.foods.getCustomFoods();
  return _impl.getCustomFoods();
}

export async function update(
  id: string,
  patch: Partial<Omit<NewFood, "id" | "createdAt">>
): Promise<Food> {
  if (dexieAdapter) return dexieAdapter.foods.update(id, patch);
  return _impl.update(id, patch);
}
