import { db } from "@/db/client";
import { foods } from "@/db/schema";
import type { Food, NewFood } from "@/db/schema";
import { normalizeForSearch } from "@/lib/search";
import { eq, inArray, like, sql } from "drizzle-orm";

const MAX_SEARCH_RESULTS = 30;

/**
 * Search foods by name, accent-insensitive and case-insensitive.
 * Matches against the pre-computed name_normalized column using LIKE so that
 * "jamon" finds "Jamón" and "noquis" finds "Ñoquis".
 */
export async function searchByName(query: string): Promise<Food[]> {
  if (!query.trim()) return [];
  const normalizedQuery = normalizeForSearch(query);
  return db
    .select()
    .from(foods)
    .where(like(foods.nameNormalized, `%${normalizedQuery}%`))
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
 * Batch fetch multiple foods by id in a single query.
 * Returns only the rows that exist (missing ids are silently omitted).
 * Order is not guaranteed — callers should map results by id.
 */
export async function getByIds(ids: string[]): Promise<Food[]> {
  if (ids.length === 0) return [];
  return db.select().from(foods).where(inArray(foods.id, ids));
}

/**
 * Upsert an Open Food Facts food into the local cache.
 * On conflict (same id), updates all mutable fields so stale OFF data is refreshed.
 * Always keeps name_normalized in sync with name.
 */
export async function upsert(food: NewFood): Promise<Food> {
  const nameNormalized = normalizeForSearch(food.name);
  const rows = await db
    .insert(foods)
    .values({ ...food, nameNormalized })
    .onConflictDoUpdate({
      target: foods.id,
      set: {
        name: food.name,
        nameNormalized,
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
 * Batch upsert multiple Open Food Facts foods into the local cache in a
 * single statement, replacing the old sequential-await-per-item loop.
 * Same on-conflict semantics as upsert(): existing rows are refreshed.
 * Returns an empty array without touching the DB when given no rows.
 */
export async function upsertMany(foodsToUpsert: NewFood[]): Promise<Food[]> {
  if (foodsToUpsert.length === 0) return [];

  const values = foodsToUpsert.map((food) => ({
    ...food,
    nameNormalized: normalizeForSearch(food.name),
  }));

  const rows = await db
    .insert(foods)
    .values(values)
    .onConflictDoUpdate({
      target: foods.id,
      set: {
        name: sql`excluded.name`,
        nameNormalized: sql`excluded.name_normalized`,
        brand: sql`excluded.brand`,
        caloriesPer100g: sql`excluded.calories_per_100g`,
        proteinPer100g: sql`excluded.protein_per_100g`,
        carbsPer100g: sql`excluded.carbs_per_100g`,
        fatPer100g: sql`excluded.fat_per_100g`,
        servingSizeG: sql`excluded.serving_size_g`,
        offProductCode: sql`excluded.off_product_code`,
      },
    })
    .returning();

  return rows;
}

/**
 * Insert a new custom food. Throws if a food with the same id already exists.
 * Use upsert() for OFF-sourced foods.
 * Always computes name_normalized from name via the shared helper.
 */
export async function insert(food: NewFood): Promise<Food> {
  const nameNormalized = normalizeForSearch(food.name);
  const rows = await db
    .insert(foods)
    .values({ ...food, nameNormalized })
    .returning();
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
 * If name is being updated, recomputes name_normalized automatically.
 * Returns the updated row.
 */
export async function update(
  id: string,
  patch: Partial<Omit<NewFood, "id" | "createdAt">>
): Promise<Food> {
  const fullPatch: Partial<Omit<NewFood, "id" | "createdAt">> & { nameNormalized?: string } = {
    ...patch,
  };
  if (patch.name !== undefined) {
    fullPatch.nameNormalized = normalizeForSearch(patch.name);
  }
  const rows = await db.update(foods).set(fullPatch).where(eq(foods.id, id)).returning();
  return rows[0];
}
