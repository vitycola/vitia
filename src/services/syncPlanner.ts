/**
 * Sync planner — pure ordering and compaction of queued sync ops.
 *
 * Queue ids are random UUIDs, so the raw drain order is arbitrary. Running a
 * `delete` before the `upsert` of the same row would leave a zombie row on the
 * remote. The planner restores chronological order and drops ops that a later
 * op makes redundant, so the flush never recreates a row it just deleted.
 */

import type { SyncQueueRow } from "@/db/schema";
import { normalizeQueuedPayload } from "@/src/services/syncMappers";

export interface FlushPlan {
  /** Ops to execute, in order. */
  ordered: SyncQueueRow[];
  /** Ids of ops made redundant by a later op; they must be removed unsent. */
  superseded: string[];
}

/**
 * Chronological order; ties: upsert before delete, then by id.
 * Ops with an unparseable timestamp go last so they can never jump ahead of
 * well-formed ops.
 */
export function compareOps(a: SyncQueueRow, b: SyncQueueRow): number {
  const ta = Date.parse(a.updatedAt);
  const tb = Date.parse(b.updatedAt);
  const aValid = !Number.isNaN(ta);
  const bValid = !Number.isNaN(tb);
  if (aValid && bValid && ta !== tb) return ta - tb;
  if (aValid !== bValid) return aValid ? -1 : 1;
  if (a.op !== b.op) return a.op === "upsert" ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function parseOpRow(op: SyncQueueRow): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(op.row as string);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Key identifying a meal slot (user + date + meal type). */
export function mealSlotKey(userId: string, date: unknown, mealType: unknown): string {
  return `${userId}|${String(date)}|${String(mealType)}`;
}

export type MealOpInfo =
  | { kind: "upsert"; id: string; slot: string }
  | { kind: "delete"; id: string }
  | { kind: "bulkDelete"; slot: string };

/**
 * Extracts the row id / meal slot a meal_entries op acts on, handling both
 * snake_case and legacy camelCase payloads. Returns null for other tables or
 * payloads that cannot be understood.
 */
export function describeMealOp(op: SyncQueueRow): MealOpInfo | null {
  if (op.table !== "meal_entries") return null;
  const payload = parseOpRow(op);
  if (!payload) return null;

  if (op.op === "delete") {
    if (payload.bulk) {
      return {
        kind: "bulkDelete",
        slot: mealSlotKey(op.userId, payload.date, payload.meal_type ?? payload.mealType),
      };
    }
    return payload.id != null ? { kind: "delete", id: String(payload.id) } : null;
  }

  if (op.op === "upsert") {
    const normalized = normalizeQueuedPayload("meal_entries", payload, op.userId);
    if (normalized.id == null) return null;
    return {
      kind: "upsert",
      id: String(normalized.id),
      slot: mealSlotKey(op.userId, normalized.date, normalized.meal_type),
    };
  }
  return null;
}

export function planFlush(ops: SyncQueueRow[]): FlushPlan {
  const ordered = [...ops].sort(compareOps);
  const superseded = new Set<string>();

  // Reverse pass: everything seen so far is LATER than the op under inspection.
  const laterUpsertIds = new Set<string>();
  const laterDeletedIds = new Set<string>();
  const laterBulkSlots = new Set<string>();
  const laterProfileUsers = new Set<string>();

  for (let i = ordered.length - 1; i >= 0; i--) {
    const op = ordered[i];

    if (op.table === "users_profile" && op.op === "upsert") {
      if (laterProfileUsers.has(op.userId)) superseded.add(op.id);
      else laterProfileUsers.add(op.userId);
      continue;
    }

    const info = describeMealOp(op);
    if (!info) continue;

    if (info.kind === "bulkDelete") {
      laterBulkSlots.add(info.slot);
    } else if (info.kind === "delete") {
      laterDeletedIds.add(`${op.userId}|${info.id}`);
    } else {
      const idKey = `${op.userId}|${info.id}`;
      if (
        laterUpsertIds.has(idKey) ||
        laterDeletedIds.has(idKey) ||
        laterBulkSlots.has(info.slot)
      ) {
        superseded.add(op.id);
      }
      // Even a superseded upsert is a "later op" for earlier upserts of the same id.
      laterUpsertIds.add(idKey);
    }
  }

  return {
    ordered: ordered.filter((op) => !superseded.has(op.id)),
    superseded: ordered.filter((op) => superseded.has(op.id)).map((op) => op.id),
  };
}
