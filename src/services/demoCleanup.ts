/**
 * One-time local cleanup of demo rows on authenticated real devices.
 *
 * Deletes demo meal entries through the normal repo path (so remote deletes
 * are enqueued by id) and drops the cached demo foods. Progress entries and
 * the profile have no reliable demo marker and are intentionally left alone.
 */

import * as foodsRepo from "@/db/repos/foods";
import * as mealEntriesRepo from "@/db/repos/mealEntries";
import { DEMO_FOOD_IDS, isDemoDevice, isDemoMealEntry } from "@/src/services/demoGuard";
import { useAuthStore } from "@/src/stores/useAuthStore";

let _cleanupDone = false;

/** Test helper: allow the once-per-boot cleanup to run again. */
export function resetDemoCleanupForTests(): void {
  _cleanupDone = false;
}

/**
 * Removes local demo meals and foods. Runs once per boot, never throws.
 * Returns the number of meal entries deleted.
 */
export async function cleanupDemoData(sessionUserId: string): Promise<number> {
  if (_cleanupDone || isDemoDevice()) return 0;
  // The repo only enqueues remote deletes when the auth store has a user, so
  // require it to match the session; otherwise skip and retry on the next sync.
  if (useAuthStore.getState().userId !== sessionUserId) return 0;

  let removed = 0;
  try {
    const demoEntries = (await mealEntriesRepo.getAll()).filter(isDemoMealEntry);
    for (const entry of demoEntries) {
      await mealEntriesRepo.remove(entry.id);
      removed++;
    }

    const demoFoods = await foodsRepo.getByIds([...DEMO_FOOD_IDS]);
    for (const food of demoFoods) {
      await foodsRepo.deleteFood(food.id);
    }

    if (removed > 0 || demoFoods.length > 0) {
      console.info(
        `[demoCleanup] removed ${removed} demo meal entries and ${demoFoods.length} demo foods`
      );
    }
    _cleanupDone = true; // only after a fully successful pass
  } catch (err) {
    console.warn("[demoCleanup] failed:", err);
  }
  return removed;
}
