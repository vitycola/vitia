/**
 * Dispatching favorites repository.
 * Routes calls to Dexie adapter (IndexedDB) or drizzle implementation (OPFS/SQLite)
 * based on the active backend — without touching the pure drizzle files in
 * db/repositories/, which remain backend-agnostic (R6).
 */

import { dexieAdapter } from "@/db/client";
import * as _impl from "@/db/repositories/favorites";

export async function isFavorite(foodId: string, userId: string | null): Promise<boolean> {
  if (dexieAdapter) return dexieAdapter.favorites.isFavorite(foodId, userId);
  return _impl.isFavorite(foodId, userId);
}

export async function toggle(foodId: string, userId: string | null): Promise<boolean> {
  if (dexieAdapter) return dexieAdapter.favorites.toggle(foodId, userId);
  return _impl.toggle(foodId, userId);
}

export async function listFoodIds(userId: string | null): Promise<string[]> {
  if (dexieAdapter) return dexieAdapter.favorites.listFoodIds(userId);
  return _impl.listFoodIds(userId);
}
