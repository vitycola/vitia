import { db } from "@/db/client";
import { progressEntries, progressPhotos } from "@/db/schema";
import type { NewProgressPhoto, ProgressEntry } from "@/db/schema";
import { computeNavyBodyFat } from "@/lib/bodyFat";
import { generateId } from "@/lib/id";
import { and, asc, between, desc, eq, isNotNull, lt } from "drizzle-orm";

export interface ProgressPhotoInput {
  blob: Blob;
  mimeType: string;
}

export interface ProgressInput {
  date: string;
  userId?: string | null;
  weightKg?: number | null;
  neckCm?: number | null;
  waistCm?: number | null;
  hipCm?: number | null;
  notes?: string | null;
  photos: ProgressPhotoInput[];
}

/** A photo attached to a progress entry — always a Blob at the repo boundary. */
export interface ProgressPhotoView {
  id: string;
  entryId: string;
  blob: Blob;
  mimeType: string;
  position: number;
}

export interface ProgressEntryWithPhotos extends ProgressEntry {
  photos: ProgressPhotoView[];
}

// ── Blob <-> Buffer boundary conversion ────────────────────────────────
// drizzle-orm 0.44.1 types blob({mode:"buffer"}) columns as Buffer, not
// Uint8Array. The repo normalizes so every caller (store/UI) always sees a
// Blob, regardless of which backend is active underneath.

async function blobToBuffer(blob: Blob): Promise<Buffer> {
  const arrayBuffer = await blob.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

function bufferToBlob(buffer: Buffer, mimeType: string): Blob {
  return new Blob([new Uint8Array(buffer)], { type: mimeType });
}

/**
 * Get the progress_entries row for a date, with its photos (ordered by
 * position), converting each photo's stored Buffer back into a Blob.
 * Returns null when no record exists for that date.
 */
export async function getByDate(date: string): Promise<ProgressEntryWithPhotos | null> {
  const rows = await db
    .select()
    .from(progressEntries)
    .where(eq(progressEntries.date, date))
    .limit(1);
  const entry = rows[0];
  if (!entry) return null;

  const photos = await getPhotos(entry.id);
  return { ...entry, photos };
}

/**
 * Get all progress_entries rows whose date falls within [from, to] inclusive,
 * ordered by date ascending. Does not include photos (dashboard/list use only).
 */
export async function getRange(from: string, to: string): Promise<ProgressEntry[]> {
  return db
    .select()
    .from(progressEntries)
    .where(between(progressEntries.date, from, to))
    .orderBy(asc(progressEntries.date));
}

/**
 * Get a progress_entries row's photos, ordered by position, with the stored
 * Buffer converted back to a Blob at the boundary.
 */
export async function getPhotos(entryId: string): Promise<ProgressPhotoView[]> {
  const rows = await db
    .select()
    .from(progressPhotos)
    .where(eq(progressPhotos.entryId, entryId))
    .orderBy(asc(progressPhotos.position));
  return rows.map((row) => ({
    id: row.id,
    entryId: row.entryId,
    blob: bufferToBlob(row.blob, row.mimeType),
    mimeType: row.mimeType,
    position: row.position,
  }));
}

/**
 * Return the most recent non-null bodyFatPct across all progress_entries
 * (optionally restricted to entries before a given date), or null when none
 * exists. Used for the write-time carry-forward rule (spec: Insufficient
 * inputs fall back to last known value).
 */
export async function getLatestBodyFat(beforeDate?: string): Promise<number | null> {
  const whereClause = beforeDate
    ? and(isNotNull(progressEntries.bodyFatPct), lt(progressEntries.date, beforeDate))
    : isNotNull(progressEntries.bodyFatPct);

  const rows = await db
    .select({ bodyFatPct: progressEntries.bodyFatPct, date: progressEntries.date })
    .from(progressEntries)
    .where(whereClause)
    .orderBy(desc(progressEntries.date))
    .limit(1);

  return rows[0]?.bodyFatPct ?? null;
}

/**
 * Create or overwrite the progress_entries record for a date (upsert keyed
 * on the unique date index), replacing its photos, all inside a single
 * transaction. bodyFatPct is computed via the Navy method from this write's
 * inputs; when inputs are insufficient, carries forward the most recent
 * non-null bodyFatPct value, or stores null when none exists.
 *
 * profileInput carries the sex/heightCm needed for the Navy formula — these
 * live on usersProfile, not on progress_entries, so the caller (dispatching
 * repo) resolves and passes them in.
 */
export async function upsertByDate(
  input: ProgressInput,
  profile: { sex: "male" | "female"; heightCm: number } | null
): Promise<ProgressEntry> {
  return db.transaction(async (tx) => {
    const existingRows = await tx
      .select()
      .from(progressEntries)
      .where(eq(progressEntries.date, input.date))
      .limit(1);
    const existing = existingRows[0];

    const computed = profile
      ? computeNavyBodyFat({
          sex: profile.sex,
          heightCm: profile.heightCm,
          neckCm: input.neckCm,
          waistCm: input.waistCm,
          hipCm: input.hipCm,
        })
      : null;

    let bodyFatPct = computed;
    if (bodyFatPct === null) {
      bodyFatPct = await getLatestBodyFat();
    }

    const now = new Date().toISOString();
    const id = existing?.id ?? generateId();

    const entryRows = await tx
      .insert(progressEntries)
      .values({
        id,
        userId: input.userId ?? existing?.userId ?? null,
        date: input.date,
        weightKg: input.weightKg ?? null,
        neckCm: input.neckCm ?? null,
        waistCm: input.waistCm ?? null,
        hipCm: input.hipCm ?? null,
        bodyFatPct,
        notes: input.notes ?? null,
        createdAt: existing?.createdAt,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: progressEntries.date,
        set: {
          weightKg: input.weightKg ?? null,
          neckCm: input.neckCm ?? null,
          waistCm: input.waistCm ?? null,
          hipCm: input.hipCm ?? null,
          bodyFatPct,
          notes: input.notes ?? null,
          updatedAt: now,
        },
      })
      .returning();
    const entry = entryRows[0];

    // Replace-on-edit: delete old photos, insert new ones.
    await tx.delete(progressPhotos).where(eq(progressPhotos.entryId, entry.id));

    if (input.photos.length > 0) {
      const photoValues: NewProgressPhoto[] = await Promise.all(
        input.photos.map(async (photo, index) => ({
          id: generateId(),
          entryId: entry.id,
          blob: await blobToBuffer(photo.blob),
          mimeType: photo.mimeType,
          position: index,
        }))
      );
      await tx.insert(progressPhotos).values(photoValues);
    }

    return entry;
  });
}
