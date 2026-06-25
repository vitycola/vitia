import { db } from "@/db/client";
import { foods } from "@/db/schema";
import type { Food, NewFood } from "@/db/schema";
import { eq, like } from "drizzle-orm";

const MAX_SEARCH_RESULTS = 30;

/**
 * Search foods by name (case-insensitive LIKE %q%).
 * Returns local cache results including both OFF-sourced and custom foods.
 */
export async function searchByName(query: string): Promise<Food[]> {
  if (!query.trim()) return [];

  return db
    .select()
    .from(foods)
    .where(like(foods.name, `%${query}%`))
    .limit(MAX_SEARCH_RESULTS);
}

/**
 * Get a single food by its primary key.
 * Returns null when no row exists with that id.
 */
export async function getById(id: string): Promise<Food | null> {
  const rows = await db.select().from(foods).where(eq(foods.id, id)).limit(1);
  return rows[0] ?? null;
}

/**
 * Upsert an Open Food Facts food into the local cache.
 * On conflict (same id), updates all mutable fields so stale OFF data is refreshed.
 */
export async function upsert(food: NewFood): Promise<Food> {
  const rows = await db
    .insert(foods)
    .values(food)
    .onConflictDoUpdate({
      target: foods.id,
      set: {
        name: food.name,
        brand: food.brand,
        caloriesPer100g: food.caloriesPer100g,
        proteinPer100g: food.proteinPer100g,
        carbsPer100g: food.carbsPer100g,
        fatPer100g: food.fatPer100g,
        servingSizeG: food.servingSizeG,
        offProductCode: food.offProductCode,
      },
    })
    .returning();

  return rows[0];
}

/**
 * Insert a new custom food. Throws if a food with the same id already exists.
 * Use upsert() for OFF-sourced foods.
 */
export async function insert(food: NewFood): Promise<Food> {
  const rows = await db.insert(foods).values(food).returning();
  return rows[0];
}

/**
 * Get all custom foods (source = 'custom'), ordered by name.
 * Used by the Profile screen to list foods the user has created.
 */
export async function getCustomFoods(): Promise<Food[]> {
  return db.select().from(foods).where(eq(foods.source, "custom")).orderBy(foods.name);
}

/**
 * Update specific fields of an existing food by id.
 * Returns the updated row.
 */
export async function update(
  id: string,
  patch: Partial<Omit<NewFood, "id" | "createdAt">>
): Promise<Food> {
  const rows = await db.update(foods).set(patch).where(eq(foods.id, id)).returning();
  return rows[0];
}
