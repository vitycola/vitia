/**
 * Demo-data guard — keeps seeded demo rows and demo devices out of the cloud.
 *
 * Pure helpers (no repo or store imports) so every sync path can share them.
 */

/** localStorage key written by the demo seed once a device has been seeded. */
export const DEMO_SEED_MARKER_KEY = "vitia.demoSeed";
export const DEMO_SEED_MARKER_VALUE = "v1";

/**
 * Written at the START of seeding and never removed on success, so a seed that
 * fails halfway still marks the device as demo.
 */
export const DEMO_SEED_STARTED_KEY = "vitia.demoSeedStarted";

/** Food id prefix used by every demo fixture (see src/seed/seedDemoProfile.ts). */
export const DEMO_FOOD_ID_PREFIX = "demo-food-";

/** Ids of the demo foods created by the seed (kept in sync by a test). */
export const DEMO_FOOD_IDS: readonly string[] = [
  "demo-food-oatmeal",
  "demo-food-chicken-rice",
  "demo-food-salad",
  "demo-food-yogurt",
  "demo-food-salmon",
];

const AUTH_TOKEN_KEY = /^sb-.*-auth-token$/;

/**
 * True when a meal entry references a demo food. Accepts both the local
 * (camelCase `foodId`) and remote/queued (snake_case `food_id`) shapes.
 */
export function isDemoMealEntry(entry: unknown): boolean {
  if (typeof entry !== "object" || entry === null) return false;
  const row = entry as { foodId?: unknown; food_id?: unknown };
  const id = row.foodId ?? row.food_id;
  return typeof id === "string" && id.startsWith(DEMO_FOOD_ID_PREFIX);
}

/**
 * True when this browser origin was seeded with demo data. Such a device must
 * never run any cloud sync. Storage failures count as "not a demo device".
 */
export function isDemoDevice(): boolean {
  try {
    return (
      localStorage.getItem(DEMO_SEED_MARKER_KEY) === DEMO_SEED_MARKER_VALUE ||
      localStorage.getItem(DEMO_SEED_STARTED_KEY) !== null
    );
  } catch {
    return false;
  }
}

/**
 * True when this browser has ever stored a Supabase auth session
 * (`sb-<ref>-auth-token`). Storage failures return false.
 */
export function hasEverHeldAuthSession(): boolean {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && AUTH_TOKEN_KEY.test(key)) return true;
    }
  } catch {
    // storage unavailable
  }
  return false;
}
