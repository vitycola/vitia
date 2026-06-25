/**
 * Web database client — the single db/client.ts for the web-only Vite/PWA build.
 *
 * Repositories import { db } from "@/db/client" and receive this facade directly.
 * No platform split needed in this web-only repo.
 *
 * Design: openspec/changes/web-pwa-migration/design.md
 *   - Architecture Decisions 3 (drizzle sqlite-proxy) and 4 (two first-class adapters)
 *   - "CRITICAL: Transactions across the Worker boundary"
 *   - W4: OPFS probe with OPFS_PROBE_TIMEOUT_MS constant
 *
 * Spec: web-local-storage R1, R4 (OPFS primary), R5 (Dexie fallback),
 *       R6 (contracts preserved), R9 (no partial state on error)
 */

import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "@/db/schema";
import { createDexieAdapter } from "@/src/db/dexie-adapter";
import type { DbRequest, DbResponse } from "@/src/db/worker";
import {
  SQL_FILES,
  CREATE_TRACKING_TABLE,
  STATEMENT_BREAKPOINT,
  hashContent,
  migrationJournal,
  type MigrationJournal,
} from "@/src/db/migrate.web";

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
 *
 * URL is relative to this file's source location (db/client.ts) and points at
 * src/db/worker.ts — Vite resolves it at build time into a hashed worker chunk.
 */
function openWorker(): {
  call: (req: AnyCall) => Promise<{ rows: unknown[][] }>;
  terminate: () => void;
  waitForReady: (timeoutMs: number) => Promise<void>;
} {
  const worker = new Worker(new URL("../src/db/worker.ts", import.meta.url), { type: "module" });

  let nextId = 1;
  const pending = new Map<
    number,
    { resolve: (v: { rows: unknown[][] }) => void; reject: (e: Error) => void }
  >();

  // Ready promise — resolves when the Worker posts { kind: "ready" }.
  let resolveReady!: () => void;
  let rejectReady!: (e: Error) => void;
  const readyPromise = new Promise<void>((res, rej) => {
    resolveReady = res;
    rejectReady = rej;
  });

  worker.onmessage = (event: MessageEvent<DbResponse | { kind: "ready" }>) => {
    const msg = event.data;
    if (!("id" in msg)) {
      // { kind: "ready" } signal from the Worker
      resolveReady();
      return;
    }
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

  worker.onerror = (ev) => {
    rejectReady(new Error(`[db] Worker error: ${ev.message}`));
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

  function waitForReady(timeoutMs: number): Promise<void> {
    return Promise.race([
      readyPromise,
      new Promise<void>((_, reject) =>
        setTimeout(
          () => reject(new Error(`[db] Worker readiness timeout after ${timeoutMs}ms`)),
          timeoutMs,
        ),
      ),
    ]);
  }

  return { call, terminate, waitForReady };
}

// ---------------------------------------------------------------------------
// FIFO async mutex — serialises transaction() calls across both backends
// ---------------------------------------------------------------------------

/**
 * A simple FIFO async mutex.
 *
 * Only one holder runs at a time; subsequent calls queue and execute in
 * arrival order once the current holder releases the lock.
 *
 * This prevents "cannot start a transaction within a transaction" when two
 * concurrent db.transaction() calls reach the Worker (or the Dexie adapter)
 * simultaneously.
 */
function createMutex() {
  let tail: Promise<void> = Promise.resolve();

  return {
    run<T>(fn: () => Promise<T>): Promise<T> {
      const next = tail.then(() => fn());
      // The tail must never reject — isolate errors so the queue keeps draining.
      tail = next.then(
        () => {},
        () => {},
      );
      return next;
    },
  };
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
 *
 * transaction() is serialized through a FIFO mutex so concurrent callers
 * never send BEGIN while another transaction is open on the Worker.
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
  const mutex = createMutex();

  /**
   * Transaction facade (design §"Executor + transaction flow"):
   *   1. Acquire FIFO mutex (serializes concurrent callers)
   *   2. BEGIN (via Worker)
   *   3. Build per-tx drizzle proxy routing through tx-exec
   *   4. COMMIT on success; ROLLBACK + rethrow on any error (R9)
   */
  async function transaction<T>(fn: (tx: ProxyDb) => Promise<T>): Promise<T> {
    return mutex.run(async () => {
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
    });
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
// Reuses shared constants/helpers from src/db/migrate.web.ts so both migration
// paths cannot silently diverge when a future migration is added.
// ---------------------------------------------------------------------------

/**
 * Run migrations over the Worker channel.
 * Cannot use the sync MigratorExecutor interface here — the Worker is async.
 * Shares SQL_FILES, CREATE_TRACKING_TABLE, STATEMENT_BREAKPOINT, hashContent,
 * and migrationJournal from migrate.web.ts to stay in sync with the tested path.
 */
async function runWorkerMigrations(
  call: (req: AnyCall) => Promise<{ rows: unknown[][] }>,
): Promise<void> {
  // Ensure tracking table — uses shared DDL constant
  await call({
    kind: "exec",
    sql: CREATE_TRACKING_TABLE,
    params: [],
    method: "run",
  });

  const journal = migrationJournal as MigrationJournal;

  const appliedResult = await call({
    kind: "exec",
    sql: "SELECT tag, hash FROM __drizzle_migrations",
    params: [],
    method: "all",
  });
  const applied = new Map<string, string>(
    appliedResult.rows.map((r) => [r[0] as string, r[1] as string]),
  );

  const entries = [...journal.entries].sort((a, b) => a.idx - b.idx);

  for (const { tag, when } of entries) {
    // SQL_FILES is the shared map from migrate.web.ts — same source of truth
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
    // STATEMENT_BREAKPOINT is the shared delimiter constant
    const statements = raw
      .split(STATEMENT_BREAKPOINT)
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
// Dexie fallback helper — extracted so both failure paths can reuse it
// ---------------------------------------------------------------------------

async function startDexiePath(): Promise<{ type: BackendType }> {
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

  // Dexie's own transaction() is already mutex-guarded per adapter method;
  // this shim throws if somehow called directly.
  Object.defineProperty(shim!, "transaction", {
    value: async () => {
      throw new Error("[db] Dexie backend: use dexieAdapter.mealEntries instead.");
    },
    writable: true,
    configurable: true,
  });
  _db = shim;
  return { type: "dexie" };
}

// ---------------------------------------------------------------------------
// Async initialisation — runs once at module load
// ---------------------------------------------------------------------------

const _init = (async (): Promise<{ type: BackendType }> => {
  const opfsAvailable = await probeOpfs();

  if (opfsAvailable) {
    // ── OPFS / wa-sqlite path ─────────────────────────────────────────
    const { call, terminate, waitForReady } = openWorker();

    try {
      // Wait for Worker WASM init + readiness signal within the probe timeout.
      // If the Worker hangs (WASM load failure, VFS error), this rejects and
      // we terminate the Worker and fall back to Dexie — never hang dbReady.
      await waitForReady(OPFS_PROBE_TIMEOUT_MS);
      await runWorkerMigrations(call);
      _db = buildOpfsDb(call);
      return { type: "opfs" };
    } catch (err) {
      console.warn(
        "[vitia] OPFS Worker init/migration failed — falling back to Dexie.",
        err,
      );
      terminate();
      return startDexiePath();
    }
  }

  // ── Dexie / IndexedDB path (iOS Safari, incognito, no COOP/COEP) ──
  return startDexiePath();
})();

dbReady = _init;
