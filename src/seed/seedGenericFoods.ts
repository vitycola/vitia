/**
 * Generic BEDCA-sourced foods (crudo basis) auto-seed.
 *
 * Runs once at app boot (src/main.tsx) for every environment — unlike
 * seedDemoProfile, this is real reference data, not a demo fixture. Seeds a
 * curated set of supermarket staples with `category` and `dataBasis`
 * already resolved, so the crudo/cocido conversion toggle
 * (lib/cookingConversion.ts) works out of the box without the user having
 * to create every raw ingredient by hand via "Crear alimento manual".
 *
 * Crudo only, deliberately no separate cocido row: seeding both once
 * produced two food-search results that disagreed on calories for the same
 * real 100 g of cooked rice — 128 kcal via the crudo row + toggle
 * (100 g / 3.0 category factor × 384.1 kcal/100g raw density) vs 111.6
 * kcal via a directly-measured BEDCA "hervido" row. COOKING_FACTORS is a
 * single scalar per category, not a per-food precise ratio (design D2,
 * BR-4), so it will never exactly match an independently-measured cooked
 * value — keeping only the crudo row makes the toggle the single source of
 * truth for cocido weight, consistent with how every other food in the app
 * already works.
 *
 * Scope: only pairs whose BEDCA record passed an Atwater cross-check
 * (reported kcal ≈ 4*protein + 4*carbs + 9*fat per 100g) are included.
 * `legumbres` is deliberately excluded — both candidate BEDCA "hervido"
 * records failed this check: garbanzo_hervido (f_id 2192) reports 358.7
 * kcal/100g but its own macros compute to ~133 kcal; lenteja_hervida
 * (f_id 2200) is the same record already flagged in lib/cookingFactors.ts
 * for implausible water content.
 *
 * Idempotent by only inserting ids that don't exist yet (checked via
 * getByIds) — never re-touches an existing row, so a user who edits a
 * seeded food via "Editar alimento" keeps their edit on the next boot
 * (a blind upsert-on-every-boot would silently revert it).
 *
 * Attribution: AESAN/BEDCA Base de Datos Española de Composición de
 * Alimentos v1.0 (2010), personal-use carve-out (same as lib/cookingFactors.ts).
 */
import * as foodsRepo from "@/db/repos/foods";
import type { NewFood } from "@/db/schema";
import type { CookingBasis } from "@/lib/cookingConversion";
import type { FoodCategory } from "@/lib/foodCategories";

/** Bump when GENERIC_FOODS entries change — enables future audit. */
export const GENERIC_FOODS_SEED_VERSION = 2;

type GenericFood = NewFood & { category: FoodCategory; dataBasis: CookingBasis };

export const GENERIC_FOODS: GenericFood[] = [
  // cereales_y_granos — BEDCA f_id 904
  {
    id: "generic-food-arroz-integral-crudo",
    name: "Arroz integral",
    caloriesPer100g: 384.1,
    proteinPer100g: 7.5,
    carbsPer100g: 81.3,
    fatPer100g: 2.6,
    source: "custom",
    category: "cereales_y_granos",
    dataBasis: "crudo",
  },
  // carnes — BEDCA f_id 994 (con piel)
  {
    id: "generic-food-pechuga-pollo-cruda",
    name: "Pechuga de pollo",
    caloriesPer100g: 104.5,
    proteinPer100g: 23.1,
    carbsPer100g: 0,
    fatPer100g: 1.2,
    source: "custom",
    category: "carnes",
    dataBasis: "crudo",
  },
  // pescados_y_mariscos — BEDCA f_id 2134
  {
    id: "generic-food-atun-crudo",
    name: "Atún",
    caloriesPer100g: 118.6,
    proteinPer100g: 22,
    carbsPer100g: 0,
    fatPer100g: 3.3,
    source: "custom",
    category: "pescados_y_mariscos",
    dataBasis: "crudo",
  },
  // huevos — BEDCA f_id 2127
  {
    id: "generic-food-huevo-fresco",
    name: "Huevo de gallina",
    caloriesPer100g: 148.9,
    proteinPer100g: 12.5,
    carbsPer100g: 0,
    fatPer100g: 11.1,
    source: "custom",
    category: "huevos",
    dataBasis: "crudo",
  },
  // vegetales — BEDCA f_id 2403
  {
    id: "generic-food-patata-cruda",
    name: "Patata",
    caloriesPer100g: 72.5,
    proteinPer100g: 2.2,
    carbsPer100g: 15.2,
    fatPer100g: 0.2,
    source: "custom",
    category: "vegetales",
    dataBasis: "crudo",
  },
];

/**
 * Seeds GENERIC_FOODS, skipping any id that already exists in the local
 * cache. Safe to call on every boot: after the first successful run this
 * is a single getByIds lookup with no writes.
 *
 * Never rejects (runs for every user at boot, unlike the gated demo seed):
 * a lookup/insert failure is logged and swallowed rather than blocking
 * first render.
 */
export async function seedGenericFoods(): Promise<void> {
  try {
    const ids = GENERIC_FOODS.map((food) => food.id);
    const existing = await foodsRepo.getByIds(ids);
    const existingIds = new Set(existing.map((food) => food.id));
    const missing = GENERIC_FOODS.filter((food) => !existingIds.has(food.id));
    if (missing.length === 0) return;
    await foodsRepo.upsertMany(missing);
  } catch (err) {
    console.error("[seedGenericFoods] seeding failed, will retry next boot", err);
  }
}
