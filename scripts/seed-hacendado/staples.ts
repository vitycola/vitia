/**
 * Dry-staple detection and raw/cooked basis for Open Food Facts rows.
 *
 * Rule keys (families): pasta_dry, rice_dry, legumes_dry, grains_dry. They are
 * also the keys looked up in staple-factors.json.
 *
 * data_basis policy (fail-closed, never guessed):
 *   crudo  = row matches a staple family, has NO disqualifying (cooked / canned
 *            / prepared / fresh / frozen / dish) tag AND its energy density is
 *            inside the dry band of that family.
 *   cocido = a positive cooked signal (OFF tags: lib/offBasisMap.ts plus the
 *            extra tags below) on a row in category cereales_y_granos or
 *            legumbres, and, for staple families, a density inside the cooked
 *            band. Cooked signals on other categories (canned fish, ready
 *            meals, canned vegetables) are deliberately NOT turned into a
 *            basis: a raw<->cooked weight toggle is not meaningful for them.
 *   null   = everything else (ambiguous, conflicting tag/density, no signal).
 *            Density alone never asserts "cocido".
 */

import { basisFromOffTags } from "../../lib/offBasisMap";
import {
  STRONG_PASTA_SHAPE,
  foldName as foldNameRules,
  hasDryVeto,
  isPlainStapleName,
} from "./nameRules";

export type StapleRule = "pasta_dry" | "rice_dry" | "legumes_dry" | "grains_dry";
export type Basis = "crudo" | "cocido";

const FAMILY_TAGS: Record<StapleRule, string[]> = {
  pasta_dry: ["en:pastas", "en:dry-pastas", "en:cereal-pastas", "en:durum-wheat-pasta"],
  rice_dry: ["en:rices", "en:precooked-rices", "en:prepared-rices", "en:cooked-rices"],
  legumes_dry: [
    "en:pulses",
    "en:lentils",
    "en:chickpeas",
    "en:common-beans",
    "en:beans",
    "en:legume-seeds",
    "en:legumes",
  ],
  grains_dry: [
    "en:couscous",
    "en:quinoa",
    "en:rolled-oats",
    "en:oat-flakes",
    "en:oats",
    "en:bulgur",
    "en:semolina",
    "en:millet",
    "en:buckwheat",
    "en:barley",
    "en:cereal-semolinas",
    "en:wheat-semolinas",
  ],
};

/** Evaluated in this order; first family with a matching tag wins. */
const FAMILY_ORDER: StapleRule[] = ["pasta_dry", "rice_dry", "grains_dry", "legumes_dry"];

/** Dry energy density band (kcal / 100 g) per family. */
export const DRY_BAND: Record<StapleRule, [number, number]> = {
  pasta_dry: [320, 400],
  rice_dry: [320, 400],
  legumes_dry: [280, 400],
  grains_dry: [300, 420],
};

/** Cooked / canned energy density band (kcal / 100 g) for any family. */
export const COOKED_BAND: [number, number] = [40, 240];

/** Tags that mean "not a plain dry staple". Exact tags; prefixes below. */
const DISQUALIFYING_TAGS = new Set([
  "en:canned-foods",
  "en:conserves",
  "en:meals",
  "en:fresh-pasta",
  "en:stuffed-pastas",
  "en:ravioli",
  "en:tortellini",
  "en:gnocchi",
  "en:soups",
  "en:instant-noodles",
  "en:instant-noodle-soups",
  "en:dried-meals",
  "en:pasta-dishes",
  "en:rice-dishes",
  "en:microwave-meals",
  "en:prepared-rices",
  "en:precooked-rices",
  "en:cooked-foods",
  "en:precooked-foods",
  "en:prepared-dishes",
  "en:salads",
  "en:prepared-salads",
  "en:snacks",
  "en:salty-snacks",
  "en:pizzas",
  "en:sandwiches",
  "en:sauces",
  "en:beverages",
  "en:plant-based-beverages",
  "en:legume-based-drinks",
  "en:soy-based-drinks",
  "en:peanut-butters",
  "en:legume-butters",
  "en:nut-butters",
  "en:peanuts",
  "en:roasted-peanuts",
  "en:nuts",
  "en:green-beans",
  "en:green-peas",
  "en:vegetables",
  "en:frozen-foods",
  "en:fresh-foods",
  "en:meat-alternatives",
  "en:meat-analogues",
  "en:biscuits",
  "en:crisps",
  "en:desserts",
]);
const DISQUALIFYING_PREFIXES = [
  "en:canned-",
  "en:cooked-",
  "en:precooked-",
  "en:frozen-",
  "en:prepared-",
];

/** Cooked signals beyond OFF_BASIS_RULES in lib/offBasisMap.ts. */
const EXTRA_COOKED_TAGS = new Set([
  "en:prepared-rices",
  "en:precooked-rices",
  "en:cooked-rices",
  "en:cooked-pastas",
  "en:cooked-legumes",
  "en:canned-lentils",
  "en:canned-chickpeas",
  "en:canned-common-beans",
  "en:canned-white-common-beans",
]);

/** Tag fragments that mean the product is a derived / non-plain-staple form. */
const DISQUALIFYING_FRAGMENTS = [
  "noodle",
  "granola",
  "muesli",
  "chocolate",
  "flour",
  "dough",
  "pie-",
  "puff-pastr",
  "porridge",
  "instant",
  "pates",
  "liver-pate",
  "-pate",
  "dumpling",
  "stuffed",
  "filled",
  "cannelloni-fill",
  "cheese",
  "sweet-corn",
  "vegetable-pasta",
];
const DISQUALIFYING_EXACT_EXTRA = new Set([
  "en:pate",
  "en:pates",
  "en:flours",
  "en:cereal-flours",
  "en:breakfast-cereals-with-chocolate",
  "en:extruded-cereals",
  "en:rice-cakes",
  "en:puffed-cereals",
  "en:rice-drinks",
]);

function hasDisqualifyingTag(tags: string[]): boolean {
  return tags.some(
    (t) =>
      DISQUALIFYING_TAGS.has(t) ||
      DISQUALIFYING_EXACT_EXTRA.has(t) ||
      DISQUALIFYING_PREFIXES.some((p) => t.startsWith(p)) ||
      DISQUALIFYING_FRAGMENTS.some((f) => t.includes(f))
  );
}

/** Family by tag only (no exclusions applied). */
export function stapleFamily(tags: string[] | undefined): StapleRule | null {
  if (!tags || tags.length === 0) return null;
  const set = new Set(tags);
  // Couscous is often co-tagged en:pastas; it must never inherit the pasta rule.
  if (set.has("en:couscous")) return "grains_dry";
  for (const fam of FAMILY_ORDER) {
    if (FAMILY_TAGS[fam].some((t) => set.has(t))) return fam;
  }
  return null;
}

export function hasCookedSignal(tags: string[] | undefined): boolean {
  if (!tags || tags.length === 0) return false;
  if (basisFromOffTags(tags) === "cocido") return true;
  return tags.some(
    (t) =>
      EXTRA_COOKED_TAGS.has(t) ||
      t.startsWith("en:canned-") ||
      t.startsWith("en:cooked-") ||
      t.startsWith("en:precooked-")
  );
}

export interface BasisInput {
  tags: string[] | undefined;
  /** Used only when `tags` is empty: dry-staple family inferred from the name. */
  nameFamily?: StapleRule | null;
  kcal: number;
  category: string | null;
  /** Cleaned display name; when given, name vetoes apply to every row. */
  name?: string | null;
}

export interface BasisResult {
  basis: Basis | null;
  /** Staple rule key, set only for dry-eligible staple rows (no disqualifying tag). */
  stapleRule: StapleRule | null;
  /** Staple family matched by tags, even if disqualified (review candidates). */
  candidateFamily: StapleRule | null;
  /** Why basis is null / why decided (short code, for review). */
  reason: string;
}

export function determineBasis({
  tags,
  kcal,
  category,
  nameFamily,
  name,
}: BasisInput): BasisResult {
  const t = tags ?? [];
  const nameKnown = name !== undefined;
  const dryVeto = nameKnown && hasDryVeto(name);
  if (t.length === 0 && nameFamily && !dryVeto) {
    const [lo, hi] = DRY_BAND[nameFamily];
    if (kcal >= lo && kcal <= hi) {
      return {
        basis: "crudo",
        stapleRule: nameFamily,
        candidateFamily: nameFamily,
        reason: "name_and_dry_density",
      };
    }
    return {
      basis: null,
      stapleRule: null,
      candidateFamily: nameFamily,
      reason: "name_staple_density_out_of_dry_band",
    };
  }
  let family = stapleFamily(t);
  // Pasta sold under mis-tagged categories (e.g. only en:legumes) is still pasta.
  if (nameKnown && family === "legumes_dry" && STRONG_PASTA_SHAPE.test(foldNameRules(name))) {
    family = "pasta_dry";
  }
  // Couscous is a grain even when only tagged as pasta / semolina / not at all.
  if (nameKnown && /^(cous ?cous|cuscus)\b/u.test(foldNameRules(name))) family = "grains_dry";
  const cooked = hasCookedSignal(t);
  const disq = hasDisqualifyingTag(t);
  const eligible = family !== null && !disq && !dryVeto;

  if (cooked) {
    if (category !== "cereales_y_granos" && category !== "legumbres") {
      return {
        basis: null,
        stapleRule: null,
        candidateFamily: family,
        reason: "cooked_signal_outside_grain_legume",
      };
    }
    if (nameKnown && !isPlainStapleName(name)) {
      return {
        basis: null,
        stapleRule: null,
        candidateFamily: family,
        reason: "cooked_dish_or_unplain_name",
      };
    }
    if (kcal >= COOKED_BAND[0] && kcal <= COOKED_BAND[1]) {
      return {
        basis: "cocido",
        stapleRule: null,
        candidateFamily: family,
        reason: "cooked_tag_and_density",
      };
    }
    return {
      basis: null,
      stapleRule: null,
      candidateFamily: family,
      reason: "cooked_tag_density_conflict",
    };
  }

  if (eligible && family) {
    const [lo, hi] = DRY_BAND[family];
    if (kcal >= lo && kcal <= hi) {
      return {
        basis: "crudo",
        stapleRule: family,
        candidateFamily: family,
        reason: "dry_staple_density",
      };
    }
    return {
      basis: null,
      stapleRule: null,
      candidateFamily: family,
      reason: "staple_density_out_of_dry_band",
    };
  }
  if (family) {
    return {
      basis: null,
      stapleRule: null,
      candidateFamily: family,
      reason: dryVeto ? "staple_name_vetoed" : "staple_tag_with_disqualifying_tag",
    };
  }
  return { basis: null, stapleRule: null, candidateFamily: null, reason: "no_basis_signal" };
}

// ── Name fallback for rows with NO category tags at all ──────────────────────
// Only used when categories_tags is empty (common for Hacendado rows). A name
// match alone never yields a basis: crudo still needs the family's dry density
// band, and any word hinting at cooked / prepared / filled / mixed products
// disqualifies the name.

const NAME_FAMILY: Array<[StapleRule, RegExp]> = [
  [
    "pasta_dry",
    /^(pasta|espagueti|macarron|fideo|penne|fusilli|tallarin|lazo|codo|rigatoni|farfalle|canelon|lasana)/u,
  ],
  ["rice_dry", /^arroz/u],
  ["legumes_dry", /^(lenteja|garbanzo|alubia|judia blanca|judias pintas)/u],
  ["grains_dry", /^(cuscus|quinoa|avena|copos de avena|bulgur)/u],
];
const NAME_DISQUALIFY =
  /(cocid|bote|conserva|precocin|\bcon\b|\bal\b|\ba la\b|fresc|rellen|carbonara|bolo|ensalada|sopa|pollo|atun|pato|verdura|vegetal|congelad|microondas|instant|salsa|chocolate|sabor|guarnicion|frito|\bde\b.*\bcon\b)/u;

function foldName(s: string): string {
  return s.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().trim();
}

export function nameStapleFamily(name: string | null | undefined): StapleRule | null {
  if (!name) return null;
  const n = foldName(name);
  if (NAME_DISQUALIFY.test(n) || hasDryVeto(name)) return null;
  for (const [fam, re] of NAME_FAMILY) if (re.test(n)) return fam;
  return null;
}
