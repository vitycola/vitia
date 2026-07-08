import type { FoodCategory } from "@/lib/foodCategories";

/**
 * Ordered, first-match-wins. Maps OFF category taxonomy tags (from
 * `product.categories_tags`, e.g. "en:rices") to our 14 `FOOD_CATEGORIES`
 * keys. Committed in-repo (BR-6, offline-first — no network required).
 * Sourced from OFF's published category TAXONOMY (not the multi-GB product
 * dump, which is explicitly out of scope). Ordered most-specific-first so a
 * product carrying several tags resolves to its most precise category.
 *
 * Only categories that have a corresponding entry in COOKING_FACTORS need
 * OFF tag coverage to unlock conversion — other categories may still be
 * mapped here for general categorization/display even without a factor.
 */
export const OFF_CATEGORY_RULES: ReadonlyArray<{ tag: string; category: FoodCategory }> = [
  { tag: "en:rices", category: "cereales_y_granos" },
  { tag: "en:pastas", category: "cereales_y_granos" },
  { tag: "en:breads", category: "cereales_y_granos" },
  { tag: "en:cereals", category: "cereales_y_granos" },
  { tag: "en:legumes", category: "legumbres" },
  { tag: "en:lentils", category: "legumbres" },
  { tag: "en:chickpeas", category: "legumbres" },
  { tag: "en:beans", category: "legumbres" },
  { tag: "en:meats", category: "carnes" },
  { tag: "en:poultry", category: "carnes" },
  { tag: "en:fishes", category: "pescados_y_mariscos" },
  { tag: "en:seafood", category: "pescados_y_mariscos" },
  { tag: "en:eggs", category: "huevos" },
  { tag: "en:dairies", category: "lacteos" },
  { tag: "en:milks", category: "lacteos" },
  { tag: "en:cheeses", category: "lacteos" },
  { tag: "en:fruits", category: "frutas" },
  { tag: "en:vegetables", category: "vegetales" },
  { tag: "en:nuts", category: "frutos_secos" },
  { tag: "en:beverages", category: "bebidas" },
  { tag: "en:sauces", category: "condimentos_y_salsas" },
  { tag: "en:condiments", category: "condimentos_y_salsas" },
  { tag: "en:sweets", category: "dulces_y_snacks" },
  { tag: "en:snacks", category: "dulces_y_snacks" },
  { tag: "en:cold-cuts", category: "fiambres_y_embutidos" },
  { tag: "en:sausages", category: "fiambres_y_embutidos" },
];

/**
 * Returns the category of the first rule whose tag appears in the product's
 * `categories_tags`, checked in `OFF_CATEGORY_RULES` order. Returns null when
 * no rule matches (unmapped tags leave `category: null` — spec: "Unmapped OFF
 * tag").
 */
export function categoryFromOffTags(tags: string[] | undefined): FoodCategory | null {
  if (!tags || tags.length === 0) return null;
  const tagSet = new Set(tags);
  for (const rule of OFF_CATEGORY_RULES) {
    if (tagSet.has(rule.tag)) return rule.category;
  }
  return null;
}
