/**
 * Sync queue — durable outbound operation queue.
 *
 * Ops are persisted in the local DB (sync_queue table on OPFS path;
 * sync_queue IndexedDB object store on Dexie path) so they survive
 * browser restarts and offline periods.
 *
 * Design: sdd/user-session-persistence/design — Architecture Decision 7 & 8
 *   - Enqueued inside repo write fns after local commit
 *   - Drained by SyncService on reconnect / boot
 */

import { dexieAdapter } from "@/db/client";
import { db } from "@/db/client";
import { syncQueue as syncQueueTable } from "@/db/schema";
import type { NewSyncQueueRow, SyncQueueRow } from "@/db/schema";
import { generateId } from "@/lib/id";

// Re-export for callers that only import from this module
export type { SyncQueueRow as SyncOp };

type EnqueueListener = () => void;
let _onEnqueue: EnqueueListener | null = null;

/**
 * Register a callback invoked after every successful enqueue (used by the
 * sync service to schedule a flush). Pass null to unregister. Kept as a hook
 * so this module never imports the sync service (circular dependency).
 */
export function setOnEnqueue(cb: EnqueueListener | null): void {
  _onEnqueue = cb;
}

let _lastIssuedMs = 0;

/** Parses an ISO string or "YYYY-MM-DD HH:MM:SS" (treated as UTC); NaN if invalid. */
function parseTimestamp(value: string | undefined): number {
  if (!value) return Number.NaN;
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value);
  const iso = value.includes("T") ? value : value.replace(" ", "T");
  return Date.parse(hasZone ? iso : `${iso}Z`);
}

/**
 * Issues a strictly increasing ISO timestamp per device: max(provided-or-now,
 * last issued + 1ms). Removes same-millisecond ties and mixed formats so the
 * flush planner can order ops reliably.
 *
 * Limitation: the counter lives in memory, so a wall-clock step backwards
 * across an app restart can still reorder ops. A Dexie auto-increment
 * sequence would be the stricter fix.
 */
function nextUpdatedAt(provided: string | undefined): string {
  const parsed = parseTimestamp(provided);
  const base = Number.isNaN(parsed) ? Date.now() : parsed;
  _lastIssuedMs = Math.max(base, _lastIssuedMs + 1);
  return new Date(_lastIssuedMs).toISOString();
}

/**
 * Enqueue a sync operation.
 * Safe to call when offline — the op is persisted locally and will be
 * sent to Supabase when connectivity is restored.
 */
export async function enqueue(op: Omit<NewSyncQueueRow, "id">): Promise<void> {
  // Computed synchronously, before any await, so callers that do not await
  // (`void enqueue(...)`) still get call-order timestamps.
  const row: NewSyncQueueRow = { ...op, id: generateId(), updatedAt: nextUpdatedAt(op.updatedAt) };

  try {
    if (dexieAdapter) {
      await dexieAdapter.syncQueue.enqueue(row);
    } else {
      await db.insert(syncQueueTable).values(row);
    }
  } catch (err) {
    // Enqueue failure must never block the write caller — log and move on
    console.error("[syncQueue] enqueue failed (op will be lost):", err);
    return;
  }

  try {
    _onEnqueue?.();
  } catch (err) {
    console.warn("[syncQueue] onEnqueue listener failed:", err);
  }
}

/**
 * Return all queued operations in insertion order.
 */
export async function drain(): Promise<SyncQueueRow[]> {
  if (dexieAdapter) {
    return dexieAdapter.syncQueue.drain();
  }
  return db.select().from(syncQueueTable);
}

/**
 * Remove a specific operation from the queue (after successful push).
 */
export async function remove(id: string): Promise<void> {
  if (dexieAdapter) {
    await dexieAdapter.syncQueue.remove(id);
  } else {
    const { eq } = await import("drizzle-orm");
    await db.delete(syncQueueTable).where(eq(syncQueueTable.id, id));
  }
}
