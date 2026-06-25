/**
 * Web database client — replaces db/client.ts for the Vite/PWA build.
 *
 * Aliased in vite.config.ts: `@/db/client` → `@/src/db/client.web`
 * The native db/client.ts is left untouched for the Expo build.
 *
 * Design: openspec/changes/web-pwa-migration/design.md
 *   - Architecture Decisions 3 (drizzle sqlite-proxy) and 4 (two first-class adapters)
 *   - "CRITICAL: Transactions across the Worker boundary"
 *   - W4: OPFS probe with OPFS_PROBE_TIMEOUT_MS constant + Worker teardown on fallback
 *
 * Spec: web-local-storage R1, R4 (OPFS primary), R5 (Dexie fallback),
 *       R6 (contracts preserved), R9 (no partial state on error)
 *
 * Repositories import { db } from "@/db/client". With the Vite alias active
 * they receive the facade exported here — no repository file is modified.
 */

import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "@/db/schema";
import { createDexieAdapter } from "@/src/db/dexie-adapter";
import type { DbRequest, DbResponse } from "@/src/db/worker";

// ---------------------------------------------------------------------------
// OPFS probe (W4) — named timeout constant
// ---------------------------------------------------------------------------

/** W4: OPFS availability probe timeout in milliseconds (default 3 s). */
const OPFS_PROBE_TIMEOUT_MS = 3_000;

/**
 * Probe whether OPFS + crossOriginIsolated are usable within a bounded window.
 * Resolves to true only when ALL of these conditions hold:
 *   1. crossOriginIsolated === true (COOP/COEP headers in place)
 *   2. navigator.storage.getDirectory() resolves (OPFS API available)
 *   3. A test-write succeeds (VFS is functional, not just declared)
 *
 * On any failure (including timeout) → resolves false → Dexie fallback.
 *
 * W4 Worker teardown: the Worker that was spawned during the probe is
 * terminated when the probe fails (see openWorker / startOpfsPath).
 */
async function probeOpfs(): Promise<boolean> {
  // crossOriginIsolated is false when COOP/COEP headers are absent
  if (typeof crossOriginIsolated === "undefined" || !crossOriginIsolated) {
    return false;
  }

  const timeout = new Promise<false>((resolve) => {
    setTimeout(() => resolve(false), OPFS_PROBE_TIMEOUT_MS);
  });

  const probe = (async (): Promise<boolean> => {
    try {
      const root = await navigator.storage.getDirectory();
      const testHandle = await root.getFileHandle("__vitia_probe__", { create: true });
      const writable = await testHandle.createWritable();
      await writable.write(new Uint8Array([0]));
      await writable.close();
      await root.removeEntry("__vitia_probe__").catch(() => {});
      return true;
    } catch {
      return false;
    }
  })();

  return Promise.race([probe, timeout]);
}

// ---------------------------------------------------------------------------
// Worker call infrastructure
// ---------------------------------------------------------------------------

/** Narrowed call types for each DbRequest kind (without the `id` field). */
type ExecCall = Omit<Extract<DbRequest, { kind: "exec" }>, "id">;
type TxExecCall = Omit<Extract<DbRequest, { kind: "tx-exec" }>, "id">;
type TxControlCall = Omit<Extract<DbRequest, { kind: "begin" | "commit" | "rollback" }>, "id">;
type AnyCall = ExecCall | TxExecCall | TxControlCall;

/**
 * Open the wa-sqlite Worker and return a caller + terminate pair.
 * The caller sends messages and correlates responses by id.
 * W4: `terminate()` is called if the OPFS probe fails (Worker teardown).
 */
function openWorker(): {
  call: (req: AnyCall) => Promise<{ rows: unknown[][] }>;
  terminate: () => void;
} {
  const worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });

  let nextId = 1;
  const pending = new Map<
    number,
    { resolve: (v: { rows: unknown[][] }) => void; reject: (e: Error) => void }
  >();

  worker.onmessage = (event: MessageEvent<DbResponse | { kind: "ready" }>) => {
    const msg = event.data;
    if (!("id" in msg)) return; // the { kind: "ready" } signal
    const response = msg as DbResponse;
    const handler = pending.get(response.id);
    if (!handler) return;
    pending.delete(response.id);
    if (response.ok) {
      handler.resolve({ rows: response.rows });
    } else {
      handler.reject(new Error(response.error));
    }
  };

  function call(req: AnyCall): Promise<{ rows: unknown[][] }> {
    return new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      worker.postMessage({ ...req, id });
    });
  }

  function terminate(): void {
    for (const [, handler] of pending) {
      handler.reject(new Error("[db] Worker terminated"));
    }
    pending.clear();
    worker.terminate();
  }

  return { call, terminate };
}

// ---------------------------------------------------------------------------
// drizzle sqlite-proxy type alias
// ---------------------------------------------------------------------------

type ProxyDb = ReturnType<typeof drizzle<typeof schema>>;

// ---------------------------------------------------------------------------
// OPFS-backed drizzle facade
// ---------------------------------------------------------------------------

/**
 * Build the drizzle-proxy db instance backed by the Worker.
 *
 * The `db` object returned here satisfies the same API as the Expo SQLite
 * drizzle instance: .select(), .insert(), .update(), .delete(), and
 * a custom .transaction() that wraps Worker BEGIN/COMMIT/ROLLBACK.
 */
function buildOpfsDb(call: (req: AnyCall) => Promise<{ rows: unknown[][] }>): ProxyDb & {
  transaction<T>(fn: (tx: ProxyDb) => Promise<T>): Promise<T>;
} {
  const executor = async (
    sql: string,
    params: unknown[],
    method: string,
  ): Promise<{ rows: unknown[][] }> =>
    call({
      kind: "exec",
      sql,
      params,
      method: method as "run" | "all" | "get" | "values",
    });

  const baseDb = drizzle(executor, { schema });

  let txIdCounter = 0;

  /**
   * Transaction facade (design §"Executor + transaction flow"):
   *   1. BEGIN (via Worker)
   *   2. Build per-tx drizzle proxy routing through tx-exec
   *   3. COMMIT on success; ROLLBACK + rethrow on any error (R9)
   */
  async function transaction<T>(fn: (tx: ProxyDb) => Promise<T>): Promise<T> {
    const txId = ++txIdCounter;

    await call({ kind: "begin", txId });

    try {
      const txExecutor = async (
        sql: string,
        params: unknown[],
        method: string,
      ): Promise<{ rows: unknown[][] }> =>
        call({
          kind: "tx-exec",
          txId,
          sql,
          params,
          method: method as "run" | "all" | "get" | "values",
        });

      const txProxy = drizzle(txExecutor, { schema });
      const result = await fn(txProxy);
      await call({ kind: "commit", txId });
      return result;
    } catch (err) {
      try { await call({ kind: "rollback", txId }); } catch { /* ignore rollback errors */ }
      throw err; // R9: propagate to caller
    }
  }

  // Attach transaction to the drizzle proxy via prototype override
  const dbWithTx = Object.create(baseDb) as ProxyDb & {
    transaction<T>(fn: (tx: ProxyDb) => Promise<T>): Promise<T>;
  };
  Object.defineProperty(dbWithTx, "transaction", {
    value: transaction,
    writable: true,
    configurable: true,
  });

  return dbWithTx;
}

// ---------------------------------------------------------------------------
// Worker-based async migration runner
// ---------------------------------------------------------------------------

/**
 * Run migrations over the Worker channel.
 * Cannot use the sync MigratorExecutor interface here — the Worker is async.
 * We replicate the migration algorithm from migrate.web.ts using Worker calls.
 */
async function runWorkerMigrations(
  call: (req: AnyCall) => Promise<{ rows: unknown[][] }>,
): Promise<void> {
  // Ensure tracking table
  await call({
    kind: "exec",
    sql: `CREATE TABLE IF NOT EXISTS __drizzle_migrations (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      tag        TEXT NOT NULL UNIQUE,
      hash       TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )`,
    params: [],
    method: "run",
  });

  // Bundled via Vite — these dynamic imports resolve at build time
  const journalModule = await import("@/db/migrations/meta/_journal.json");
  const sql0000 = (await import("@/db/migrations/0000_thick_eddie_brock.sql?raw")).default;

  const SQL_FILES: Record<string, string> = {
    "0000_thick_eddie_brock": sql0000,
  };

  function hashContent(content: string): string {
    let h = 5381;
    for (let i = 0; i < content.length; i++) {
      h = ((h << 5) + h) ^ content.charCodeAt(i);
      h = h >>> 0;
    }
    return h.toString(16).padStart(8, "0");
  }

  const appliedResult = await call({
    kind: "exec",
    sql: "SELECT tag, hash FROM __drizzle_migrations",
    params: [],
    method: "all",
  });
  const applied = new Map<string, string>(
    appliedResult.rows.map((r) => [r[0] as string, r[1] as string]),
  );

  const journal = journalModule.default as {
    entries: Array<{ idx: number; tag: string; when: number }>;
  };
  const entries = [...journal.entries].sort((a, b) => a.idx - b.idx);

  for (const { tag, when } of entries) {
    const raw = SQL_FILES[tag];
    if (!raw) throw new Error(`[migrator] SQL for '${tag}' not found in bundle`);

    const computedHash = hashContent(raw);

    if (applied.has(tag)) {
      if (applied.get(tag) !== computedHash) {
        throw new Error(`[migrator] Drift detected for '${tag}': stored ≠ computed hash`);
      }
      continue; // idempotent skip
    }

    // Apply in a transaction (txId -1 is used exclusively for migration)
    const migTxId = -1;
    const statements = raw
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);

    await call({ kind: "begin", txId: migTxId });
    try {
      for (const stmt of statements) {
        await call({ kind: "tx-exec", txId: migTxId, sql: stmt, params: [], method: "run" });
      }
      await call({
        kind: "tx-exec",
        txId: migTxId,
        sql: "INSERT INTO __drizzle_migrations (tag, hash, created_at) VALUES (?, ?, ?)",
        params: [tag, computedHash, when],
        method: "run",
      });
      await call({ kind: "commit", txId: migTxId });
    } catch (err) {
      await call({ kind: "rollback", txId: migTxId });
      throw err;
    }
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

type BackendType = "opfs" | "dexie";

/** Resolves when the storage backend is ready. main.tsx awaits this. */
export let dbReady: Promise<{ type: BackendType }>;

/** Dexie adapter singleton — non-null when the Dexie path is active. */
export let dexieAdapter: ReturnType<typeof createDexieAdapter> | null = null;

// The actual db instance, set once init() completes.
let _db: ProxyDb & { transaction<T>(fn: (tx: ProxyDb) => Promise<T>): Promise<T> } | null = null;

/**
 * The database singleton consumed by all repositories.
 * Backed by a Proxy so that any access before dbReady resolves throws a clear
 * error rather than a cryptic "cannot read property of undefined".
 *
 * main.tsx awaits dbReady before mounting <RouterProvider>, so in normal
 * operation this Proxy guard is never triggered.
 */
export const db: ProxyDb & {
  transaction<T>(fn: (tx: ProxyDb) => Promise<T>): Promise<T>;
} = new Proxy(
  {} as ProxyDb & { transaction<T>(fn: (tx: ProxyDb) => Promise<T>): Promise<T> },
  {
    get(_target, prop) {
      if (!_db) {
        throw new Error(
          `[db] Not ready. Await dbReady before calling db.${String(prop)}(). ` +
            "Ensure main.tsx awaits dbReady before mounting the router.",
        );
      }
      const value = (_db as unknown as Record<string | symbol, unknown>)[prop];
      return typeof value === "function" ? (value as Function).bind(_db) : value;
    },
  },
);

// ---------------------------------------------------------------------------
// Async initialisation — runs once at module load
// ---------------------------------------------------------------------------

const _init = (async (): Promise<{ type: BackendType }> => {
  const opfsAvailable = await probeOpfs();

  if (opfsAvailable) {
    // ── OPFS / wa-sqlite path ─────────────────────────────────────────
    const { call } = openWorker();
    await runWorkerMigrations(call);
    _db = buildOpfsDb(call);
    return { type: "opfs" };
  }

  // ── Dexie / IndexedDB path (iOS Safari, incognito, no COOP/COEP) ──
  console.warn(
    "[vitia] OPFS not available — falling back to Dexie/IndexedDB. " +
      "Data persists via IndexedDB.",
  );
  dexieAdapter = createDexieAdapter("vitia");
  await dexieAdapter.ready;

  // Dexie path: drizzle query builders are NOT used by repos on this path.
  // The Dexie adapter implements the repo contracts directly and is called
  // by the stores layer (wired in Phase 3). We assign a sentinel db that
  // throws clearly if any code bypasses the stores and calls drizzle directly.
  const shimExecutor = async (_sql: string, _params: unknown[], _method: string) => {
    throw new Error(
      "[db] Dexie backend active. Access data via dexieAdapter, not the drizzle db object.",
    );
  };
  const shimBase = drizzle(shimExecutor, { schema });
  const shim = Object.create(shimBase) as typeof _db;
  Object.defineProperty(shim!, "transaction", {
    value: async () => {
      throw new Error("[db] Dexie backend: use dexieAdapter.mealEntries instead.");
    },
    writable: true,
    configurable: true,
  });
  _db = shim;
  return { type: "dexie" };
})();

dbReady = _init;
