/**
 * Dexie/IndexedDB adapter for Vitia PWA.
 *
 * Implements the EXACT same repository contracts as the SQLite path so that
 * stores and screens never need to branch on which backend is active.
 *
 * Design: openspec/changes/web-pwa-migration/design.md — Architecture Decision 4
 * Spec:   web-local-storage R5, R6, Scenarios 2.2 and 2.8
 *
 * Review flags addressed:
 *   - W2/S1: idempotent migration tracking via __drizzle_migrations table in
 *     IndexedDB (same tag set as the OPFS migrator — Scenario 2.4)
 *   - W2: db.transaction() mapped to dexie.transaction('rw', ...) for
 *     insertBulk and deleteByDateAndMeal atomicity (rollback on partial failure)
 */

import type {
  Food,
  MealEntry,
  NewFood,
  NewMealEntry,
  NewSyncQueueRow,
  NewUserProfile,
  SyncQueueRow,
  UserProfile,
} from "@/db/schema";
import { normalizeForSearch } from "@/lib/search";
import Dexie, { type Table } from "dexie";

// ---------------------------------------------------------------------------
// IndexedDB table row types
// We mirror the SQL column names exactly so the return shapes satisfy the
// TypeScript types from db/schema.ts.
// ---------------------------------------------------------------------------

// All columns are required at the store level; optional DB fields become
// nullable in the schema declaration (keyPath handles id).

interface FoodRow extends Food {}
interface MealEntryRow extends MealEntry {}
interface UserProfileRow extends UserProfile {}
interface SyncQueueDexieRow extends SyncQueueRow {}

/**
 * Migration tracking row — same semantic as __drizzle_migrations in SQLite.
 * Satisfies W2/S1: both backends report the same tag set (Scenario 2.4).
 */
interface MigrationRow {
  id?: number;
  tag: string;
  hash: string;
  created_at: number;
}

// ---------------------------------------------------------------------------
// Dexie database class
// ---------------------------------------------------------------------------

const DB_VERSION = 3;

/**
 * The tags applied by the OPFS migrator (journal order).
 * Dexie's object stores are declared instead of using DDL, but we record the
 * same tags so both backends satisfy Scenario 2.4 identically.
 */
const MIGRATION_TAGS: Array<{ tag: string; when: number }> = [
  { tag: "0000_thick_eddie_brock", when: 1782165949458 },
  { tag: "0001_name_normalized", when: 1782200000000 },
  { tag: "0002_user_session_persistence", when: 1751000000000 },
];

class VitiaDb extends Dexie {
  foods!: Table<FoodRow, string>;
  meal_entries!: Table<MealEntryRow, string>;
  users_profile!: Table<UserProfileRow, number>;
  sync_queue!: Table<SyncQueueDexieRow, string>;
  __drizzle_migrations!: Table<MigrationRow, number>;

  constructor(name: string) {
    super(name);

    // Version 1: original schema (no nameNormalized)
    this.version(1).stores({
      foods: "id, name, source, offProductCode",
      meal_entries: "id, date, [date+mealType], foodId",
      users_profile: "id",
      __drizzle_migrations: "++id, &tag",
    });

    // Version 2: adds nameNormalized index (0001_name_normalized migration)
    this.version(2)
      .stores({
        foods: "id, name, nameNormalized, source, offProductCode",
        meal_entries: "id, date, [date+mealType], foodId",
        users_profile: "id",
        __drizzle_migrations: "++id, &tag",
      })
      .upgrade(async (trans) => {
        // Backfill nameNormalized for any existing rows
        await trans
          .table("foods")
          .toCollection()
          .modify((food) => {
            food.nameNormalized = normalizeForSearch(food.name as string);
          });
      });

    // Version 3: adds userId + updatedAt to meal_entries and users_profile;
    // adds sync_queue table (0002_user_session_persistence migration)
    this.version(DB_VERSION).stores({
      foods: "id, name, nameNormalized, source, offProductCode",
      meal_entries: "id, date, [date+mealType], foodId, userId",
      users_profile: "id, userId",
      sync_queue: "id, userId, table",
      __drizzle_migrations: "++id, &tag",
    });
    // No upgrade() needed: userId and updatedAt are optional columns.
    // Existing rows without them will have undefined values, which is fine.
  }
}

// ---------------------------------------------------------------------------
// Public API types
// ---------------------------------------------------------------------------

/** Foods repository surface — mirrors db/repositories/foods.ts exactly */
export interface FoodsRepo {
  searchByName(query: string): Promise<Food[]>;
  getById(id: string): Promise<Food | null>;
  upsert(food: NewFood): Promise<Food>;
  insert(food: NewFood): Promise<Food>;
  getCustomFoods(): Promise<Food[]>;
  update(id: string, patch: Partial<Omit<NewFood, "id" | "createdAt">>): Promise<Food>;
}

/** Profile repository surface — mirrors db/repositories/profile.ts exactly */
export interface ProfileRepo {
  getProfile(): Promise<UserProfile | null>;
  upsertProfile(data: Omit<NewUserProfile, "id">): Promise<UserProfile>;
}

/** SyncQueue repository surface — durable outbound operation queue */
export interface SyncQueueRepo {
  enqueue(op: NewSyncQueueRow): Promise<void>;
  drain(): Promise<SyncQueueRow[]>;
  remove(id: string): Promise<void>;
}

/** MealEntries repository surface — mirrors db/repositories/mealEntries.ts exactly */
export interface MealEntriesRepo {
  getByDate(date: string): Promise<MealEntry[]>;
  getByDateAndMeal(date: string, mealType: MealEntry["mealType"]): Promise<MealEntry[]>;
  insert(entry: NewMealEntry): Promise<MealEntry>;
  insertBulk(entries: NewMealEntry[]): Promise<MealEntry[]>;
  remove(id: string): Promise<void>;
  deleteByDateAndMeal(date: string, mealType: MealEntry["mealType"]): Promise<void>;
}

/** The full adapter returned by createDexieAdapter() */
export interface DexieAdapter {
  /** Resolves when the database is open and migrations have been recorded. */
  readonly ready: Promise<void>;
  readonly foods: FoodsRepo;
  readonly profile: ProfileRepo;
  readonly mealEntries: MealEntriesRepo;
  readonly syncQueue: SyncQueueRepo;
  /** Exposed for testing: returns the list of applied migration tags (W2/S1). */
  getAppliedMigrationTags(): Promise<string[]>;
  /** Close the underlying Dexie connection (useful in tests). */
  close(): void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a fully initialised Dexie adapter.
 * The returned `ready` promise resolves once the DB is open and all migration
 * tags have been recorded (idempotent — safe to call multiple times).
 *
 * In production, the db name is always "vitia".
 * In tests, pass a unique name to avoid inter-test state.
 */
export function createDexieAdapter(dbName = "vitia"): DexieAdapter {
  // Use fake-indexeddb when running under Jest (set via indexedDB global or
  // the "fake-indexeddb/auto" import in jest.setup.ts)
  const db = new VitiaDb(dbName);

  // ── Migration tracking (W2/S1: idempotent, same tags as OPFS path) ─────
  const ready: Promise<void> = db.open().then(async () => {
    await db.transaction("rw", db.__drizzle_migrations, async () => {
      for (const { tag, when } of MIGRATION_TAGS) {
        const existing = await db.__drizzle_migrations.where("tag").equals(tag).first();
        if (!existing) {
          await db.__drizzle_migrations.add({
            tag,
            hash: "dexie-declarative", // Dexie uses declarative stores, no SQL hash
            created_at: when,
          });
        }
      }
    });
  });

  // ── Foods ────────────────────────────────────────────────────────────────

  function now(): string {
    return new Date().toISOString();
  }

  const foods: FoodsRepo = {
    async searchByName(query) {
      if (!query.trim()) return [];
      const normalizedQuery = normalizeForSearch(query);
      // Search against the pre-computed nameNormalized field using filter().
      // Both query and stored values are normalized via the shared helper,
      // ensuring "jamon" matches "Jamón" and "noquis" matches "Ñoquis".
      return db.foods
        .filter((f) => (f.nameNormalized ?? normalizeForSearch(f.name)).includes(normalizedQuery))
        .limit(30)
        .toArray();
    },

    async getById(id) {
      return (await db.foods.get(id)) ?? null;
    },

    async upsert(food) {
      // Merge with existing if present (mirrors ON CONFLICT DO UPDATE)
      const existing = await db.foods.get(food.id);
      const row: FoodRow = {
        id: food.id,
        name: food.name,
        nameNormalized: normalizeForSearch(food.name),
        brand: food.brand ?? null,
        caloriesPer100g: food.caloriesPer100g,
        proteinPer100g: food.proteinPer100g ?? 0,
        carbsPer100g: food.carbsPer100g ?? 0,
        fatPer100g: food.fatPer100g ?? 0,
        servingSizeG: food.servingSizeG ?? null,
        source: food.source,
        offProductCode: food.offProductCode ?? null,
        createdAt: existing?.createdAt ?? food.createdAt ?? now(),
      };
      await db.foods.put(row);
      return row;
    },

    async insert(food) {
      const row: FoodRow = {
        id: food.id,
        name: food.name,
        nameNormalized: normalizeForSearch(food.name),
        brand: food.brand ?? null,
        caloriesPer100g: food.caloriesPer100g,
        proteinPer100g: food.proteinPer100g ?? 0,
        carbsPer100g: food.carbsPer100g ?? 0,
        fatPer100g: food.fatPer100g ?? 0,
        servingSizeG: food.servingSizeG ?? null,
        source: food.source,
        offProductCode: food.offProductCode ?? null,
        createdAt: food.createdAt ?? now(),
      };
      // Dexie .add() throws ConstraintError on duplicate key, matching SQL behaviour
      await db.foods.add(row);
      return row;
    },

    async getCustomFoods() {
      const all = await db.foods.where("source").equals("custom").toArray();
      // localeCompare with Spanish locale and sensitivity:"base" provides
      // accent-insensitive alphabetical ordering consistent with SQLite's
      // ORDER BY name for Spanish food names (ñ sorts after n, etc.).
      return all.sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" }));
    },

    async update(id, patch) {
      const fullPatch: Partial<FoodRow> = { ...(patch as Partial<FoodRow>) };
      if (patch.name !== undefined) {
        fullPatch.nameNormalized = normalizeForSearch(patch.name);
      }
      await db.foods.update(id, fullPatch);
      // Return the updated row, or undefined when the id does not exist.
      // This matches the SQLite/proxy path which returns rows[0] (undefined on
      // no-match) without throwing — so both backends behave identically.
      return (await db.foods.get(id)) as Food;
    },
  };

  // ── Profile ──────────────────────────────────────────────────────────────

  const PROFILE_ID = 1;

  const profile: ProfileRepo = {
    async getProfile() {
      return (await db.users_profile.get(PROFILE_ID)) ?? null;
    },

    async upsertProfile(data) {
      const row: UserProfileRow = {
        id: PROFILE_ID,
        userId: data.userId ?? null,
        age: data.age,
        heightCm: data.heightCm,
        weightKg: data.weightKg,
        sex: data.sex,
        activityLevel: data.activityLevel,
        goal: data.goal,
        calorieGoal: data.calorieGoal,
        proteinGoalG: data.proteinGoalG,
        carbsGoalG: data.carbsGoalG,
        fatGoalG: data.fatGoalG,
        useManualGoals: data.useManualGoals ?? false,
        createdAt: data.createdAt ?? now(),
        updatedAt: now(),
      };
      await db.users_profile.put(row);
      return row;
    },
  };

  // ── MealEntries ──────────────────────────────────────────────────────────

  const mealEntries: MealEntriesRepo = {
    async getByDate(date) {
      const rows = await db.meal_entries.where("date").equals(date).toArray();
      return rows.sort((a, b) => a.loggedAt.localeCompare(b.loggedAt));
    },

    async getByDateAndMeal(date, mealType) {
      // Compound index [date+meal_type] was declared in Dexie schema
      const rows = await db.meal_entries
        .where("[date+mealType]")
        .equals([date, mealType])
        .toArray();
      return rows.sort((a, b) => a.loggedAt.localeCompare(b.loggedAt));
    },

    async insert(entry) {
      const row: MealEntryRow = {
        id: entry.id,
        userId: entry.userId ?? null,
        date: entry.date,
        mealType: entry.mealType,
        foodId: entry.foodId,
        foodName: entry.foodName,
        quantityG: entry.quantityG,
        calories: entry.calories,
        proteinG: entry.proteinG,
        carbsG: entry.carbsG,
        fatG: entry.fatG,
        loggedAt: entry.loggedAt ?? now(),
        updatedAt: entry.updatedAt ?? null,
      };
      await db.meal_entries.add(row);
      return row;
    },

    async insertBulk(entries) {
      if (entries.length === 0) return [];

      // W2: use dexie.transaction('rw', ...) for atomicity
      // If any insert fails (e.g. duplicate id), Dexie aborts the entire
      // transaction → partial state never committed (R9 / Scenario 2.7)
      return db.transaction("rw", db.meal_entries, async () => {
        const results: MealEntryRow[] = [];
        for (const entry of entries) {
          const row: MealEntryRow = {
            id: entry.id,
            userId: entry.userId ?? null,
            date: entry.date,
            mealType: entry.mealType,
            foodId: entry.foodId,
            foodName: entry.foodName,
            quantityG: entry.quantityG,
            calories: entry.calories,
            proteinG: entry.proteinG,
            carbsG: entry.carbsG,
            fatG: entry.fatG,
            loggedAt: entry.loggedAt ?? now(),
            updatedAt: entry.updatedAt ?? null,
          };
          await db.meal_entries.add(row); // throws ConstraintError on duplicate
          results.push(row);
        }
        return results;
      });
    },

    async remove(id) {
      await db.meal_entries.delete(id);
    },

    async deleteByDateAndMeal(date, mealType) {
      // W2: wrap in transaction for atomicity
      await db.transaction("rw", db.meal_entries, async () => {
        const keys = await db.meal_entries
          .where("[date+mealType]")
          .equals([date, mealType])
          .primaryKeys();
        await db.meal_entries.bulkDelete(keys);
      });
    },
  };

  // ── SyncQueue ────────────────────────────────────────────────────────────

  const syncQueue: SyncQueueRepo = {
    async enqueue(op) {
      await db.sync_queue.put(op as SyncQueueDexieRow);
    },

    async drain() {
      return db.sync_queue.toArray();
    },

    async remove(id) {
      await db.sync_queue.delete(id);
    },
  };

  // ── Public adapter ────────────────────────────────────────────────────────

  return {
    ready,
    foods,
    profile,
    mealEntries,
    syncQueue,

    async getAppliedMigrationTags() {
      const rows = await db.__drizzle_migrations.toArray();
      return rows.map((r) => r.tag);
    },

    close() {
      db.close();
    },
  };
}
