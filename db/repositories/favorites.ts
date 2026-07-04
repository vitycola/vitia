/**
 * Pure drizzle favorites repository.
 * Backend-agnostic (R6) — dispatched by db/repos/favorites.ts.
 *
 * `userId` is nullable; `null` represents the local/anonymous owner (mirrors
 * the `mealEntries` pattern). Note: SQLite treats NULL as distinct in UNIQUE
 * indexes, so uniqueness for the local-anonymous owner AND the meal
 * dimension is enforced here via an explicit existence check rather than
 * relying solely on the DB constraint (kept in sync with the Dexie
 * adapter's equivalent behaviour).
 *
 * Favorites are meal-aware: a food may hold multiple rows, one per meal type
 * it was favorited under. `mealType = null` represents the "unassigned"
 * bucket. Removal is always whole-food: `removeAllMeals` deletes every row
 * for (userId, foodId) regardless of how many meal types it spans.
 */

import { db } from "@/db/client";
import { userFavoriteFoods } from "@/db/schema";
import { generateId } from "@/lib/id";
import type { MealType } from "@/types";
import { and, eq, isNull } from "drizzle-orm";

export interface FavoriteMealRow {
  foodId: string;
  mealType: MealType | null;
}

function ownerClause(userId: string | null) {
  return userId === null ? isNull(userFavoriteFoods.userId) : eq(userFavoriteFoods.userId, userId);
}

function mealClause(mealType: MealType | null) {
  return mealType === null
    ? isNull(userFavoriteFoods.mealType)
    : eq(userFavoriteFoods.mealType, mealType);
}

/** Returns whether the given food is favorited by the given user (any meal type). */
export async function isFavorite(foodId: string, userId: string | null): Promise<boolean> {
  const rows = await db
    .select()
    .from(userFavoriteFoods)
    .where(and(eq(userFavoriteFoods.foodId, foodId), ownerClause(userId)))
    .limit(1);
  return rows.length > 0;
}

/**
 * Toggle favorite state for a food/user pair.
 * @deprecated thin wrapper for legacy callers — toggle -> setMeals([]) / removeAllMeals.
 * Returns the new state (true = now favorited, false = now unfavorited).
 */
export async function toggle(foodId: string, userId: string | null): Promise<boolean> {
  const alreadyFavorite = await isFavorite(foodId, userId);
  if (alreadyFavorite) {
    await removeAllMeals(foodId, userId);
    return false;
  }
  await setMeals(foodId, userId, []);
  return true;
}

/** Returns the list of favorited food ids for the given user. */
export async function listFoodIds(userId: string | null): Promise<string[]> {
  const rows = await db
    .select({ foodId: userFavoriteFoods.foodId })
    .from(userFavoriteFoods)
    .where(ownerClause(userId));
  return rows.map((r) => r.foodId);
}

/**
 * Add a single favorite row for (foodId, userId, mealType).
 * No-op if a row for that exact (userId, foodId, mealType) already exists
 * (unique-constraint guard, extended to the meal dimension).
 */
export async function addMeal(
  foodId: string,
  userId: string | null,
  mealType: MealType | null
): Promise<void> {
  const rows = await db
    .select()
    .from(userFavoriteFoods)
    .where(and(eq(userFavoriteFoods.foodId, foodId), ownerClause(userId), mealClause(mealType)))
    .limit(1);
  if (rows.length > 0) return;

  await db.insert(userFavoriteFoods).values({
    id: generateId(),
    userId,
    foodId,
    mealType,
  });
}

/** Deletes EVERY row for (userId, foodId), regardless of mealType. */
export async function removeAllMeals(foodId: string, userId: string | null): Promise<void> {
  await db
    .delete(userFavoriteFoods)
    .where(and(eq(userFavoriteFoods.foodId, foodId), ownerClause(userId)));
}

/**
 * Diff mealTypes vs the existing rows for (userId, foodId):
 * - empty array -> exactly one row with mealType = NULL
 * - non-empty array -> one row per meal type; existing NULL row and any
 *   meal types not in the new selection are removed; new meal types are added.
 */
export async function setMeals(
  foodId: string,
  userId: string | null,
  mealTypes: MealType[]
): Promise<void> {
  const existing = await db
    .select()
    .from(userFavoriteFoods)
    .where(and(eq(userFavoriteFoods.foodId, foodId), ownerClause(userId)));

  if (mealTypes.length === 0) {
    const nonNull = existing.filter((r) => r.mealType !== null);
    if (nonNull.length > 0) {
      for (const row of nonNull) {
        await db.delete(userFavoriteFoods).where(eq(userFavoriteFoods.id, row.id));
      }
    }
    const hasNull = existing.some((r) => r.mealType === null);
    if (!hasNull) {
      await db.insert(userFavoriteFoods).values({
        id: generateId(),
        userId,
        foodId,
        mealType: null,
      });
    }
    return;
  }

  const wanted = new Set(mealTypes);
  const toRemove = existing.filter((r) => r.mealType === null || !wanted.has(r.mealType));
  for (const row of toRemove) {
    await db.delete(userFavoriteFoods).where(eq(userFavoriteFoods.id, row.id));
  }

  const existingMealTypes = new Set(
    existing.filter((r) => r.mealType !== null).map((r) => r.mealType as MealType)
  );
  const toAdd = mealTypes.filter((m) => !existingMealTypes.has(m));
  for (const mealType of toAdd) {
    await db.insert(userFavoriteFoods).values({
      id: generateId(),
      userId,
      foodId,
      mealType,
    });
  }
}

/** Returns the list of meal types (or null for unassigned) a food is favorited under. */
export async function getMealsForFood(
  foodId: string,
  userId: string | null
): Promise<(MealType | null)[]> {
  const rows = await db
    .select({ mealType: userFavoriteFoods.mealType })
    .from(userFavoriteFoods)
    .where(and(eq(userFavoriteFoods.foodId, foodId), ownerClause(userId)));
  return rows.map((r) => r.mealType);
}

/** Returns all (foodId, mealType) favorite rows for the given user. */
export async function listWithMeals(userId: string | null): Promise<FavoriteMealRow[]> {
  const rows = await db
    .select({ foodId: userFavoriteFoods.foodId, mealType: userFavoriteFoods.mealType })
    .from(userFavoriteFoods)
    .where(ownerClause(userId));
  return rows;
}
