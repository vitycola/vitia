import { sql } from "drizzle-orm";
import {
  blob,
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

// ── users_profile (single row per user) ───────────────────────────────
export const usersProfile = sqliteTable("users_profile", {
  id: integer("id").primaryKey(), // always 1 in local DB (keyed to userId on cloud)
  userId: text("user_id"), // null when sync is disabled; Supabase auth.uid() when enabled
  age: integer("age").notNull(),
  heightCm: real("height_cm").notNull(),
  weightKg: real("weight_kg").notNull(),
  sex: text("sex", { enum: ["male", "female"] }).notNull(),
  activityLevel: text("activity_level", {
    enum: ["sedentary", "lightly_active", "moderately_active", "very_active", "extra_active"],
  }).notNull(),
  goal: text("goal", { enum: ["lose_weight", "maintain", "gain_muscle"] }).notNull(),
  calorieGoal: real("calorie_goal").notNull(),
  proteinGoalG: real("protein_goal_g").notNull(),
  carbsGoalG: real("carbs_goal_g").notNull(),
  fatGoalG: real("fat_goal_g").notNull(),
  useManualGoals: integer("use_manual_goals", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: text("updated_at").notNull().default(sql`(CURRENT_TIMESTAMP)`),
});

// ── foods (cache of OFF results + custom foods) ───────────────────────
export const foods = sqliteTable(
  "foods",
  {
    id: text("id").primaryKey(), // UUID (custom) or OFF product code
    name: text("name").notNull(),
    brand: text("brand"),
    caloriesPer100g: real("calories_per_100g").notNull(),
    proteinPer100g: real("protein_per_100g").notNull().default(0),
    carbsPer100g: real("carbs_per_100g").notNull().default(0),
    fatPer100g: real("fat_per_100g").notNull().default(0),
    servingSizeG: real("serving_size_g"),
    // "generic" added for generic_foods catalog (Supabase); "ai_photo" and
    // "ai_list" added for foods synthesized from AI-detected items
    // (ai-food-persistence), split by input mode (photo analysis vs.
    // text/list analysis) so the origin can be shown to the user later.
    // TS-level enum only — SQLite has no enum type, so no migration file is needed.
    source: text("source", {
      enum: ["openfoodfacts", "custom", "generic", "ai_photo", "ai_list"],
    }).notNull(),
    offProductCode: text("off_product_code"),
    nameNormalized: text("name_normalized").notNull().default(""),
    imageUrl: text("image_url"),
    // Nullable: null = uncategorized. Validated against lib/foodCategories.ts
    // keys at the app layer (not a SQL enum) because the category list is
    // expected to grow — see design.md "category column type".
    category: text("category"),
    // Nullable: null = unknown/unresolved basis (fail-closed — same discipline
    // as an unknown category). Reuses the "crudo"/"cocido" domain vocabulary
    // (see lib/cookingConversion.ts CookingBasis). Design: raw-cooked-conversion
    // D6.1 (sdd/raw-cooked-conversion/design).
    dataBasis: text("data_basis", { enum: ["crudo", "cocido"] }),
    createdAt: text("created_at").notNull().default(sql`(CURRENT_TIMESTAMP)`),
  },
  (t) => ({
    nameIdx: index("foods_name_idx").on(t.name),
    offCodeIdx: index("foods_off_code_idx").on(t.offProductCode),
    nameNormalizedIdx: index("foods_name_normalized_idx").on(t.nameNormalized),
  })
);

// ── food_ingredients (recipe rows for composite/created foods) ────────
// Child table persisting the recipe of a composite food so it can be
// reopened and edited. No FK cascade on delete: if an ingredient food is
// later deleted, the parent's snapshot macros remain locked at last save
// (spec: Dangling Ingredient Handling).
export const foodIngredients = sqliteTable(
  "food_ingredients",
  {
    id: text("id").primaryKey(), // UUID
    parentFoodId: text("parent_food_id")
      .notNull()
      .references(() => foods.id),
    ingredientFoodId: text("ingredient_food_id")
      .notNull()
      .references(() => foods.id),
    weightG: real("weight_g").notNull(),
    position: integer("position").notNull(),
    createdAt: text("created_at").notNull().default(sql`(CURRENT_TIMESTAMP)`),
  },
  (t) => ({
    parentIdx: index("food_ingredients_parent_idx").on(t.parentFoodId),
  })
);

// ── meal_entries (the diary; denormalized macros) ─────────────────────
export const mealEntries = sqliteTable(
  "meal_entries",
  {
    id: text("id").primaryKey(), // UUID
    userId: text("user_id"), // null when sync is disabled; Supabase auth.uid() when enabled
    date: text("date").notNull(), // YYYY-MM-DD device-local
    mealType: text("meal_type", {
      enum: ["breakfast", "lunch", "dinner", "snack"],
    }).notNull(),
    foodId: text("food_id")
      .notNull()
      .references(() => foods.id),
    foodName: text("food_name").notNull(), // denormalized snapshot (FR-034/045)
    quantityG: real("quantity_g").notNull(),
    calories: real("calories").notNull(), // computed at log time
    proteinG: real("protein_g").notNull(),
    carbsG: real("carbs_g").notNull(),
    fatG: real("fat_g").notNull(),
    loggedAt: text("logged_at").notNull().default(sql`(CURRENT_TIMESTAMP)`),
    updatedAt: text("updated_at"), // null when sync is disabled; ISO string when enabled
  },
  (t) => ({
    dateIdx: index("meal_entries_date_idx").on(t.date),
    dateMealIdx: index("meal_entries_date_meal_idx").on(t.date, t.mealType),
  })
);

// ── user_favorite_foods (user-scoped favorite join table) ─────────────
// Never a boolean on `foods` — that table is a SHARED OFF/custom cache and
// a boolean there would leak favorite state across users.
export const userFavoriteFoods = sqliteTable(
  "user_favorite_foods",
  {
    id: text("id").primaryKey(), // UUID
    userId: text("user_id"), // null when sync is disabled (local anonymous owner)
    foodId: text("food_id")
      .notNull()
      .references(() => foods.id),
    // Nullable: NULL = "unassigned" bucket. A food may hold multiple rows,
    // one per meal type it was favorited under (design: per-meal favorite rows).
    mealType: text("meal_type", {
      enum: ["breakfast", "lunch", "dinner", "snack"],
    }),
    createdAt: text("created_at").notNull().default(sql`(CURRENT_TIMESTAMP)`),
  },
  (t) => ({
    userFoodMealIdx: uniqueIndex("user_favorite_foods_user_food_meal_idx").on(
      t.userId,
      t.foodId,
      t.mealType
    ),
  })
);

// ── progress_entries (daily body-progress snapshot; single row per date) ──
export const progressEntries = sqliteTable(
  "progress_entries",
  {
    id: text("id").primaryKey(), // UUID
    userId: text("user_id"), // null when sync is disabled; Supabase auth.uid() when enabled
    date: text("date").notNull(), // YYYY-MM-DD device-local (unique — one record per day)
    weightKg: real("weight_kg"),
    neckCm: real("neck_cm"),
    chestCm: real("chest_cm"),
    armCm: real("arm_cm"),
    waistCm: real("waist_cm"),
    hipCm: real("hip_cm"),
    thighCm: real("thigh_cm"),
    bodyFatPct: real("body_fat_pct"), // stored Navy-method result or carry-forward
    notes: text("notes"),
    createdAt: text("created_at").notNull().default(sql`(CURRENT_TIMESTAMP)`),
    updatedAt: text("updated_at"),
  },
  (t) => ({
    dateIdx: uniqueIndex("progress_entries_date_idx").on(t.date),
  })
);

// ── progress_photos (child rows; binary blob, no sync in this change) ──
export const progressPhotos = sqliteTable(
  "progress_photos",
  {
    id: text("id").primaryKey(), // UUID
    entryId: text("entry_id")
      .notNull()
      .references(() => progressEntries.id),
    blob: blob("blob", { mode: "buffer" }).notNull(), // Buffer (OPFS) / Blob (Dexie) — repo normalizes
    mimeType: text("mime_type").notNull(),
    position: integer("position").notNull(),
    createdAt: text("created_at").notNull().default(sql`(CURRENT_TIMESTAMP)`),
  },
  (t) => ({
    entryIdx: index("progress_photos_entry_idx").on(t.entryId),
  })
);

// ── sync_queue (durable outbound operation queue) ─────────────────────
// Shared by both OPFS and Dexie backends (backed by IndexedDB on Dexie path,
// SQLite on OPFS path). Survives browser restarts and offline periods.
// Note: "progress_photos" is intentionally NOT in this enum — binary photo
// sync is deferred (design: Photo storage strategy across dual backend).
export const syncQueue = sqliteTable("sync_queue", {
  id: text("id").primaryKey(), // UUID — idempotent re-enqueue guard
  table: text("table", { enum: ["users_profile", "meal_entries", "progress_entries"] }).notNull(),
  op: text("op", { enum: ["upsert", "delete"] }).notNull(),
  row: text("row").notNull(), // JSON-serialised payload
  userId: text("user_id").notNull(),
  updatedAt: text("updated_at").notNull(), // ISO string; used for LWW ordering
});

// ── off_category_corrections (single aggregate row; device-local telemetry) ──
// Records how often a user manually corrects an auto-assigned OFF `category`
// (signal for a possible future manual-confirm UI — counter only, no UI in
// this change). Deliberately NOT in sync_queue's `table` enum — this is
// device-local telemetry, not user content (mirrors how progress_photos is
// intentionally excluded from sync). Design: raw-cooked-conversion D5
// (sdd/raw-cooked-conversion/design).
export const offCategoryCorrections = sqliteTable("off_category_corrections", {
  id: integer("id").primaryKey(), // always 1 — single aggregate row
  correctionCount: integer("correction_count").notNull().default(0),
  updatedAt: text("updated_at").notNull().default(sql`(CURRENT_TIMESTAMP)`),
});

// Inferred types (single source of truth for the app)
export type UserProfile = typeof usersProfile.$inferSelect;
export type NewUserProfile = typeof usersProfile.$inferInsert;
export type Food = typeof foods.$inferSelect;
export type NewFood = typeof foods.$inferInsert;
export type MealEntry = typeof mealEntries.$inferSelect;
export type NewMealEntry = typeof mealEntries.$inferInsert;
export type UserFavoriteFood = typeof userFavoriteFoods.$inferSelect;
export type NewUserFavoriteFood = typeof userFavoriteFoods.$inferInsert;
export type SyncQueueRow = typeof syncQueue.$inferSelect;
export type NewSyncQueueRow = typeof syncQueue.$inferInsert;
export type FoodIngredient = typeof foodIngredients.$inferSelect;
export type NewFoodIngredient = typeof foodIngredients.$inferInsert;
export type ProgressEntry = typeof progressEntries.$inferSelect;
export type NewProgressEntry = typeof progressEntries.$inferInsert;
export type ProgressPhoto = typeof progressPhotos.$inferSelect;
export type NewProgressPhoto = typeof progressPhotos.$inferInsert;
export type OffCategoryCorrection = typeof offCategoryCorrections.$inferSelect;
export type NewOffCategoryCorrection = typeof offCategoryCorrections.$inferInsert;
