/**
 * Pure drizzle implementation of the OFF category-correction telemetry
 * counter (single aggregate row, id = 1). Backend-agnostic — no dexie
 * knowledge here (R6). Design: raw-cooked-conversion D5.
 */
import { db } from "@/db/client";
import { offCategoryCorrections } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

const AGGREGATE_ROW_ID = 1;

/**
 * Increment the correction counter by 1, creating the aggregate row on first
 * use. Called whenever a user manually overrides an auto-assigned OFF
 * `category`.
 */
export async function incrementOffCategoryCorrection(): Promise<void> {
  await db
    .insert(offCategoryCorrections)
    .values({ id: AGGREGATE_ROW_ID, correctionCount: 1 })
    .onConflictDoUpdate({
      target: offCategoryCorrections.id,
      set: {
        correctionCount: sql`${offCategoryCorrections.correctionCount} + 1`,
        updatedAt: sql`(CURRENT_TIMESTAMP)`,
      },
    });
}

/**
 * Read the current correction count. Returns 0 when no correction has ever
 * been recorded (no aggregate row yet).
 */
export async function getOffCategoryCorrectionCount(): Promise<number> {
  const rows = await db
    .select()
    .from(offCategoryCorrections)
    .where(eq(offCategoryCorrections.id, AGGREGATE_ROW_ID))
    .limit(1);
  return rows[0]?.correctionCount ?? 0;
}
