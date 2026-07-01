/**
 * Pure drizzle favorites repository.
 * Backend-agnostic (R6) — dispatched by db/repos/favorites.ts.
 *
 * `userId` is nullable; `null` represents the local/anonymous owner (mirrors
 * the `mealEntries` pattern). Note: SQLite treats NULL as distinct in UNIQUE
 * indexes, so uniqueness for the local-anonymous owner is enforced here via
 * an explicit existence check rather than relying solely on the DB
 * constraint (kept in sync with the Dexie adapter's equivalent behaviour).
 */

import { db } from "@/db/client";
import { userFavoriteFoods } from "@/db/schema";
import { generateId } from "@/lib/id";
import { and, eq, isNull } from "drizzle-orm";

function ownerClause(userId: string | null) {
  return userId === null ? isNull(userFavoriteFoods.userId) : eq(userFavoriteFoods.userId, userId);
}

/** Returns whether the given food is favorited by the given user. */
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
 * Returns the new state (true = now favorited, false = now unfavorited).
 */
export async function toggle(foodId: string, userId: string | null): Promise<boolean> {
  const rows = await db
    .select()
    .from(userFavoriteFoods)
    .where(and(eq(userFavoriteFoods.foodId, foodId), ownerClause(userId)))
    .limit(1);

  if (rows.length > 0) {
    await db.delete(userFavoriteFoods).where(eq(userFavoriteFoods.id, rows[0].id));
    return false;
  }

  await db.insert(userFavoriteFoods).values({
    id: generateId(),
    userId,
    foodId,
  });
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
