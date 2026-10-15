import type { MealEntry, UserProfile } from "@/db/schema";
import {
  mealEntryFromRemote,
  mealEntryToRemote,
  normalizeQueuedPayload,
  profileFromRemote,
  profileToRemote,
} from "@/src/services/syncMappers";

const entry: MealEntry = {
  id: "e1",
  userId: null,
  date: "2026-01-02",
  mealType: "lunch",
  foodId: "f1",
  foodName: "Rice",
  quantityG: 150,
  calories: 195,
  proteinG: 4,
  carbsG: 42,
  fatG: 0.5,
  loggedAt: "2026-01-02T12:00:00.000Z",
  updatedAt: null,
};

const profile: UserProfile = {
  id: 1,
  userId: null,
  age: 30,
  heightCm: 180,
  weightKg: 80,
  sex: "male",
  activityLevel: "moderately_active",
  goal: "maintain",
  calorieGoal: 2500,
  proteinGoalG: 150,
  carbsGoalG: 300,
  fatGoalG: 70,
  useManualGoals: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
};

describe("meal entry mapper", () => {
  it("maps to snake_case and uses the provided user id", () => {
    const remote = mealEntryToRemote(entry, "user-1");
    expect(remote).toEqual({
      id: "e1",
      user_id: "user-1",
      date: "2026-01-02",
      meal_type: "lunch",
      food_id: "f1",
      food_name: "Rice",
      quantity_g: 150,
      calories: 195,
      protein_g: 4,
      carbs_g: 42,
      fat_g: 0.5,
      logged_at: "2026-01-02T12:00:00.000Z",
      updated_at: null,
    });
  });

  it("round-trips through the remote shape", () => {
    const back = mealEntryFromRemote(mealEntryToRemote(entry, "user-1"));
    expect(back).toEqual({ ...entry, userId: "user-1" });
  });
});

describe("profile mapper", () => {
  it("drops the local id and maps to snake_case", () => {
    const remote = profileToRemote(profile, "user-1");
    expect(remote).not.toHaveProperty("id");
    expect(remote.user_id).toBe("user-1");
    expect(remote.height_cm).toBe(180);
    expect(remote.use_manual_goals).toBe(false);
  });

  it("round-trips through the remote shape", () => {
    const { id: _id, ...rest } = profile;
    expect(profileFromRemote(profileToRemote(profile, "user-1"))).toEqual({
      ...rest,
      userId: "user-1",
    });
  });
});

describe("normalizeQueuedPayload", () => {
  it("converts a legacy camelCase meal entry and uses the op owner as user_id", () => {
    const legacy = { ...entry, user_id: "stale" };
    const out = normalizeQueuedPayload("meal_entries", legacy, "user-1");
    expect(out).toEqual(mealEntryToRemote(entry, "user-1"));
  });

  it("is idempotent for already-normalized payloads", () => {
    const remote = mealEntryToRemote(entry, "user-1");
    expect(normalizeQueuedPayload("meal_entries", { ...remote }, "user-1")).toEqual(remote);
  });

  it("converts a legacy profile payload and removes the id column", () => {
    const out = normalizeQueuedPayload(
      "users_profile",
      { ...profile, user_id: "user-1" },
      "user-1"
    );
    expect(out).toEqual(profileToRemote(profile, "user-1"));
  });

  it("passes unmapped tables through untouched", () => {
    const payload = { date: "2026-01-01", weightKg: 80 };
    expect(normalizeQueuedPayload("progress_entries", payload, "user-1")).toBe(payload);
  });
});
