/**
 * Pure mappers between local (camelCase) rows and the remote Supabase
 * (snake_case) schema defined in .claude/supabase-setup.sql.
 *
 * Also exposes `normalizeQueuedPayload`, which upgrades legacy camelCase
 * payloads that were persisted in `sync_queue` before the mappers existed.
 *
 * progress_entries has no remote table yet, so its payloads pass through
 * untouched.
 */

import type { GoalHistoryEntry, MealEntry, UserProfile } from "@/db/schema";

export interface RemoteMealEntry {
  id: string;
  user_id: string;
  date: string;
  meal_type: MealEntry["mealType"];
  food_id: string;
  food_name: string;
  quantity_g: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  logged_at: string;
  updated_at: string | null;
}

export interface RemoteProfile {
  user_id: string;
  age: number;
  height_cm: number;
  weight_kg: number;
  sex: UserProfile["sex"];
  activity_level: UserProfile["activityLevel"];
  goal: UserProfile["goal"];
  calorie_goal: number;
  protein_goal_g: number;
  carbs_goal_g: number;
  fat_goal_g: number;
  use_manual_goals: boolean;
  created_at: string;
  updated_at: string;
}

export interface RemoteGoalHistory {
  user_id: string;
  effective_from: string;
  calorie_goal: number;
  protein_goal_g: number;
  carbs_goal_g: number;
  fat_goal_g: number;
  use_manual_goals: boolean;
  created_at: string;
  updated_at: string;
}

// ── meal_entries ────────────────────────────────────────────────────────

export function mealEntryToRemote(entry: MealEntry, userId: string): RemoteMealEntry {
  return {
    id: entry.id,
    user_id: userId,
    date: entry.date,
    meal_type: entry.mealType,
    food_id: entry.foodId,
    food_name: entry.foodName,
    quantity_g: entry.quantityG,
    calories: entry.calories,
    protein_g: entry.proteinG,
    carbs_g: entry.carbsG,
    fat_g: entry.fatG,
    logged_at: entry.loggedAt,
    updated_at: entry.updatedAt ?? null,
  };
}

/** Maps a remote row to the local shape. `userId` is stored locally as-is. */
export function mealEntryFromRemote(row: RemoteMealEntry): MealEntry {
  return {
    id: row.id,
    userId: row.user_id,
    date: row.date,
    mealType: row.meal_type,
    foodId: row.food_id,
    foodName: row.food_name,
    quantityG: row.quantity_g,
    calories: row.calories,
    proteinG: row.protein_g,
    carbsG: row.carbs_g,
    fatG: row.fat_g,
    loggedAt: row.logged_at,
    updatedAt: row.updated_at ?? null,
  };
}

// ── users_profile ───────────────────────────────────────────────────────

/** The remote table has no `id` column (user_id is the primary key). */
export function profileToRemote(profile: UserProfile, userId: string): RemoteProfile {
  return {
    user_id: userId,
    age: profile.age,
    height_cm: profile.heightCm,
    weight_kg: profile.weightKg,
    sex: profile.sex,
    activity_level: profile.activityLevel,
    goal: profile.goal,
    calorie_goal: profile.calorieGoal,
    protein_goal_g: profile.proteinGoalG,
    carbs_goal_g: profile.carbsGoalG,
    fat_goal_g: profile.fatGoalG,
    use_manual_goals: profile.useManualGoals,
    created_at: profile.createdAt,
    updated_at: profile.updatedAt,
  };
}

/** Returns the fields accepted by `profileRepo.upsertProfile` (no id). */
export function profileFromRemote(row: RemoteProfile): Omit<UserProfile, "id"> {
  return {
    userId: row.user_id,
    age: row.age,
    heightCm: row.height_cm,
    weightKg: row.weight_kg,
    sex: row.sex,
    activityLevel: row.activity_level,
    goal: row.goal,
    calorieGoal: row.calorie_goal,
    proteinGoalG: row.protein_goal_g,
    carbsGoalG: row.carbs_goal_g,
    fatGoalG: row.fat_goal_g,
    useManualGoals: row.use_manual_goals,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ── goal_history ────────────────────────────────────────────────────────

/** The remote table is keyed by (user_id, effective_from). */
export function goalHistoryToRemote(entry: GoalHistoryEntry, userId: string): RemoteGoalHistory {
  return {
    user_id: userId,
    effective_from: entry.effectiveFrom,
    calorie_goal: entry.calorieGoal,
    protein_goal_g: entry.proteinGoalG,
    carbs_goal_g: entry.carbsGoalG,
    fat_goal_g: entry.fatGoalG,
    use_manual_goals: entry.useManualGoals,
    created_at: entry.createdAt,
    updated_at: entry.updatedAt,
  };
}

/** Maps a remote row to the local shape. `userId` is stored locally as-is. */
export function goalHistoryFromRemote(row: RemoteGoalHistory): GoalHistoryEntry {
  return {
    effectiveFrom: row.effective_from,
    userId: row.user_id,
    calorieGoal: row.calorie_goal,
    proteinGoalG: row.protein_goal_g,
    carbsGoalG: row.carbs_goal_g,
    fatGoalG: row.fat_goal_g,
    useManualGoals: row.use_manual_goals,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ── Legacy queue normalization ──────────────────────────────────────────

const MEAL_ENTRY_KEYS: Record<string, string> = {
  userId: "user_id",
  mealType: "meal_type",
  foodId: "food_id",
  foodName: "food_name",
  quantityG: "quantity_g",
  proteinG: "protein_g",
  carbsG: "carbs_g",
  fatG: "fat_g",
  loggedAt: "logged_at",
  updatedAt: "updated_at",
};

const PROFILE_KEYS: Record<string, string> = {
  userId: "user_id",
  heightCm: "height_cm",
  weightKg: "weight_kg",
  activityLevel: "activity_level",
  calorieGoal: "calorie_goal",
  proteinGoalG: "protein_goal_g",
  carbsGoalG: "carbs_goal_g",
  fatGoalG: "fat_goal_g",
  useManualGoals: "use_manual_goals",
  createdAt: "created_at",
  updatedAt: "updated_at",
};

const GOAL_HISTORY_KEYS: Record<string, string> = {
  userId: "user_id",
  effectiveFrom: "effective_from",
  calorieGoal: "calorie_goal",
  proteinGoalG: "protein_goal_g",
  carbsGoalG: "carbs_goal_g",
  fatGoalG: "fat_goal_g",
  useManualGoals: "use_manual_goals",
  createdAt: "created_at",
  updatedAt: "updated_at",
};

const MEAL_ENTRY_COLUMNS = new Set([
  "id",
  "user_id",
  "date",
  "meal_type",
  "food_id",
  "food_name",
  "quantity_g",
  "calories",
  "protein_g",
  "carbs_g",
  "fat_g",
  "logged_at",
  "updated_at",
]);

const PROFILE_COLUMNS = new Set([
  "user_id",
  "age",
  "height_cm",
  "weight_kg",
  "sex",
  "activity_level",
  "goal",
  "calorie_goal",
  "protein_goal_g",
  "carbs_goal_g",
  "fat_goal_g",
  "use_manual_goals",
  "created_at",
  "updated_at",
]);

const GOAL_HISTORY_COLUMNS = new Set([
  "user_id",
  "effective_from",
  "calorie_goal",
  "protein_goal_g",
  "carbs_goal_g",
  "fat_goal_g",
  "use_manual_goals",
  "created_at",
  "updated_at",
]);

function renameKeys(
  payload: Record<string, unknown>,
  keyMap: Record<string, string>,
  columns: Set<string>,
  userId: string
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    const target = keyMap[key] ?? key;
    // Keep an already-snake_case value if both spellings are present
    if (target !== key && target in payload) continue;
    if (columns.has(target)) out[target] = value;
  }
  // The queue op owner is authoritative; local userId may be null/stale.
  out.user_id = userId;
  return out;
}

/**
 * Normalizes an upsert payload read from the sync queue to the remote
 * snake_case schema. Idempotent: already-normalized payloads are unchanged
 * apart from column filtering. Tables without a remote mapping pass through.
 */
export function normalizeQueuedPayload(
  table: string,
  payload: Record<string, unknown>,
  userId: string
): Record<string, unknown> {
  if (table === "meal_entries") {
    return renameKeys(payload, MEAL_ENTRY_KEYS, MEAL_ENTRY_COLUMNS, userId);
  }
  if (table === "users_profile") {
    return renameKeys(payload, PROFILE_KEYS, PROFILE_COLUMNS, userId);
  }
  if (table === "goal_history") {
    return renameKeys(payload, GOAL_HISTORY_KEYS, GOAL_HISTORY_COLUMNS, userId);
  }
  return payload;
}
