import { db } from "@/db/client";
import { foods, mealEntries } from "@/db/schema";
import type { MealEntry, NewMealEntry } from "@/db/schema";
import { and, asc, eq, gte, lte, sql } from "drizzle-orm";

export type MealEntryView = MealEntry & { brand: string | null };

/**
 * Get all meal entries for a given date with brand from foods, ordered by logged_at ascending.
 */
export async function getByDate(date: string): Promise<MealEntryView[]> {
  const rows = await db
    .select({ entry: mealEntries, brand: foods.brand })
    .from(mealEntries)
    .leftJoin(foods, eq(mealEntries.foodId, foods.id))
    .where(eq(mealEntries.date, date))
    .orderBy(asc(mealEntries.loggedAt));
  return rows.map((r) => ({ ...r.entry, brand: r.brand ?? null }));
}

/**
 * Get meal entries for a specific date and meal type.
 */
export async function getByDateAndMeal(
  date: string,
  mealType: MealEntry["mealType"]
): Promise<MealEntry[]> {
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
  const rows = await db.insert(mealEntries).values(entry).returning();
  return rows[0];
}

/**
 * Update an existing meal entry (quantity, denormalized macros, and/or
 * meal type) and return the updated row.
 */
export async function update(
  id: string,
  patch: Partial<Omit<NewMealEntry, "id">>
): Promise<MealEntry> {
  const rows = await db.update(mealEntries).set(patch).where(eq(mealEntries.id, id)).returning();
  return rows[0];
}

/**
 * Delete a meal entry by its UUID primary key.
 */
export async function remove(id: string): Promise<void> {
  await db.delete(mealEntries).where(eq(mealEntries.id, id));
}

/**
 * Insert multiple meal entries in a single transaction.
 * Returns the inserted rows, or an empty array when entries is empty.
 */
export async function insertBulk(entries: NewMealEntry[]): Promise<MealEntry[]> {
  if (entries.length === 0) return [];

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
 * Aggregate totals (calories, protein, carbs, fat) per day for all meal
 * entries whose date falls within [from, to] inclusive.
 * Returns one row per date that has at least one entry; days with no
 * entries are omitted (callers treat absence as zero / empty).
 */
export interface DayTotals {
  date: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export async function getLoggedTotalsByDateRange(from: string, to: string): Promise<DayTotals[]> {
  const rows = await db
    .select({
      date: mealEntries.date,
      calories: sql<number>`sum(${mealEntries.calories})`,
      proteinG: sql<number>`sum(${mealEntries.proteinG})`,
      carbsG: sql<number>`sum(${mealEntries.carbsG})`,
      fatG: sql<number>`sum(${mealEntries.fatG})`,
    })
    .from(mealEntries)
    .where(and(gte(mealEntries.date, from), lte(mealEntries.date, to)))
    .groupBy(mealEntries.date)
    .orderBy(asc(mealEntries.date));

  return rows.map((r) => ({
    date: r.date,
    calories: Number(r.calories ?? 0),
    proteinG: Number(r.proteinG ?? 0),
    carbsG: Number(r.carbsG ?? 0),
    fatG: Number(r.fatG ?? 0),
  }));
}

/**
 * Delete all meal entries for a given date and meal type in a single transaction.
 */
export async function deleteByDateAndMeal(
  date: string,
  mealType: MealEntry["mealType"]
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .delete(mealEntries)
      .where(and(eq(mealEntries.date, date), eq(mealEntries.mealType, mealType)));
  });
}
