import type { CookingBasis } from "@/lib/cookingConversion";
import { basisFromOffTags } from "@/lib/offBasisMap";

/**
 * Basis inference for OFF staples (pasta, rice, dried legumes, quinoa-type
 * grains).
 *
 * WHY: OFF's taxonomy has no "raw" tag, so `basisFromOffTags` can only ever
 * say "cocido". For staples the energy density is an almost perfect
 * discriminator, though: dry pasta/rice/pulses sit around 330-370 kcal/100 g
 * while their cooked counterparts sit around 90-160 kcal/100 g (water roughly
 * triples the weight). Outside these groups no such rule is applied
 * (fail-closed: basis stays null).
 *
 * THRESHOLDS (evidence: OFF dump, products sold in Spain, no cooked-signal
 * tag, kcal known; staple groups as defined below):
 *   - pasta   n=1672: p25=344 p50=349 p75=355; 90% >= 280; ~1515 are >= 270
 *   - rice    n=603:  p25=341 p50=347 p75=352; bimodal, dry bin 325-375 (496),
 *                     cooked-like bins 125-225 (~79 items), 225-300 almost empty
 *   - legumes n=500:  dry bins 275-400 (~370 items), wet bins 50-175 (~110),
 *                     only ~10 items in 200-275
 *   - grains  n=153:  dry bins 300-425, wet bins 75-225
 * Cooked pasta/rice/pulses top out around 190 kcal/100 g, dry ones bottom out
 * around 270 kcal/100 g (lower-calorie dry legume flours/pastas), so:
 *   kcal >= 270 -> "crudo"; kcal <= 200 -> "cocido"; (200, 270) -> null.
 * 270 (not 300) is deliberate: ~80 genuine dry legumes and ~36 dry pastas sit
 * in 275-300. Missing, zero or non-finite kcal -> null (OFF defaults to 0
 * when the field is absent, which must not read as "cooked").
 */
export const STAPLE_RAW_MIN_KCAL = 270;
export const STAPLE_COOKED_MAX_KCAL = 200;

export type StapleGroup = "pasta" | "rice" | "legumes" | "grains";

const STAPLE_INCLUDE_TAGS: Readonly<Record<StapleGroup, readonly string[]>> = {
  pasta: ["en:pastas"],
  rice: ["en:rices"],
  legumes: ["en:pulses", "en:lentils", "en:chickpeas", "en:common-beans", "en:white-beans"],
  grains: ["en:quinoa", "en:couscous", "en:bulgur"],
};

/**
 * Tags that mean "this is a dish, ready meal, snack, noodle, stuffed/fresh
 * pasta, drink, flour or other processed form", where an energy-density rule
 * is not trustworthy. Any of them disqualifies the product from staple
 * inference (basis stays null). Every name below was verified to exist in the
 * OFF dump (products sold in Spain); names that do not occur (e.g.
 * "en:rice-cakes", "en:lasagnas", "en:fresh-pastas", "en:rice-drinks") are
 * deliberately NOT listed. Real names for those concepts are in the set or
 * covered by `EXCLUDED_TAG_SUFFIX` / `EXCLUDED_TAG_PREFIXES` below.
 */
const STAPLE_EXCLUDE_TAGS: ReadonlySet<string> = new Set([
  // dishes / ready meals
  "en:meals",
  "en:pasta-dishes",
  "en:rice-dishes",
  "en:prepared-rices",
  "en:risottos",
  "en:microwave-meals",
  "en:canned-meals",
  "en:dried-meals",
  "en:dried-products-to-be-rehydrated",
  "en:soups",
  "en:pizzas",
  "en:pasta-salads",
  "en:rice-salads",
  "en:rice-puddings",
  "en:plant-based-meals",
  "en:combination-meals",
  "en:meal-kits",
  "en:prepared-lentils",
  "en:baked-beans-in-tomato-sauce",
  // filled / fresh pasta
  "en:stuffed-pastas",
  "en:fresh-pasta",
  "en:ravioli",
  "en:raviolis",
  "en:gnocchi",
  "en:filled-gnocchi",
  "en:cannelloni",
  "en:tortellini",
  "en:tortelloni",
  // noodles (dry or instant): excluded entirely, no basis and no factor
  "en:noodles",
  "en:instant-noodles",
  "en:instant-noodle-soups",
  "en:rice-noodles",
  "en:dried-rice-noodles",
  "en:rice-vermicelli",
  "en:soba",
  // snacks / bars / cakes / crackers / flours / sauces / drinks
  "en:snacks",
  "en:salty-snacks",
  "en:sweet-snacks",
  "en:puffed-rice-cakes",
  "en:puffed-cereal-cakes",
  "en:rice-crackers",
  "en:cereal-bars",
  "en:flours",
  "en:rice-flours",
  "en:pasta-sauces",
  "en:sauces",
  "en:spreads",
  "en:rice-based-drinks",
  "en:plain-rice-based-drinks",
  "en:cereal-based-drinks",
  "en:plant-based-beverages",
  "en:beverages",
  "en:milk-substitutes",
  "en:plant-based-milk-alternatives",
  // nuts, fresh produce and frozen items that also carry legume tags
  "en:peanuts",
  "en:nuts",
  "en:vegetables",
  "en:sprouts",
  "en:fresh-foods",
  "en:fresh-plant-based-foods",
  "en:frozen-foods",
]);

/** Catch-all for the long tail of dish/noodle/filled-pasta tag names. */
const EXCLUDED_TAG_SUFFIX =
  /-(dishes|meals|noodles|noodle-soups|sprouts|salads|tortellini|tortellinis|tortelloni|raviolis|lasagne|lasagnas|cannelloni|gnocchi)$/;
const EXCLUDED_TAG_PREFIXES: readonly string[] = [
  "en:fresh-",
  "en:prepared-",
  "en:instant-",
  "en:pasta-stuffed",
  "en:frozen-",
];

function isExcludedTag(tag: string): boolean {
  return (
    STAPLE_EXCLUDE_TAGS.has(tag) ||
    EXCLUDED_TAG_SUFFIX.test(tag) ||
    EXCLUDED_TAG_PREFIXES.some((p) => tag.startsWith(p))
  );
}

/** Group the product belongs to, or null when it is not an eligible staple. */
export function stapleGroupFromOffTags(tags: string[] | undefined): StapleGroup | null {
  if (!tags || tags.length === 0) return null;
  const tagSet = new Set(tags);
  for (const t of tagSet) if (isExcludedTag(t)) return null;
  for (const group of Object.keys(STAPLE_INCLUDE_TAGS) as StapleGroup[]) {
    if (STAPLE_INCLUDE_TAGS[group].some((t) => tagSet.has(t))) return group;
  }
  return null;
}

/**
 * Energy-density rule only (no cooked-tag handling). Null for non-staples,
 * missing/invalid kcal, and the ambiguous middle band.
 */
export function inferStapleBasis(
  tags: string[] | undefined,
  kcalPer100g: number | null | undefined
): CookingBasis | null {
  if (stapleGroupFromOffTags(tags) === null) return null;
  if (typeof kcalPer100g !== "number" || !Number.isFinite(kcalPer100g) || kcalPer100g <= 0) {
    return null;
  }
  if (kcalPer100g >= STAPLE_RAW_MIN_KCAL) return "crudo";
  if (kcalPer100g <= STAPLE_COOKED_MAX_KCAL) return "cocido";
  return null;
}

/**
 * Full OFF basis resolution: an explicit cooked-signal tag always wins, then
 * the staple energy-density rule, otherwise null (unknown, toggle hidden).
 */
export function resolveOffBasis(
  tags: string[] | undefined,
  kcalPer100g: number | null | undefined
): CookingBasis | null {
  return basisFromOffTags(tags) ?? inferStapleBasis(tags, kcalPer100g);
}

/**
 * Cooked grams per raw gram for dry pasta.
 *
 * Derived from BEDCA (bedca.net/bdpub/procquery.php) with the same dual
 * method as lib/cookingFactors.ts, on the only clean same-food raw/boiled
 * pasta pair: "Pasta alimenticia, con huevo, cruda" (f_id 1118: water 9.7 g,
 * protein 13.5 g per 100 g) vs "Pasta alimenticia, con huevo, hervida"
 * (f_id 1072: water 70 g, protein 4.7 g per 100 g).
 *   water method:   (100 - 9.7) / (100 - 70) = 3.01
 *   protein method: 13.5 / 4.7               = 2.87   (4.8% apart)
 * Mean 2.94, rounded to 2.9. The whole-wheat pair (f_id 1074 -> 1076) was not
 * used: its raw water is recorded as 0 g, which is implausible. Plain pasta
 * (f_id 1117) has no boiled counterpart in BEDCA. NOTE: the boiled entries
 * hold 64-70 g water, i.e. softer/wetter than the ~2.2-2.5 usually quoted
 * for al dente pasta; treat as an upper-middle estimate.
 */
export const PASTA_DRY_COOKING_FACTOR = 2.9;

/**
 * Per-food cooking factor derived from OFF tags. Only returned for eligible
 * dry-pasta products whose resolved basis is "crudo"; null otherwise (the
 * category factor then applies, if any).
 */
export function cookingFactorFromOffTags(
  tags: string[] | undefined,
  basis: CookingBasis | null
): number | null {
  if (basis !== "crudo") return null;
  if (stapleGroupFromOffTags(tags) !== "pasta") return null;
  return PASTA_DRY_COOKING_FACTOR;
}

/**
 * Single derivation used by `normalizeOffProduct`: basis (cooked tag wins,
 * then staple energy-density rule) plus the tag-based per-food factor, which
 * is only ever set together with a "crudo" basis.
 */
export function deriveOffCookingFields(
  categoriesTags: string[] | undefined,
  caloriesPer100g: number | null | undefined
): { dataBasis: CookingBasis | null; cookingFactor: number | null } {
  const dataBasis = resolveOffBasis(categoriesTags, caloriesPer100g);
  return { dataBasis, cookingFactor: cookingFactorFromOffTags(categoriesTags, dataBasis) };
}
