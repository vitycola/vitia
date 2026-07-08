/**
 * Dispatching OFF-category-correction-counter repository.
 * Routes calls to Dexie adapter (IndexedDB) or drizzle implementation (OPFS/SQLite)
 * based on the active backend — without touching the pure drizzle files in
 * db/repositories/, which remain backend-agnostic (R6).
 */

import { dexieAdapter } from "@/db/client";
import * as _impl from "@/db/repositories/offCategoryCorrections";

export async function incrementOffCategoryCorrection(): Promise<void> {
  if (dexieAdapter) return dexieAdapter.offCategoryCorrections.increment();
  return _impl.incrementOffCategoryCorrection();
}

export async function getOffCategoryCorrectionCount(): Promise<number> {
  if (dexieAdapter) return dexieAdapter.offCategoryCorrections.getCount();
  return _impl.getOffCategoryCorrectionCount();
}
