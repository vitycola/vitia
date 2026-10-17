/**
 * Sync service — coordinates push/pull between local DB and Supabase.
 *
 * Design: sdd/user-session-persistence/design — Data Flow section
 *
 * Write path (outbound):
 *   1. repo writes local → enqueues op
 *   2. flush() drains queue → supabase upsert per conflict policy
 *
 * Reconcile path (on login + reconnect):
 *   1. push: local rows not in remote → insert remote
 *   2. pull: remote rows not in local → insert local
 *   3. profile conflict: LWW by updatedAt
 *   4. stores reload() to rehydrate UI
 */

import { db, dexieAdapter } from "@/db/client";
import * as mealEntriesRepo from "@/db/repos/mealEntries";
import * as profileRepo from "@/db/repos/profile";
import { mealEntries as mealEntriesTable } from "@/db/schema";
import type { MealEntry, NewMealEntry, UserProfile } from "@/db/schema";
import { getSupabaseClient, isSyncEnabled } from "@/src/lib/supabase";
import { cleanupDemoData } from "@/src/services/demoCleanup";
import { isDemoDevice, isDemoMealEntry } from "@/src/services/demoGuard";
import {
  type RemoteMealEntry,
  type RemoteProfile,
  mealEntryFromRemote,
  mealEntryToRemote,
  normalizeQueuedPayload,
  profileFromRemote,
  profileToRemote,
} from "@/src/services/syncMappers";
import { drain, remove } from "@/src/services/syncQueue";
import { useAuthStore } from "@/src/stores/useAuthStore";
import { useDayStore } from "@/stores/useDayStore";
import { useProfileStore } from "@/stores/useProfileStore";
import { eq } from "drizzle-orm";

let _cleanupFns: Array<() => void> = [];
let _startedFor: string | null = null;
/** Bumped on every start/stop so in-flight work for a previous user can bail out. */
let _generation = 0;
let _flushInFlight: Promise<void> | null = null;

/** Sync runs only when enabled AND this device was never seeded with demo data. */
function isSyncActive(): boolean {
  if (!isSyncEnabled()) return false;
  if (!isDemoDevice()) return true;
  if (!_demoWarned && useAuthStore.getState().userId) {
    _demoWarned = true;
    console.warn(
      "[syncService] Sync is disabled: this origin was used for the demo seed. " +
        "Remove localStorage keys 'vitia.demoSeed' and 'vitia.demoSeedStarted' to re-enable it."
    );
  }
  return false;
}

let _demoWarned = false;

/** Test helper: reset the once-per-boot kill-switch warning. */
export function resetDemoWarningForTests(): void {
  _demoWarned = false;
}

const BACKFILL_BATCH_SIZE = 500;
const BACKFILL_FLAG_PREFIX = "vitia:sync:mealEntriesBackfilled:";
const _backfillInFlight = new Map<string, Promise<boolean>>();

/**
 * Start the sync service for the given user.
 * Registers online and visibilitychange listeners and kicks off an initial
 * sync (flush + full-history backfill + reconcile).
 * Idempotent: calling it again for the same user is a no-op; calling it for
 * a different user restarts the service.
 */
export function start(userId: string): void {
  if (!isSyncActive()) return;
  if (_startedFor === userId) return;

  stop(); // clean up previous listeners if any
  _startedFor = userId;
  _generation++;

  const handleOnline = () => {
    void sync(userId);
  };

  const handleVisibilityChange = () => {
    if (document.visibilityState === "visible") {
      void flush();
    }
  };

  window.addEventListener("online", handleOnline);
  document.addEventListener("visibilitychange", handleVisibilityChange);

  _cleanupFns = [
    () => window.removeEventListener("online", handleOnline),
    () => document.removeEventListener("visibilitychange", handleVisibilityChange),
  ];

  void sync(userId);
}

/**
 * Stop the sync service and remove all listeners.
 */
export function stop(): void {
  for (const fn of _cleanupFns) fn();
  _cleanupFns = [];
  _startedFor = null;
  _generation++;
}

async function getSessionUserId(
  supabase: ReturnType<typeof getSupabaseClient>
): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

/**
 * Keep the sync service in step with the auth store: start it when a session
 * is authenticated, stop it on sign out. Returns an unsubscribe function.
 * No-op when sync is disabled (local-only mode).
 */
export function bindSyncToAuth(): () => void {
  if (!isSyncActive()) return () => {};

  const apply = (state: { status: string; userId: string | null }) => {
    if (state.status === "authed" && state.userId) {
      start(state.userId);
    } else if (state.status === "anon") {
      stop();
    }
  };

  apply(useAuthStore.getState());
  return useAuthStore.subscribe(apply);
}

/**
 * Drain the sync queue and push all pending ops to Supabase.
 * Each op is removed from the queue only after a successful push.
 */
export function flush(): Promise<void> {
  if (!isSyncActive()) return Promise.resolve();
  if (_flushInFlight) return _flushInFlight;

  _flushInFlight = runFlush().finally(() => {
    _flushInFlight = null;
  });
  return _flushInFlight;
}

async function runFlush(): Promise<void> {
  const generation = _generation;
  const supabase = getSupabaseClient();

  const sessionUserId = await getSessionUserId(supabase);
  if (!sessionUserId) return;

  const ops = await drain();

  for (const op of ops) {
    if (generation !== _generation) return; // user switched / sync stopped
    // Ops queued by another account stay queued until that account signs in.
    if (op.userId !== sessionUserId) continue;

    try {
      const parsed = JSON.parse(op.row as string) as Record<string, unknown>;

      // Demo rows must never reach the cloud: drop the op instead of retrying.
      if (op.table === "meal_entries" && op.op === "upsert") {
        const normalized = normalizeQueuedPayload(op.table, parsed, op.userId);
        if (isDemoMealEntry(normalized)) {
          await remove(op.id);
          continue;
        }
      }

      if (op.op === "upsert") {
        // Queue rows persisted before the mappers existed are camelCase
        const payload = normalizeQueuedPayload(op.table, parsed, op.userId);
        // Real upsert: edits must overwrite the remote row (meal_entries by
        // id, profile by user_id). Only the backfill ignores duplicates.
        const { error } = await supabase.from(op.table).upsert(payload, {
          onConflict: op.table === "meal_entries" ? "id" : "user_id",
        });

        if (error) throw error;
      } else if (op.op === "delete") {
        const payload = parsed;
        if (payload.bulk) {
          // Bulk delete by date + meal_type
          const { error } = await supabase
            .from(op.table)
            .delete()
            .eq("user_id", op.userId)
            .eq("date", payload.date as string)
            .eq("meal_type", payload.meal_type as string);

          if (error) throw error;
        } else {
          const { error } = await supabase
            .from(op.table)
            .delete()
            .eq("id", payload.id as string)
            .eq("user_id", op.userId);

          if (error) throw error;
        }
      }

      await remove(op.id);
    } catch (err) {
      // Leave op in queue — it will be retried on next flush
      console.warn(`[syncService] flush: op ${op.id} failed, will retry:`, err);
    }
  }
}

/**
 * Full reconcile: push local-only rows to remote, pull remote-only rows to local.
 * Profile conflict resolved by last-write-wins (updatedAt).
 * After reconcile, triggers store reload so UI reflects the merged state.
 */
export async function reconcile(userId: string): Promise<void> {
  if (!isSyncActive()) return;

  const supabase = getSupabaseClient();
  const generation = _generation;
  const isStale = () => generation !== _generation;

  try {
    const sessionUserId = await getSessionUserId(supabase);
    if (!sessionUserId || sessionUserId !== userId || isStale()) return;

    // ── Profile reconcile ─────────────────────────────────────────────
    const localProfile = await profileRepo.getProfile();

    const { data: remoteProfileData, error: profileError } = await supabase
      .from("users_profile")
      .select("*")
      .eq("user_id", userId)
      .single();
    if (isStale()) return;

    // PGRST116 = row not found
    if (profileError && profileError.code !== "PGRST116") {
      console.warn("[syncService] reconcile: profile fetch failed:", profileError);
    } else {
      const remoteProfile = (remoteProfileData as RemoteProfile | null) ?? null;

      // A local profile owned by another account must never be uploaded.
      const canPushProfile =
        !!localProfile && (localProfile.userId == null || localProfile.userId === sessionUserId);

      if (localProfile && !remoteProfile) {
        if (canPushProfile) await pushProfile(supabase, localProfile, userId);
      } else if (remoteProfile && !localProfile) {
        await profileRepo.replaceProfileFromRemote(profileFromRemote(remoteProfile));
      } else if (localProfile && remoteProfile) {
        // LWW: keep whichever has the newer updatedAt
        const localTs = new Date(localProfile.updatedAt).getTime();
        const remoteTs = new Date(remoteProfile.updated_at).getTime();

        if (remoteTs > localTs) {
          await profileRepo.replaceProfileFromRemote(profileFromRemote(remoteProfile));
        } else if (localTs > remoteTs && canPushProfile) {
          await pushProfile(supabase, localProfile, userId);
        }
      }
    }

    // ── Meal entries reconcile ────────────────────────────────────────
    // Pull remote rows not present locally
    const { data: remoteEntries, error: entriesError } = await supabase
      .from("meal_entries")
      .select("*")
      .eq("user_id", userId);
    if (isStale()) return;

    if (entriesError) {
      console.warn("[syncService] reconcile: meal_entries fetch failed:", entriesError);
    } else if (remoteEntries) {
      for (const remote of remoteEntries as RemoteMealEntry[]) {
        if (isStale()) return;
        // Demo rows must never be ingested locally on any device.
        if (isDemoMealEntry(remote)) continue;
        // Check if entry exists locally
        let existsLocally = false;
        if (dexieAdapter) {
          const localEntry = await dexieAdapter.mealEntries.getByDate(remote.date);
          existsLocally = localEntry.some((e) => e.id === remote.id);
        } else {
          const rows = await db
            .select()
            .from(mealEntriesTable)
            .where(eq(mealEntriesTable.id, remote.id))
            .limit(1);
          existsLocally = rows.length > 0;
        }

        if (!existsLocally) {
          // Insert remote entry locally (without re-enqueuing)
          const localEntry = mealEntryFromRemote(remote) as NewMealEntry;
          try {
            if (dexieAdapter) {
              await dexieAdapter.mealEntries.insert(localEntry);
            } else {
              await db.insert(mealEntriesTable).values(localEntry);
            }
          } catch {
            // Skip duplicate or constraint errors on pull
          }
        }
      }
    }

    // Push local entries (last 30 days) not in remote. Older history is
    // covered once per user by backfillMealEntries().
    const today = new Date().toISOString().slice(0, 10);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    let localEntries: MealEntry[] = [];
    const dexie = dexieAdapter;
    if (dexie) {
      // Collect last 30 days for efficiency
      const dates: string[] = [];
      for (let i = 0; i < 30; i++) {
        const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        dates.push(d);
      }
      const allEntries = await Promise.all(dates.map((d) => dexie.mealEntries.getByDate(d)));
      localEntries = allEntries.flat();
    } else {
      const { and, gte, lte } = await import("drizzle-orm");
      localEntries = await db
        .select()
        .from(mealEntriesTable)
        .where(and(gte(mealEntriesTable.date, thirtyDaysAgo), lte(mealEntriesTable.date, today)));
    }

    const remoteIds = new Set(((remoteEntries ?? []) as RemoteMealEntry[]).map((e) => e.id));
    const missing = localEntries.filter(
      (e) =>
        !remoteIds.has(e.id) &&
        !isDemoMealEntry(e) &&
        (e.userId == null || e.userId === sessionUserId)
    );
    if (isStale()) return;

    if (!entriesError && missing.length > 0) {
      const { error } = await supabase.from("meal_entries").upsert(
        missing.map((e) => mealEntryToRemote(e, userId)),
        { onConflict: "id", ignoreDuplicates: true }
      );
      if (error) {
        console.warn("[syncService] reconcile: meal_entries push failed:", error);
      }
    }

    // Reload stores after reconcile
    await useProfileStore.getState().load();
    await useDayStore.getState().loadEntries();
  } catch (err) {
    console.error("[syncService] reconcile failed:", err);
  }
}

async function pushProfile(
  supabase: ReturnType<typeof getSupabaseClient>,
  profile: UserProfile,
  userId: string
): Promise<void> {
  const { error } = await supabase
    .from("users_profile")
    .upsert(profileToRemote(profile, userId), { onConflict: "user_id" });
  if (error) {
    console.warn("[syncService] reconcile: profile push failed:", error);
  }
}

function backfillFlagKey(userId: string): string {
  return `${BACKFILL_FLAG_PREFIX}${userId}`;
}

function isBackfillDone(userId: string): boolean {
  try {
    return localStorage.getItem(backfillFlagKey(userId)) === "1";
  } catch {
    return false;
  }
}

function markBackfillDone(userId: string): void {
  try {
    localStorage.setItem(backfillFlagKey(userId), "1");
  } catch {
    // Storage unavailable — the backfill will simply run again next time
    // (it is idempotent thanks to ignoreDuplicates).
  }
}

/**
 * Upload the complete local meal history (no date cap) to Supabase.
 *
 * - user_id always comes from the authenticated session, never from local rows
 * - upserts in batches of <=500 with insert-if-not-exists semantics
 * - stops at the first failed batch; the "done" flag (per user, localStorage)
 *   is persisted only after every batch succeeds
 *
 * Returns true when the backfill is complete (now or previously).
 */
export function backfillMealEntries(userId: string): Promise<boolean> {
  if (!isSyncActive()) return Promise.resolve(false);

  const inFlight = _backfillInFlight.get(userId);
  if (inFlight) return inFlight;

  const run = runBackfill(userId).finally(() => {
    _backfillInFlight.delete(userId);
  });
  _backfillInFlight.set(userId, run);
  return run;
}

async function runBackfill(userId: string): Promise<boolean> {
  if (isBackfillDone(userId)) return true;

  try {
    const supabase = getSupabaseClient();
    const { data } = await supabase.auth.getSession();
    const sessionUserId = data.session?.user.id;
    if (!sessionUserId) {
      console.warn("[syncService] backfill: no authenticated session, skipping");
      return false;
    }

    // Only rows that are unowned or owned by this session user may be uploaded;
    // rows left on the device by another account must never be re-stamped.
    const entries = (await mealEntriesRepo.getAll()).filter(
      (e) => !isDemoMealEntry(e) && (e.userId == null || e.userId === sessionUserId)
    );
    const generation = _generation;

    for (let i = 0; i < entries.length; i += BACKFILL_BATCH_SIZE) {
      if (generation !== _generation) return false;
      const batch = entries
        .slice(i, i + BACKFILL_BATCH_SIZE)
        .map((e) => mealEntryToRemote(e, sessionUserId));

      const { error } = await supabase
        .from("meal_entries")
        .upsert(batch, { onConflict: "id", ignoreDuplicates: true });

      if (error) {
        console.warn(`[syncService] backfill: batch at offset ${i} failed:`, error);
        return false;
      }
    }

    markBackfillDone(userId);
    return true;
  } catch (err) {
    console.warn("[syncService] backfill failed:", err);
    return false;
  }
}

/**
 * Full sync: flush queue, backfill full history once, then reconcile.
 * Call this after login or on reconnect.
 */
export async function sync(userId: string): Promise<void> {
  if (!isSyncActive()) return;
  const generation = _generation;
  // Remove leftover demo rows first so their remote deletes ride this flush.
  // Needs a real session; cleanupDemoData never throws.
  const supabase = getSupabaseClient();
  const sessionUserId = await getSessionUserId(supabase);
  if (sessionUserId && sessionUserId === userId) await cleanupDemoData(sessionUserId);
  if (generation !== _generation) return;
  await flush();
  if (generation !== _generation) return;
  await backfillMealEntries(userId);
  if (generation !== _generation) return;
  await reconcile(userId);
}
