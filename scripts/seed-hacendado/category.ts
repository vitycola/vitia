/**
 * Category resolution for Open Food Facts rows.
 *
 * Strategy: an explicit, ordered rule list (first match wins) that fixes the
 * cases where the app's generic `categoryFromOffTags` (lib/offCategoryMap.ts)
 * gives a wrong answer purely because of rule ORDER on multi-tag products
 * (e.g. peanut butter carries en:legumes, plant drinks carry en:legume-*), and
 * fills gaps for tags the generic map does not know. When none of these match
 * we fall back to the generic map. Unresolved => null (listed in review.csv).
 */

import type { FoodCategory } from "../../lib/foodCategories";
import { categoryFromOffTags } from "../../lib/offCategoryMap";
import {
  PASTA_SHAPE,
  STRONG_PASTA_SHAPE,
  categoryFromName,
  foldName,
  hasDryVeto,
} from "./nameRules";
import type { StapleRule } from "./staples";

type Rule = { tags: string[]; category: FoodCategory };

export const SEED_CATEGORY_RULES: ReadonlyArray<Rule> = [
  // 1. Drinks that would otherwise look like dairy / legumes / fruit.
  {
    category: "bebidas",
    tags: [
      "en:plant-based-beverages",
      "en:plant-based-milk-alternatives",
      "en:soy-based-drinks",
      "en:legume-based-drinks",
      "en:milk-substitutes",
      "en:fruit-based-beverages",
      "en:fruit-juices",
      "en:juices-and-nectars",
      "en:waters",
      "en:sodas",
      "en:carbonated-drinks",
      "en:coffees",
      "en:teas",
      "en:hot-beverages",
      "en:alcoholic-beverages",
      "en:beers",
      "en:wines",
      "en:non-alcoholic-beverages",
      "en:energy-drinks",
      "en:sweetened-beverages",
    ],
  },
  // 2. Spreads: sweet ones are sweets, nut/peanut butters are nuts.
  {
    category: "dulces_y_snacks",
    tags: [
      "en:chocolate-spreads",
      "en:sweet-spreads",
      "en:hazelnut-spreads",
      "en:jams",
      "en:honeys",
    ],
  },
  {
    category: "frutos_secos",
    tags: ["en:peanut-butters", "en:nut-butters", "en:legume-butters", "en:oilseed-purees"],
  },
  // 2b. Pre-cooked plain rice is still a grain (basis cocido), not a dish.
  {
    category: "cereales_y_granos",
    tags: ["en:precooked-rices", "en:cooked-rices", "en:cooked-pastas"],
  },
  // 3. Prepared dishes (must win over the grain / legume ingredient tags).
  {
    category: "otros",
    tags: [
      "en:pasta-dishes",
      "en:instant-pasta",
      "en:instant-noodles",
      "en:instant-noodle-soups",
      "en:risottos",
      "en:quiches",
      "en:rice-dishes",
      "en:soups",
      "en:pizzas",
      "en:sandwiches",
      "en:prepared-salads",
      "en:dishes",
      "en:microwave-meals",
      "en:meat-alternatives",
      "en:meat-analogues",
    ],
  },
  // 4. Sauces, condiments, oils, spices.
  {
    category: "condimentos_y_salsas",
    tags: [
      "en:sauces",
      "en:condiments",
      "en:dressings",
      "en:vinegars",
      "en:spices",
      "en:salts",
      "en:olive-tree-products",
      "en:fats",
      "en:vegetable-oils",
      "en:oils",
      "en:mayonnaises",
      "en:ketchups",
    ],
  },
  // 5. Dairy (before desserts so dairy desserts stay dairy).
  {
    category: "lacteos",
    tags: [
      "en:cheeses",
      "en:yogurts",
      "en:milks",
      "en:dairies",
      "en:fermented-milk-products",
      "en:dairy-desserts",
      "en:dairy-drinks",
      "en:creams",
      "en:butters",
    ],
  },
  // 6. Sweets and snacks (before cereals so biscuits are not grains).
  {
    category: "dulces_y_snacks",
    tags: [
      "en:chocolates",
      "en:confectioneries",
      "en:biscuits-and-cakes",
      "en:biscuits",
      "en:cakes",
      "en:desserts",
      "en:ice-creams-and-sorbets",
      "en:frozen-desserts",
      "en:sweet-snacks",
      "en:snacks",
      "en:salty-snacks",
      "en:crisps",
      "en:chips-and-fries",
      "en:cocoa-and-its-products",
      "en:sugars",
      "en:appetizers",
    ],
  },
  // 7. Cold cuts before generic meats.
  {
    category: "fiambres_y_embutidos",
    tags: ["en:cold-cuts", "en:sausages", "en:prepared-meats", "en:hams", "en:charcuteries"],
  },
  {
    category: "carnes",
    tags: [
      "en:meats",
      "en:meats-and-their-products",
      "en:poultries",
      "en:poultry",
      "en:chicken-and-its-products",
      "en:beef",
      "en:pork",
    ],
  },
  {
    category: "pescados_y_mariscos",
    tags: [
      "en:fishes",
      "en:fishes-and-their-products",
      "en:fatty-fishes",
      "en:canned-fishes",
      "en:seafood",
      "en:salmons",
      "en:tunas",
      "en:surimi",
    ],
  },
  { category: "huevos", tags: ["en:eggs"] },
  // 8. Nuts before legumes (peanuts are tagged en:legumes in OFF).
  {
    category: "frutos_secos",
    tags: [
      "en:nuts",
      "en:nuts-and-their-products",
      "en:peanuts",
      "en:roasted-peanuts",
      "en:dried-fruits-and-nuts",
    ],
  },
  // 9. Vegetables that OFF also tags as legumes, and potatoes.
  {
    category: "vegetales",
    tags: [
      "en:green-beans",
      "en:potatoes",
      "en:sweet-potatoes-and-their-products",
      "en:frozen-vegetables",
      "en:fresh-vegetables",
      "en:green-peas",
      "en:sprouted-seeds",
      "en:sweet-corn",
      "en:canned-sweet-corn",
      "en:corn-on-the-cob",
    ],
  },
  // 10. Grains and legumes.
  {
    category: "cereales_y_granos",
    tags: [
      "en:rices",
      "en:pastas",
      "en:cereal-pastas",
      "en:noodles",
      "en:couscous",
      "en:quinoa",
      "en:rolled-oats",
      "en:oat-flakes",
      "en:cereal-grains",
      "en:breakfast-cereals",
      "en:flours",
      "en:breads",
      "en:cereals",
      "en:cereals-and-their-products",
      "en:semolina",
      "en:bulgur",
    ],
  },
  {
    category: "legumbres",
    tags: [
      "en:legumes",
      "en:lentils",
      "en:chickpeas",
      "en:beans",
      "en:pulses",
      "en:legume-seeds",
      "en:legumes-and-their-products",
    ],
  },
  // 11. Produce.
  { category: "frutas", tags: ["en:fruits", "en:fruits-based-foods", "en:fresh-fruits"] },
  {
    category: "vegetales",
    tags: ["en:vegetables", "en:vegetables-based-foods", "en:plant-based-pickles", "en:pickles"],
  },
  // 12. Generic beverages last (dairy / plant drinks were handled above).
  { category: "bebidas", tags: ["en:beverages", "en:beverages-and-beverages-preparations"] },
  // 12b. Gap fillers for tags the generic map does not know.
  {
    category: "condimentos_y_salsas",
    tags: [
      "en:broths",
      "en:bouillon-cubes",
      "en:dehydrated-broths",
      "en:liquid-broths",
      "en:vegetable-broths",
      "en:cooking-helpers",
    ],
  },
  {
    category: "dulces_y_snacks",
    tags: [
      "en:sweeteners",
      "en:sugar-substitutes",
      "en:syrups",
      "en:simple-syrups",
      "en:agave-syrups",
      "en:dessert-mixes",
      "en:mixes-for-jelly-desserts",
      "en:tabletop-sweeteners",
      "en:snacks-and-desserts-for-babies",
    ],
  },
  { category: "lacteos", tags: ["en:baby-milks", "en:infant-formulas", "en:growth-milks"] },
  {
    category: "frutos_secos",
    tags: [
      "en:sunflower-seeds",
      "en:pumpkin-seeds",
      "en:sunflower-seeds-and-their-products",
      "en:pumpkin-seeds-and-their-products",
    ],
  },
  {
    category: "frutas",
    tags: ["en:canned-fruits", "en:baby-fruit-desserts", "en:fruit-based-foods"],
  },
  { category: "cereales_y_granos", tags: ["en:pizza-dough", "en:bakery-products"] },
  {
    category: "otros",
    tags: [
      "en:baby-foods",
      "en:food-additives",
      "en:dietary-supplements",
      "en:bodybuilding-supplements",
      "en:baker-s-yeast",
      "en:food-colorings",
    ],
  },
  // 13. Ready meals with no better signal.
  { category: "otros", tags: ["en:meals", "en:plant-based-meals"] },
];

export interface CategoryOptions {
  /** Staple family inferred from the name (only used when tags are empty). */
  nameFamily?: StapleRule | null;
  /** Cleaned display name; enables the name overrides that run before the tag rules. */
  name?: string | null;
  kcal?: number;
}

export function resolveCategory(
  tags: string[] | undefined,
  opts: CategoryOptions = {}
): FoodCategory | null {
  const t = tags ?? [];
  const byName = categoryFromName(opts.name, t, { kcal: opts.kcal });
  if (byName) return byName;
  // A plain pasta-shape name on a pasta-tagged row is pasta, whatever other tags say
  // (e.g. legume-flour pasta also tagged en:legumes).
  const n = foldName(opts.name);
  if (
    n &&
    PASTA_SHAPE.test(n) &&
    !hasDryVeto(opts.name) &&
    (t.some((x) => x === "en:pastas" || x === "en:dry-pastas" || x === "en:cereal-pastas") ||
      (STRONG_PASTA_SHAPE.test(n) && t.some((x) => x === "en:legumes" || x === "en:pulses")))
  ) {
    return "cereales_y_granos";
  }
  if (t.length === 0) {
    if (opts.nameFamily === "legumes_dry") return "legumbres";
    return opts.nameFamily ? "cereales_y_granos" : null;
  }
  const set = new Set(t);
  for (const rule of SEED_CATEGORY_RULES) {
    if (rule.tags.some((t) => set.has(t))) return rule.category;
  }
  return categoryFromOffTags(tags);
}
