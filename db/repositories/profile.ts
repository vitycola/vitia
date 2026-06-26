import { db, dexieAdapter } from "@/db/client";
import { usersProfile } from "@/db/schema";
import type { NewUserProfile, UserProfile } from "@/db/schema";
import { eq } from "drizzle-orm";

// The profile is a singleton row with id = 1.
const PROFILE_ID = 1;

/**
 * Retrieve the single user profile row.
 * Returns null if no profile has been saved yet (first launch).
 */
export async function getProfile(): Promise<UserProfile | null> {
  if (dexieAdapter) return dexieAdapter.profile.getProfile();
  const rows = await db.select().from(usersProfile).where(eq(usersProfile.id, PROFILE_ID)).limit(1);
  return rows[0] ?? null;
}

/**
 * Insert or replace the user profile (always id = 1).
 * A second call updates rather than creating a second row.
 */
export async function upsertProfile(data: Omit<NewUserProfile, "id">): Promise<UserProfile> {
  if (dexieAdapter) return dexieAdapter.profile.upsertProfile(data);
  const rows = await db
    .insert(usersProfile)
    .values({ ...data, id: PROFILE_ID })
    .onConflictDoUpdate({
      target: usersProfile.id,
      set: {
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
        useManualGoals: data.useManualGoals,
        updatedAt: new Date().toISOString(),
      },
    })
    .returning();

  return rows[0];
}
