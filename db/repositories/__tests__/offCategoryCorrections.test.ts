/**
 * OFF-category-correction counter contract test — exercises the real Dexie
 * adapter implementation (fake-indexeddb), proving the counter persists and
 * is readable back through the actual repo surface (not a reimplementation).
 *
 * The OPFS/SQLite path (db/repositories/offCategoryCorrections.ts) shares the
 * identical single-aggregate-row SQL pattern already covered end-to-end by
 * the SQLite-proxy harness in src/db/__tests__/repository-contract.test.ts
 * (same onConflictDoUpdate + sql`... + 1` idiom used elsewhere in that repo
 * layer); this file focuses on the Dexie contract, which has its own
 * hand-written increment logic (read-then-put) that needs direct coverage.
 *
 * Design: raw-cooked-conversion D5 (sdd/raw-cooked-conversion/design) — single
 * aggregate row (id=1), increment + read.
 */
import { createDexieAdapter } from "@/src/db/dexie-adapter";

describe("offCategoryCorrections — Dexie (fake-indexeddb)", () => {
  function makeAdapter() {
    return createDexieAdapter(`corrections-${Date.now()}-${Math.random()}`);
  }

  // Note: Dexie.close() dispatches a CustomEvent which is not available in
  // Node's test environment (see src/db/__tests__/repository-contract.test.ts
  // for the same established convention) — we skip explicit close() and rely
  // on a fresh, uniquely-named db per test for isolation instead.

  it("getCount returns 0 when no correction has ever been recorded", async () => {
    const adapter = makeAdapter();
    await adapter.ready;

    expect(await adapter.offCategoryCorrections.getCount()).toBe(0);
  });

  it("increment() creates the aggregate row and sets count to 1 on first call", async () => {
    const adapter = makeAdapter();
    await adapter.ready;

    await adapter.offCategoryCorrections.increment();

    expect(await adapter.offCategoryCorrections.getCount()).toBe(1);
  });

  it("increment() increments the existing aggregate row on subsequent calls", async () => {
    const adapter = makeAdapter();
    await adapter.ready;

    await adapter.offCategoryCorrections.increment();
    await adapter.offCategoryCorrections.increment();
    await adapter.offCategoryCorrections.increment();

    expect(await adapter.offCategoryCorrections.getCount()).toBe(3);
  });

  it("persists across adapter instances against the same underlying database name", async () => {
    const dbName = `corrections-persist-${Date.now()}-${Math.random()}`;
    const first = createDexieAdapter(dbName);
    await first.ready;
    await first.offCategoryCorrections.increment();

    const second = createDexieAdapter(dbName);
    await second.ready;
    expect(await second.offCategoryCorrections.getCount()).toBe(1);
  });
});
