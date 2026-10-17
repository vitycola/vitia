/**
 * Derives data_basis ("crudo" | "cocido" | null) from a BEDCA food name.
 *
 * Fail-closed: when the basis is not determinable, returns null rather than
 * guessing. This matches the fail-closed discipline in lib/cookingConversion.ts.
 *
 * Cross-reference: categories that have a cooking factor in lib/cookingFactors.ts
 * (cereales_y_granos, legumbres, carnes, pescados_y_mariscos, huevos, vegetales)
 * are the categories where basis matters most — but basis is per-item, not
 * per-category, so we derive it from the food name regardless of category.
 */

/** Spanish/BEDCA terms that indicate a raw/unprocessed item. */
export const RAW_TERMS = [
  "crudo",
  "cruda",
  "crudos",
  "crudas",
  "fresco",
  "fresca",
  "frescos",
  "frescas",
  "seco",
  "seca",
  "secos",
  "secas",
  "natural",
  "naturales",
  "sin cocer",
  "sin cocinar",
  "sin hervir",
  "sin procesar",
  "en grano",
  "sin tostar",
];

/** Spanish/BEDCA terms that indicate a cooked item. */
export const COOKED_TERMS = [
  "cocido",
  "cocida",
  "cocidos",
  "cocidas",
  "hervido",
  "hervida",
  "hervidos",
  "hervidas",
  "asado",
  "asada",
  "asados",
  "asadas",
  "frito",
  "frita",
  "fritos",
  "fritas",
  "plancha",
  "a la plancha",
  "al horno",
  "a la parrilla",
  "horneado",
  "horneada",
  "cocinado",
  "cocinada",
  "preparado",
  "preparada",
  "guisado",
  "estofado",
  "tostado",
  "tostada",
  "tostados",
  "a la romana",
  "rebozado",
  "rebozada",
];

/**
 * Derives data_basis from the BEDCA food name.
 *
 * Returns:
 *   "crudo"  — name contains a raw term
 *   "cocido" — name contains a cooked term
 *   null     — basis is genuinely unknown (fail-closed; never guessed)
 *
 * When both raw and cooked terms appear, "cocido" wins (the item was processed).
 */
export function mapBasis(foodName: string): "crudo" | "cocido" | null {
  const lower = foodName.toLowerCase();

  const isCooked = COOKED_TERMS.some((term) => lower.includes(term));
  if (isCooked) return "cocido";

  const isRaw = RAW_TERMS.some((term) => lower.includes(term));
  if (isRaw) return "crudo";

  return null;
}
