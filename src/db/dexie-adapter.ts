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
  FoodIngredient,
  MealEntry,
  NewFood,
  NewFoodIngredient,
  NewMealEntry,
  NewSyncQueueRow,
  NewUserProfile,
  OffCategoryCorrection,
  ProgressEntry,
  SyncQueueRow,
  UserFavoriteFood,
  UserProfile,
} from "@/db/schema";
import { computeNavyBodyFat } from "@/lib/bodyFat";
import { sumIngredientMacros } from "@/lib/nutrition";
import { normalizeForSearch } from "@/lib/search";
import type { MealType } from "@/types";
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
interface UserFavoriteFoodRow extends UserFavoriteFood {}
interface FoodIngredientRow extends FoodIngredient {}
interface ProgressEntryRow extends ProgressEntry {}
interface OffCategoryCorrectionRow extends OffCategoryCorrection {}

/**
 * Dexie photo row. Unlike the OPFS/drizzle path (which stores a Buffer in a
 * BLOB column), IndexedDB stores a native Blob directly — no conversion
 * needed on this path (design: Photo storage strategy across dual backend).
 */
interface ProgressPhotoRow {
  id: string;
  entryId: string;
  blob: Blob;
  mimeType: string;
  position: number;
  createdAt: string;
}

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

const DB_VERSION = 9;

/**
 * The tags applied by the OPFS migrator (journal order).
 * Dexie's object stores are declared instead of using DDL, but we record the
 * same tags so both backends satisfy Scenario 2.4 identically.
 */
const MIGRATION_TAGS: Array<{ tag: string; when: number }> = [
  { tag: "0000_thick_eddie_brock", when: 1782165949458 },
  { tag: "0001_name_normalized", when: 1782200000000 },
  { tag: "0002_user_session_persistence", when: 1751000000000 },
  { tag: "0003_food_detail", when: 1793000000000 },
  { tag: "0004_favorites_meal_type", when: 1799000000000 },
  { tag: "0005_composite_foods", when: 1805000000000 },
  { tag: "0006_progress_log", when: 1810000000000 },
  { tag: "0007_progress_measurements", when: 1815000000000 },
  { tag: "0008_raw_cooked_conversion", when: 1820000000000 },
];

class VitiaDb extends Dexie {
  foods!: Table<FoodRow, string>;
  meal_entries!: Table<MealEntryRow, string>;
  users_profile!: Table<UserProfileRow, number>;
  sync_queue!: Table<SyncQueueDexieRow, string>;
  user_favorite_foods!: Table<UserFavoriteFoodRow, string>;
  food_ingredients!: Table<FoodIngredientRow, string>;
  progress_entries!: Table<ProgressEntryRow, string>;
  progress_photos!: Table<ProgressPhotoRow, string>;
  off_category_corrections!: Table<OffCategoryCorrectionRow, number>;
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

    // Version 4: adds imageUrl to foods + user_favorite_foods table
    // (0003_food_detail migration)
    this.version(4).stores({
      foods: "id, name, nameNormalized, source, offProductCode",
      meal_entries: "id, date, [date+mealType], foodId, userId",
      users_profile: "id, userId",
      sync_queue: "id, userId, table",
      user_favorite_foods: "id, userId, foodId, [userId+foodId]",
      __drizzle_migrations: "++id, &tag",
    });
    // No upgrade() needed: imageUrl is an optional column and
    // user_favorite_foods is a brand-new store.

    // Version 5: adds mealType + compound index to user_favorite_foods
    // (0004_favorites_meal_type migration)
    this.version(5).stores({
      foods: "id, name, nameNormalized, source, offProductCode",
      meal_entries: "id, date, [date+mealType], foodId, userId",
      users_profile: "id, userId",
      sync_queue: "id, userId, table",
      user_favorite_foods: "id, userId, foodId, [userId+foodId], [userId+foodId+mealType]",
      __drizzle_migrations: "++id, &tag",
    });
    // No upgrade() needed: mealType is an optional column; existing rows have
    // undefined mealType, which is treated as NULL/"unassigned" (design D2).

    // Version 6: adds food_ingredients table + category on foods
    // (0005_composite_foods migration)
    this.version(DB_VERSION).stores({
      foods: "id, name, nameNormalized, source, offProductCode, category",
      meal_entries: "id, date, [date+mealType], foodId, userId",
      users_profile: "id, userId",
      sync_queue: "id, userId, table",
      user_favorite_foods: "id, userId, foodId, [userId+foodId], [userId+foodId+mealType]",
      food_ingredients: "id, parentFoodId, ingredientFoodId",
      __drizzle_migrations: "++id, &tag",
    });
    // No upgrade() needed: category is an optional column and food_ingredients
    // is a brand-new store (additive, mirrors v4/v5 rollout style).

    // Version 7: adds progress_entries + progress_photos tables
    // (0006_progress_log migration)
    this.version(DB_VERSION).stores({
      foods: "id, name, nameNormalized, source, offProductCode, category",
      meal_entries: "id, date, [date+mealType], foodId, userId",
      users_profile: "id, userId",
      sync_queue: "id, userId, table",
      user_favorite_foods: "id, userId, foodId, [userId+foodId], [userId+foodId+mealType]",
      food_ingredients: "id, parentFoodId, ingredientFoodId",
      progress_entries: "id, date, userId",
      progress_photos: "id, entryId",
      __drizzle_migrations: "++id, &tag",
    });
    // No upgrade() needed: progress_entries and progress_photos are brand-new
    // stores (additive, mirrors v6 rollout style).

    // Version 8: adds chestCm/armCm/thighCm to progress_entries
    // (0007_progress_measurements migration)
    this.version(8).stores({
      foods: "id, name, nameNormalized, source, offProductCode, category",
      meal_entries: "id, date, [date+mealType], foodId, userId",
      users_profile: "id, userId",
      sync_queue: "id, userId, table",
      user_favorite_foods: "id, userId, foodId, [userId+foodId], [userId+foodId+mealType]",
      food_ingredients: "id, parentFoodId, ingredientFoodId",
      progress_entries: "id, date, userId",
      progress_photos: "id, entryId",
      __drizzle_migrations: "++id, &tag",
    });
    // No upgrade() needed: chestCm/armCm/thighCm are new optional columns on
    // an existing store — no index change (mirrors v7/v6 rollout style).

    // Version 9: adds dataBasis to foods + off_category_corrections table
    // (0008_raw_cooked_conversion migration)
    this.version(DB_VERSION).stores({
      foods: "id, name, nameNormalized, source, offProductCode, category, dataBasis",
      meal_entries: "id, date, [date+mealType], foodId, userId",
      users_profile: "id, userId",
      sync_queue: "id, userId, table",
      user_favorite_foods: "id, userId, foodId, [userId+foodId], [userId+foodId+mealType]",
      food_ingredients: "id, parentFoodId, ingredientFoodId",
      progress_entries: "id, date, userId",
      progress_photos: "id, entryId",
      off_category_corrections: "id",
      __drizzle_migrations: "++id, &tag",
    });
    // No upgrade() needed: dataBasis is a new optional column and
    // off_category_corrections is a brand-new store (additive, mirrors v6-v8
    // rollout style).
  }
}

// ---------------------------------------------------------------------------
// Public API types
// ---------------------------------------------------------------------------

/** Ingredient input shape shared by createComposite/upsertIngredients. */
export type NewIngredientInput = Omit<NewFoodIngredient, "id" | "parentFoodId" | "createdAt">;

/** Foods repository surface — mirrors db/repositories/foods.ts exactly */
export interface FoodsRepo {
  searchByName(query: string): Promise<Food[]>;
  getById(id: string): Promise<Food | null>;
  getByIds(ids: string[]): Promise<Food[]>;
  upsert(food: NewFood): Promise<Food>;
  upsertMany(foods: NewFood[]): Promise<Food[]>;
  insert(food: NewFood): Promise<Food>;
  getCustomFoods(): Promise<Food[]>;
  update(id: string, patch: Partial<Omit<NewFood, "id" | "createdAt">>): Promise<Food>;
  createComposite(food: NewFood, ingredients: NewIngredientInput[]): Promise<Food>;
  getIngredients(parentFoodId: string): Promise<FoodIngredient[]>;
  upsertIngredients(parentFoodId: string, ingredients: NewIngredientInput[]): Promise<void>;
  getCompositeFoodIds(): Promise<string[]>;
  deleteFood(id: string): Promise<void>;
}

/** A single favorite row's meal assignment — used by listWithMeals(). */
export interface FavoriteMealRow {
  foodId: string;
  mealType: MealType | null;
}

/** Favorites repository surface — mirrors db/repositories/favorites.ts exactly */
export interface FavoritesRepo {
  isFavorite(foodId: string, userId: string | null): Promise<boolean>;
  /** @deprecated kept as a thin wrapper — toggle -> setMeals([]) / removeAllMeals */
  toggle(foodId: string, userId: string | null): Promise<boolean>;
  listFoodIds(userId: string | null): Promise<string[]>;
  addMeal(foodId: string, userId: string | null, mealType: MealType | null): Promise<void>;
  /** Deletes EVERY row for (userId, foodId), regardless of mealType. */
  removeAllMeals(foodId: string, userId: string | null): Promise<void>;
  /** Diffs mealTypes vs existing rows; empty array -> single NULL row. */
  setMeals(foodId: string, userId: string | null, mealTypes: MealType[]): Promise<void>;
  getMealsForFood(foodId: string, userId: string | null): Promise<(MealType | null)[]>;
  listWithMeals(userId: string | null): Promise<FavoriteMealRow[]>;
}

/** Profile repository surface — mirrors db/repositories/profile.ts exactly */
export interface ProfileRepo {
  getProfile(): Promise<UserProfile | null>;
  upsertProfile(data: Omit<NewUserProfile, "id">): Promise<UserProfile>;
}

/** A photo attached to a progress entry — always a Blob at the repo boundary. */
export interface ProgressPhotoView {
  id: string;
  entryId: string;
  blob: Blob;
  mimeType: string;
  position: number;
}

/** Input shape for creating/replacing a progress_photos row. */
export interface NewProgressPhotoInput {
  blob: Blob;
  mimeType: string;
}

/** Input shape for upsertByDate — mirrors db/repos/progress.ts ProgressInput. */
export interface ProgressUpsertInput {
  date: string;
  weightKg?: number | null;
  neckCm?: number | null;
  chestCm?: number | null;
  armCm?: number | null;
  waistCm?: number | null;
  hipCm?: number | null;
  thighCm?: number | null;
  notes?: string | null;
  userId?: string | null;
  photos: NewProgressPhotoInput[];
}

export interface ProgressEntryWithPhotos extends ProgressEntry {
  photos: ProgressPhotoView[];
}

/** Sex + height needed to run the Navy formula — mirrors db/repositories/progress.ts. */
export interface ProgressProfileInput {
  sex: "male" | "female";
  heightCm: number;
}

/** Progress repository surface — mirrors db/repositories/progress.ts exactly */
export interface ProgressRepo {
  getByDate(date: string): Promise<ProgressEntryWithPhotos | null>;
  getRange(from: string, to: string): Promise<ProgressEntry[]>;
  /**
   * profile carries sex/heightCm for the Navy formula (mirrors the pure
   * drizzle repo's signature) — pass null when no profile exists yet.
   */
  upsertByDate(
    input: ProgressUpsertInput,
    profile: ProgressProfileInput | null
  ): Promise<ProgressEntry>;
  getPhotos(entryId: string): Promise<ProgressPhotoView[]>;
  getLatestBodyFat(beforeDate?: string): Promise<number | null>;
  /** Deletes the progress_entries row for a date, cascading to its photos. No-op if the date has no record. */
  deleteByDate(date: string): Promise<void>;
}

/**
 * OFF category-correction telemetry counter — single aggregate row, no
 * per-event history. Design: raw-cooked-conversion D5.
 */
export interface OffCategoryCorrectionsRepo {
  increment(): Promise<void>;
  getCount(): Promise<number>;
}

/** SyncQueue repository surface — durable outbound operation queue */
export interface SyncQueueRepo {
  enqueue(op: NewSyncQueueRow): Promise<void>;
  drain(): Promise<SyncQueueRow[]>;
  remove(id: string): Promise<void>;
}

/** MealEntries repository surface — mirrors db/repositories/mealEntries.ts exactly */
export interface DayTotals {
  date: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface MealEntriesRepo {
  getByDate(date: string): Promise<MealEntry[]>;
  getByDateAndMeal(date: string, mealType: MealEntry["mealType"]): Promise<MealEntry[]>;
  getLoggedTotalsByDateRange(from: string, to: string): Promise<DayTotals[]>;
  insert(entry: NewMealEntry): Promise<MealEntry>;
  insertBulk(entries: NewMealEntry[]): Promise<MealEntry[]>;
  update(id: string, patch: Partial<Omit<NewMealEntry, "id">>): Promise<MealEntry>;
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
  readonly favorites: FavoritesRepo;
  readonly progress: ProgressRepo;
  readonly offCategoryCorrections: OffCategoryCorrectionsRepo;
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

    async getByIds(ids) {
      if (ids.length === 0) return [];
      const rows = await db.foods.bulkGet(ids);
      return rows.filter((r): r is FoodRow => r !== undefined);
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
        imageUrl: food.imageUrl ?? existing?.imageUrl ?? null,
        category: food.category ?? existing?.category ?? null,
        dataBasis: food.dataBasis ?? existing?.dataBasis ?? null,
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
        imageUrl: food.imageUrl ?? null,
        category: food.category ?? null,
        dataBasis: food.dataBasis ?? null,
        createdAt: food.createdAt ?? now(),
      };
      // Dexie .add() throws ConstraintError on duplicate key, matching SQL behaviour
      await db.foods.add(row);
      return row;
    },

    async upsertMany(foodsToUpsert) {
      if (foodsToUpsert.length === 0) return [];

      // W2: single transaction so all N rows commit atomically (mirrors the
      // batched drizzle insert on the OPFS backend — design D8).
      return db.transaction("rw", db.foods, async () => {
        const ids = foodsToUpsert.map((f) => f.id);
        const existingRows = await db.foods.bulkGet(ids);
        const existingById = new Map(existingRows.filter(Boolean).map((r) => [r?.id, r]));

        const rows: FoodRow[] = foodsToUpsert.map((food) => {
          const existing = existingById.get(food.id);
          return {
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
            imageUrl: food.imageUrl ?? existing?.imageUrl ?? null,
            category: food.category ?? existing?.category ?? null,
            dataBasis: food.dataBasis ?? existing?.dataBasis ?? null,
            createdAt: existing?.createdAt ?? food.createdAt ?? now(),
          };
        });

        await db.foods.bulkPut(rows);
        return rows;
      });
    },

    async getCustomFoods() {
      const all = await db.foods.where("source").equals("custom").toArray();
      // Newest first (spec: Created Foods List sorted by createdAt descending).
      return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
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

    async createComposite(food, ingredients) {
      await assertNoNestedComposites(ingredients.map((i) => i.ingredientFoodId));

      return db.transaction("rw", db.foods, db.food_ingredients, async () => {
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
          imageUrl: food.imageUrl ?? null,
          category: food.category ?? null,
          dataBasis: food.dataBasis ?? null,
          createdAt: food.createdAt ?? now(),
        };
        await db.foods.add(row);

        if (ingredients.length > 0) {
          const ingredientRows: FoodIngredientRow[] = ingredients.map((ing) => ({
            id: globalThis.crypto.randomUUID(),
            parentFoodId: row.id,
            ingredientFoodId: ing.ingredientFoodId,
            weightG: ing.weightG,
            position: ing.position,
            createdAt: now(),
          }));
          await db.food_ingredients.bulkAdd(ingredientRows);
        }

        return row;
      });
    },

    async getIngredients(parentFoodId) {
      const rows = await db.food_ingredients.where("parentFoodId").equals(parentFoodId).toArray();
      return rows.sort((a, b) => a.position - b.position);
    },

    async upsertIngredients(parentFoodId, ingredients) {
      await assertNoNestedComposites(ingredients.map((i) => i.ingredientFoodId));

      await db.transaction("rw", db.foods, db.food_ingredients, async () => {
        const existingKeys = await db.food_ingredients
          .where("parentFoodId")
          .equals(parentFoodId)
          .primaryKeys();
        await db.food_ingredients.bulkDelete(existingKeys);

        if (ingredients.length > 0) {
          const ingredientRows: FoodIngredientRow[] = ingredients.map((ing) => ({
            id: globalThis.crypto.randomUUID(),
            parentFoodId,
            ingredientFoodId: ing.ingredientFoodId,
            weightG: ing.weightG,
            position: ing.position,
            createdAt: now(),
          }));
          await db.food_ingredients.bulkAdd(ingredientRows);
        }

        const ingredientFoodRows =
          ingredients.length > 0
            ? await db.foods.bulkGet(ingredients.map((i) => i.ingredientFoodId))
            : [];
        const byId = new Map(
          ingredientFoodRows.filter((r): r is FoodRow => r !== undefined).map((r) => [r.id, r])
        );
        const summed = sumIngredientMacros(
          ingredients.map((ing) => ({
            food: byId.get(ing.ingredientFoodId) as Food,
            weightG: ing.weightG,
          }))
        );

        await db.foods.update(parentFoodId, {
          caloriesPer100g: summed.caloriesPer100g,
          proteinPer100g: summed.proteinPer100g,
          carbsPer100g: summed.carbsPer100g,
          fatPer100g: summed.fatPer100g,
          servingSizeG: summed.totalWeightG,
        });
      });
    },

    async getCompositeFoodIds() {
      const rows = await db.food_ingredients.toArray();
      return Array.from(new Set(rows.map((r) => r.parentFoodId)));
    },

    async deleteFood(id) {
      await db.transaction("rw", db.foods, db.food_ingredients, async () => {
        const ownRecipeKeys = await db.food_ingredients
          .where("parentFoodId")
          .equals(id)
          .primaryKeys();
        const referencedElsewhereKeys = await db.food_ingredients
          .where("ingredientFoodId")
          .equals(id)
          .primaryKeys();
        await db.food_ingredients.bulkDelete([...ownRecipeKeys, ...referencedElsewhereKeys]);
        await db.foods.delete(id);
      });
    },
  };

  async function assertNoNestedComposites(ingredientFoodIds: string[]): Promise<void> {
    if (ingredientFoodIds.length === 0) return;
    const compositeIds = new Set(await foods.getCompositeFoodIds());
    const nested = ingredientFoodIds.filter((id) => compositeIds.has(id));
    if (nested.length > 0) {
      throw new Error(
        `Nested composites are not allowed: ${nested.join(", ")} are already composite foods.`
      );
    }
  }

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

    async getLoggedTotalsByDateRange(from, to) {
      const rows = await db.meal_entries.where("date").between(from, to, true, true).toArray();

      // Group and sum in JS — mirrors the SQL GROUP BY date query in the
      // drizzle backend (T3). Days with no entries are not included.
      const byDate = new Map<
        string,
        { calories: number; proteinG: number; carbsG: number; fatG: number }
      >();

      for (const row of rows) {
        const existing = byDate.get(row.date) ?? {
          calories: 0,
          proteinG: 0,
          carbsG: 0,
          fatG: 0,
        };
        byDate.set(row.date, {
          calories: existing.calories + row.calories,
          proteinG: existing.proteinG + row.proteinG,
          carbsG: existing.carbsG + row.carbsG,
          fatG: existing.fatG + row.fatG,
        });
      }

      return Array.from(byDate.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, totals]) => ({ date, ...totals }));
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

    async update(id, patch) {
      await db.meal_entries.update(id, patch as Partial<MealEntryRow>);
      // Matches the SQLite/proxy path: returns the updated row, or undefined
      // (cast as MealEntry) when the id does not exist.
      return (await db.meal_entries.get(id)) as MealEntry;
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

  // ── Favorites ────────────────────────────────────────────────────────────

  // IndexedDB does not treat `null` as an indexable key, so records with a
  // null userId are invisible to a `.where("userId").equals(...)` (or
  // compound-index) query. We index on foodId only and filter userId in JS
  // to correctly support the "null = local anonymous owner" convention.
  function sameOwner(rowUserId: string | null, userId: string | null): boolean {
    return (rowUserId ?? null) === (userId ?? null);
  }

  const favorites: FavoritesRepo = {
    async isFavorite(foodId, userId) {
      const rows = await db.user_favorite_foods.where("foodId").equals(foodId).toArray();
      return rows.some((r) => sameOwner(r.userId, userId));
    },

    async toggle(foodId, userId) {
      // Thin wrapper for legacy callers: toggle -> setMeals([]) / removeAllMeals.
      const rows = await db.user_favorite_foods.where("foodId").equals(foodId).toArray();
      const existing = rows.filter((r) => sameOwner(r.userId, userId));

      if (existing.length > 0) {
        await favorites.removeAllMeals(foodId, userId);
        return false;
      }

      await favorites.setMeals(foodId, userId, []);
      return true;
    },

    async listFoodIds(userId) {
      const rows = await db.user_favorite_foods.toArray();
      return rows.filter((r) => sameOwner(r.userId, userId)).map((r) => r.foodId);
    },

    async addMeal(foodId, userId, mealType) {
      const rows = await db.user_favorite_foods.where("foodId").equals(foodId).toArray();
      const alreadyExists = rows.some(
        (r) => sameOwner(r.userId, userId) && (r.mealType ?? null) === (mealType ?? null)
      );
      if (alreadyExists) return; // unique-constraint guard, extended to the meal dimension

      const row: UserFavoriteFoodRow = {
        id: globalThis.crypto.randomUUID(),
        userId: userId ?? null,
        foodId,
        mealType: mealType ?? null,
        createdAt: now(),
      };
      await db.user_favorite_foods.add(row);
    },

    async removeAllMeals(foodId, userId) {
      const rows = await db.user_favorite_foods.where("foodId").equals(foodId).toArray();
      const toDelete = rows.filter((r) => sameOwner(r.userId, userId)).map((r) => r.id);
      if (toDelete.length === 0) return;
      await db.user_favorite_foods.bulkDelete(toDelete);
    },

    async setMeals(foodId, userId, mealTypes) {
      return db.transaction("rw", db.user_favorite_foods, async () => {
        const rows = await db.user_favorite_foods.where("foodId").equals(foodId).toArray();
        const existing = rows.filter((r) => sameOwner(r.userId, userId));

        if (mealTypes.length === 0) {
          // Zero selections -> exactly one NULL row. Remove all existing
          // non-null rows and ensure a single NULL row exists.
          const nonNull = existing.filter((r) => r.mealType !== null && r.mealType !== undefined);
          await db.user_favorite_foods.bulkDelete(nonNull.map((r) => r.id));
          const hasNull = existing.some((r) => r.mealType === null || r.mealType === undefined);
          if (!hasNull) {
            await db.user_favorite_foods.add({
              id: globalThis.crypto.randomUUID(),
              userId: userId ?? null,
              foodId,
              mealType: null,
              createdAt: now(),
            });
          }
          return;
        }

        // Diff vs existing: remove rows no longer selected (including the
        // NULL/unassigned row, since a non-empty selection replaces it),
        // add rows for newly selected meal types.
        const wanted = new Set(mealTypes);
        const toRemove = existing.filter(
          (r) => r.mealType === null || r.mealType === undefined || !wanted.has(r.mealType)
        );
        if (toRemove.length > 0) {
          await db.user_favorite_foods.bulkDelete(toRemove.map((r) => r.id));
        }

        const existingMealTypes = new Set(
          existing
            .filter((r) => r.mealType !== null && r.mealType !== undefined)
            .map((r) => r.mealType as MealType)
        );
        const toAdd = mealTypes.filter((m) => !existingMealTypes.has(m));
        for (const mealType of toAdd) {
          await db.user_favorite_foods.add({
            id: globalThis.crypto.randomUUID(),
            userId: userId ?? null,
            foodId,
            mealType,
            createdAt: now(),
          });
        }
      });
    },

    async getMealsForFood(foodId, userId) {
      const rows = await db.user_favorite_foods.where("foodId").equals(foodId).toArray();
      return rows.filter((r) => sameOwner(r.userId, userId)).map((r) => r.mealType ?? null);
    },

    async listWithMeals(userId) {
      const rows = await db.user_favorite_foods.toArray();
      return rows
        .filter((r) => sameOwner(r.userId, userId))
        .map((r) => ({ foodId: r.foodId, mealType: r.mealType ?? null }));
    },
  };

  // ── Progress (progress_entries + progress_photos) ───────────────────────

  const progress: ProgressRepo = {
    async getByDate(date) {
      const row = await db.progress_entries.where("date").equals(date).first();
      if (!row) return null;
      const photos = await progress.getPhotos(row.id);
      return { ...row, photos };
    },

    async getRange(from, to) {
      const rows = await db.progress_entries.where("date").between(from, to, true, true).toArray();
      return rows.sort((a, b) => a.date.localeCompare(b.date));
    },

    async upsertByDate(input, profile) {
      return db.transaction("rw", db.progress_entries, db.progress_photos, async () => {
        const existing = await db.progress_entries.where("date").equals(input.date).first();

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
          bodyFatPct = await progress.getLatestBodyFat();
        }

        const row: ProgressEntryRow = {
          id: existing?.id ?? globalThis.crypto.randomUUID(),
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
          createdAt: existing?.createdAt ?? now(),
          updatedAt: now(),
        };
        await db.progress_entries.put(row);

        // Replace-on-edit: delete old photos, insert new ones (design: photo
        // replace-on-edit inside the same transaction).
        const existingPhotoKeys = await db.progress_photos
          .where("entryId")
          .equals(row.id)
          .primaryKeys();
        await db.progress_photos.bulkDelete(existingPhotoKeys);

        if (input.photos.length > 0) {
          const photoRows: ProgressPhotoRow[] = input.photos.map((photo, index) => ({
            id: globalThis.crypto.randomUUID(),
            entryId: row.id,
            blob: photo.blob,
            mimeType: photo.mimeType,
            position: index,
            createdAt: now(),
          }));
          await db.progress_photos.bulkAdd(photoRows);
        }

        return row;
      });
    },

    async getPhotos(entryId) {
      const rows = await db.progress_photos.where("entryId").equals(entryId).toArray();
      return rows
        .sort((a, b) => a.position - b.position)
        .map((r) => ({
          id: r.id,
          entryId: r.entryId,
          blob: r.blob,
          mimeType: r.mimeType,
          position: r.position,
        }));
    },

    async getLatestBodyFat(beforeDate) {
      let rows = await db.progress_entries.toArray();
      if (beforeDate) {
        rows = rows.filter((r) => r.date < beforeDate);
      }
      const withBodyFat = rows
        .filter((r): r is ProgressEntryRow & { bodyFatPct: number } => r.bodyFatPct != null)
        .sort((a, b) => b.date.localeCompare(a.date));
      return withBodyFat[0]?.bodyFatPct ?? null;
    },

    async deleteByDate(date) {
      await db.transaction("rw", db.progress_entries, db.progress_photos, async () => {
        const existing = await db.progress_entries.where("date").equals(date).first();
        if (!existing) return; // no-op: nothing to delete for this date

        const photoKeys = await db.progress_photos
          .where("entryId")
          .equals(existing.id)
          .primaryKeys();
        await db.progress_photos.bulkDelete(photoKeys);
        await db.progress_entries.delete(existing.id);
      });
    },
  };

  // ── OFF category corrections (single aggregate row) ────────────────────────

  const OFF_CATEGORY_CORRECTIONS_ID = 1;

  const offCategoryCorrections: OffCategoryCorrectionsRepo = {
    async increment() {
      await db.transaction("rw", db.off_category_corrections, async () => {
        const existing = await db.off_category_corrections.get(OFF_CATEGORY_CORRECTIONS_ID);
        await db.off_category_corrections.put({
          id: OFF_CATEGORY_CORRECTIONS_ID,
          correctionCount: (existing?.correctionCount ?? 0) + 1,
          updatedAt: now(),
        });
      });
    },

    async getCount() {
      const row = await db.off_category_corrections.get(OFF_CATEGORY_CORRECTIONS_ID);
      return row?.correctionCount ?? 0;
    },
  };

  // ── Public adapter ────────────────────────────────────────────────────────

  return {
    ready,
    foods,
    profile,
    mealEntries,
    syncQueue,
    favorites,
    progress,
    offCategoryCorrections,

    async getAppliedMigrationTags() {
      const rows = await db.__drizzle_migrations.toArray();
      return rows.map((r) => r.tag);
    },

    close() {
      db.close();
    },
  };
}
