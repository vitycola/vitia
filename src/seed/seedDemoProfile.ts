/**
 * Demo weight-loss profile auto-seed.
 *
 * Runs once at app boot (src/main.tsx, after dbReady + initFromSession, before
 * first render) in non-production environments. Seeds a demo weightloss
 * profile with a 6-day meal/progress log window (one gap day) so the app
 * boots straight into populated screens instead of onboarding.
 *
 * Onboarding is gated purely by profile existence (day.tsx:102,
 * profile/layout.tsx:31) — no new "completed onboarding" flag is introduced;
 * seeding the profile row IS the onboarding-complete marker (design decision).
 *
 * Safety against ever reaching Supabase: `shouldSeed()` refuses to run at
 * all whenever cloud sync is enabled AND a real user session is already
 * authenticated at boot time. This is the actual structural guarantee — the
 * repos in db/repos/* read the LIVE useAuthStore userId at write time (not
 * any value the fixtures set), so a fixture-level `userId: null` alone does
 * NOT stop a sync enqueue if a real session happens to be active while
 * seeding runs. Gating at `shouldSeed()` closes that gap for every write in
 * this module.
 *
 * Design: sdd/demo-weight-loss-profile-seed/design
 * Spec:   sdd/demo-weight-loss-profile-seed/spec (REQ-1..REQ-8)
 */

import * as foodsRepo from "@/db/repos/foods";
import * as mealEntriesRepo from "@/db/repos/mealEntries";
import * as profileRepo from "@/db/repos/profile";
import * as progressRepo from "@/db/repos/progress";
import type { NewFood, NewMealEntry } from "@/db/schema";
import { generateId } from "@/lib/id";
import { computeBMR, computeTDEE, deriveCalorieGoal, deriveMacros } from "@/lib/nutrition";
import { isSyncEnabled } from "@/src/lib/supabase";
import { getDemoSeedEnv, getHostname, getLocationSearch } from "@/src/seed/env";
import { useAuthStore } from "@/src/stores/useAuthStore";

// ---------------------------------------------------------------------------
// Environment gating (REQ-7)
// ---------------------------------------------------------------------------

/**
 * Known production hostnames for the runtime PROD + hostname guard.
 *
 * Ships empty: the canonical production domain is not discoverable from any
 * git-tracked file (no `homepage` in package.json, no domain in vercel.json).
 * Safety is instead carried by two other layers that do not depend on this
 * list: (1) `VITE_ENABLE_DEMO_SEED` is scoped to Preview+Development only in
 * Vercel project settings (build-time), and (2) `shouldSeed()` refuses to run
 * whenever cloud sync is enabled and a real user session is authenticated,
 * which structurally prevents seeded rows from ever reaching Supabase
 * regardless of this list. Add real hostnames here if/when the production
 * domain is confirmed, to get a third, independent runtime backstop.
 */
export const KNOWN_PROD_HOSTS: string[] = [];

/**
 * Whether the demo seed is permitted to run in the current environment.
 *
 * (DEV || VITE_ENABLE_DEMO_SEED === "true") && !(PROD && known prod host)
 *   && !(cloud sync enabled && a real user session is authenticated)
 *
 * The last clause is the structural guarantee that seeded data can never
 * reach Supabase: db/repos/{profile,mealEntries,progress}.ts read the LIVE
 * useAuthStore userId at write time (not any value this module passes), and
 * `_enqueue*` only skips the sync op when `!userId`. Setting `userId: null`
 * on the seed's own fixtures does NOT prevent that read — the only reliable
 * guard is refusing to seed at all whenever sync is enabled and a real
 * session is present, since a real session can only exist once
 * `initFromSession()` has resolved (which always runs before this seed).
 */
export function shouldSeed(): boolean {
  const env = getDemoSeedEnv();
  const flagEnabled = env.DEV === true || env.VITE_ENABLE_DEMO_SEED === "true";
  const onKnownProdHost = env.PROD === true && KNOWN_PROD_HOSTS.includes(getHostname());
  const { userId } = useAuthStore.getState();
  const wouldSync = isSyncEnabled() && userId != null;
  return flagEnabled && !onKnownProdHost && !wouldSync;
}

// ---------------------------------------------------------------------------
// Day-window helpers (6 calendar days, D-5..D0, gap at D-3)
// ---------------------------------------------------------------------------

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function daysAgo(n: number): string {
  return new Date(Date.now() - n * ONE_DAY_MS).toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Demo foods fixture (REQ-5) — created before any meal insert (FK dependency)
// ---------------------------------------------------------------------------

export const DEMO_FOODS: NewFood[] = [
  {
    id: "demo-food-oatmeal",
    name: "Avena con fruta",
    caloriesPer100g: 370,
    proteinPer100g: 13,
    carbsPer100g: 60,
    fatPer100g: 7,
    source: "custom",
    nameNormalized: "avena con fruta",
  },
  {
    id: "demo-food-chicken-rice",
    name: "Pollo con arroz",
    caloriesPer100g: 190,
    proteinPer100g: 18,
    carbsPer100g: 22,
    fatPer100g: 4,
    source: "custom",
    nameNormalized: "pollo con arroz",
  },
  {
    id: "demo-food-salad",
    name: "Ensalada mixta",
    caloriesPer100g: 60,
    proteinPer100g: 3,
    carbsPer100g: 8,
    fatPer100g: 2,
    source: "custom",
    nameNormalized: "ensalada mixta",
  },
  {
    id: "demo-food-yogurt",
    name: "Yogur griego",
    caloriesPer100g: 120,
    proteinPer100g: 10,
    carbsPer100g: 6,
    fatPer100g: 5,
    source: "custom",
    nameNormalized: "yogur griego",
  },
  {
    id: "demo-food-salmon",
    name: "Salmón a la plancha",
    caloriesPer100g: 210,
    proteinPer100g: 22,
    carbsPer100g: 0,
    fatPer100g: 13,
    source: "custom",
    nameNormalized: "salmon a la plancha",
  },
];

// ---------------------------------------------------------------------------
// Demo meal entries fixture (REQ-2) — 6-day window, gap at D-3
// ---------------------------------------------------------------------------

interface DayMealPlan {
  dayOffset: number;
  meals: Array<{
    mealType: NewMealEntry["mealType"];
    foodId: string;
    foodName: string;
    quantityG: number;
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
  }>;
}

const [OATMEAL, CHICKEN_RICE, SALAD, YOGURT, SALMON] = DEMO_FOODS;

// Day-by-day shape per design/spec table (D-5..D0, gap at D-3).
const DAY_PLANS: DayMealPlan[] = [
  {
    dayOffset: 5,
    meals: [
      {
        mealType: "breakfast",
        foodId: OATMEAL.id,
        foodName: OATMEAL.name,
        quantityG: 150,
        calories: 555,
        proteinG: 19.5,
        carbsG: 90,
        fatG: 10.5,
      },
      {
        mealType: "lunch",
        foodId: CHICKEN_RICE.id,
        foodName: CHICKEN_RICE.name,
        quantityG: 350,
        calories: 665,
        proteinG: 63,
        carbsG: 77,
        fatG: 14,
      },
      {
        mealType: "snack",
        foodId: YOGURT.id,
        foodName: YOGURT.name,
        quantityG: 150,
        calories: 180,
        proteinG: 15,
        carbsG: 9,
        fatG: 7.5,
      },
      {
        mealType: "dinner",
        foodId: SALMON.id,
        foodName: SALMON.name,
        quantityG: 350,
        calories: 735,
        proteinG: 77,
        carbsG: 0,
        fatG: 45.5,
      },
    ],
  },
  {
    // UNDER goal (~1750 vs ~2200)
    dayOffset: 4,
    meals: [
      {
        mealType: "breakfast",
        foodId: OATMEAL.id,
        foodName: OATMEAL.name,
        quantityG: 100,
        calories: 370,
        proteinG: 13,
        carbsG: 60,
        fatG: 7,
      },
      {
        mealType: "lunch",
        foodId: SALAD.id,
        foodName: SALAD.name,
        quantityG: 300,
        calories: 180,
        proteinG: 9,
        carbsG: 24,
        fatG: 6,
      },
      {
        mealType: "snack",
        foodId: YOGURT.id,
        foodName: YOGURT.name,
        quantityG: 100,
        calories: 120,
        proteinG: 10,
        carbsG: 6,
        fatG: 5,
      },
      {
        mealType: "dinner",
        foodId: CHICKEN_RICE.id,
        foodName: CHICKEN_RICE.name,
        quantityG: 550,
        calories: 1045,
        proteinG: 99,
        carbsG: 121,
        fatG: 22,
      },
    ],
  },
  // D-3: intentional gap day — no plan entry, no meals.
  {
    // OVER goal (~2650 vs ~2200)
    dayOffset: 2,
    meals: [
      {
        mealType: "breakfast",
        foodId: OATMEAL.id,
        foodName: OATMEAL.name,
        quantityG: 200,
        calories: 740,
        proteinG: 26,
        carbsG: 120,
        fatG: 14,
      },
      {
        mealType: "lunch",
        foodId: CHICKEN_RICE.id,
        foodName: CHICKEN_RICE.name,
        quantityG: 450,
        calories: 855,
        proteinG: 81,
        carbsG: 99,
        fatG: 18,
      },
      {
        mealType: "snack",
        foodId: YOGURT.id,
        foodName: YOGURT.name,
        quantityG: 200,
        calories: 240,
        proteinG: 20,
        carbsG: 12,
        fatG: 10,
      },
      {
        mealType: "dinner",
        foodId: SALMON.id,
        foodName: SALMON.name,
        quantityG: 390,
        calories: 819,
        proteinG: 86,
        carbsG: 0,
        fatG: 50.7,
      },
    ],
  },
  {
    // slightly under (~2050)
    dayOffset: 1,
    meals: [
      {
        mealType: "breakfast",
        foodId: OATMEAL.id,
        foodName: OATMEAL.name,
        quantityG: 150,
        calories: 555,
        proteinG: 19.5,
        carbsG: 90,
        fatG: 10.5,
      },
      {
        mealType: "lunch",
        foodId: SALAD.id,
        foodName: SALAD.name,
        quantityG: 250,
        calories: 150,
        proteinG: 7.5,
        carbsG: 20,
        fatG: 5,
      },
      {
        mealType: "dinner",
        foodId: SALMON.id,
        foodName: SALMON.name,
        quantityG: 640,
        calories: 1344,
        proteinG: 140.8,
        carbsG: 0,
        fatG: 83.2,
      },
    ],
  },
  {
    // on target (~2200)
    dayOffset: 0,
    meals: [
      {
        mealType: "breakfast",
        foodId: OATMEAL.id,
        foodName: OATMEAL.name,
        quantityG: 150,
        calories: 555,
        proteinG: 19.5,
        carbsG: 90,
        fatG: 10.5,
      },
      {
        mealType: "lunch",
        foodId: CHICKEN_RICE.id,
        foodName: CHICKEN_RICE.name,
        quantityG: 450,
        calories: 855,
        proteinG: 81,
        carbsG: 99,
        fatG: 18,
      },
      {
        mealType: "dinner",
        foodId: SALMON.id,
        foodName: SALMON.name,
        quantityG: 380,
        calories: 798,
        proteinG: 83.6,
        carbsG: 0,
        fatG: 49.4,
      },
    ],
  },
];

/** Builds the fixture rows for mealEntries.insertBulk() (REQ-2, REQ-5). */
export function buildDemoMealEntries(): NewMealEntry[] {
  const entries: NewMealEntry[] = [];
  for (const plan of DAY_PLANS) {
    const date = daysAgo(plan.dayOffset);
    for (const meal of plan.meals) {
      entries.push({
        id: generateId(),
        userId: null,
        date,
        mealType: meal.mealType,
        foodId: meal.foodId,
        foodName: meal.foodName,
        quantityG: meal.quantityG,
        calories: meal.calories,
        proteinG: meal.proteinG,
        carbsG: meal.carbsG,
        fatG: meal.fatG,
      });
    }
  }
  return entries;
}

// ---------------------------------------------------------------------------
// Demo progress entries fixture (REQ-3) — logged days only, weight trending down
// ---------------------------------------------------------------------------

interface DemoProgressFixture {
  date: string;
  weightKg: number;
  neckCm: number;
  chestCm: number;
  armCm: number;
  waistCm: number;
  hipCm: number;
  thighCm: number;
  hue: number;
}

// One entry per logged day (D-5, D-4, D-2, D-1, D0), weight trending
// 82.0 -> 81.2 (non-increasing), one distinct hue per day for its photo.
const PROGRESS_PLANS: Array<Omit<DemoProgressFixture, "date"> & { dayOffset: number }> = [
  {
    dayOffset: 5,
    weightKg: 82.0,
    neckCm: 39,
    chestCm: 102,
    armCm: 34,
    waistCm: 92,
    hipCm: 100,
    thighCm: 56,
    hue: 10,
  },
  {
    dayOffset: 4,
    weightKg: 81.8,
    neckCm: 39,
    chestCm: 101.5,
    armCm: 34,
    waistCm: 91.5,
    hipCm: 99.5,
    thighCm: 55.8,
    hue: 80,
  },
  // D-3: intentional gap day — no progress entry, no photo.
  {
    dayOffset: 2,
    weightKg: 81.6,
    neckCm: 38.8,
    chestCm: 101,
    armCm: 33.8,
    waistCm: 91,
    hipCm: 99,
    thighCm: 55.6,
    hue: 150,
  },
  {
    dayOffset: 1,
    weightKg: 81.4,
    neckCm: 38.8,
    chestCm: 100.5,
    armCm: 33.6,
    waistCm: 90.5,
    hipCm: 98.5,
    thighCm: 55.4,
    hue: 220,
  },
  {
    dayOffset: 0,
    weightKg: 81.2,
    neckCm: 38.6,
    chestCm: 100,
    armCm: 33.5,
    waistCm: 90,
    hipCm: 98,
    thighCm: 55.2,
    hue: 290,
  },
];

/**
 * Builds the fixture rows consumed by progress.upsertByDate() (REQ-3).
 * Deliberately omits bodyFatPct — the repo derives it via the Navy method
 * from the seeded profile's sex/heightCm plus these measurements.
 */
export function buildDemoProgressEntries(): DemoProgressFixture[] {
  return PROGRESS_PLANS.map(({ dayOffset, ...rest }) => ({
    date: daysAgo(dayOffset),
    ...rest,
  }));
}

// ---------------------------------------------------------------------------
// Placeholder photo generation (REQ-4) — client-side, no network
// ---------------------------------------------------------------------------

export interface PlaceholderPhoto {
  blob: Blob;
  mimeType: string;
}

/**
 * Generates a solid-color 64x64 PNG via an offscreen <canvas>, entirely
 * client-side and synchronous/local (no fetch, no Supabase Storage call).
 */
export function makePlaceholderPhoto(hue: number): Promise<PlaceholderPhoto> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      reject(new Error("[seedDemoProfile] canvas 2D context unavailable"));
      return;
    }

    ctx.fillStyle = `hsl(${hue}, 60%, 55%)`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("[seedDemoProfile] canvas.toBlob produced no blob"));
        return;
      }
      resolve({ blob, mimeType: "image/png" });
    }, "image/png");
  });
}

// ---------------------------------------------------------------------------
// Idempotency marker + reset (REQ-8)
// ---------------------------------------------------------------------------

const SEED_MARKER_KEY = "vitia.demoSeed";
const SEED_MARKER_VALUE = "v1";

function hasSeedMarker(): boolean {
  return window.localStorage.getItem(SEED_MARKER_KEY) === SEED_MARKER_VALUE;
}

function writeSeedMarker(): void {
  window.localStorage.setItem(SEED_MARKER_KEY, SEED_MARKER_VALUE);
}

function clearSeedMarker(): void {
  window.localStorage.removeItem(SEED_MARKER_KEY);
}

function isResetRequested(): boolean {
  return new URLSearchParams(getLocationSearch()).get("seedReset") === "1";
}

/**
 * Clears previously seeded demo rows (by known seeded dates) ahead of a
 * `?seedReset=1` re-seed. Foods are left in place (idempotent upsertMany
 * re-creates/overwrites them harmlessly on the next seed pass) — only the
 * per-date progress rows are removed here since mealEntries doesn't expose a
 * per-date bulk delete outside of deleteByDateAndMeal (meal-type scoped).
 */
async function clearPreviouslySeededRows(): Promise<void> {
  const allOffsets = [5, 4, 3, 2, 1, 0];
  for (const offset of allOffsets) {
    const date = daysAgo(offset);
    await progressRepo.deleteByDate(date);
    for (const mealType of ["breakfast", "lunch", "dinner", "snack"] as const) {
      await mealEntriesRepo.deleteByDateAndMeal(date, mealType);
    }
  }
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

/**
 * Seeds the demo weight-loss profile, meals, and progress log.
 *
 * Sequential writes (profile -> foods -> meals -> progress+photos); the
 * idempotency marker is written ONLY after every step succeeds. There is no
 * cross-repo transaction (repos dispatch across Dexie/OPFS with no shared tx
 * primitive), so a failure partway through intentionally leaves the marker
 * unwritten — the next boot retries from scratch rather than silently
 * leaving the app half-seeded forever.
 *
 * Never rejects: main.tsx's boot hook awaits this without its own try/catch,
 * so a seed failure must never block first render.
 */
export async function seedDemoProfile(): Promise<void> {
  if (!shouldSeed()) return;

  try {
    if (isResetRequested()) {
      await clearPreviouslySeededRows();
      clearSeedMarker();
    }

    if (hasSeedMarker()) return;

    // 1. Profile — satisfies the onboarding gate (REQ-1, REQ-6).
    await profileRepo.upsertProfile(buildDemoProfileUpsert());

    // 2. Foods — must exist before any meal insert (FK target, REQ-5).
    await foodsRepo.upsertMany(DEMO_FOODS);

    // 3. Meal entries — 6-day window with gap at D-3 (REQ-2).
    await mealEntriesRepo.insertBulk(buildDemoMealEntries());

    // 4. Progress entries + one placeholder photo per logged day (REQ-3, REQ-4).
    for (const entry of buildDemoProgressEntries()) {
      const photo = await makePlaceholderPhoto(entry.hue);
      await progressRepo.upsertByDate({
        date: entry.date,
        weightKg: entry.weightKg,
        neckCm: entry.neckCm,
        chestCm: entry.chestCm,
        armCm: entry.armCm,
        waistCm: entry.waistCm,
        hipCm: entry.hipCm,
        thighCm: entry.thighCm,
        photos: [photo],
      });
    }

    // 5. Marker last — only after every write above has succeeded (REQ-8).
    writeSeedMarker();
  } catch (err) {
    console.error(
      "[seedDemoProfile] seeding failed — marker not written, will retry next boot",
      err
    );
  }
}

/** Fixed demo profile inputs (REQ-1). */
const DEMO_PROFILE_INPUT = {
  age: 33,
  heightCm: 178,
  weightKg: 82,
  sex: "male" as const,
  activityLevel: "moderately_active" as const,
  goal: "lose_weight" as const,
};

function buildDemoProfileUpsert() {
  const bmr = computeBMR(DEMO_PROFILE_INPUT);
  const tdee = computeTDEE(bmr, DEMO_PROFILE_INPUT.activityLevel);
  const calorieGoal = deriveCalorieGoal(tdee, DEMO_PROFILE_INPUT.goal);
  const macros = deriveMacros(calorieGoal);

  return {
    ...DEMO_PROFILE_INPUT,
    calorieGoal,
    proteinGoalG: macros.proteinG,
    carbsGoalG: macros.carbsG,
    fatGoalG: macros.fatG,
    useManualGoals: false,
  };
}
