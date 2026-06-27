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
import * as profileRepo from "@/db/repos/profile";
import { mealEntries as mealEntriesTable } from "@/db/schema";
import type { NewMealEntry } from "@/db/schema";
import { getSupabaseClient, isSyncEnabled } from "@/src/lib/supabase";
import { drain, remove } from "@/src/services/syncQueue";
import { useDayStore } from "@/stores/useDayStore";
import { useProfileStore } from "@/stores/useProfileStore";
import { eq } from "drizzle-orm";

let _cleanupFns: Array<() => void> = [];

/**
 * Start the sync service for the given user.
 * Registers online and visibilitychange listeners.
 * Safe to call multiple times — re-start cleans up previous listeners.
 */
export function start(userId: string): void {
  stop(); // clean up previous listeners if any

  if (!isSyncEnabled()) return;

  const handleOnline = () => {
    void flush();
    void reconcile(userId);
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
}

/**
 * Stop the sync service and remove all listeners.
 */
export function stop(): void {
  for (const fn of _cleanupFns) fn();
  _cleanupFns = [];
}

/**
 * Drain the sync queue and push all pending ops to Supabase.
 * Each op is removed from the queue only after a successful push.
 */
export async function flush(): Promise<void> {
  if (!isSyncEnabled()) return;

  const supabase = getSupabaseClient();
  const ops = await drain();

  for (const op of ops) {
    try {
      const payload = JSON.parse(op.row as string) as Record<string, unknown>;

      if (op.op === "upsert") {
        const { error } = await supabase.from(op.table).upsert(payload, {
          // meal_entries: insert-if-not-exists by id (UUID); profile: LWW by updated_at
          onConflict: op.table === "meal_entries" ? "id" : "user_id",
          ignoreDuplicates: op.table === "meal_entries",
        });

        if (error) throw error;
      } else if (op.op === "delete") {
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
  if (!isSyncEnabled()) return;

  const supabase = getSupabaseClient();

  try {
    // ── Profile reconcile ─────────────────────────────────────────────
    const localProfile = await profileRepo.getProfile();

    const { data: remoteProfile, error: profileError } = await supabase
      .from("users_profile")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (!profileError || profileError.code === "PGRST116") {
      // PGRST116 = row not found
      if (localProfile && !remoteProfile) {
        // Push local profile to remote
        await supabase.from("users_profile").upsert({
          ...localProfile,
          user_id: userId,
          updated_at: new Date().toISOString(),
        });
      } else if (remoteProfile && !localProfile) {
        // Pull remote profile to local
        const { user_id: _, ...profileData } = remoteProfile as Record<string, unknown>;
        void profileRepo.upsertProfile(
          profileData as Parameters<typeof profileRepo.upsertProfile>[0]
        );
      } else if (localProfile && remoteProfile) {
        // LWW: keep whichever has the newer updatedAt
        const localTs = new Date(localProfile.updatedAt).getTime();
        const remoteTs = new Date(
          (remoteProfile as Record<string, unknown>).updated_at as string
        ).getTime();

        if (remoteTs > localTs) {
          const { user_id: _, ...profileData } = remoteProfile as Record<string, unknown>;
          void profileRepo.upsertProfile(
            profileData as Parameters<typeof profileRepo.upsertProfile>[0]
          );
        } else if (localTs > remoteTs) {
          await supabase.from("users_profile").upsert({
            ...localProfile,
            user_id: userId,
            updated_at: new Date().toISOString(),
          });
        }
      }
    }

    // ── Meal entries reconcile ────────────────────────────────────────
    // Pull remote rows not present locally
    const { data: remoteEntries, error: entriesError } = await supabase
      .from("meal_entries")
      .select("*")
      .eq("user_id", userId);

    if (!entriesError && remoteEntries) {
      for (const remote of remoteEntries as Array<Record<string, unknown>>) {
        const entryId = remote.id as string;

        // Check if entry exists locally
        let existsLocally = false;
        if (dexieAdapter) {
          const localEntry = await dexieAdapter.mealEntries.getByDate(remote.date as string);
          existsLocally = localEntry.some((e) => e.id === entryId);
        } else {
          const rows = await db
            .select()
            .from(mealEntriesTable)
            .where(eq(mealEntriesTable.id, entryId))
            .limit(1);
          existsLocally = rows.length > 0;
        }

        if (!existsLocally) {
          // Insert remote entry locally (without re-enqueuing)
          const { user_id: _uid, ...entryData } = remote;
          const localEntry = entryData as NewMealEntry;
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

    // Push local entries not in remote
    const today = new Date().toISOString().slice(0, 10);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    let localEntries: Array<Record<string, unknown>> = [];
    const dexie = dexieAdapter;
    if (dexie) {
      // Collect last 30 days for efficiency
      const dates: string[] = [];
      for (let i = 0; i < 30; i++) {
        const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        dates.push(d);
      }
      const allEntries = await Promise.all(dates.map((d) => dexie.mealEntries.getByDate(d)));
      localEntries = allEntries.flat() as Array<Record<string, unknown>>;
    } else {
      const { and, gte, lte } = await import("drizzle-orm");
      const rows = await db
        .select()
        .from(mealEntriesTable)
        .where(and(gte(mealEntriesTable.date, thirtyDaysAgo), lte(mealEntriesTable.date, today)));
      localEntries = rows as Array<Record<string, unknown>>;
    }

    const remoteIds = new Set(
      (remoteEntries ?? []).map((e) => (e as Record<string, unknown>).id as string)
    );

    for (const local of localEntries) {
      if (!remoteIds.has(local.id as string)) {
        await supabase
          .from("meal_entries")
          .upsert({ ...local, user_id: userId }, { onConflict: "id", ignoreDuplicates: true });
      }
    }

    // Reload stores after reconcile
    await useProfileStore.getState().load();
    await useDayStore.getState().loadEntries();
  } catch (err) {
    console.error("[syncService] reconcile failed:", err);
  }
}

/**
 * Full sync: flush queue then reconcile.
 * Call this after login or on reconnect.
 */
export async function sync(userId: string): Promise<void> {
  await flush();
  await reconcile(userId);
}
