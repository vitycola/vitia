import type { NewFood } from "@/db/schema";
import { COOKING_FACTORS } from "@/lib/cookingFactors";
import type { FoodCategory } from "@/lib/foodCategories";

/** Reuses the existing Spanish domain vocabulary verbatim (see lib/foodCategories.ts, src/routes/portion.tsx). */
export type CookingBasis = "crudo" | "cocido";

export type ConversionDirection = "crudo_to_cocido" | "cocido_to_crudo";

export type ConversionResult =
  | { kind: "converted"; grams: number } // known factor applied
  | { kind: "no-factor" }; // category has no known factor -> caller hides toggle

/**
 * Type-guard: true when `category` has an entry in COOKING_FACTORS. Single
 * source of truth shared with `convertWeight` — no parallel "is convertible"
 * boolean can drift from the table this reads (BR-5).
 */
export function hasCookingFactor(category: string | null | undefined): category is FoodCategory {
  if (!category) return false;
  return category in COOKING_FACTORS;
}

/**
 * Resolve the effective cooked-per-raw factor. Priority: a valid per-food
 * factor (finite and > 0) wins over the category factor; an invalid per-food
 * value (0, negative, NaN, Infinity) is ignored and the category factor is
 * used instead. Returns undefined when neither exists (fail-closed).
 */
export function resolveCookingFactor(
  category: string | null | undefined,
  foodFactor?: number | null
): number | undefined {
  if (typeof foodFactor === "number" && Number.isFinite(foodFactor) && foodFactor > 0) {
    return foodFactor;
  }
  if (hasCookingFactor(category)) {
    return (COOKING_FACTORS as Partial<Record<FoodCategory, number>>)[category];
  }
  return undefined;
}

/**
 * Pure weight conversion between raw and cooked basis. The optional
 * `foodFactor` (per-product cooked grams per raw gram) takes priority over the
 * category factor. NEVER guesses: no resolvable factor returns
 * `{kind:"no-factor"}` rather than a numeric value (spec: "Unknown category").
 *
 * `grams <= 0` short-circuits to `{kind:"converted", grams:0}` in either
 * direction — no divide-by-zero risk since we never actually divide by
 * grams, only by the resolved factor (which is always > 0).
 */
export function convertWeight(
  category: string | null | undefined,
  grams: number,
  direction: ConversionDirection,
  foodFactor?: number | null
): ConversionResult {
  const factor = resolveCookingFactor(category, foodFactor);
  if (factor === undefined) return { kind: "no-factor" };
  if (grams <= 0) return { kind: "converted", grams: 0 };

  const convertedGrams = direction === "crudo_to_cocido" ? grams * factor : grams / factor;
  return { kind: "converted", grams: convertedGrams };
}

/**
 * Toggle-visibility gate. TRUE only when the food has a resolved `dataBasis`
 * AND a usable factor (valid per-food `cookingFactor` OR a category factor).
 * Either missing -> false -> toggle hidden, no conversion (fail-closed, BR-5).
 * Single source of truth for both entry surfaces (diary logging + recipe
 * ingredients).
 */
export function canConvert(
  food: Pick<NewFood, "category" | "dataBasis"> & { cookingFactor?: number | null }
): boolean {
  return (
    food.dataBasis != null && resolveCookingFactor(food.category, food.cookingFactor) !== undefined
  );
}

/**
 * Derive the conversion direction from the food's stored basis vs. the basis
 * the user says their entered weight is in. Returns null when no conversion
 * is needed (bases already match) OR when the stored basis is unresolved —
 * callers should use the entered grams unchanged in either null case.
 */
export function directionFor(
  storedBasis: CookingBasis | null | undefined,
  enteredBasis: CookingBasis
): ConversionDirection | null {
  if (storedBasis == null || storedBasis === enteredBasis) return null;
  return enteredBasis === "cocido" ? "cocido_to_crudo" : "crudo_to_cocido";
}
