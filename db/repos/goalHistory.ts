/**
 * Dispatching goal-history repository.
 * Routes calls to Dexie adapter (IndexedDB) or drizzle implementation (OPFS/SQLite)
 * based on the active backend.
 *
 * Every row is owned by the active account (the signed-in auth user id, or the
 * "local" marker while signed out) and reads are filtered by that owner, so
 * accounts sharing a device never see each other's history.
 *
 * When VITE_SYNC_ENABLED=true, each record() by a signed-in user also enqueues
 * an outbound sync op (fire-and-forget; never blocks the caller).
 */

import { dexieAdapter } from "@/db/client";
import * as _impl from "@/db/repositories/goalHistory";
import type { GoalHistoryEntry, NewGoalHistoryEntry } from "@/db/schema";
import { LOCAL_GOAL_OWNER } from "@/lib/goalHistory";
import { isSyncEnabled } from "@/src/lib/supabase";
import { isDemoDevice } from "@/src/services/demoGuard";
import { goalHistoryToRemote } from "@/src/services/syncMappers";
import { enqueue } from "@/src/services/syncQueue";
import { useAuthStore } from "@/src/stores/useAuthStore";

/** The account that owns newly recorded history right now. */
export function currentOwner(): string {
  return useAuthStore.getState().userId ?? LOCAL_GOAL_OWNER;
}

/**
 * The owner's entries, oldest effective_from first. Multi-step callers capture
 * the owner once and pass it, so a sign-in switch cannot split an operation.
 */
export async function list(owner: string = currentOwner()): Promise<GoalHistoryEntry[]> {
  if (dexieAdapter) return dexieAdapter.goalHistory.list(owner);
  return _impl.list(owner);
}

/**
 * Insert or overwrite the owner's entry for data.effectiveFrom and enqueue a
 * sync op when signed in (unless options.enqueue is false, used for pending
 * seeds that must not reach the cloud before the first reconcile).
 */
export async function record(
  data: Omit<NewGoalHistoryEntry, "userId">,
  owner: string = currentOwner(),
  options: { enqueue?: boolean } = {}
): Promise<GoalHistoryEntry> {
  const row = { ...data, userId: owner };

  const entry = dexieAdapter ? await dexieAdapter.goalHistory.record(row) : await _impl.record(row);
  if (options.enqueue !== false) _enqueueGoalHistoryOp(entry, owner);
  return entry;
}

/** Delete the owner's entry for one day (no sync op). */
export async function remove(effectiveFrom: string, owner: string = currentOwner()): Promise<void> {
  if (dexieAdapter) return dexieAdapter.goalHistory.remove(owner, effectiveFrom);
  return _impl.remove(owner, effectiveFrom);
}

/**
 * Write entries pulled from the cloud: keeps the remote updatedAt and
 * never enqueues sync ops (avoids echoing pulled rows back).
 */
export async function replaceFromRemote(rows: NewGoalHistoryEntry[]): Promise<void> {
  if (rows.length === 0) return;
  if (dexieAdapter) return dexieAdapter.goalHistory.replaceFromRemote(rows);
  return _impl.replaceFromRemote(rows);
}

/** Re-own signed-out ("local") entries to `userId` (days they already have are kept). */
export async function adoptLocalOwned(userId: string): Promise<void> {
  if (dexieAdapter) return dexieAdapter.goalHistory.adoptLocalOwned(userId);
  return _impl.adoptLocalOwned(userId);
}

// ── Private helpers ───────────────────────────────────────────────────

function _enqueueGoalHistoryOp(entry: GoalHistoryEntry, owner: string): void {
  if (!isSyncEnabled() || owner === LOCAL_GOAL_OWNER) return;
  // A seeded demo device must never push its (demo) history.
  if (isDemoDevice()) return;

  void enqueue({
    table: "goal_history",
    op: "upsert",
    row: JSON.stringify(goalHistoryToRemote(entry, owner)),
    userId: owner,
    updatedAt: entry.updatedAt,
  });
}
