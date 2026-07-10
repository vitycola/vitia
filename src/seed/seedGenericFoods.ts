/**
 * Generic BEDCA-sourced foods (crudo/cocido pairs) auto-seed.
 *
 * Runs once at app boot (src/main.tsx) for every environment — unlike
 * seedDemoProfile, this is real reference data, not a demo fixture. Seeds a
 * curated set of supermarket staples with `category` and `dataBasis`
 * already resolved, so the crudo/cocido conversion toggle
 * (lib/cookingConversion.ts) works out of the box without the user having
 * to create every raw ingredient by hand via "Crear alimento manual".
 *
 * Scope: only pairs whose BEDCA record passed an Atwater cross-check
 * (reported kcal ≈ 4*protein + 4*carbs + 9*fat per 100g) are included.
 * `legumbres` is deliberately excluded — both candidate BEDCA "hervido"
 * records failed this check: garbanzo_hervido (f_id 2192) reports 358.7
 * kcal/100g but its own macros compute to ~133 kcal; lenteja_hervida
 * (f_id 2200) is the same record already flagged in lib/cookingFactors.ts
 * for implausible water content. Seeding known-bad calorie data would be
 * worse than seeding nothing for that category.
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
export const GENERIC_FOODS_SEED_VERSION = 1;

type GenericFood = NewFood & { category: FoodCategory; dataBasis: CookingBasis };

export const GENERIC_FOODS: GenericFood[] = [
  // cereales_y_granos — BEDCA f_id 904 (crudo) / 1009 (hervido)
  {
    id: "generic-food-arroz-integral-crudo",
    name: "Arroz integral (crudo)",
    caloriesPer100g: 384.1,
    proteinPer100g: 7.5,
    carbsPer100g: 81.3,
    fatPer100g: 2.6,
    source: "custom",
    category: "cereales_y_granos",
    dataBasis: "crudo",
  },
  {
    id: "generic-food-arroz-integral-cocido",
    name: "Arroz integral (cocido)",
    caloriesPer100g: 111.6,
    proteinPer100g: 2.6,
    carbsPer100g: 22.9,
    fatPer100g: 0.9,
    source: "custom",
    category: "cereales_y_granos",
    dataBasis: "cocido",
  },
  // carnes — BEDCA f_id 994 (crudo, con piel) / 2297 (plancha)
  {
    id: "generic-food-pechuga-pollo-cruda",
    name: "Pechuga de pollo (cruda)",
    caloriesPer100g: 104.5,
    proteinPer100g: 23.1,
    carbsPer100g: 0,
    fatPer100g: 1.2,
    source: "custom",
    category: "carnes",
    dataBasis: "crudo",
  },
  {
    id: "generic-food-pechuga-pollo-plancha",
    name: "Pechuga de pollo (a la plancha)",
    caloriesPer100g: 145,
    proteinPer100g: 22.2,
    carbsPer100g: 0,
    fatPer100g: 6.2,
    source: "custom",
    category: "carnes",
    dataBasis: "cocido",
  },
  // pescados_y_mariscos — BEDCA f_id 2134 (crudo) / 2135 (plancha)
  {
    id: "generic-food-atun-crudo",
    name: "Atún (crudo)",
    caloriesPer100g: 118.6,
    proteinPer100g: 22,
    carbsPer100g: 0,
    fatPer100g: 3.3,
    source: "custom",
    category: "pescados_y_mariscos",
    dataBasis: "crudo",
  },
  {
    id: "generic-food-atun-plancha",
    name: "Atún (a la plancha)",
    caloriesPer100g: 199.6,
    proteinPer100g: 23,
    carbsPer100g: 0,
    fatPer100g: 12,
    source: "custom",
    category: "pescados_y_mariscos",
    dataBasis: "cocido",
  },
  // huevos — BEDCA f_id 2127 (fresco) / 2126 (hervido, duro)
  {
    id: "generic-food-huevo-fresco",
    name: "Huevo de gallina (crudo)",
    caloriesPer100g: 148.9,
    proteinPer100g: 12.5,
    carbsPer100g: 0,
    fatPer100g: 11.1,
    source: "custom",
    category: "huevos",
    dataBasis: "crudo",
  },
  {
    id: "generic-food-huevo-hervido",
    name: "Huevo de gallina (hervido)",
    caloriesPer100g: 144.9,
    proteinPer100g: 12.5,
    carbsPer100g: 0.3,
    fatPer100g: 10.5,
    source: "custom",
    category: "huevos",
    dataBasis: "cocido",
  },
  // vegetales — BEDCA f_id 2403 (cruda) / 2404 (hervida)
  {
    id: "generic-food-patata-cruda",
    name: "Patata (cruda)",
    caloriesPer100g: 72.5,
    proteinPer100g: 2.2,
    carbsPer100g: 15.2,
    fatPer100g: 0.2,
    source: "custom",
    category: "vegetales",
    dataBasis: "crudo",
  },
  {
    id: "generic-food-patata-hervida",
    name: "Patata (hervida)",
    caloriesPer100g: 74.9,
    proteinPer100g: 2.4,
    carbsPer100g: 15.6,
    fatPer100g: 0.2,
    source: "custom",
    category: "vegetales",
    dataBasis: "cocido",
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
