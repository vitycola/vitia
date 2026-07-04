/**
 * From-scratch web migrator for Vitia PWA.
 *
 * Replaces the RN-only babel-plugin-inline-import approach used by
 * db/migrate.ts. Imports SQL files via Vite `?raw` (which becomes a plain
 * string import in the browser build) and applies them in journal order via
 * a driver-agnostic MigratorExecutor interface.
 *
 * Design: openspec/changes/web-pwa-migration/design.md — "From-scratch web migrator"
 * Spec:   web-local-storage R2, Scenarios 2.1 and 2.4
 */

// Vite ?raw imports → raw SQL strings. The Jest SQL transform (jest.sql-transform.js)
// and the moduleNameMapper ("^(.+\\.sql)\\?raw$": "$1") together let this run in tests.
import sql0000 from "@/db/migrations/0000_thick_eddie_brock.sql?raw";
import sql0001 from "@/db/migrations/0001_name_normalized.sql?raw";
import sql0002 from "@/db/migrations/0002_user_session_persistence.sql?raw";
import sql0003 from "@/db/migrations/0003_food_detail.sql?raw";
import sql0004 from "@/db/migrations/0004_favorites_meal_type.sql?raw";
import journal from "@/db/migrations/meta/_journal.json";

/** Re-export the journal so runWorkerMigrations in db/client.ts can reuse it. */
export { journal as migrationJournal };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Driver-agnostic executor interface used by runWebMigrations.
 *
 * - wa-sqlite path: built from the Worker's exec channel
 * - Dexie path: N/A (Dexie uses declarative store definitions; the migrator
 *   is only called on the SQLite path)
 * - Test path: backed by better-sqlite3 in-memory DB (no Worker needed)
 */
export interface MigratorExecutor {
  /** Execute DDL or DML statements that return no rows. */
  run(sql: string): void;
  /** Execute a parameterised SELECT and return rows. */
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): T[];
  /** Execute a parameterised INSERT/UPDATE/DELETE. */
  execute(sql: string, params?: unknown[]): void;
}

interface MigrationRow {
  tag: string;
  hash: string;
}

// ---------------------------------------------------------------------------
// SQL file map — keyed by journal entry tag
// Exported so runWorkerMigrations in db/client.ts can reuse it without drift.
// ---------------------------------------------------------------------------

export const SQL_FILES: Record<string, string> = {
  "0000_thick_eddie_brock": sql0000,
  "0001_name_normalized": sql0001,
  "0002_user_session_persistence": sql0002,
  "0003_food_detail": sql0003,
  "0004_favorites_meal_type": sql0004,
};

// ---------------------------------------------------------------------------
// Tracking table DDL
// Exported so both migration paths share the exact same DDL.
// ---------------------------------------------------------------------------

export const CREATE_TRACKING_TABLE = `
CREATE TABLE IF NOT EXISTS __drizzle_migrations (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  tag        TEXT NOT NULL UNIQUE,
  hash       TEXT NOT NULL,
  created_at INTEGER NOT NULL
)`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Drizzle migration statement breakpoint delimiter. */
export const STATEMENT_BREAKPOINT = "--> statement-breakpoint";

/** Split a raw SQL migration file into individual executable statements. */
export function splitStatements(raw: string): string[] {
  return raw
    .split(STATEMENT_BREAKPOINT)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Compute a deterministic hash of a string.
 * Uses a simple djb2-style hash for portability across environments
 * (avoids requiring SubtleCrypto async + keeps the migrator synchronous).
 * The hash is stable for drift detection; it is NOT a security primitive.
 */
export function hashContent(content: string): string {
  let h = 5381;
  for (let i = 0; i < content.length; i++) {
    h = ((h << 5) + h) ^ content.charCodeAt(i);
    h = h >>> 0; // keep as unsigned 32-bit
  }
  return h.toString(16).padStart(8, "0");
}

/** The journal module type — shared between migration paths. */
export type MigrationJournal = {
  entries: Array<{ idx: number; tag: string; when: number }>;
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Run all pending migrations in journal order.
 *
 * Algorithm (design §"From-scratch web migrator"):
 *   1. Ensure __drizzle_migrations tracking table exists.
 *   2. For each journal entry (sorted by idx):
 *      a. If already applied AND hash matches → skip (idempotent).
 *      b. If already applied AND hash differs → throw (drift detected).
 *      c. If not applied → split SQL on breakpoints, execute each statement
 *         inside a BEGIN/COMMIT block, then insert tracking row.
 */
export async function runWebMigrations(executor: MigratorExecutor): Promise<void> {
  // Step 1: ensure tracking table
  executor.run(CREATE_TRACKING_TABLE);

  // Load applied migrations
  const applied = new Map<string, string>(
    executor
      .query<MigrationRow>("SELECT tag, hash FROM __drizzle_migrations")
      .map((r) => [r.tag, r.hash])
  );

  // Step 2: process entries in journal order (sorted by idx)
  const entries = [...journal.entries].sort((a, b) => a.idx - b.idx);

  for (const entry of entries) {
    const { tag, when } = entry;
    const raw = SQL_FILES[tag];

    if (raw === undefined) {
      throw new Error(`[migrator] SQL file for migration '${tag}' not found in SQL_FILES map`);
    }

    const computedHash = hashContent(raw);

    if (applied.has(tag)) {
      const storedHash = applied.get(tag) ?? "";
      if (storedHash !== computedHash) {
        throw new Error(
          `[migrator] Migration drift detected for '${tag}': stored hash '${storedHash}' ≠ computed '${computedHash}'. The .sql file was modified after it was applied. Do not edit applied migrations.`
        );
      }
      // Already applied and hash matches — skip
      continue;
    }

    // Not yet applied — execute inside a transaction
    const statements = splitStatements(raw);

    executor.run("BEGIN");
    try {
      for (const stmt of statements) {
        executor.run(stmt);
      }
      executor.execute(
        "INSERT INTO __drizzle_migrations (tag, hash, created_at) VALUES (?, ?, ?)",
        [tag, computedHash, when]
      );
      executor.run("COMMIT");
    } catch (err) {
      executor.run("ROLLBACK");
      throw err;
    }
  }
}
