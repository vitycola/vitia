import type { FoodCategory } from "@/lib/foodCategories";

/**
 * Cooked grams produced per 1 raw gram, per category (e.g. 2.5 means 100 g
 * raw yields 250 g cooked). Weight-only — macro density already lives
 * per-food in `foods`, so this table never carries a macro value, only a
 * yield ratio (design D2: single scalar ratio, not per-method, BR-4).
 *
 * Categories ABSENT from this map have no known factor -> the conversion
 * toggle stays hidden for them (fail-closed, spec: "Category with no
 * defensible factor").
 *
 * SOURCING (BEDCA-verified pass, 2026-07-09): Vitia is confirmed personal-use
 * only, so BEDCA (bedca.net/bdpub) raw/cooked composition pairs are used
 * directly, no licensing gate (design A-1). Values queried via BEDCA's public
 * XML endpoint (`bdpub/procquery.php`) for a same-food crudo/hervido pair per
 * category, then derived two ways and cross-checked: (a) dry-matter/water
 * conservation — ratio = (100 - water_raw) / (100 - water_cooked); (b)
 * stable-macro conservation — ratio = protein_raw_per100g /
 * protein_cooked_per100g. Both methods assume cooking mainly changes water
 * content, which held up for grains/legumes/fish/eggs but NOT for the
 * chicken pair (see `carnes` below).
 * Attribution (BEDCA terms of use, non-commercial/personal carve-out):
 * AESAN/BEDCA Base de Datos Española de Composición de Alimentos v1.0 (2010).
 */
export const COOKING_FACTORS = {
  // Source: "Arroz integral, crudo" (BEDCA f_id 904: water 11.4g, protein
  // 7.5g per 100g) vs "Arroz integral, hervido" (f_id 1009: water 71.8g,
  // protein 2.6g per 100g). Water-method ratio 3.14, protein-method 2.88 —
  // averaged to 3.0.
  cereales_y_granos: 3.0,
  // Source: "Garbanzo, seco, crudo" (f_id 1020: water 7.275g, protein
  // 19.305g per 100g) vs "Garbanzo, hervido" (f_id 2192: water 59.1g,
  // protein 8.9g per 100g). Water-method ratio 2.27, protein-method 2.17 —
  // averaged to 2.2. (The BEDCA "Lenteja, hervida" entry, f_id 2200, was
  // rejected as a second data point — its reported water content, 9.3g/100g,
  // is implausible for boiled lentils and looks like a data anomaly.)
  legumbres: 2.2,
  // NOT derived from the BEDCA pair for this category: the only raw entry
  // is "Pollo, pechuga, con piel, crudo" (f_id 994, WITH skin) while the
  // cooked entry "Pollo, pechuga, plancha" (f_id 2297) is a different,
  // presumably skinless product — comparing them yields an implausible
  // ~1.0 ratio (contradicts well-established chicken-breast cooking yield).
  // BEDCA has no matching skin-on/skin-on or skinless/skinless crudo+cocido
  // pair for this cut, so this stays a standard culinary-yield reference
  // value (meat loses moisture + rendered fat; typical yield 70-75% of raw
  // weight) rather than a BEDCA-derived number.
  carnes: 0.72,
  // Source: "Atún, crudo" (f_id 2134: water 67.3g, protein 22g per 100g) vs
  // "Atún, plancha" (f_id 2135: water 65g, protein 23g per 100g) — a clean
  // same-food pair (no skin/cut confound, unlike the chicken pair above).
  // Water-method ratio 0.93, protein-method 0.96 — averaged to 0.95. This is
  // a notably higher yield (less shrinkage) than general culinary-yield
  // literature for grilled fish (commonly cited ~0.80-0.85); flagged as
  // moderate confidence pending a second reference food, not silently
  // smoothed toward the literature figure.
  pescados_y_mariscos: 0.95,
  // Source: "Huevo de gallina fresco" (f_id 2127: water 76.4g, protein
  // 12.5g per 100g) vs "Huevo de gallina, hervido, duro" (f_id 2126: water
  // 75.7g, protein 12.5g per 100g) — nearly identical, confirming boiled
  // eggs lose negligible weight in-shell. Ratio ~0.99.
  huevos: 0.99,
  // Source: "Patata, cruda" (f_id 2403: water 80.6g, protein 2.2g per 100g)
  // vs "Patata, hervida" (f_id 2404: water 79.39g, protein 2.38g per 100g) —
  // clean same-food pair. Water-method ratio 0.94, protein-method 0.92 —
  // averaged to 0.93. Added post-v1 scope: not in the original design's
  // 5-category list, but BEDCA's OFF-tag mapping for `vegetales`
  // (`en:vegetables`, lib/offCategoryMap.ts) already existed, so this needed
  // no other wiring — hasCookingFactor/canConvert read this table directly.
  vegetales: 0.93,
} as const satisfies Partial<Record<FoodCategory, number>>;

/** Bump when values or keys in COOKING_FACTORS change — enables future audit. */
export const COOKING_FACTORS_VERSION = 3;
