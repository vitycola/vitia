// Re-export Drizzle inferred types as the shared type surface for the app.
// Add app-level types and enums here as they are defined in later PRs.

export type {
  UserProfile,
  NewUserProfile,
  Food,
  NewFood,
  MealEntry,
  NewMealEntry,
} from "@/db/schema";

export type { MealEntryView } from "@/db/repositories/mealEntries";

export type MealType = "breakfast" | "lunch" | "dinner" | "snack";
export type Sex = "male" | "female";
export type ActivityLevel =
  | "sedentary"
  | "lightly_active"
  | "moderately_active"
  | "very_active"
  | "extra_active";
export type Goal = "lose_weight" | "maintain" | "gain_muscle";
