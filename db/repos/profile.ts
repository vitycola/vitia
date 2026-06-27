/**
 * Dispatching profile repository.
 * Routes calls to Dexie adapter (IndexedDB) or drizzle implementation (OPFS/SQLite)
 * based on the active backend — without touching the pure drizzle files in
 * db/repositories/, which remain backend-agnostic (R6).
 *
 * When VITE_SYNC_ENABLED=true, each write also enqueues an outbound sync op
 * (fire-and-forget; never blocks the caller).
 */

import { dexieAdapter } from "@/db/client";
import * as _impl from "@/db/repositories/profile";
import type { NewUserProfile, UserProfile } from "@/db/schema";
import { isSyncEnabled } from "@/src/lib/supabase";
import { enqueue } from "@/src/services/syncQueue";
import { useAuthStore } from "@/src/stores/useAuthStore";

export async function getProfile(): Promise<UserProfile | null> {
  if (dexieAdapter) return dexieAdapter.profile.getProfile();
  return _impl.getProfile();
}

export async function upsertProfile(data: Omit<NewUserProfile, "id">): Promise<UserProfile> {
  const { userId } = useAuthStore.getState();

  if (dexieAdapter) {
    const profile = await dexieAdapter.profile.upsertProfile(data);
    _enqueueProfileOp(profile, userId);
    return profile;
  }

  const profile = await _impl.upsertProfile(data);
  _enqueueProfileOp(profile, userId);
  return profile;
}

// ── Private helpers ───────────────────────────────────────────────────

function _enqueueProfileOp(profile: UserProfile, userId: string | null): void {
  if (!isSyncEnabled() || !userId) return;

  void enqueue({
    table: "users_profile",
    op: "upsert",
    row: JSON.stringify({ ...profile, user_id: userId }),
    userId,
    updatedAt: new Date().toISOString(),
  });
}
