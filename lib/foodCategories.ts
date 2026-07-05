/**
 * Fixed, finite taxonomy of food categories for composite/created foods.
 *
 * Spec: composite-food-creation — Category Taxonomy.
 * Design: design.md — "category column type" (plain nullable text column,
 * validated at the app layer against these keys; additive when the list
 * grows, no schema migration required).
 */

export const FOOD_CATEGORIES = {
  vegetales: { label: "Vegetales", icon: "🥦" },
  frutas: { label: "Frutas", icon: "🍎" },
  cereales_y_granos: { label: "Cereales y granos", icon: "🌾" },
  legumbres: { label: "Legumbres", icon: "🫘" },
  lacteos: { label: "Lácteos", icon: "🥛" },
  huevos: { label: "Huevos", icon: "🥚" },
  carnes: { label: "Carnes", icon: "🥩" },
  pescados_y_mariscos: { label: "Pescados y mariscos", icon: "🐟" },
  fiambres_y_embutidos: { label: "Fiambres y embutidos", icon: "🍖" },
  frutos_secos: { label: "Frutos secos", icon: "🥜" },
  bebidas: { label: "Bebidas", icon: "🥤" },
  dulces_y_snacks: { label: "Dulces y snacks", icon: "🍬" },
  condimentos_y_salsas: { label: "Condimentos y salsas", icon: "🧂" },
  otros: { label: "Otros", icon: "🍽️" },
} as const satisfies Record<string, { label: string; icon: string }>;

export type FoodCategory = keyof typeof FOOD_CATEGORIES;

/** Fallback icon used when a food has no category or an unrecognized one. */
const FALLBACK_ICON = "🍽️";

/**
 * Resolve the icon for a category key.
 * Returns the fallback icon for null, undefined, or unknown keys.
 */
export function categoryIcon(category: string | null | undefined): string {
  if (!category || !(category in FOOD_CATEGORIES)) return FALLBACK_ICON;
  return FOOD_CATEGORIES[category as FoodCategory].icon;
}
