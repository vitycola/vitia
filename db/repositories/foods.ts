import { db } from "@/db/client";
import { foodIngredients, foods } from "@/db/schema";
import type { Food, FoodIngredient, NewFood, NewFoodIngredient } from "@/db/schema";
import { generateId } from "@/lib/id";
import { sumIngredientMacros } from "@/lib/nutrition";
import { normalizeForSearch } from "@/lib/search";
import { asc, eq, inArray, like, sql } from "drizzle-orm";

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
 * Get all custom foods (source = 'custom'), newest first.
 * Used by the "Creados" tab to list foods the user has created.
 */
export async function getCustomFoods(): Promise<Food[]> {
  return db
    .select()
    .from(foods)
    .where(eq(foods.source, "custom"))
    .orderBy(sql`${foods.createdAt} DESC`);
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

// ── Composite foods (food_ingredients) ─────────────────────────────────

export type NewIngredientInput = Omit<NewFoodIngredient, "id" | "parentFoodId" | "createdAt">;

/**
 * Returns the distinct set of foodIds that are already composite (have one or
 * more food_ingredients rows as parent). Used both to exclude composites from
 * the ingredient picker and to guard against nested composite-of-composite
 * recipes.
 */
export async function getCompositeFoodIds(): Promise<string[]> {
  const rows = await db
    .selectDistinct({ parentFoodId: foodIngredients.parentFoodId })
    .from(foodIngredients);
  return rows.map((r) => r.parentFoodId);
}

/**
 * Throws if any of the given ingredient food ids is itself a composite food
 * (design: nested-composite prevention lives in the repository).
 */
async function assertNoNestedComposites(ingredientFoodIds: string[]): Promise<void> {
  if (ingredientFoodIds.length === 0) return;
  const compositeIds = new Set(await getCompositeFoodIds());
  const nested = ingredientFoodIds.filter((id) => compositeIds.has(id));
  if (nested.length > 0) {
    throw new Error(
      `Nested composites are not allowed: ${nested.join(", ")} are already composite foods.`
    );
  }
}

/**
 * Insert a new composite food and its recipe (food_ingredients rows) in a
 * single transaction. Throws if any ingredient is itself a composite food.
 */
export async function createComposite(
  food: NewFood,
  ingredients: NewIngredientInput[]
): Promise<Food> {
  await assertNoNestedComposites(ingredients.map((i) => i.ingredientFoodId));

  return db.transaction(async (tx) => {
    const nameNormalized = normalizeForSearch(food.name);
    const foodRows = await tx
      .insert(foods)
      .values({ ...food, nameNormalized })
      .returning();
    const parent = foodRows[0];

    if (ingredients.length > 0) {
      await tx.insert(foodIngredients).values(
        ingredients.map((ing) => ({
          id: generateId(),
          parentFoodId: parent.id,
          ingredientFoodId: ing.ingredientFoodId,
          weightG: ing.weightG,
          position: ing.position,
        }))
      );
    }

    return parent;
  });
}

/**
 * Get a composite food's recipe rows, ordered by position.
 * Tolerates a missing referenced ingredient food — this returns the raw
 * food_ingredients rows only; callers (UI) must handle a missing food when
 * resolving ingredientFoodId -> Food (spec: Dangling Ingredient Handling).
 */
export async function getIngredients(parentFoodId: string): Promise<FoodIngredient[]> {
  return db
    .select()
    .from(foodIngredients)
    .where(eq(foodIngredients.parentFoodId, parentFoodId))
    .orderBy(asc(foodIngredients.position));
}

/**
 * Replace all ingredient rows for a composite food and recompute + persist
 * its per-100g snapshot macros from the new recipe (spec: Snapshot Recompute
 * on Explicit Edit Only). Throws if any ingredient is itself a composite food.
 */
export async function upsertIngredients(
  parentFoodId: string,
  ingredients: NewIngredientInput[]
): Promise<void> {
  await assertNoNestedComposites(ingredients.map((i) => i.ingredientFoodId));

  await db.transaction(async (tx) => {
    await tx.delete(foodIngredients).where(eq(foodIngredients.parentFoodId, parentFoodId));

    if (ingredients.length > 0) {
      await tx.insert(foodIngredients).values(
        ingredients.map((ing) => ({
          id: generateId(),
          parentFoodId,
          ingredientFoodId: ing.ingredientFoodId,
          weightG: ing.weightG,
          position: ing.position,
        }))
      );
    }

    const ingredientFoodRows =
      ingredients.length > 0
        ? await tx
            .select()
            .from(foods)
            .where(
              inArray(
                foods.id,
                ingredients.map((i) => i.ingredientFoodId)
              )
            )
        : [];
    const byId = new Map(ingredientFoodRows.map((f) => [f.id, f]));
    const summed = sumIngredientMacros(
      ingredients.map((ing) => ({
        food: byId.get(ing.ingredientFoodId) as Food,
        weightG: ing.weightG,
      }))
    );

    await tx
      .update(foods)
      .set({
        caloriesPer100g: summed.caloriesPer100g,
        proteinPer100g: summed.proteinPer100g,
        carbsPer100g: summed.carbsPer100g,
        fatPer100g: summed.fatPer100g,
        servingSizeG: summed.totalWeightG,
      })
      .where(eq(foods.id, parentFoodId));
  });
}
