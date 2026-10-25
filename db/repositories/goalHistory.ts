import { db } from "@/db/client";
import { goalHistory } from "@/db/schema";
import type { GoalHistoryEntry, NewGoalHistoryEntry } from "@/db/schema";
import { LOCAL_GOAL_OWNER } from "@/lib/goalHistory";
import { and, asc, eq } from "drizzle-orm";

/**
 * The owner's goal history entries, oldest effective_from first.
 */
export async function list(userId: string): Promise<GoalHistoryEntry[]> {
  return db
    .select()
    .from(goalHistory)
    .where(eq(goalHistory.userId, userId))
    .orderBy(asc(goalHistory.effectiveFrom));
}

/**
 * Insert or overwrite the entry for (data.userId, data.effectiveFrom).
 * Recording twice on the same day updates that day's entry (createdAt is
 * preserved) rather than creating a second row. Timestamps are always ISO
 * strings (never SQLite's zone-less CURRENT_TIMESTAMP) so last-write-wins
 * comparisons are unambiguous.
 */
export async function record(data: NewGoalHistoryEntry): Promise<GoalHistoryEntry> {
  const stamp = new Date().toISOString();
  const rows = await db
    .insert(goalHistory)
    .values({ ...data, createdAt: data.createdAt ?? stamp, updatedAt: stamp })
    .onConflictDoUpdate({
      target: [goalHistory.userId, goalHistory.effectiveFrom],
      set: {
        calorieGoal: data.calorieGoal,
        proteinGoalG: data.proteinGoalG,
        carbsGoalG: data.carbsGoalG,
        fatGoalG: data.fatGoalG,
        useManualGoals: data.useManualGoals ?? false,
        updatedAt: stamp,
      },
    })
    .returning();

  return rows[0];
}

/**
 * Write entries pulled from the cloud, preserving their updatedAt (needed for
 * last-write-wins). Unlike record this does not stamp "now"; callers must not
 * enqueue sync ops for it.
 */
export async function replaceFromRemote(rows: NewGoalHistoryEntry[]): Promise<void> {
  for (const row of rows) {
    const { userId: _u, effectiveFrom: _d, ...rest } = row;
    await db
      .insert(goalHistory)
      .values(row)
      .onConflictDoUpdate({
        target: [goalHistory.userId, goalHistory.effectiveFrom],
        set: rest,
      });
  }
}

/**
 * Re-own the signed-out ("local") entries to `userId`. Days the user already
 * has are kept as they are and the local copy is dropped.
 */
export async function adoptLocalOwned(userId: string): Promise<void> {
  const locals = await db
    .select()
    .from(goalHistory)
    .where(eq(goalHistory.userId, LOCAL_GOAL_OWNER));
  for (const row of locals) {
    await db
      .insert(goalHistory)
      .values({ ...row, userId })
      .onConflictDoNothing();
  }
  if (locals.length > 0) {
    await db.delete(goalHistory).where(eq(goalHistory.userId, LOCAL_GOAL_OWNER));
  }
}

/**
 * Delete the owner's entry for one day. No-op when it does not exist.
 */
export async function remove(userId: string, effectiveFrom: string): Promise<void> {
  await db
    .delete(goalHistory)
    .where(and(eq(goalHistory.userId, userId), eq(goalHistory.effectiveFrom, effectiveFrom)));
}
