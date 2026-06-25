import type { Food, UserProfile } from "@/db/schema";

// ── Activity level multipliers (Mifflin-St Jeor) ──────────────────────
const ACTIVITY_MULTIPLIERS: Record<UserProfile["activityLevel"], number> = {
  sedentary: 1.2,
  lightly_active: 1.375,
  moderately_active: 1.55,
  very_active: 1.725,
  extra_active: 1.9,
};

// ── Goal multipliers ───────────────────────────────────────────────────
const GOAL_MULTIPLIERS: Record<UserProfile["goal"], number> = {
  lose_weight: 0.8,
  maintain: 1.0,
  gain_muscle: 1.1,
};

// ── Macro calorie densities (kcal per gram) ────────────────────────────
const PROTEIN_KCAL_PER_G = 4;
const CARBS_KCAL_PER_G = 4;
const FAT_KCAL_PER_G = 9;

// ── Macro split ratios (30/40/30) ─────────────────────────────────────
const PROTEIN_RATIO = 0.3;
const CARBS_RATIO = 0.4;
const FAT_RATIO = 0.3;

export interface MacroTargets {
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface PortionMacros {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

/**
 * Compute Basal Metabolic Rate using Mifflin-St Jeor formula.
 *
 * Male:   BMR = (10 × weight_kg) + (6.25 × height_cm) − (5 × age) + 5
 * Female: BMR = (10 × weight_kg) + (6.25 × height_cm) − (5 × age) − 161
 */
export function computeBMR(profile: {
  age: number;
  heightCm: number;
  weightKg: number;
  sex: UserProfile["sex"];
}): number {
  const base = 10 * profile.weightKg + 6.25 * profile.heightCm - 5 * profile.age;
  return profile.sex === "male" ? base + 5 : base - 161;
}

/**
 * Compute Total Daily Energy Expenditure by applying the activity multiplier.
 */
export function computeTDEE(bmr: number, activityLevel: UserProfile["activityLevel"]): number {
  return bmr * ACTIVITY_MULTIPLIERS[activityLevel];
}

/**
 * Derive calorie goal from TDEE by applying the goal multiplier.
 * Result is rounded to the nearest whole number.
 */
export function deriveCalorieGoal(tdee: number, goal: UserProfile["goal"]): number {
  return Math.round(tdee * GOAL_MULTIPLIERS[goal]);
}

/**
 * Derive macro targets (g) from a calorie goal using the 30/40/30 split.
 * Values are rounded to one decimal place; store full precision, display rounds.
 */
export function deriveMacros(calorieGoal: number): MacroTargets {
  return {
    proteinG: Math.round((calorieGoal * PROTEIN_RATIO) / PROTEIN_KCAL_PER_G),
    carbsG: Math.round((calorieGoal * CARBS_RATIO) / CARBS_KCAL_PER_G),
    fatG: Math.round((calorieGoal * FAT_RATIO) / FAT_KCAL_PER_G),
  };
}

/**
 * Scale food macros for a given portion in grams.
 * All values are derived from the food's per-100g data.
 * Store full precision; display callers may round.
 */
export function scalePortion(
  food: Pick<Food, "caloriesPer100g" | "proteinPer100g" | "carbsPer100g" | "fatPer100g">,
  grams: number
): PortionMacros {
  const factor = grams / 100;
  return {
    calories: food.caloriesPer100g * factor,
    proteinG: food.proteinPer100g * factor,
    carbsG: food.carbsPer100g * factor,
    fatG: food.fatPer100g * factor,
  };
}
