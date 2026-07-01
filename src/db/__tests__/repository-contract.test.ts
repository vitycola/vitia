/**
 * Repository contract test suite — parameterized over BOTH storage backends.
 *
 * Layer exercised:
 *   - OPFS/SQLite path: better-sqlite3 in-memory behind the sqlite-proxy executor
 *     (query-translation and contract layer; the Worker message protocol is a
 *     browser-only concern and is NOT covered here — it requires a real Worker
 *     environment with wa-sqlite loaded)
 *   - Dexie path: fake-indexeddb (Dexie adapter contract layer)
 *
 * Spec: R1–R10, Scenarios 2.1–2.8 (web-local-storage.md)
 * Design: design.md — Verified Repository Contracts, Transaction facade, Dexie adapter
 *
 * Review flags addressed:
 *   - S2: INSERT...RETURNING uses method 'all', not 'run' (sqlite-proxy executor)
 *   - W2/S1: Dexie migration tracking idempotence (Scenario 2.4 on Dexie path)
 *   - W2: Dexie tx adapter atomicity — insertBulk rollback test (Scenario 2.7)
 */

import * as schema from "@/db/schema";
import type {
  Food,
  MealEntry,
  NewFood,
  NewMealEntry,
  NewUserProfile,
  UserProfile,
} from "@/db/schema";
import { normalizeForSearch } from "@/lib/search";
import { type DexieAdapter, createDexieAdapter } from "@/src/db/dexie-adapter";
import { type MigratorExecutor, runWebMigrations } from "@/src/db/migrate.web";
import Database from "better-sqlite3";
import { and, asc, eq, isNull, like } from "drizzle-orm";
import { drizzle as drizzleProxy } from "drizzle-orm/sqlite-proxy";

// ---------------------------------------------------------------------------
// Shared backend interface
// ---------------------------------------------------------------------------

interface RepositoryBackend {
  name: string;
  // Foods
  searchByName(query: string): Promise<Food[]>;
  getById(id: string): Promise<Food | null>;
  upsert(food: NewFood): Promise<Food>;
  insert(food: NewFood): Promise<Food>;
  getCustomFoods(): Promise<Food[]>;
  update(id: string, patch: Partial<Omit<NewFood, "id" | "createdAt">>): Promise<Food>;
  // Profile
  getProfile(): Promise<UserProfile | null>;
  upsertProfile(data: Omit<NewUserProfile, "id">): Promise<UserProfile>;
  // MealEntries
  getByDate(date: string): Promise<MealEntry[]>;
  getByDateAndMeal(date: string, mealType: MealEntry["mealType"]): Promise<MealEntry[]>;
  insertEntry(entry: NewMealEntry): Promise<MealEntry>;
  insertBulk(entries: NewMealEntry[]): Promise<MealEntry[]>;
  updateEntry(id: string, patch: Partial<Omit<NewMealEntry, "id">>): Promise<MealEntry>;
  remove(id: string): Promise<void>;
  deleteByDateAndMeal(date: string, mealType: MealEntry["mealType"]): Promise<void>;
  // Favorites
  isFavorite(foodId: string, userId: string | null): Promise<boolean>;
  toggleFavorite(foodId: string, userId: string | null): Promise<boolean>;
  listFavoriteFoodIds(userId: string | null): Promise<string[]>;
}

// ---------------------------------------------------------------------------
// SQLite-proxy backend (better-sqlite3 in-memory)
//
// This validates query-translation correctness: that drizzle's sqlite-proxy
// calls map to the right better-sqlite3 methods, especially:
//   S2: INSERT...RETURNING uses method 'all' (not 'run') so rows are returned.
// ---------------------------------------------------------------------------

function makeSqliteProxyBackend(): RepositoryBackend & { _ready: Promise<void> } {
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

  /**
   * Core executor for the sqlite-proxy driver.
   *
   * S2 flag: drizzle uses method 'all' for INSERT...RETURNING.
   * We MUST call stmt.all() (not stmt.run()) when method is 'all', otherwise
   * returning() calls return empty arrays and repos get undefined rows.
   */
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
    // 'all' and 'values' — covers SELECT and INSERT...RETURNING
    const rows = stmt.all(...params) as Record<string, unknown>[];
    return { rows: rows.map((r) => Object.values(r)) };
  }

  // The base drizzle proxy instance — has all select/insert/update/delete/etc.
  const db = drizzleProxy(
    async (sql, params, method) =>
      execSync(sql, params, method as "run" | "all" | "get" | "values"),
    { schema }
  );

  /**
   * FIFO async mutex — serialises concurrent transaction() calls.
   * Mirrors the mutex in buildOpfsDb (db/client.ts) to reproduce the same
   * fix in the test harness, proving the concurrency test would fail without it.
   */
  let txTail: Promise<void> = Promise.resolve();
  function runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    const next = txTail.then(() => fn());
    txTail = next.then(
      () => {},
      () => {}
    );
    return next;
  }

  /**
   * Transaction facade.
   * Mirrors the design (design.md "CRITICAL: Transactions across the Worker boundary"):
   *   Acquire mutex → BEGIN → run fn(txProxy) → COMMIT; on error → ROLLBACK + rethrow.
   * In tests we use the same better-sqlite3 connection (no Worker needed).
   * The mutex serializes concurrent callers — identical to the OPFS Worker path.
   */
  async function transaction<T>(fn: (tx: typeof db) => Promise<T>): Promise<T> {
    return runExclusive(async () => {
      bsDb.exec("BEGIN");
      try {
        // Per-tx proxy on the same connection — serialization is guaranteed by
        // the mutex above (same guarantee as the Worker's single-threaded model).
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

  return {
    name: "SQLite-proxy (better-sqlite3 in-memory)",
    _ready,

    // ── Foods ────────────────────────────────────────────────────────────

    async searchByName(query) {
      if (!query.trim()) return [];
      // Uses the real SQLite repo logic: search against name_normalized column
      // with LIKE, exactly as db/repositories/foods.ts does. The shared
      // normalizeForSearch helper ensures query and stored values are comparable.
      const normalizedQuery = normalizeForSearch(query);
      const rows = await db
        .select()
        .from(schema.foods)
        .where(like(schema.foods.nameNormalized, `%${normalizedQuery}%`))
        .limit(30);
      return rows;
    },

    async getById(id) {
      const rows = await db.select().from(schema.foods).where(eq(schema.foods.id, id)).limit(1);
      return rows[0] ?? null;
    },

    async upsert(food) {
      // S2: .returning() → drizzle calls executor with method 'all'
      const nameNormalized = normalizeForSearch(food.name);
      const rows = await db
        .insert(schema.foods)
        .values({ ...food, nameNormalized })
        .onConflictDoUpdate({
          target: schema.foods.id,
          set: {
            name: food.name,
            nameNormalized,
            brand: food.brand,
            caloriesPer100g: food.caloriesPer100g,
            proteinPer100g: food.proteinPer100g,
            carbsPer100g: food.carbsPer100g,
            fatPer100g: food.fatPer100g,
            servingSizeG: food.servingSizeG,
            offProductCode: food.offProductCode,
          },
        })
        .returning();
      return rows[0];
    },

    async insert(food) {
      // S2: .returning() → drizzle calls executor with method 'all'
      const nameNormalized = normalizeForSearch(food.name);
      const rows = await db
        .insert(schema.foods)
        .values({ ...food, nameNormalized })
        .returning();
      return rows[0];
    },

    async getCustomFoods() {
      return db
        .select()
        .from(schema.foods)
        .where(eq(schema.foods.source, "custom"))
        .orderBy(schema.foods.name);
    },

    async update(id, patch) {
      const fullPatch: typeof patch & { nameNormalized?: string } = { ...patch };
      if (patch.name !== undefined) {
        fullPatch.nameNormalized = normalizeForSearch(patch.name);
      }
      const rows = await db
        .update(schema.foods)
        .set(fullPatch)
        .where(eq(schema.foods.id, id))
        .returning();
      return rows[0];
    },

    // ── Profile ──────────────────────────────────────────────────────────

    async getProfile() {
      const rows = await db
        .select()
        .from(schema.usersProfile)
        .where(eq(schema.usersProfile.id, 1))
        .limit(1);
      return rows[0] ?? null;
    },

    async upsertProfile(data) {
      const rows = await db
        .insert(schema.usersProfile)
        .values({ ...data, id: 1 })
        .onConflictDoUpdate({
          target: schema.usersProfile.id,
          set: { ...data, updatedAt: new Date().toISOString() },
        })
        .returning();
      return rows[0];
    },

    // ── MealEntries ──────────────────────────────────────────────────────

    async getByDate(date) {
      return db
        .select()
        .from(schema.mealEntries)
        .where(eq(schema.mealEntries.date, date))
        .orderBy(asc(schema.mealEntries.loggedAt));
    },

    async getByDateAndMeal(date, mealType) {
      return db
        .select()
        .from(schema.mealEntries)
        .where(and(eq(schema.mealEntries.date, date), eq(schema.mealEntries.mealType, mealType)))
        .orderBy(asc(schema.mealEntries.loggedAt));
    },

    async insertEntry(entry) {
      const rows = await db.insert(schema.mealEntries).values(entry).returning();
      return rows[0];
    },

    async insertBulk(entries) {
      if (entries.length === 0) return [];
      return transaction(async (tx) => {
        const results: MealEntry[] = [];
        for (const entry of entries) {
          const rows = await tx.insert(schema.mealEntries).values(entry).returning();
          results.push(rows[0]);
        }
        return results;
      });
    },

    async updateEntry(id, patch) {
      const rows = await db
        .update(schema.mealEntries)
        .set(patch)
        .where(eq(schema.mealEntries.id, id))
        .returning();
      return rows[0];
    },

    async remove(id) {
      await db.delete(schema.mealEntries).where(eq(schema.mealEntries.id, id));
    },

    async deleteByDateAndMeal(date, mealType) {
      await transaction(async (tx) => {
        await tx
          .delete(schema.mealEntries)
          .where(and(eq(schema.mealEntries.date, date), eq(schema.mealEntries.mealType, mealType)));
      });
    },

    // ── Favorites ──────────────────────────────────────────────────────────

    async isFavorite(foodId, userId) {
      const owner =
        userId === null
          ? isNull(schema.userFavoriteFoods.userId)
          : eq(schema.userFavoriteFoods.userId, userId);
      const rows = await db
        .select()
        .from(schema.userFavoriteFoods)
        .where(and(eq(schema.userFavoriteFoods.foodId, foodId), owner))
        .limit(1);
      return rows.length > 0;
    },

    async toggleFavorite(foodId, userId) {
      const owner =
        userId === null
          ? isNull(schema.userFavoriteFoods.userId)
          : eq(schema.userFavoriteFoods.userId, userId);
      const rows = await db
        .select()
        .from(schema.userFavoriteFoods)
        .where(and(eq(schema.userFavoriteFoods.foodId, foodId), owner))
        .limit(1);

      if (rows.length > 0) {
        await db
          .delete(schema.userFavoriteFoods)
          .where(eq(schema.userFavoriteFoods.id, rows[0].id));
        return false;
      }

      await db.insert(schema.userFavoriteFoods).values({ id: nextId(), userId, foodId });
      return true;
    },

    async listFavoriteFoodIds(userId) {
      const owner =
        userId === null
          ? isNull(schema.userFavoriteFoods.userId)
          : eq(schema.userFavoriteFoods.userId, userId);
      const rows = await db
        .select({ foodId: schema.userFavoriteFoods.foodId })
        .from(schema.userFavoriteFoods)
        .where(owner);
      return rows.map((r) => r.foodId);
    },
  };
}

// ---------------------------------------------------------------------------
// Dexie backend (fake-indexeddb)
// ---------------------------------------------------------------------------

function makeDexieBackend(): RepositoryBackend & { _ready: Promise<void>; _dexie: DexieAdapter } {
  const adapter = createDexieAdapter(`vitia-test-${Math.random().toString(36).slice(2)}`);

  return {
    name: "Dexie/IndexedDB (fake-indexeddb)",
    _ready: adapter.ready,
    _dexie: adapter,

    async searchByName(query) {
      return adapter.foods.searchByName(query);
    },
    async getById(id) {
      return adapter.foods.getById(id);
    },
    async upsert(food) {
      return adapter.foods.upsert(food);
    },
    async insert(food) {
      return adapter.foods.insert(food);
    },
    async getCustomFoods() {
      return adapter.foods.getCustomFoods();
    },
    async update(id, patch) {
      return adapter.foods.update(id, patch);
    },

    async getProfile() {
      return adapter.profile.getProfile();
    },
    async upsertProfile(data) {
      return adapter.profile.upsertProfile(data);
    },

    async getByDate(date) {
      return adapter.mealEntries.getByDate(date);
    },
    async getByDateAndMeal(date, mealType) {
      return adapter.mealEntries.getByDateAndMeal(date, mealType);
    },
    async insertEntry(entry) {
      return adapter.mealEntries.insert(entry);
    },
    async insertBulk(entries) {
      return adapter.mealEntries.insertBulk(entries);
    },
    async updateEntry(id, patch) {
      return adapter.mealEntries.update(id, patch);
    },
    async remove(id) {
      return adapter.mealEntries.remove(id);
    },
    async deleteByDateAndMeal(date, mealType) {
      return adapter.mealEntries.deleteByDateAndMeal(date, mealType);
    },

    async isFavorite(foodId, userId) {
      return adapter.favorites.isFavorite(foodId, userId);
    },
    async toggleFavorite(foodId, userId) {
      return adapter.favorites.toggle(foodId, userId);
    },
    async listFavoriteFoodIds(userId) {
      return adapter.favorites.listFoodIds(userId);
    },
  };
}

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

let idCounter = 0;
function nextId(): string {
  return `test-id-${++idCounter}`;
}

function makeFood(overrides: Partial<NewFood> = {}): NewFood {
  return {
    id: nextId(),
    name: "Test Food",
    brand: "Test Brand",
    caloriesPer100g: 100,
    proteinPer100g: 10,
    carbsPer100g: 15,
    fatPer100g: 3,
    source: "openfoodfacts",
    ...overrides,
  };
}

function makeEntry(overrides: Partial<NewMealEntry> = {}): NewMealEntry {
  return {
    id: nextId(),
    date: "2024-01-15",
    mealType: "lunch",
    foodId: nextId(),
    foodName: "Test Food",
    quantityG: 100,
    calories: 100,
    proteinG: 10,
    carbsG: 15,
    fatG: 3,
    ...overrides,
  };
}

function makeProfile(): Omit<schema.NewUserProfile, "id"> {
  return {
    age: 30,
    heightCm: 175,
    weightKg: 70,
    sex: "male",
    activityLevel: "sedentary",
    goal: "maintain",
    calorieGoal: 2000,
    proteinGoalG: 150,
    carbsGoalG: 250,
    fatGoalG: 65,
    useManualGoals: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Parameterized contract suite — runs against BOTH backends
// ---------------------------------------------------------------------------

describe.each([
  ["SQLite-proxy (better-sqlite3 in-memory)", makeSqliteProxyBackend],
  ["Dexie/IndexedDB (fake-indexeddb)", makeDexieBackend],
] as const)("Repository contract — %s", (_backendName, makeBackend) => {
  // Each describe block gets its own backend instance to avoid cross-test
  // state from the shared idCounter (foods inserted in one test are visible
  // to subsequent tests on the same backend).
  let backend: RepositoryBackend & { _ready: Promise<void> };

  beforeAll(async () => {
    backend = makeBackend();
    await backend._ready;
  });

  // ─── Foods ──────────────────────────────────────────────────────────

  describe("foods.insert (S2: INSERT...RETURNING → method 'all')", () => {
    it("returns the inserted row with all fields (Scenario 2.8)", async () => {
      const food = makeFood({ name: "Banana", source: "custom" });
      const result = await backend.insert(food);

      expect(result).toBeDefined();
      expect(result.id).toBe(food.id);
      expect(result.name).toBe("Banana");
      expect(result.source).toBe("custom");
    });

    it("throws when inserting a duplicate id", async () => {
      const food = makeFood();
      await backend.insert(food);
      await expect(backend.insert(food)).rejects.toThrow();
    });
  });

  describe("foods.upsert (S2: .returning() on conflict-update)", () => {
    it("inserts when id is new and returns the row", async () => {
      const food = makeFood({ name: "Apple", source: "openfoodfacts" });
      const result = await backend.upsert(food);
      expect(result.id).toBe(food.id);
      expect(result.name).toBe("Apple");
    });

    it("updates existing row and returns updated data", async () => {
      const food = makeFood({ name: "Original", source: "openfoodfacts" });
      await backend.upsert(food);

      const updated = await backend.upsert({ ...food, name: "Updated" });
      expect(updated.id).toBe(food.id);
      expect(updated.name).toBe("Updated");
    });
  });

  describe("foods.searchByName", () => {
    it("returns empty array for empty query", async () => {
      const result = await backend.searchByName("");
      expect(result).toEqual([]);
    });

    it("finds foods matching name substring", async () => {
      const food = makeFood({ name: "Whole Milk XYZ" });
      await backend.insert(food);

      const results = await backend.searchByName("Whole Milk XYZ");
      const ids = results.map((f) => f.id);
      expect(ids).toContain(food.id);
    });

    it("returns empty array when no match", async () => {
      const results = await backend.searchByName("zzz-no-match-zzz-999");
      expect(results).toEqual([]);
    });
  });

  describe("foods.getById", () => {
    it("returns the food when found", async () => {
      const food = makeFood({ name: "Rice Special" });
      await backend.insert(food);

      const result = await backend.getById(food.id);
      expect(result).not.toBeNull();
      expect(result?.id).toBe(food.id);
    });

    it("returns null when not found", async () => {
      const result = await backend.getById("nonexistent-id-xyz-999");
      expect(result).toBeNull();
    });
  });

  describe("foods.getCustomFoods", () => {
    it("returns only custom foods ordered by name", async () => {
      // Use a fresh isolated backend for this test to avoid cross-contamination
      const fresh = makeBackend();
      await fresh._ready;

      const c1 = makeFood({ name: "Zucchini Bread", source: "custom" });
      const c2 = makeFood({ name: "Apple Jam", source: "custom" });
      const off = makeFood({ name: "Commercial Product", source: "openfoodfacts" });
      await fresh.insert(c1);
      await fresh.insert(c2);
      await fresh.insert(off);

      const result = await fresh.getCustomFoods();
      // All results are custom
      expect(result.every((f) => f.source === "custom")).toBe(true);
      // Alphabetically sorted
      const names = result.map((f) => f.name);
      expect(names.indexOf("Apple Jam")).toBeLessThan(names.indexOf("Zucchini Bread"));
    });
  });

  describe("foods.update", () => {
    it("updates specified fields and returns updated row", async () => {
      const food = makeFood({ name: "Old Name", caloriesPer100g: 50 });
      await backend.insert(food);

      const updated = await backend.update(food.id, { name: "New Name", caloriesPer100g: 75 });
      expect(updated.name).toBe("New Name");
      expect(updated.caloriesPer100g).toBe(75);
    });
  });

  // ─── Profile ─────────────────────────────────────────────────────────

  describe("profile.getProfile / upsertProfile", () => {
    it("returns null when no profile exists yet (first launch)", async () => {
      const fresh = makeBackend();
      await fresh._ready;
      const result = await fresh.getProfile();
      expect(result).toBeNull();
    });

    it("inserts profile and returns it with id=1", async () => {
      const fresh = makeBackend();
      await fresh._ready;
      const result = await fresh.upsertProfile(makeProfile());
      expect(result.id).toBe(1);
      expect(result.age).toBe(30);
    });

    it("second upsertProfile call updates, does not duplicate (singleton id=1)", async () => {
      const fresh = makeBackend();
      await fresh._ready;
      await fresh.upsertProfile(makeProfile());
      await fresh.upsertProfile({ ...makeProfile(), age: 35 });

      const profile = await fresh.getProfile();
      expect(profile).not.toBeNull();
      expect(profile?.age).toBe(35);
      expect(profile?.id).toBe(1);
    });
  });

  // ─── MealEntries ─────────────────────────────────────────────────────

  describe("mealEntries.insert + getByDate", () => {
    it("inserts entry and retrieves it by date", async () => {
      const food = makeFood({ name: "FK Food Entry" });
      await backend.insert(food);

      const entry = makeEntry({ foodId: food.id, foodName: food.name, date: "2024-08-01" });
      await backend.insertEntry(entry);

      const results = await backend.getByDate("2024-08-01");
      expect(results.map((e) => e.id)).toContain(entry.id);
    });
  });

  describe("mealEntries.getByDateAndMeal", () => {
    it("filters by date AND mealType", async () => {
      const fresh = makeBackend();
      await fresh._ready;

      const food = makeFood({ name: "FilterByMeal Food" });
      await fresh.insert(food);

      const lunchEntry = makeEntry({
        foodId: food.id,
        foodName: food.name,
        date: "2024-09-01",
        mealType: "lunch",
      });
      const dinnerEntry = makeEntry({
        foodId: food.id,
        foodName: food.name,
        date: "2024-09-01",
        mealType: "dinner",
      });
      await fresh.insertEntry(lunchEntry);
      await fresh.insertEntry(dinnerEntry);

      const lunches = await fresh.getByDateAndMeal("2024-09-01", "lunch");
      expect(lunches.map((e) => e.id)).toContain(lunchEntry.id);
      expect(lunches.map((e) => e.id)).not.toContain(dinnerEntry.id);
    });
  });

  describe("mealEntries.remove", () => {
    it("removes an entry by id", async () => {
      const food = makeFood({ name: "RemoveMe Food" });
      await backend.insert(food);

      const entry = makeEntry({ foodId: food.id, foodName: food.name, date: "2024-10-01" });
      await backend.insertEntry(entry);
      await backend.remove(entry.id);

      const results = await backend.getByDate("2024-10-01");
      expect(results.map((e) => e.id)).not.toContain(entry.id);
    });
  });

  describe("mealEntries.insertBulk (transaction atomicity — R9/Scenario 2.7)", () => {
    it("inserts all entries and returns them (happy path)", async () => {
      const food = makeFood({ name: "Bulk Food" });
      await backend.insert(food);

      const entries = [
        makeEntry({
          foodId: food.id,
          foodName: food.name,
          date: "2024-11-01",
          mealType: "breakfast",
        }),
        makeEntry({ foodId: food.id, foodName: food.name, date: "2024-11-01", mealType: "lunch" }),
      ];
      const results = await backend.insertBulk(entries);
      expect(results).toHaveLength(2);
      expect(results[0].id).toBe(entries[0].id);
      expect(results[1].id).toBe(entries[1].id);
    });

    it("returns empty array when entries list is empty", async () => {
      const results = await backend.insertBulk([]);
      expect(results).toEqual([]);
    });

    it("rolls back on partial failure — no partial state committed (W2)", async () => {
      const fresh = makeBackend();
      await fresh._ready;

      const food = makeFood({ name: "Rollback Food" });
      await fresh.insert(food);

      const validEntry = makeEntry({
        foodId: food.id,
        foodName: food.name,
        date: "2024-12-01",
        mealType: "breakfast",
      });
      // Duplicate id causes a unique constraint violation on the second insert
      const duplicateEntry = { ...validEntry };

      await expect(fresh.insertBulk([validEntry, duplicateEntry])).rejects.toThrow();

      // The first entry MUST NOT be committed (atomicity guarantee — R9)
      const rows = await fresh.getByDate("2024-12-01");
      expect(rows.map((e) => e.id)).not.toContain(validEntry.id);
    });
  });

  describe("mealEntries.deleteByDateAndMeal (uses db.transaction)", () => {
    it("deletes all entries for a date+mealType", async () => {
      const fresh = makeBackend();
      await fresh._ready;

      const food = makeFood({ name: "DeleteAll Food" });
      await fresh.insert(food);

      const e1 = makeEntry({
        foodId: food.id,
        foodName: food.name,
        date: "2024-12-15",
        mealType: "dinner",
      });
      const e2 = makeEntry({
        foodId: food.id,
        foodName: food.name,
        date: "2024-12-15",
        mealType: "dinner",
      });
      await fresh.insertEntry(e1);
      await fresh.insertEntry(e2);

      await fresh.deleteByDateAndMeal("2024-12-15", "dinner");

      const rows = await fresh.getByDateAndMeal("2024-12-15", "dinner");
      expect(rows).toHaveLength(0);
    });

    it("does not delete entries for a different mealType on the same date", async () => {
      const fresh = makeBackend();
      await fresh._ready;

      const food = makeFood({ name: "Keep Food" });
      await fresh.insert(food);

      const keeper = makeEntry({
        foodId: food.id,
        foodName: food.name,
        date: "2024-12-16",
        mealType: "breakfast",
      });
      const toDelete = makeEntry({
        foodId: food.id,
        foodName: food.name,
        date: "2024-12-16",
        mealType: "lunch",
      });
      await fresh.insertEntry(keeper);
      await fresh.insertEntry(toDelete);

      await fresh.deleteByDateAndMeal("2024-12-16", "lunch");

      const remaining = await fresh.getByDate("2024-12-16");
      expect(remaining.map((e) => e.id)).toContain(keeper.id);
    });
  });

  // ─── mealEntries.update (edit mode) ────────────────────────────────

  describe("mealEntries.updateEntry", () => {
    it("recalculates and persists a new quantity/macros in place (no duplicate row)", async () => {
      const fresh = makeBackend();
      await fresh._ready;

      const food = makeFood({ name: "Update Food" });
      await fresh.insert(food);

      const entry = makeEntry({
        foodId: food.id,
        foodName: food.name,
        date: "2025-04-01",
        mealType: "lunch",
        quantityG: 100,
        calories: 100,
      });
      await fresh.insertEntry(entry);

      const updated = await fresh.updateEntry(entry.id, {
        quantityG: 200,
        calories: 200,
        proteinG: 20,
        carbsG: 30,
        fatG: 6,
      });
      expect(updated.quantityG).toBe(200);
      expect(updated.calories).toBe(200);

      const rows = await fresh.getByDateAndMeal("2025-04-01", "lunch");
      expect(rows).toHaveLength(1);
      expect(rows[0].quantityG).toBe(200);
    });

    it("moves the entry to a different meal section when mealType changes", async () => {
      const fresh = makeBackend();
      await fresh._ready;

      const food = makeFood({ name: "Move Food" });
      await fresh.insert(food);

      const entry = makeEntry({
        foodId: food.id,
        foodName: food.name,
        date: "2025-04-02",
        mealType: "lunch",
      });
      await fresh.insertEntry(entry);

      await fresh.updateEntry(entry.id, { mealType: "dinner" });

      const lunch = await fresh.getByDateAndMeal("2025-04-02", "lunch");
      const dinner = await fresh.getByDateAndMeal("2025-04-02", "dinner");
      expect(lunch.map((e) => e.id)).not.toContain(entry.id);
      expect(dinner.map((e) => e.id)).toContain(entry.id);
    });
  });

  // ─── Favorites ──────────────────────────────────────────────────────

  describe("favorites.toggle / isFavorite / listFoodIds", () => {
    it("toggling an unfavorited food favorites it and persists", async () => {
      const fresh = makeBackend();
      await fresh._ready;

      const food = makeFood({ name: "Fav Food A" });
      await fresh.insert(food);

      expect(await fresh.isFavorite(food.id, "user-1")).toBe(false);

      const newState = await fresh.toggleFavorite(food.id, "user-1");
      expect(newState).toBe(true);
      expect(await fresh.isFavorite(food.id, "user-1")).toBe(true);
    });

    it("toggling an already-favorited food unfavorites it (removes the row)", async () => {
      const fresh = makeBackend();
      await fresh._ready;

      const food = makeFood({ name: "Fav Food B" });
      await fresh.insert(food);

      await fresh.toggleFavorite(food.id, "user-1");
      const newState = await fresh.toggleFavorite(food.id, "user-1");
      expect(newState).toBe(false);
      expect(await fresh.isFavorite(food.id, "user-1")).toBe(false);
    });

    it("does not leak favorite state across users (user isolation)", async () => {
      const fresh = makeBackend();
      await fresh._ready;

      const food = makeFood({ name: "Fav Food C" });
      await fresh.insert(food);

      await fresh.toggleFavorite(food.id, "user-A");

      expect(await fresh.isFavorite(food.id, "user-A")).toBe(true);
      expect(await fresh.isFavorite(food.id, "user-B")).toBe(false);
    });

    it("supports null userId as the local/anonymous owner", async () => {
      const fresh = makeBackend();
      await fresh._ready;

      const food = makeFood({ name: "Fav Food D" });
      await fresh.insert(food);

      await fresh.toggleFavorite(food.id, null);
      expect(await fresh.isFavorite(food.id, null)).toBe(true);
      expect(await fresh.isFavorite(food.id, "some-user")).toBe(false);
    });

    it("listFoodIds returns only the given user's favorited foods", async () => {
      const fresh = makeBackend();
      await fresh._ready;

      const foodA = makeFood({ name: "List Fav A" });
      const foodB = makeFood({ name: "List Fav B" });
      await fresh.insert(foodA);
      await fresh.insert(foodB);

      await fresh.toggleFavorite(foodA.id, "user-list");
      await fresh.toggleFavorite(foodB.id, "other-user");

      const ids = await fresh.listFavoriteFoodIds("user-list");
      expect(ids).toContain(foodA.id);
      expect(ids).not.toContain(foodB.id);
    });
  });
});

// ---------------------------------------------------------------------------
// Dexie-specific: migration tracking idempotence (W2/S1, Scenario 2.4)
// ---------------------------------------------------------------------------

describe("Dexie migration tracking — idempotence (W2/S1, Scenario 2.4)", () => {
  it("records all migration tags on first open", async () => {
    const adapter = createDexieAdapter(`vitia-idem-${Math.random().toString(36).slice(2)}`);
    await adapter.ready;

    const tags = await adapter.getAppliedMigrationTags();
    // The Dexie adapter must record at least the 0000 migration tag
    expect(tags).toContain("0000_thick_eddie_brock");
  });

  it("re-opening the same database name does not duplicate migration records", async () => {
    const dbName = `vitia-idem-dedup-${Math.random().toString(36).slice(2)}`;
    const adapter1 = createDexieAdapter(dbName);
    await adapter1.ready;
    const tags1 = await adapter1.getAppliedMigrationTags();
    // Note: Dexie.close() dispatches a CustomEvent which is not available in Node.
    // In production (browser) this is fine. In tests we skip the explicit close
    // and let the GC/fake-indexeddb handle cleanup — idempotence is what matters.

    // Simulate a second adapter instance for the same DB (same session, different
    // code path — covers the "already has migration rows" branch of the ready guard).
    const adapter2 = createDexieAdapter(dbName);
    await adapter2.ready;
    const tags2 = await adapter2.getAppliedMigrationTags();

    // Same tags, no duplicates written by the second open
    expect(tags2.sort()).toEqual(tags1.sort());
    expect(tags2.length).toBe(tags1.length);
  });
});

// ---------------------------------------------------------------------------
// Accent-insensitive search — backend parity (Spanish food names)
// Both backends must return identical results for accented queries.
// ---------------------------------------------------------------------------

describe.each([
  ["SQLite-proxy (better-sqlite3 in-memory)", makeSqliteProxyBackend],
  ["Dexie/IndexedDB (fake-indexeddb)", makeDexieBackend],
] as const)("Accent-insensitive searchByName — %s", (_backendName, makeBackend) => {
  let backend: RepositoryBackend & { _ready: Promise<void> };

  beforeAll(async () => {
    backend = makeBackend();
    await backend._ready;
  });

  it("finds 'Jamón' when searching 'jamon' (accent-insensitive, Spain app)", async () => {
    const food = makeFood({ name: "Jamón ibérico", source: "custom" });
    await backend.insert(food);

    const results = await backend.searchByName("jamon");
    expect(results.map((f) => f.id)).toContain(food.id);
  });

  it("finds 'Ñoquis' when searching 'noquis' (ñ normalization)", async () => {
    const food = makeFood({ name: "Ñoquis de patata", source: "custom" });
    await backend.insert(food);

    const results = await backend.searchByName("noquis");
    expect(results.map((f) => f.id)).toContain(food.id);
  });

  it("returns empty for unmatched query even with accented data", async () => {
    await backend.insert(makeFood({ name: "Jamón cocido" }));
    const results = await backend.searchByName("zzz-no-match-accented");
    expect(results).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// FIFO transaction mutex — concurrency correctness (CRITICAL 1)
//
// Two concurrent db.transaction() calls must both complete successfully and
// the final row count must be exactly correct — no "cannot start a transaction
// within a transaction" error and no lost/partial rows.
//
// This test runs against the SQLite-proxy backend which directly exercises
// the transaction() facade from the test harness (same logic as the OPFS
// Worker path). The Dexie backend is covered implicitly by its own adapter
// using Dexie's built-in transaction serialization.
// ---------------------------------------------------------------------------

describe("FIFO transaction mutex — concurrent transaction() calls (CRITICAL 1)", () => {
  it("two concurrent insertBulk calls both succeed — no collision, exact row count", async () => {
    const backend = makeSqliteProxyBackend();
    await backend._ready;

    const food = makeFood({ name: "Concurrent Food" });
    await backend.insert(food);

    const batch1 = [
      makeEntry({
        foodId: food.id,
        foodName: food.name,
        date: "2025-01-01",
        mealType: "breakfast",
      }),
      makeEntry({ foodId: food.id, foodName: food.name, date: "2025-01-01", mealType: "lunch" }),
    ];
    const batch2 = [
      makeEntry({ foodId: food.id, foodName: food.name, date: "2025-01-01", mealType: "dinner" }),
      makeEntry({
        foodId: food.id,
        foodName: food.name,
        date: "2025-01-02",
        mealType: "breakfast",
      }),
    ];

    // Fire both concurrently — without a mutex this causes "cannot start a
    // transaction within a transaction" on a shared single-connection backend.
    const [r1, r2] = await Promise.all([backend.insertBulk(batch1), backend.insertBulk(batch2)]);

    expect(r1).toHaveLength(2);
    expect(r2).toHaveLength(2);

    // All 4 entries must be persisted correctly
    const day1 = await backend.getByDate("2025-01-01");
    const day2 = await backend.getByDate("2025-01-02");
    expect(day1).toHaveLength(3); // breakfast + lunch + dinner
    expect(day2).toHaveLength(1); // breakfast only
  });

  it("concurrent insertBulk + deleteByDateAndMeal both complete, final state is consistent", async () => {
    const backend = makeSqliteProxyBackend();
    await backend._ready;

    const food = makeFood({ name: "Concurrent Food 2" });
    await backend.insert(food);

    // Pre-seed entries to delete
    const toDelete = [
      makeEntry({ foodId: food.id, foodName: food.name, date: "2025-02-01", mealType: "lunch" }),
      makeEntry({ foodId: food.id, foodName: food.name, date: "2025-02-01", mealType: "lunch" }),
    ];
    await backend.insertBulk(toDelete);

    const toInsert = [
      makeEntry({ foodId: food.id, foodName: food.name, date: "2025-02-01", mealType: "dinner" }),
    ];

    // Concurrent: one deletes lunch, the other inserts dinner
    await Promise.all([
      backend.deleteByDateAndMeal("2025-02-01", "lunch"),
      backend.insertBulk(toInsert),
    ]);

    const remaining = await backend.getByDate("2025-02-01");
    // lunch entries deleted, dinner entry inserted
    const remainingIds = remaining.map((e) => e.id);
    expect(remainingIds).not.toContain(toDelete[0].id);
    expect(remainingIds).not.toContain(toDelete[1].id);
    expect(remainingIds).toContain(toInsert[0].id);
  });

  it("a throwing transaction leaves NO partial rows (rollback integrity)", async () => {
    const backend = makeSqliteProxyBackend();
    await backend._ready;

    const food = makeFood({ name: "Rollback Integrity Food" });
    await backend.insert(food);

    const valid = makeEntry({
      foodId: food.id,
      foodName: food.name,
      date: "2025-03-01",
      mealType: "breakfast",
    });
    const duplicate = { ...valid }; // same id → constraint violation

    await expect(backend.insertBulk([valid, duplicate])).rejects.toThrow();

    // No partial rows: valid entry must NOT be committed
    const rows = await backend.getByDate("2025-03-01");
    expect(rows.map((e) => e.id)).not.toContain(valid.id);
  });
});
