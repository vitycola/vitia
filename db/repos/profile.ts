/**
 * Dispatching profile repository.
 * Routes calls to Dexie adapter (IndexedDB) or drizzle implementation (OPFS/SQLite)
 * based on the active backend — without touching the pure drizzle files in
 * db/repositories/, which remain backend-agnostic (R6).
 */

import { dexieAdapter } from "@/db/client";
import * as _impl from "@/db/repositories/profile";
import type { NewUserProfile, UserProfile } from "@/db/schema";

export async function getProfile(): Promise<UserProfile | null> {
  if (dexieAdapter) return dexieAdapter.profile.getProfile();
  return _impl.getProfile();
}

export async function upsertProfile(data: Omit<NewUserProfile, "id">): Promise<UserProfile> {
  if (dexieAdapter) return dexieAdapter.profile.upsertProfile(data);
  return _impl.upsertProfile(data);
}
