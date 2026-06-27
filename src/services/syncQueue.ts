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

/**
 * Enqueue a sync operation.
 * Safe to call when offline — the op is persisted locally and will be
 * sent to Supabase when connectivity is restored.
 */
export async function enqueue(
  op: Omit<NewSyncQueueRow, "id">
): Promise<void> {
  const row: NewSyncQueueRow = { ...op, id: generateId() };

  try {
    if (dexieAdapter) {
      await dexieAdapter.syncQueue.enqueue(row);
    } else {
      await db.insert(syncQueueTable).values(row);
    }
  } catch (err) {
    // Enqueue failure must never block the write caller — log and move on
    console.error("[syncQueue] enqueue failed (op will be lost):", err);
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
