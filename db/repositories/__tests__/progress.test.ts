/**
 * Progress repository contract suite — parameterized over BOTH storage
 * backends, mirroring src/db/__tests__/repository-contract.test.ts.
 *
 * Layer exercised:
 *   - OPFS/SQLite path: better-sqlite3 in-memory behind the sqlite-proxy
 *     executor (query-translation + Blob<->Buffer boundary conversion)
 *   - Dexie path: fake-indexeddb (Dexie adapter contract layer, native Blob)
 *
 * Spec: Create/Edit progress entry, Body-fat computed on write, carry-forward
 * Design: sdd/progress-log/design — Photo storage strategy, Navy method
 *         input mapping, bodyFatPct carry-forward
 */

import * as schema from "@/db/schema";
import type { NewProgressEntry } from "@/db/schema";
import type { ProgressProfileInput } from "@/src/db/dexie-adapter";
import { createDexieAdapter } from "@/src/db/dexie-adapter";
import { type MigratorExecutor, runWebMigrations } from "@/src/db/migrate.web";
import Database from "better-sqlite3";
import { and, asc, between, desc, eq, isNotNull, lt } from "drizzle-orm";
import { drizzle as drizzleProxy } from "drizzle-orm/sqlite-proxy";

// ---------------------------------------------------------------------------
// Shared backend interface (progress-only slice)
// ---------------------------------------------------------------------------

interface ProgressPhotoInput {
  blob: Blob;
  mimeType: string;
}

interface ProgressUpsertInput {
  date: string;
  userId?: string | null;
  weightKg?: number | null;
  neckCm?: number | null;
  chestCm?: number | null;
  armCm?: number | null;
  waistCm?: number | null;
  hipCm?: number | null;
  thighCm?: number | null;
  notes?: string | null;
  photos: ProgressPhotoInput[];
}

interface ProgressBackend {
  name: string;
  getByDate(date: string): Promise<(schema.ProgressEntry & { photos: unknown[] }) | null>;
  getRange(from: string, to: string): Promise<schema.ProgressEntry[]>;
  upsertByDate(
    input: ProgressUpsertInput,
    profile: ProgressProfileInput | null
  ): Promise<schema.ProgressEntry>;
  getPhotos(entryId: string): Promise<Array<{ id: string; blob: Blob; mimeType: string }>>;
  getLatestBodyFat(beforeDate?: string): Promise<number | null>;
  deleteByDate(date: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// SQLite-proxy backend (better-sqlite3 in-memory) — exercises the pure repo
// logic directly against schema.progressEntries/progressPhotos, including
// the Blob<->Buffer boundary conversion (drizzle-orm 0.44.1 types blob
// columns as Buffer, not Uint8Array).
// ---------------------------------------------------------------------------

function makeSqliteProxyBackend(): ProgressBackend & { _ready: Promise<void> } {
  const bsDb = new Database(":memory:");

  const migrationExecutor: MigratorExecutor = {
    run(sql) {
      bsDb.exec(sql);
    },
    query<T>(sql: string, params: unknown[] = []) {
      return bsDb.prepare(sql).all(...params) as T[];
    },
    execute(sql: string, params: unknown[] = []) {
      bsDb.prepare(sql).run(...params);
    },
  };

  const _ready = runWebMigrations(migrationExecutor);

  function execSync(
    sql: string,
    params: unknown[],
    method: "run" | "all" | "get" | "values"
  ): { rows: unknown[][] } {
    const stmt = bsDb.prepare(sql);
    if (method === "run") {
      stmt.run(...params);
      return { rows: [] };
    }
    if (method === "get") {
      const row = stmt.get(...params) as Record<string, unknown> | undefined;
      return row ? { rows: [Object.values(row)] } : { rows: [] };
    }
    const rows = stmt.all(...params) as Record<string, unknown>[];
    return { rows: rows.map((r) => Object.values(r)) };
  }

  const db = drizzleProxy(
    async (sql, params, method) =>
      execSync(sql, params, method as "run" | "all" | "get" | "values"),
    { schema }
  );

  let txTail: Promise<void> = Promise.resolve();
  function runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    const next = txTail.then(() => fn());
    txTail = next.then(
      () => {},
      () => {}
    );
    return next;
  }

  async function transaction<T>(fn: (tx: typeof db) => Promise<T>): Promise<T> {
    return runExclusive(async () => {
      bsDb.exec("BEGIN");
      try {
        const txProxy = drizzleProxy(
          async (sql, params, method) =>
            execSync(sql, params, method as "run" | "all" | "get" | "values"),
          { schema }
        );
        const result = await fn(txProxy);
        bsDb.exec("COMMIT");
        return result;
      } catch (err) {
        try {
          bsDb.exec("ROLLBACK");
        } catch {
          /* already rolled back or closed */
        }
        throw err;
      }
    });
  }

  async function blobToBuffer(blob: Blob): Promise<Buffer> {
    const arrayBuffer = await blob.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  function bufferToBlob(buffer: Buffer, mimeType: string): Blob {
    return new Blob([new Uint8Array(buffer)], { type: mimeType });
  }

  async function getPhotos(entryId: string) {
    const rows = await db
      .select()
      .from(schema.progressPhotos)
      .where(eq(schema.progressPhotos.entryId, entryId))
      .orderBy(asc(schema.progressPhotos.position));
    return rows.map((row) => ({
      id: row.id,
      blob: bufferToBlob(row.blob, row.mimeType),
      mimeType: row.mimeType,
    }));
  }

  async function getLatestBodyFat(beforeDate?: string) {
    const whereClause = beforeDate
      ? and(
          isNotNull(schema.progressEntries.bodyFatPct),
          lt(schema.progressEntries.date, beforeDate)
        )
      : isNotNull(schema.progressEntries.bodyFatPct);

    const rows = await db
      .select({ bodyFatPct: schema.progressEntries.bodyFatPct })
      .from(schema.progressEntries)
      .where(whereClause)
      .orderBy(desc(schema.progressEntries.date))
      .limit(1);
    return rows[0]?.bodyFatPct ?? null;
  }

  return {
    name: "SQLite-proxy (better-sqlite3 in-memory)",
    _ready,

    async getByDate(date) {
      const rows = await db
        .select()
        .from(schema.progressEntries)
        .where(eq(schema.progressEntries.date, date))
        .limit(1);
      const entry = rows[0];
      if (!entry) return null;
      const photos = await getPhotos(entry.id);
      return { ...entry, photos };
    },

    async getRange(from, to) {
      return db
        .select()
        .from(schema.progressEntries)
        .where(between(schema.progressEntries.date, from, to))
        .orderBy(asc(schema.progressEntries.date));
    },

    getPhotos,
    getLatestBodyFat,

    async upsertByDate(input, profile) {
      // Import lazily to avoid a hard dependency cycle in the test harness.
      const { computeNavyBodyFat } = await import("@/lib/bodyFat");
      const { generateId } = await import("@/lib/id");

      return transaction(async (tx) => {
        const existingRows = await tx
          .select()
          .from(schema.progressEntries)
          .where(eq(schema.progressEntries.date, input.date))
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
          .insert(schema.progressEntries)
          .values({
            id,
            userId: input.userId ?? existing?.userId ?? null,
            date: input.date,
            weightKg: input.weightKg ?? null,
            neckCm: input.neckCm ?? null,
            chestCm: input.chestCm ?? null,
            armCm: input.armCm ?? null,
            waistCm: input.waistCm ?? null,
            hipCm: input.hipCm ?? null,
            thighCm: input.thighCm ?? null,
            bodyFatPct,
            notes: input.notes ?? null,
            createdAt: existing?.createdAt,
            updatedAt: now,
          } satisfies NewProgressEntry)
          .onConflictDoUpdate({
            target: schema.progressEntries.date,
            set: {
              weightKg: input.weightKg ?? null,
              neckCm: input.neckCm ?? null,
              chestCm: input.chestCm ?? null,
              armCm: input.armCm ?? null,
              waistCm: input.waistCm ?? null,
              hipCm: input.hipCm ?? null,
              thighCm: input.thighCm ?? null,
              bodyFatPct,
              notes: input.notes ?? null,
              updatedAt: now,
            },
          })
          .returning();
        const entry = entryRows[0];

        await tx.delete(schema.progressPhotos).where(eq(schema.progressPhotos.entryId, entry.id));

        if (input.photos.length > 0) {
          const photoValues = await Promise.all(
            input.photos.map(async (photo, index) => ({
              id: generateId(),
              entryId: entry.id,
              blob: await blobToBuffer(photo.blob),
              mimeType: photo.mimeType,
              position: index,
            }))
          );
          await tx.insert(schema.progressPhotos).values(photoValues);
        }

        return entry;
      });
    },

    async deleteByDate(date) {
      return transaction(async (tx) => {
        const rows = await tx
          .select()
          .from(schema.progressEntries)
          .where(eq(schema.progressEntries.date, date))
          .limit(1);
        const existing = rows[0];
        if (!existing) return;

        await tx
          .delete(schema.progressPhotos)
          .where(eq(schema.progressPhotos.entryId, existing.id));
        await tx.delete(schema.progressEntries).where(eq(schema.progressEntries.id, existing.id));
      });
    },
  };
}

// ---------------------------------------------------------------------------
// Dexie backend (fake-indexeddb)
// ---------------------------------------------------------------------------

function makeDexieBackend(): ProgressBackend & { _ready: Promise<void> } {
  const adapter = createDexieAdapter(`vitia-progress-test-${Math.random().toString(36).slice(2)}`);

  return {
    name: "Dexie/IndexedDB (fake-indexeddb)",
    _ready: adapter.ready,

    async getByDate(date) {
      return adapter.progress.getByDate(date);
    },
    async getRange(from, to) {
      return adapter.progress.getRange(from, to);
    },
    async upsertByDate(input, profile) {
      return adapter.progress.upsertByDate(input, profile);
    },
    async getPhotos(entryId) {
      return adapter.progress.getPhotos(entryId);
    },
    async getLatestBodyFat(beforeDate) {
      return adapter.progress.getLatestBodyFat(beforeDate);
    },
    async deleteByDate(date) {
      return adapter.progress.deleteByDate(date);
    },
  };
}

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function makePhoto(overrides: Partial<ProgressPhotoInput> = {}): ProgressPhotoInput {
  return {
    blob: new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" }),
    mimeType: "image/png",
    ...overrides,
  };
}

const MALE_PROFILE: ProgressProfileInput = { sex: "male", heightCm: 180 };
const FEMALE_PROFILE: ProgressProfileInput = { sex: "female", heightCm: 165 };

// ---------------------------------------------------------------------------
// Parameterized contract suite
// ---------------------------------------------------------------------------

describe.each([
  ["SQLite-proxy (better-sqlite3 in-memory)", makeSqliteProxyBackend],
  ["Dexie/IndexedDB (fake-indexeddb)", makeDexieBackend],
] as const)("Progress repository contract — %s", (_backendName, makeBackend) => {
  let backend: ProgressBackend & { _ready: Promise<void> };

  beforeEach(async () => {
    backend = makeBackend();
    await backend._ready;
  });

  describe("getByDate", () => {
    it("returns null when no record exists for the date", async () => {
      const result = await backend.getByDate("2026-01-01");
      expect(result).toBeNull();
    });
  });

  describe("upsertByDate — create", () => {
    it("creates a row for a new date with weight only", async () => {
      const entry = await backend.upsertByDate(
        { date: "2026-02-01", weightKg: 70, photos: [] },
        null
      );
      expect(entry.date).toBe("2026-02-01");
      expect(entry.weightKg).toBe(70);

      const fetched = await backend.getByDate("2026-02-01");
      expect(fetched?.weightKg).toBe(70);
    });

    it("computes and stores bodyFatPct when sufficient inputs are provided (male)", async () => {
      const entry = await backend.upsertByDate(
        { date: "2026-02-02", neckCm: 38, waistCm: 85, photos: [] },
        MALE_PROFILE
      );
      expect(entry.bodyFatPct).toBe(16.1);
    });

    it("computes and stores bodyFatPct when sufficient inputs are provided (female, requires hip)", async () => {
      const entry = await backend.upsertByDate(
        { date: "2026-02-03", neckCm: 32, waistCm: 70, hipCm: 95, photos: [] },
        FEMALE_PROFILE
      );
      expect(entry.bodyFatPct).toBe(24.9);
    });

    it("stores bodyFatPct as null when inputs are insufficient and no prior value exists", async () => {
      const entry = await backend.upsertByDate(
        { date: "2026-02-04", weightKg: 70, photos: [] },
        MALE_PROFILE
      );
      expect(entry.bodyFatPct).toBeNull();
    });

    it("carries forward the last non-null bodyFatPct when current inputs are insufficient", async () => {
      await backend.upsertByDate(
        { date: "2026-02-05", neckCm: 38, waistCm: 85, photos: [] },
        MALE_PROFILE
      );
      // Second entry has no measurements — should carry forward 16.1.
      const entry = await backend.upsertByDate(
        { date: "2026-02-06", weightKg: 71, photos: [] },
        MALE_PROFILE
      );
      expect(entry.bodyFatPct).toBe(16.1);
    });

    it("creates progress_photos rows for attached photos", async () => {
      const entry = await backend.upsertByDate(
        { date: "2026-02-07", photos: [makePhoto(), makePhoto()] },
        null
      );
      const photos = await backend.getPhotos(entry.id);
      expect(photos).toHaveLength(2);
      expect(photos[0].mimeType).toBe("image/png");
      expect(photos[0].blob).toBeInstanceOf(Blob);
    });
  });

  describe("upsertByDate — edit (overwrite, no duplicate row)", () => {
    it("overwrites the existing record for the same date instead of creating a duplicate", async () => {
      const first = await backend.upsertByDate(
        { date: "2026-03-01", weightKg: 70, photos: [] },
        null
      );
      const second = await backend.upsertByDate(
        { date: "2026-03-01", weightKg: 72, photos: [] },
        null
      );

      expect(second.id).toBe(first.id);

      const range = await backend.getRange("2026-03-01", "2026-03-01");
      expect(range).toHaveLength(1);
      expect(range[0].weightKg).toBe(72);
    });

    it("replaces photos on edit — old photos removed, new photos inserted", async () => {
      const first = await backend.upsertByDate(
        { date: "2026-03-02", photos: [makePhoto(), makePhoto()] },
        null
      );
      const firstPhotos = await backend.getPhotos(first.id);
      expect(firstPhotos).toHaveLength(2);
      const firstPhotoIds = firstPhotos.map((p) => p.id);

      const second = await backend.upsertByDate(
        { date: "2026-03-02", photos: [makePhoto()] },
        null
      );
      const secondPhotos = await backend.getPhotos(second.id);
      expect(secondPhotos).toHaveLength(1);
      expect(firstPhotoIds).not.toContain(secondPhotos[0].id);
    });

    it("pre-fills with previously stored values (edit mode read-back)", async () => {
      await backend.upsertByDate(
        { date: "2026-03-03", weightKg: 68, neckCm: 37, waistCm: 80, photos: [] },
        null
      );

      const fetched = await backend.getByDate("2026-03-03");
      expect(fetched?.weightKg).toBe(68);
      expect(fetched?.neckCm).toBe(37);
      expect(fetched?.waistCm).toBe(80);
    });
  });

  describe("upsertByDate — chest/arm/thigh measurements (spec: Body measurement fields)", () => {
    it("round-trips chestCm, armCm, thighCm through create and read-back", async () => {
      const entry = await backend.upsertByDate(
        { date: "2026-03-10", chestCm: 100, armCm: 32, thighCm: 55, photos: [] },
        null
      );
      expect(entry.chestCm).toBe(100);
      expect(entry.armCm).toBe(32);
      expect(entry.thighCm).toBe(55);

      const fetched = await backend.getByDate("2026-03-10");
      expect(fetched?.chestCm).toBe(100);
      expect(fetched?.armCm).toBe(32);
      expect(fetched?.thighCm).toBe(55);
    });

    it("does not affect Navy body-fat computation (chest/arm/thigh alone yield null bodyFatPct)", async () => {
      const entry = await backend.upsertByDate(
        { date: "2026-03-11", chestCm: 100, armCm: 32, thighCm: 55, photos: [] },
        MALE_PROFILE
      );
      expect(entry.bodyFatPct).toBeNull();
    });
  });

  describe("getRange", () => {
    it("returns entries within [from, to] inclusive, ordered by date ascending", async () => {
      await backend.upsertByDate({ date: "2026-04-01", weightKg: 70, photos: [] }, null);
      await backend.upsertByDate({ date: "2026-04-03", weightKg: 71, photos: [] }, null);
      await backend.upsertByDate({ date: "2026-04-02", weightKg: 70.5, photos: [] }, null);

      const range = await backend.getRange("2026-04-01", "2026-04-03");
      expect(range.map((r) => r.date)).toEqual(["2026-04-01", "2026-04-02", "2026-04-03"]);
    });
  });

  describe("getLatestBodyFat", () => {
    it("returns null when no entry has a non-null bodyFatPct", async () => {
      await backend.upsertByDate({ date: "2026-05-01", weightKg: 70, photos: [] }, null);
      expect(await backend.getLatestBodyFat()).toBeNull();
    });

    it("returns the most recent non-null bodyFatPct across entries", async () => {
      await backend.upsertByDate(
        { date: "2026-05-01", neckCm: 38, waistCm: 85, photos: [] },
        MALE_PROFILE
      );
      await backend.upsertByDate(
        { date: "2026-05-10", neckCm: 39, waistCm: 90, photos: [] },
        MALE_PROFILE
      );

      const latest = await backend.getLatestBodyFat();
      expect(latest).not.toBeNull();
      // 2026-05-10 entry (waist 90) yields a higher body fat % than 05-01 (waist 85).
      const entry10 = await backend.getByDate("2026-05-10");
      expect(latest).toBe(entry10?.bodyFatPct);
    });
  });

  describe("deleteByDate (spec: Delete a day's progress entry)", () => {
    it("deletes the progress_entries row for the date", async () => {
      await backend.upsertByDate({ date: "2026-06-01", weightKg: 70, photos: [] }, null);

      await backend.deleteByDate("2026-06-01");

      const fetched = await backend.getByDate("2026-06-01");
      expect(fetched).toBeNull();
    });

    it("cascade-deletes progress_photos rows for that entry", async () => {
      const entry = await backend.upsertByDate(
        { date: "2026-06-02", photos: [makePhoto(), makePhoto()] },
        null
      );
      const photosBeforeDelete = await backend.getPhotos(entry.id);
      expect(photosBeforeDelete).toHaveLength(2);

      await backend.deleteByDate("2026-06-02");

      const photosAfterDelete = await backend.getPhotos(entry.id);
      expect(photosAfterDelete).toHaveLength(0);
    });

    it("is a no-op (does not throw) when deleting a non-existent date", async () => {
      await expect(backend.deleteByDate("2026-06-03")).resolves.not.toThrow();
    });
  });
});
