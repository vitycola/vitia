/**
 * Tests for src/db/migrate.web.ts — exercises the from-scratch web migrator.
 * Layer: query-translation/contract (uses better-sqlite3 in-memory; no Worker)
 *
 * Spec:
 *   - R2: first run creates all tables; subsequent run is idempotent (Scenario 2.4)
 *   - Statement splitting on '--> statement-breakpoint' delimiter
 *   - __drizzle_migrations tracking table ensures idempotent re-runs
 *   - Hash drift detected and throws
 */

import { type MigratorExecutor, runWebMigrations } from "@/src/db/migrate.web";
import Database from "better-sqlite3";

/** Build a MigratorExecutor backed by a fresh in-memory better-sqlite3 DB. */
function makeInMemoryExecutor(): { executor: MigratorExecutor; db: Database.Database } {
  const db = new Database(":memory:");

  const executor: MigratorExecutor = {
    run(sql: string): void {
      db.exec(sql);
    },
    query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T[] {
      return db.prepare(sql).all(...params) as T[];
    },
    execute(sql: string, params: unknown[] = []): void {
      db.prepare(sql).run(...params);
    },
  };

  return { executor, db };
}

describe("runWebMigrations", () => {
  it("creates the __drizzle_migrations tracking table on first run", async () => {
    const { executor, db } = makeInMemoryExecutor();
    await runWebMigrations(executor);

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='__drizzle_migrations'")
      .all();
    expect(tables).toHaveLength(1);
  });

  it("creates all three app tables on first run (R2 / Scenario 2.1)", async () => {
    const { executor, db } = makeInMemoryExecutor();
    await runWebMigrations(executor);

    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('foods','meal_entries','users_profile') ORDER BY name"
      )
      .all() as { name: string }[];

    expect(tables.map((t) => t.name)).toEqual(["foods", "meal_entries", "users_profile"]);
  });

  it("records all migration tags in __drizzle_migrations after first run", async () => {
    const { executor, db } = makeInMemoryExecutor();
    await runWebMigrations(executor);

    const rows = db.prepare("SELECT tag FROM __drizzle_migrations ORDER BY id").all() as {
      tag: string;
    }[];
    // Five migrations: 0000, 0001, 0002, 0003, and 0004
    expect(rows).toHaveLength(5);
    expect(rows[0].tag).toBe("0000_thick_eddie_brock");
    expect(rows[1].tag).toBe("0001_name_normalized");
    expect(rows[2].tag).toBe("0002_user_session_persistence");
    expect(rows[3].tag).toBe("0003_food_detail");
    expect(rows[4].tag).toBe("0004_favorites_meal_type");
  });

  it("is idempotent — second run applies nothing (Scenario 2.4)", async () => {
    const { executor, db } = makeInMemoryExecutor();
    await runWebMigrations(executor);
    await runWebMigrations(executor); // second run

    // Still exactly five migration rows — no duplicate inserts
    const rows = db.prepare("SELECT COUNT(*) as c FROM __drizzle_migrations").get() as {
      c: number;
    };
    expect(rows.c).toBe(5);
  });

  it("applies migrations in journal idx order (multi-migration ordered apply)", async () => {
    const { executor, db } = makeInMemoryExecutor();
    await runWebMigrations(executor);

    // After both migrations the foods table must have the name_normalized column
    const columns = db.prepare("PRAGMA table_info(foods)").all() as { name: string }[];
    const colNames = columns.map((c) => c.name);
    expect(colNames).toContain("name_normalized");

    // The index added by 0001 must also exist
    const indexes = db
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'")
      .all() as { name: string }[];
    const indexNames = indexes.map((i) => i.name);
    expect(indexNames).toContain("foods_name_normalized_idx");
  });

  it("statement count — 0000 has 4 indexes, 0001 adds 1, 0003 adds 1 more (6 total)", async () => {
    // 0000: CREATE INDEX foods_name_idx, foods_off_code_idx,
    //       meal_entries_date_idx, meal_entries_date_meal_idx = 4
    // 0001: CREATE INDEX foods_name_normalized_idx = 1 more → 5
    // 0003: CREATE UNIQUE INDEX user_favorite_foods_user_food_idx = 1 more → 6 total
    const { executor, db } = makeInMemoryExecutor();
    await runWebMigrations(executor);

    const indexes = db
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'")
      .all() as { name: string }[];

    expect(indexes.length).toBe(6);
  });

  it("throws on hash drift — modified SQL content after migration applied", async () => {
    const { executor } = makeInMemoryExecutor();
    await runWebMigrations(executor);

    // Tamper: update the stored hash to simulate drift
    executor.execute(
      "UPDATE __drizzle_migrations SET hash = 'badhash' WHERE tag = '0000_thick_eddie_brock'"
    );

    await expect(runWebMigrations(executor)).rejects.toThrow(/drift/i);
  });

  it("preserves existing data across re-runs (Scenario 2.4)", async () => {
    const { executor, db } = makeInMemoryExecutor();
    await runWebMigrations(executor);

    // Insert a test row in users_profile
    db.exec(`
      INSERT INTO users_profile (id, age, height_cm, weight_kg, sex, activity_level, goal,
        calorie_goal, protein_goal_g, carbs_goal_g, fat_goal_g, use_manual_goals, created_at, updated_at)
      VALUES (1, 30, 175, 70, 'male', 'sedentary', 'maintain', 2000, 150, 250, 65, 0,
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);

    await runWebMigrations(executor); // second run

    const row = db.prepare("SELECT age FROM users_profile WHERE id = 1").get() as { age: number };
    expect(row.age).toBe(30);
  });
});
