/**
 * Dispatching progress repository.
 * Routes calls to Dexie adapter (IndexedDB) or drizzle implementation (OPFS/SQLite)
 * based on the active backend — without touching the pure drizzle files in
 * db/repositories/, which remain backend-agnostic (R6).
 *
 * When VITE_SYNC_ENABLED=true, each write also enqueues an outbound sync op
 * for progress_entries only (progress_photos sync is deferred — see design).
 *
 * On the Dexie path photos stay native Blob (no Buffer conversion needed);
 * the Buffer<->Blob boundary conversion lives only in db/repositories/progress.ts
 * (the OPFS/drizzle path).
 */

import { dexieAdapter } from "@/db/client";
import * as profileRepo from "@/db/repos/profile";
import * as _impl from "@/db/repositories/progress";
import type { ProgressEntryWithPhotos, ProgressInput } from "@/db/repositories/progress";
import type { ProgressEntry } from "@/db/schema";
import { isSyncEnabled } from "@/src/lib/supabase";
import { enqueue } from "@/src/services/syncQueue";
import { useAuthStore } from "@/src/stores/useAuthStore";

export type {
  ProgressEntryWithPhotos,
  ProgressInput,
  ProgressPhotoInput,
  ProgressPhotoView,
} from "@/db/repositories/progress";

export async function getByDate(date: string): Promise<ProgressEntryWithPhotos | null> {
  if (dexieAdapter) return dexieAdapter.progress.getByDate(date);
  return _impl.getByDate(date);
}

export async function getRange(from: string, to: string): Promise<ProgressEntry[]> {
  if (dexieAdapter) return dexieAdapter.progress.getRange(from, to);
  return _impl.getRange(from, to);
}

/**
 * Get entries in [from, to] inclusive, each enriched with its photos,
 * excluding entries with zero photos (spec: Range+Photos Query Contract).
 * Used by the progress-photos gallery.
 */
export async function getPhotosInRange(
  from: string,
  to: string
): Promise<ProgressEntryWithPhotos[]> {
  if (dexieAdapter) return dexieAdapter.progress.getPhotosInRange(from, to);
  return _impl.getPhotosInRange(from, to);
}

/**
 * Create or overwrite the progress_entries record for input.date, computing
 * bodyFatPct via the Navy method (falling back to carry-forward, then null)
 * and replacing photos in the same transaction.
 */
export async function upsertByDate(input: ProgressInput): Promise<ProgressEntry> {
  const { userId } = useAuthStore.getState();
  const profile = await profileRepo.getProfile();
  const navyProfile = profile ? { sex: profile.sex, heightCm: profile.heightCm } : null;
  const withUser: ProgressInput = { ...input, userId: input.userId ?? userId ?? null };

  const entry = dexieAdapter
    ? await dexieAdapter.progress.upsertByDate(withUser, navyProfile)
    : await _impl.upsertByDate(withUser, navyProfile);

  _enqueueProgressOp(entry, userId);
  return entry;
}

/**
 * Delete the progress_entries record for a date, cascading to its photos.
 * Enqueues a delete sync op (mirrors upsertByDate's enqueue-on-write shape).
 */
export async function deleteByDate(date: string): Promise<void> {
  const { userId } = useAuthStore.getState();

  if (dexieAdapter) {
    await dexieAdapter.progress.deleteByDate(date);
  } else {
    await _impl.deleteByDate(date);
  }

  _enqueueProgressDelete(date, userId);
}

// ── Private helpers ───────────────────────────────────────────────────

function _enqueueProgressOp(entry: ProgressEntry, userId: string | null): void {
  if (!isSyncEnabled() || !userId) return;

  void enqueue({
    table: "progress_entries",
    op: "upsert",
    row: JSON.stringify({ ...entry, user_id: userId }),
    userId,
    updatedAt: new Date().toISOString(),
  });
}

function _enqueueProgressDelete(date: string, userId: string | null): void {
  if (!isSyncEnabled() || !userId) return;

  void enqueue({
    table: "progress_entries",
    op: "delete",
    row: JSON.stringify({ date, user_id: userId }),
    userId,
    updatedAt: new Date().toISOString(),
  });
}
