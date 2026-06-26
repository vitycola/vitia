import { db, dexieAdapter } from "@/db/client";
import { mealEntries } from "@/db/schema";
import type { MealEntry, NewMealEntry } from "@/db/schema";
import { and, asc, eq } from "drizzle-orm";

/**
 * Get all meal entries for a given date, ordered by logged_at ascending.
 */
export async function getByDate(date: string): Promise<MealEntry[]> {
  if (dexieAdapter) return dexieAdapter.mealEntries.getByDate(date);
  return db
    .select()
    .from(mealEntries)
    .where(eq(mealEntries.date, date))
    .orderBy(asc(mealEntries.loggedAt));
}

/**
 * Get meal entries for a specific date and meal type.
 */
export async function getByDateAndMeal(
  date: string,
  mealType: MealEntry["mealType"]
): Promise<MealEntry[]> {
  if (dexieAdapter) return dexieAdapter.mealEntries.getByDateAndMeal(date, mealType);
  return db
    .select()
    .from(mealEntries)
    .where(and(eq(mealEntries.date, date), eq(mealEntries.mealType, mealType)))
    .orderBy(asc(mealEntries.loggedAt));
}

/**
 * Insert a new meal entry and return the inserted row.
 */
export async function insert(entry: NewMealEntry): Promise<MealEntry> {
  if (dexieAdapter) return dexieAdapter.mealEntries.insert(entry);
  const rows = await db.insert(mealEntries).values(entry).returning();
  return rows[0];
}

/**
 * Delete a meal entry by its UUID primary key.
 */
export async function remove(id: string): Promise<void> {
  if (dexieAdapter) return dexieAdapter.mealEntries.remove(id);
  await db.delete(mealEntries).where(eq(mealEntries.id, id));
}

/**
 * Insert multiple meal entries in a single transaction.
 * Returns the inserted rows, or an empty array when entries is empty.
 */
export async function insertBulk(entries: NewMealEntry[]): Promise<MealEntry[]> {
  if (entries.length === 0) return [];
  if (dexieAdapter) return dexieAdapter.mealEntries.insertBulk(entries);

  return db.transaction(async (tx) => {
    const results: MealEntry[] = [];
    for (const entry of entries) {
      const rows = await tx.insert(mealEntries).values(entry).returning();
      results.push(rows[0]);
    }
    return results;
  });
}

/**
 * Delete all meal entries for a given date and meal type in a single transaction.
 */
export async function deleteByDateAndMeal(
  date: string,
  mealType: MealEntry["mealType"]
): Promise<void> {
  if (dexieAdapter) return dexieAdapter.mealEntries.deleteByDateAndMeal(date, mealType);
  await db.transaction(async (tx) => {
    await tx
      .delete(mealEntries)
      .where(and(eq(mealEntries.date, date), eq(mealEntries.mealType, mealType)));
  });
}
