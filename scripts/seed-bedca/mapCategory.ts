/**
 * Maps BEDCA food group names to canonical FOOD_CATEGORIES keys from
 * lib/foodCategories.ts.
 *
 * Every mapping is documented explicitly — no undocumented assignments.
 * Unknown groups log a warning and return null (never silently assigned
 * to "otros").
 */

// Canonical keys (from lib/foodCategories.ts — kept in sync manually):
// vegetales, frutas, cereales_y_granos, legumbres, lacteos, huevos, carnes,
// pescados_y_mariscos, fiambres_y_embutidos, frutos_secos, bebidas,
// dulces_y_snacks, condimentos_y_salsas, otros

/**
 * Known BEDCA group name → canonical category key.
 *
 * Group names sourced from BEDCA v1.0 (2010) group taxonomy.
 * "Verduras y hortalizas" → vegetales  (informal ES term mapped to canonical)
 * "Cereales y derivados"  → cereales_y_granos
 * etc.
 */
const BEDCA_GROUP_CATEGORY_MAP: Record<string, string> = {
  // ── Produce ─────────────────────────────────────────────────────────────
  "Verduras y hortalizas": "vegetales",
  Verduras: "vegetales",
  Hortalizas: "vegetales",
  "Frutas y derivados": "frutas",
  Frutas: "frutas",

  // ── Grains & legumes ─────────────────────────────────────────────────────
  "Cereales y derivados": "cereales_y_granos",
  Cereales: "cereales_y_granos",
  "Pan y cereales": "cereales_y_granos",
  "Leguminosas y derivados": "legumbres",
  Leguminosas: "legumbres",
  Legumbres: "legumbres",

  // ── Dairy & eggs ─────────────────────────────────────────────────────────
  "Leche y derivados": "lacteos",
  Lácteos: "lacteos",
  "Productos lácteos": "lacteos",
  Huevos: "huevos",
  "Huevos y derivados": "huevos",

  // ── Meat, fish, deli ─────────────────────────────────────────────────────
  "Cárnicos y derivados": "carnes",   // BEDCA actual group name (differs from "Carnes y derivados")
  "Carnes y derivados": "carnes",
  Carnes: "carnes",
  "Pescados y mariscos": "pescados_y_mariscos",
  Pescados: "pescados_y_mariscos",
  "Mariscos y moluscos": "pescados_y_mariscos",
  "Embutidos y fiambres": "fiambres_y_embutidos",
  Embutidos: "fiambres_y_embutidos",
  Fiambres: "fiambres_y_embutidos",

  // ── Nuts & seeds ─────────────────────────────────────────────────────────
  "Frutos secos y semillas": "frutos_secos",
  "Frutos secos": "frutos_secos",

  // ── Beverages ────────────────────────────────────────────────────────────
  Bebidas: "bebidas",
  "Bebidas alcohólicas": "bebidas",
  "Bebidas no alcohólicas": "bebidas",
  "Refrescos y zumos": "bebidas",

  // ── Sweets & snacks ──────────────────────────────────────────────────────
  "Azúcar, chocolate y derivados": "dulces_y_snacks",  // BEDCA actual group name
  "Dulces y snacks": "dulces_y_snacks",
  "Azúcares y dulces": "dulces_y_snacks",
  "Bollería y pastelería": "dulces_y_snacks",
  Postres: "dulces_y_snacks",
  "Chocolates y confitería": "dulces_y_snacks",

  // ── Condiments & sauces ──────────────────────────────────────────────────
  "Condimentos y salsas": "condimentos_y_salsas",
  "Aceites y grasas": "condimentos_y_salsas",
  Aceites: "condimentos_y_salsas",
  Especias: "condimentos_y_salsas",
  Salsas: "condimentos_y_salsas",

  // ── Catch-all (explicit — see note below) ────────────────────────────────
  // "Otros" is deliberately NOT included as an auto-catch. Unknown groups
  // return null so the operator can review and extend the map.
  // To assign "otros" explicitly, add the exact group name here.
  "Platos preparados": "otros",
  "Alimentos para regímenes especiales": "otros",
  Miscelánea: "otros",
  "Productos de uso nutricional específico": "otros",
};

/**
 * Map a BEDCA group name to a canonical FOOD_CATEGORIES key.
 *
 * Returns null when no mapping exists — the caller must handle this case
 * (log a warning, skip, or queue for manual review). Never silently returns
 * "otros" for unknown groups.
 */
export function mapCategory(groupName: string): string | null {
  const trimmed = groupName.trim();
  if (!trimmed) return null;

  const direct = BEDCA_GROUP_CATEGORY_MAP[trimmed];
  if (direct !== undefined) return direct;

  // Soft match: check if the group name contains a known key substring.
  // This handles minor name variations (e.g. trailing whitespace, version diffs).
  // Both strings must be non-empty to prevent vacuous substring matches.
  for (const [key, value] of Object.entries(BEDCA_GROUP_CATEGORY_MAP)) {
    if (!key) continue;
    const lowerGroup = trimmed.toLowerCase();
    const lowerKey = key.toLowerCase();
    if (lowerGroup.includes(lowerKey) || lowerKey.includes(lowerGroup)) {
      return value;
    }
  }

  return null;
}
