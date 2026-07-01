/**
 * Dispatching meal-entries repository.
 * Routes calls to Dexie adapter (IndexedDB) or drizzle implementation (OPFS/SQLite)
 * based on the active backend — without touching the pure drizzle files in
 * db/repositories/, which remain backend-agnostic (R6).
 *
 * When VITE_SYNC_ENABLED=true, each write also enqueues an outbound sync op
 * (fire-and-forget; never blocks the caller).
 */

import { dexieAdapter } from "@/db/client";
import * as _impl from "@/db/repositories/mealEntries";
import type { MealEntry, NewMealEntry } from "@/db/schema";
import { isSyncEnabled } from "@/src/lib/supabase";
import { enqueue } from "@/src/services/syncQueue";
import { useAuthStore } from "@/src/stores/useAuthStore";

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
  const inserted = dexieAdapter
    ? await dexieAdapter.mealEntries.insert(entry)
    : await _impl.insert(entry);

  _enqueueMealOp(inserted, "upsert");
  return inserted;
}

export async function update(
  id: string,
  patch: Partial<Omit<NewMealEntry, "id">>
): Promise<MealEntry> {
  const updated = dexieAdapter
    ? await dexieAdapter.mealEntries.update(id, patch)
    : await _impl.update(id, patch);

  _enqueueMealOp(updated, "upsert");
  return updated;
}

export async function remove(id: string): Promise<void> {
  const { userId } = useAuthStore.getState();

  if (dexieAdapter) {
    await dexieAdapter.mealEntries.remove(id);
  } else {
    await _impl.remove(id);
  }

  if (isSyncEnabled() && userId) {
    void enqueue({
      table: "meal_entries",
      op: "delete",
      row: JSON.stringify({ id }),
      userId,
      updatedAt: new Date().toISOString(),
    });
  }
}

export async function insertBulk(entries: NewMealEntry[]): Promise<MealEntry[]> {
  const inserted = dexieAdapter
    ? await dexieAdapter.mealEntries.insertBulk(entries)
    : await _impl.insertBulk(entries);

  for (const entry of inserted) {
    _enqueueMealOp(entry, "upsert");
  }
  return inserted;
}

export async function deleteByDateAndMeal(
  date: string,
  mealType: MealEntry["mealType"]
): Promise<void> {
  const { userId } = useAuthStore.getState();

  if (dexieAdapter) {
    await dexieAdapter.mealEntries.deleteByDateAndMeal(date, mealType);
  } else {
    await _impl.deleteByDateAndMeal(date, mealType);
  }

  // For bulk delete we enqueue a synthetic "delete all by date+mealType" op.
  // SyncService handles this by deleting matching rows from Supabase.
  if (isSyncEnabled() && userId) {
    void enqueue({
      table: "meal_entries",
      op: "delete",
      row: JSON.stringify({ date, meal_type: mealType, bulk: true }),
      userId,
      updatedAt: new Date().toISOString(),
    });
  }
}

// ── Private helpers ───────────────────────────────────────────────────

function _enqueueMealOp(entry: MealEntry, op: "upsert" | "delete"): void {
  const { userId } = useAuthStore.getState();
  if (!isSyncEnabled() || !userId) return;

  void enqueue({
    table: "meal_entries",
    op,
    row: JSON.stringify({ ...entry, user_id: userId }),
    userId,
    updatedAt: new Date().toISOString(),
  });
}
