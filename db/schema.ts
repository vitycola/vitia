import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

// ── users_profile (single row, id = 1) ───────────────────────────────
export const usersProfile = sqliteTable("users_profile", {
  id: integer("id").primaryKey(), // always 1
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
    source: text("source", { enum: ["openfoodfacts", "custom"] }).notNull(),
    offProductCode: text("off_product_code"),
    nameNormalized: text("name_normalized").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`(CURRENT_TIMESTAMP)`),
  },
  (t) => ({
    nameIdx: index("foods_name_idx").on(t.name),
    offCodeIdx: index("foods_off_code_idx").on(t.offProductCode),
    nameNormalizedIdx: index("foods_name_normalized_idx").on(t.nameNormalized),
  })
);

// ── meal_entries (the diary; denormalized macros) ─────────────────────
export const mealEntries = sqliteTable(
  "meal_entries",
  {
    id: text("id").primaryKey(), // UUID
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
  },
  (t) => ({
    dateIdx: index("meal_entries_date_idx").on(t.date),
    dateMealIdx: index("meal_entries_date_meal_idx").on(t.date, t.mealType),
  })
);

// Inferred types (single source of truth for the app)
export type UserProfile = typeof usersProfile.$inferSelect;
export type NewUserProfile = typeof usersProfile.$inferInsert;
export type Food = typeof foods.$inferSelect;
export type NewFood = typeof foods.$inferInsert;
export type MealEntry = typeof mealEntries.$inferSelect;
export type NewMealEntry = typeof mealEntries.$inferInsert;
