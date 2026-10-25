/**
 * Goal history repository contract suite — parameterized over BOTH backends.
 *
 * - SQLite path: the REAL drizzle repo (db/repositories/goalHistory.ts) run
 *   against better-sqlite3 in-memory behind a sqlite-proxy `db`, schema built
 *   by the real migrations.
 * - Dexie path: the real Dexie adapter on fake-indexeddb.
 */

jest.mock("@/db/client", () => {
  const Database = require("better-sqlite3");
  const { drizzle } = require("drizzle-orm/sqlite-proxy");
  const schema = require("@/db/schema");
  const { runWebMigrations } = require("@/src/db/migrate.web");

  const bsDb = new Database(":memory:");
  runWebMigrations({
    run: (sql: string) => bsDb.exec(sql),
    query: (sql: string, params: unknown[] = []) => bsDb.prepare(sql).all(...params),
    execute: (sql: string, params: unknown[] = []) => {
      bsDb.prepare(sql).run(...params);
    },
  });

  const db = drizzle(
    async (sql: string, params: unknown[], method: string) => {
      const stmt = bsDb.prepare(sql);
      if (method === "run") {
        stmt.run(...params);
        return { rows: [] };
      }
      const rows = stmt.all(...params) as Record<string, unknown>[];
      return { rows: rows.map((r) => Object.values(r)) };
    },
    { schema }
  );

  return { db, dexieAdapter: null, __bsDb: bsDb };
});

import * as sqliteRepo from "@/db/repositories/goalHistory";
import type { GoalHistoryEntry, NewGoalHistoryEntry } from "@/db/schema";
import { createDexieAdapter } from "@/src/db/dexie-adapter";

interface GoalHistoryBackend {
  list(userId: string): Promise<GoalHistoryEntry[]>;
  record(data: NewGoalHistoryEntry): Promise<GoalHistoryEntry>;
  replaceFromRemote(rows: NewGoalHistoryEntry[]): Promise<void>;
  adoptLocalOwned(userId: string): Promise<void>;
  remove(userId: string, effectiveFrom: string): Promise<void>;
}

function makeSqliteBackend(): GoalHistoryBackend {
  // The mocked in-memory DB is shared per test file: wipe it between tests.
  const { __bsDb } = jest.requireMock("@/db/client");
  __bsDb.exec("DELETE FROM goal_history");
  return sqliteRepo;
}

function makeDexieBackend(): GoalHistoryBackend {
  return createDexieAdapter(`goal-history-${Date.now()}-${Math.random()}`).goalHistory;
}

const goals = {
  calorieGoal: 2000,
  proteinGoalG: 150,
  carbsGoalG: 200,
  fatGoalG: 60,
  useManualGoals: false,
};
const A = "user-a";
const B = "user-b";
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

describe.each([
  ["SQLite-proxy (better-sqlite3 in-memory)", makeSqliteBackend],
  ["Dexie/IndexedDB (fake-indexeddb)", makeDexieBackend],
] as const)("goalHistory repository — %s", (_name, makeBackend) => {
  let backend: GoalHistoryBackend;

  beforeEach(() => {
    backend = makeBackend();
  });

  it("list returns an empty array when nothing was recorded", async () => {
    expect(await backend.list(A)).toEqual([]);
  });

  it("record inserts an entry and list returns entries oldest first", async () => {
    await backend.record({ userId: A, effectiveFrom: "2026-03-01", ...goals, calorieGoal: 2400 });
    await backend.record({ userId: A, effectiveFrom: "2026-01-01", ...goals });

    const rows = await backend.list(A);
    expect(rows.map((r) => r.effectiveFrom)).toEqual(["2026-01-01", "2026-03-01"]);
    expect(rows[1]).toMatchObject({ calorieGoal: 2400, useManualGoals: false, userId: A });
  });

  it("record always stamps ISO timestamps (never SQLite's zone-less default)", async () => {
    const entry = await backend.record({ userId: A, effectiveFrom: "2026-03-01", ...goals });
    const [stored] = await backend.list(A);

    for (const row of [entry, stored]) {
      expect(row.updatedAt).toMatch(ISO);
      expect(row.createdAt).toMatch(ISO);
    }
  });

  it("record on the same (user, effective_from) overwrites that day's entry", async () => {
    const first = await backend.record({ userId: A, effectiveFrom: "2026-02-01", ...goals });
    const second = await backend.record({
      userId: A,
      effectiveFrom: "2026-02-01",
      ...goals,
      calorieGoal: 2600,
      useManualGoals: true,
    });

    const rows = await backend.list(A);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ calorieGoal: 2600, useManualGoals: true });
    expect(second.createdAt).toBe(first.createdAt);
  });

  it("keeps each owner's history separate, even for the same day", async () => {
    await backend.record({ userId: A, effectiveFrom: "2026-02-01", ...goals, calorieGoal: 2000 });
    await backend.record({ userId: B, effectiveFrom: "2026-02-01", ...goals, calorieGoal: 1500 });

    expect((await backend.list(A)).map((r) => r.calorieGoal)).toEqual([2000]);
    expect((await backend.list(B)).map((r) => r.calorieGoal)).toEqual([1500]);
    expect(await backend.list("nobody")).toEqual([]);
  });

  it("replaceFromRemote writes rows preserving their timestamps and owner", async () => {
    const remote = {
      effectiveFrom: "2026-02-01",
      userId: A,
      ...goals,
      createdAt: "2026-02-01T08:00:00.000Z",
      updatedAt: "2026-02-01T09:00:00.000Z",
    };
    await backend.replaceFromRemote([remote]);
    await backend.replaceFromRemote([
      { ...remote, calorieGoal: 2100, updatedAt: "2026-02-02T09:00:00.000Z" },
    ]);

    const rows = await backend.list(A);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      userId: A,
      calorieGoal: 2100,
      updatedAt: "2026-02-02T09:00:00.000Z",
    });
  });

  it("adoptLocalOwned moves signed-out rows to the user, keeping days the user already has", async () => {
    await backend.record({ userId: "local", effectiveFrom: "2026-01-01", ...goals });
    await backend.record({
      userId: "local",
      effectiveFrom: "2026-02-01",
      ...goals,
      calorieGoal: 1,
    });
    await backend.record({ userId: A, effectiveFrom: "2026-02-01", ...goals, calorieGoal: 2222 });

    await backend.adoptLocalOwned(A);

    expect(await backend.list("local")).toEqual([]);
    const rows = await backend.list(A);
    expect(rows.map((r) => [r.effectiveFrom, r.calorieGoal])).toEqual([
      ["2026-01-01", 2000],
      ["2026-02-01", 2222],
    ]);
  });

  it("remove deletes only that owner's entry for that day", async () => {
    await backend.record({ userId: A, effectiveFrom: "2026-01-01", ...goals });
    await backend.record({ userId: A, effectiveFrom: "2026-02-01", ...goals });
    await backend.record({ userId: B, effectiveFrom: "2026-01-01", ...goals });

    await backend.remove(A, "2026-01-01");
    await backend.remove(A, "2099-01-01"); // absent: no-op

    expect((await backend.list(A)).map((r) => r.effectiveFrom)).toEqual(["2026-02-01"]);
    expect((await backend.list(B)).map((r) => r.effectiveFrom)).toEqual(["2026-01-01"]);
  });

  it("adoptLocalOwned never touches another account's rows", async () => {
    await backend.record({ userId: B, effectiveFrom: "2026-01-01", ...goals });
    await backend.record({ userId: "local", effectiveFrom: "2026-03-01", ...goals });

    await backend.adoptLocalOwned(A);

    expect((await backend.list(B)).map((r) => r.effectiveFrom)).toEqual(["2026-01-01"]);
    expect((await backend.list(A)).map((r) => r.effectiveFrom)).toEqual(["2026-03-01"]);
  });
});
