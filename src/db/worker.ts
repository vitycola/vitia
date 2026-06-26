/**
 * wa-sqlite Worker — runs in a dedicated Worker thread.
 *
 * Exposes a typed request/response protocol over postMessage so the main
 * thread can execute SQL statements, manage transactions, and receive results
 * without ever sharing the SQLite connection across threads.
 *
 * Design: openspec/changes/web-pwa-migration/design.md
 *   - "Worker message protocol (concrete)"
 *   - "Executor + transaction flow"
 *   - "CRITICAL: Transactions across the Worker boundary"
 *
 * Spec: web-local-storage R1, R4 (OPFS primary), R9 (no partial state on error)
 *
 * This file is a Vite Worker entry point. It is never imported directly in
 * the main thread or in Jest tests. The sqlite-proxy facade in
 * src/db/client.web.ts sends messages here; this Worker replies with
 * id-correlated responses.
 */

/// <reference lib="webworker" />

// ---------------------------------------------------------------------------
// Request / Response protocol
// ---------------------------------------------------------------------------

/** Statement result method — controls how the Worker steps the prepared stmt. */
type ExecMethod = "run" | "all" | "get" | "values";

/**
 * Messages the main thread sends to the Worker.
 * Every message carries a unique `id`; the Worker echoes it in the response.
 */
export type DbRequest =
  | {
      id: number;
      kind: "exec";
      sql: string;
      params: unknown[];
      method: ExecMethod;
    }
  | {
      id: number;
      kind: "begin" | "commit" | "rollback";
      txId: number;
    }
  | {
      id: number;
      kind: "tx-exec";
      txId: number;
      sql: string;
      params: unknown[];
      method: ExecMethod;
    };

/**
 * Messages the Worker sends back to the main thread.
 * On success: `ok: true, rows: unknown[][]`
 * On failure: `ok: false, error: string` (the waiting Promise rejects)
 */
export type DbResponse =
  | { id: number; ok: true; rows: unknown[][] }
  | { id: number; ok: false; error: string };

// ---------------------------------------------------------------------------
// OPFS probe timeout (W4)
// Defined here for proximity; actual enforcement is in src/db/client.web.ts.
// ---------------------------------------------------------------------------
export const OPFS_PROBE_TIMEOUT_MS = 3_000;

// ---------------------------------------------------------------------------
// wa-sqlite helpers — typed as `any` because the wa-sqlite types use
// ambient global declarations (declare interface SQLiteAPI) that are not
// exported from the module and are not available in the WebWorker lib context.
// ---------------------------------------------------------------------------

// biome-ignore lint/suspicious/noExplicitAny: wa-sqlite types use ambient globals not exported from the module
type SQLiteAny = any;

/**
 * Bind parameters to a prepared statement (1-based index).
 */
function bindParams(sqlite3: SQLiteAny, stmt: number, params: unknown[]): void {
  const { SQLITE_INTEGER: _INT, SQLITE_FLOAT: _FLOAT, SQLITE_TEXT: _TEXT } = sqlite3;

  for (let i = 0; i < params.length; i++) {
    const value = params[i];
    const col = i + 1;
    if (value === null || value === undefined) {
      sqlite3.bind_null(stmt, col);
    } else if (typeof value === "number") {
      if (Number.isInteger(value)) {
        sqlite3.bind_int(stmt, col, value);
      } else {
        sqlite3.bind_double(stmt, col, value);
      }
    } else if (typeof value === "string") {
      sqlite3.bind_text(stmt, col, value);
    } else if (value instanceof Uint8Array) {
      sqlite3.bind_blob(stmt, col, value);
    } else {
      sqlite3.bind_text(stmt, col, String(value));
    }
  }
}

/**
 * Execute a single SQL statement and collect rows as value arrays.
 *
 * S2 flag: INSERT...RETURNING must go through the row-collection path
 * (method 'all') so drizzle's returning() calls receive their rows.
 */
async function execStatement(
  sqlite3: SQLiteAny,
  db: number,
  sql: string,
  params: unknown[],
  method: ExecMethod
): Promise<unknown[][]> {
  const { SQLITE_ROW, SQLITE_INTEGER, SQLITE_FLOAT, SQLITE_TEXT, SQLITE_BLOB } = sqlite3;
  const rows: unknown[][] = [];

  // In wa-sqlite v1.0.0 statements() accepts a JS string directly and manages
  // WASM memory internally — passing a raw pointer (str_value) broke all queries.
  for await (const stmt of sqlite3.statements(db, sql)) {
    bindParams(sqlite3, stmt, params);

    if (method === "run") {
      while ((await sqlite3.step(stmt)) === SQLITE_ROW) {
        // Drain implicit result rows (e.g. ON CONFLICT DO UPDATE side effects)
      }
    } else {
      while ((await sqlite3.step(stmt)) === SQLITE_ROW) {
        const row: unknown[] = [];
        const colCount = sqlite3.column_count(stmt);
        for (let i = 0; i < colCount; i++) {
          const colType = sqlite3.column_type(stmt, i);
          if (colType === SQLITE_INTEGER) {
            row.push(sqlite3.column_int(stmt, i));
          } else if (colType === SQLITE_FLOAT) {
            row.push(sqlite3.column_double(stmt, i));
          } else if (colType === SQLITE_TEXT) {
            row.push(sqlite3.column_text(stmt, i));
          } else if (colType === SQLITE_BLOB) {
            row.push(sqlite3.column_blob(stmt, i));
          } else {
            row.push(null);
          }
        }
        rows.push(row);
        if (method === "get") break; // first row only
      }
    }
  }

  return rows;
}

// ---------------------------------------------------------------------------
// Worker initialisation
// ---------------------------------------------------------------------------

async function init(): Promise<{ sqlite3: SQLiteAny; db: number }> {
  // Dynamic imports keep the WASM out of the main bundle
  const { default: SQLiteESMFactory } = await import(
    /* @vite-ignore */
    "wa-sqlite/dist/wa-sqlite.mjs"
  );
  const SQLite = await import("wa-sqlite");

  const module = await SQLiteESMFactory();
  const sqlite3 = SQLite.Factory(module);

  let db: number;
  try {
    // AccessHandlePoolVFS is the synchronous OPFS VFS — works with wa-sqlite.mjs
    // (no Asyncify needed). Requires crossOriginIsolated (COOP/COEP headers).
    // JS-only file with no TypeScript types; `as any` suppresses TS2307.
    const opfsVfsModule = await import(
      // biome-ignore lint/suspicious/noExplicitAny: JS-only wa-sqlite file with no TS types; suppresses TS2307
      /* @vite-ignore */ "wa-sqlite/src/examples/AccessHandlePoolVFS.js" as any
    );
    const AccessHandlePoolVFS: new (
      directoryPath: string
    ) => SQLiteVFS & {
      isReady: Promise<void>;
    } = opfsVfsModule.AccessHandlePoolVFS;
    const vfs = new AccessHandlePoolVFS("vitia");
    await vfs.isReady;
    await sqlite3.vfs_register(vfs, true /* as default */);
    db = await sqlite3.open_v2(
      "vitia.db",
      0x00000002 | 0x00000004 // SQLITE_OPEN_READWRITE | SQLITE_OPEN_CREATE
    );
  } catch {
    // Fallback: in-memory SQLite (should not reach here if probe passed)
    db = await sqlite3.open_v2(":memory:");
  }

  return { sqlite3, db };
}

// ---------------------------------------------------------------------------
// Message handler
// ---------------------------------------------------------------------------

const activeTx = new Set<number>();
let sqlite3Ref: SQLiteAny = null;
let dbRef: number | null = null;

const ready = init().then(({ sqlite3, db }) => {
  sqlite3Ref = sqlite3;
  dbRef = db;
  postMessage({ kind: "ready" });
});

self.onmessage = async (event: MessageEvent<DbRequest>) => {
  await ready;
  const sqlite3 = sqlite3Ref as SQLiteAny;
  const db = dbRef as number;
  const req = event.data;

  try {
    switch (req.kind) {
      case "exec": {
        const rows = await execStatement(sqlite3, db, req.sql, req.params, req.method);
        postMessage({ id: req.id, ok: true, rows } satisfies DbResponse);
        break;
      }
      case "begin": {
        activeTx.add(req.txId);
        await execStatement(sqlite3, db, "BEGIN", [], "run");
        postMessage({ id: req.id, ok: true, rows: [] } satisfies DbResponse);
        break;
      }
      case "commit": {
        activeTx.delete(req.txId);
        await execStatement(sqlite3, db, "COMMIT", [], "run");
        postMessage({ id: req.id, ok: true, rows: [] } satisfies DbResponse);
        break;
      }
      case "rollback": {
        activeTx.delete(req.txId);
        try {
          await execStatement(sqlite3, db, "ROLLBACK", [], "run");
        } catch {
          /* ignore */
        }
        postMessage({ id: req.id, ok: true, rows: [] } satisfies DbResponse);
        break;
      }
      case "tx-exec": {
        if (!activeTx.has(req.txId)) {
          postMessage({
            id: req.id,
            ok: false,
            error: `[worker] tx-exec on unknown txId ${req.txId}`,
          } satisfies DbResponse);
          return;
        }
        const rows = await execStatement(sqlite3, db, req.sql, req.params, req.method);
        postMessage({ id: req.id, ok: true, rows } satisfies DbResponse);
        break;
      }
      default: {
        const exhaustive = req as never;
        postMessage({
          id: (exhaustive as DbRequest).id,
          ok: false,
          error: `[worker] unknown kind: ${String((exhaustive as DbRequest).kind)}`,
        } satisfies DbResponse);
      }
    }
  } catch (err) {
    postMessage({
      id: req.id,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    } satisfies DbResponse);
  }
};
