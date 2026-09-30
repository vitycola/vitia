/**
 * Integration: real useProfileStore + useProgressStore over in-memory fake
 * repos. Verifies the "profile weight = latest weigh-in" rule end to end.
 */
jest.mock("@/lib/date", () => ({
  todayISO: () => "2026-03-10",
}));

jest.mock("@/db/repos/profile", () => {
  let row: Record<string, unknown> | null = null;
  return {
    getProfile: jest.fn(async () => row),
    upsertProfile: jest.fn(async (data: Record<string, unknown>) => {
      row = { id: 1, userId: null, createdAt: "x", updatedAt: "x", ...data };
      return row;
    }),
    __reset: () => {
      row = null;
    },
  };
});

jest.mock("@/db/repos/progress", () => {
  const rows = new Map<string, Record<string, unknown>>();
  return {
    getByDate: jest.fn(async (date: string) => {
      const r = rows.get(date);
      return r ? { ...r, photos: [] } : null;
    }),
    getRange: jest.fn(async (from: string, to: string) =>
      [...rows.values()].filter((r) => (r.date as string) >= from && (r.date as string) <= to)
    ),
    upsertByDate: jest.fn(async (input: Record<string, unknown>) => {
      const row = { id: `e-${input.date}`, ...input };
      rows.set(input.date as string, row);
      return row;
    }),
    deleteByDate: jest.fn(async (date: string) => {
      rows.delete(date);
    }),
    __reset: () => rows.clear(),
  };
});

import * as profileRepo from "@/db/repos/profile";
import * as progressRepo from "@/db/repos/progress";
import { computeAutoGoals } from "@/lib/nutrition";
import { useProfileStore } from "@/stores/useProfileStore";
import { useProgressStore } from "@/stores/useProgressStore";

const base = {
  age: 30,
  heightCm: 175,
  weightKg: 82,
  sex: "male" as const,
  activityLevel: "moderately_active" as const,
  goal: "maintain" as const,
};

describe("profile weight follows the latest weigh-in (integration)", () => {
  beforeEach(async () => {
    (profileRepo as unknown as { __reset: () => void }).__reset();
    (progressRepo as unknown as { __reset: () => void }).__reset();
    useProfileStore.setState({ profile: null, hasProfile: false, isLoading: false });
    useProgressStore.setState({ current: null });
    await useProfileStore.getState().saveProfile(base);
  });

  it("recordWeight(today) updates the profile weight and recomputes goals", async () => {
    await useProgressStore.getState().recordWeight("2026-03-10", 80);

    const profile = useProfileStore.getState().profile;
    expect(profile?.weightKg).toBe(80);
    expect(profile?.calorieGoal).toBe(computeAutoGoals({ ...base, weightKg: 80 }).calorieGoal);
    expect(profile?.calorieGoal).not.toBe(computeAutoGoals(base).calorieGoal);
  });

  it("saving a past, lower weigh-in does not change the profile", async () => {
    await useProgressStore.getState().recordWeight("2026-03-10", 80);
    await useProgressStore.getState().saveEntry({ date: "2026-02-01", weightKg: 70, photos: [] });

    expect(useProfileStore.getState().profile?.weightKg).toBe(80);
  });
});
