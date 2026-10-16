/**
 * Name-based rules, applied to EVERY row because OFF category tags are
 * unreliable (e.g. "pate" is tagged en:pastas, vegetable "spirals" carry pasta
 * tags). All matching runs on a folded name: lower case, no diacritics,
 * punctuation replaced by single spaces ("&" is kept).
 *
 * Fail-closed: a veto only ever REMOVES a "crudo"/"cocido"/factor claim or
 * moves a row to a safer category; it never adds one.
 */

import type { FoodCategory } from "../../lib/foodCategories";

export function foldName(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9&]+/g, " ")
    .trim();
}

const re = (words: string[]): RegExp => new RegExp(`\\b(?:${words.join("|")})\\b`, "u");

/** Words that mean "this is not a plain dry staple" (blocks crudo and any factor). */
const DRY_VETO = re([
  "pate",
  "hojaldre",
  "masa",
  "dough",
  "precocid\\w*",
  "precocin\\w*",
  "relleno\\w*",
  "rellena\\w*",
  "stuffed",
  "tortellini",
  "ravioli\\w*",
  "cappellacci",
  "gnocchi",
  "noqui\\w*",
  "queso",
  "cheese",
  "carbonara",
  "ramen",
  "yakisoba",
  "instant\\w*",
  "noodles?",
  "oriental\\w*",
  "porridge",
  "granola",
  "muesli",
  "snacks?",
  "tabule",
  "coquet\\w*",
  "risotto",
  "harinas?",
  "farine",
  "gofio",
  "flour",
  "tostad\\w*",
  "schnetzel",
  "edamame",
  "soja",
  "mezclas?",
  "mix",
  "armonia",
  "chocolate",
  "choco",
  "cacao",
  "sabor\\w*",
  "miel",
  "syrup",
  "sirope",
  "platano",
  "crunchy",
  "cereales",
  "microondas?",
  "express",
  "rapid[oa]s?",
  "listo",
  "minutos?",
  "galletas?",
  "tortitas?",
  "barritas?",
  "bebida",
  "leche",
  "crema",
  "pudding",
  "vinagre",
  "cerveza",
  "sopas?",
  "caldo",
  "paella",
  "guisos?",
  "ensaladas?",
  "salsa",
  "tomate",
  "pizza",
  "bolo\\w*",
  "pollo",
  "atun",
  "verduras?",
  "vegetales?",
  "congelad\\w*",
  "frescos?",
  "frescas?",
  "cocid\\w*",
  "bote",
  "conservas?",
  "con",
  "a la",
  "y",
  "e",
  "mac",
  "vasito",
  "crujiente",
  "crispy",
  "oatibix",
  "weetabix",
  "proteica",
  "sementes",
  "semillas",
  "overnight",
  "vainilla",
  "vanilla",
  "cup",
  "fruta",
  "frutas",
  "frutos",
  "bar",
  "tarrina",
  "bol",
]);
// "y" / "e" / "mac" / "bol" are standalone-word blends ("Quinoa y arroz", "Mac & Cheese").

export function hasDryVeto(name: string | null | undefined): boolean {
  return DRY_VETO.test(foldName(name));
}

/**
 * Pasta that is not plain durum-wheat: no cooking factor (the pasta_dry factor
 * was derived from a single egg-pasta pair, so it is only defensible for plain
 * dry wheat pasta). Name words + tag fragments.
 */
const NON_DURUM_NAME = re([
  "arroz",
  "maiz",
  "lentejas?",
  "garbanzos?",
  "guisantes?",
  "legumbres?",
  "sarraceno",
  "soba",
  "udon",
  "espelta",
  "kamut",
  "gluten",
  "integrales?",
  "integral",
  "whole",
  "cuscus",
  "couscous",
  "quinoa",
  "avena",
  "konjac",
  "proteica",
  "proteina",
  "centeno",
  "wonton",
  "noodles?",
  "fideos orientales",
  "cristal",
  "judias?",
  "alubias?",
  "habas?",
  "trigo sarraceno",
  "huevo",
  "integr\\w*",
  "intregal",
  "integrals",
  "vollkorn",
  "lenticchie",
  "lentilles",
  "llenties",
  "ceci",
  "vegetal\\w*",
  "multivegetal\\w*",
  "multicol\\w*",
  "espinac\\w*",
  "farro",
  "dinkel",
  "sepia",
  "nero",
  "tinta",
  "tomate",
  "remolacha",
  "beetroot",
  "zanahoria",
  "glutine",
  "erbsen",
  "pois",
  "chickpea",
  "lentil",
  "corn",
  "mais",
  "arrisada",
]);
const TRIGO_NOT_DURUM = (n: string): boolean =>
  /\btrigo\b/u.test(n) && !/\b(trigo duro|grano duro|semola)\b/u.test(n);
const NON_DURUM_TAG =
  /gluten|rice-past|spelt|whole|wholemeal|wholegrain|legume|lentil|chickpea|pea-|peas|buckwheat|noodle|corn|quinoa|kamut|couscous|konjac|egg-past|soba|udon|rye|oat|bean/;
const DURUM_TAG = /durum|semolina/;
export const PASTA_SHAPE =
  /^(pasta|espagueti|spaghetti|macarron|penne|fusilli|tallarin|tagliatelle|lazo|codo|rigatoni|farfalle|fideo|fideos|canelon|lasana|espiral|concha|letras|estrellas|piruleta|cabello)/u;

/** True only for plain durum-wheat dry pasta (eligible for the pasta_dry factor). */
export function isPlainDurumPasta(tags: string[], name: string | null | undefined): boolean {
  const n = foldName(name);
  if (NON_DURUM_NAME.test(n) || TRIGO_NOT_DURUM(n) || hasDryVeto(name)) return false;
  if (tags.some((t) => NON_DURUM_TAG.test(t))) return false;
  if (tags.some((t) => DURUM_TAG.test(t))) return true;
  // No durum tag: accept only a plain pasta-shape name.
  return PASTA_SHAPE.test(n);
}

/** Names that are plain staples; the only names allowed to become "cocido". */
const PLAIN_STAPLE_NAME =
  /^(arroz|garbanzos?|lentejas?|alubias?|judias? (blancas?|pintas?|rojas?)|frijoles?|feijao|quinoa|cuscus|pasta|espagueti|macarron)\b/u;
const DISH_NAME = re([
  "con",
  "a la",
  "al",
  "tres delicias",
  "secreto",
  "jardinera",
  "verduras?",
  "espinacas?",
  "pollo",
  "chorizo",
  "marisco",
  "setas?",
  "guisad\\w*",
  "estofad\\w*",
  "riojana",
  "pisto",
  "bacalao",
  "carne",
  "jamon",
  "atun",
  "ternera",
  "cerdo",
  "pato",
  "negro",
  "cubana",
  "chino",
  "frito",
  "sofrito",
  "salsa",
  "tomate",
  "ensalada",
  "potaje",
  "fabada",
  "cocido",
  "y",
]);

/** cocido is allowed only for plain staples, never for dishes. */
export function isPlainStapleName(name: string | null | undefined): boolean {
  const n = foldName(name);
  return PLAIN_STAPLE_NAME.test(n) && !DISH_NAME.test(n.replace(/^arroz cocido\b/, "arroz"));
}

// ── Powdered beverages ───────────────────────────────────────────────────────

const POWDER_NAME_STRONG =
  /\b(cafe|cafes|capuchino|cappuccino|cappucino|matcha|infusion|infusiones|descafeinado)\b/u;
const POWDER_NAME_TEA = /\b(te|tes)\b/u;
const POWDER_TAG = /coffee|tea|instant-bever|cappuc|matcha|infusion/;
const LIQUID_NAME =
  /\b(bebida|leche|refresco|zumo|helado|yogur|galleta|tarta|bombon|licor|batido|cereais|cereales|cevada|cebada|chicoria|centeno|pure|patata)\b/u;
export const POWDER_KCAL_LIMIT = 150;

/**
 * Instant coffee / cappuccino / matcha / tea reported per 100 g of POWDER.
 * A drink logged by ml with these values would overcount 5-50x.
 */
export function isPowderBeverage(
  name: string | null | undefined,
  tags: string[],
  kcal: number
): boolean {
  if (kcal <= POWDER_KCAL_LIMIT) return false;
  const n = foldName(name);
  if (LIQUID_NAME.test(n)) return false;
  const tagHit = tags.some(
    (t) => POWDER_TAG.test(t) && !t.includes("legume") && !t.includes("soy")
  );
  if (POWDER_NAME_STRONG.test(n)) return tagHit || tags.length === 0;
  // The bare word "te" is ambiguous ("pure te patata"): require a beverage tag.
  return POWDER_NAME_TEA.test(n) && tagHit;
}

// ── Category overrides by name ───────────────────────────────────────────────

const VEG_PASTA =
  /\b(espirales?|fideos?|tallarines?|espaguetis?|pasta|noodles?|lasana) (de|con) (calabacin|zanahoria|verdura|boniato|vegetal|konjac|pepino|remolacha)/u;
const SWEET_CORN = /\b(mazorquit\w*|mazorcas?|maiz dulce|sweet corn)\b/u;
const SORBET = /\b(sorbetes?|sorbet|helados?)\b/u;
const PIZZA = /\b(pizzas?|pinsa)\b/u;
const PASTA_DISH =
  /\b(mac ?& ?cheese|macaroni (and|&) cheese)\b|\b(canelones|lasana|macarrones|espaguetis|tallarines|fideos|pasta) (caseros?|rellen\w*|gratinad\w*|a la|con|al|carbonara|bolo\w*)/u;
const RICE_DISH =
  /\b(risotto|arroz (con|de|al|a la|tres delicias|negro|cubano|cubana|chino|frito)\b(?! grano)|arroz (secreto|pollo|marisco|verduras|setas))/u;
const INSTANT_NOODLE = /\b(instant\w*|ramen|yakisoba|sopa|cup noodles?)\b/u;
const SEEDS = /\b(semillas?|sesamo|lino|chia|amapola|pipas?|pepitas?)\b/u;
const NUT_SNACK =
  /\b(frutos secos|cacahuetes?|almendras?|pistachos?|nueces|nuez|anacardos?|avellanas?)\b/u;
const FRUIT =
  /\b(sandia|melon|fresas?|frambuesas?|manzanas?|platanos?|pinas?|mango|kiwi|fruta|frutas|compota|pure de fruta)\b/u;
const SWEET_POTATO = /\b(batatas?|boniatos?)\b/u;
const FRESH_VEG_LEGUME =
  /\b(guisantes?|habitas?|habas|garrofon|brotes?|tempura|judias? verdes?|edamame)\b/u;
const MEAT_WORD =
  /\b(carrillada|alitas?|hamburguesas?|albondigas?|pechuga|muslos?|solomillo|costillas?|chuletas?)\b/u;
const VEGGIE_WORD = /\b(vegetal|vegana?|veggie|soja|seitan|plant|proteina vegetal)\b/u;

export interface CategoryContext {
  name?: string | null;
  kcal?: number;
}

/**
 * Category decided by name, evaluated BEFORE the tag rules. Returns null to
 * let the tag rules decide.
 */
/** Strong pasta-shape names (not the generic word "pasta"). */
export const STRONG_PASTA_SHAPE =
  /^(espagueti|spaghetti|macarron|penne|fusilli|tallarin|tagliatelle|rigatoni|farfalle|espiral|fideo|lazo|codo)/u;

export function categoryFromName(
  name: string | null | undefined,
  tags: string[],
  ctx: { kcal?: number } = {}
): FoodCategory | null {
  const n = foldName(name);
  if (!n) return null;
  if (VEG_PASTA.test(n) || SWEET_CORN.test(n)) return "vegetales";
  if (SORBET.test(n)) return "dulces_y_snacks";
  if (PIZZA.test(n) || PASTA_DISH.test(n) || RICE_DISH.test(n)) return "otros";
  if (INSTANT_NOODLE.test(n) && /\b(pasta|fideos?|noodles?|ramen|sopa|yakisoba)\b/u.test(n))
    return "otros";
  if (SEEDS.test(n) && !/\b(pipas? de girasol con)\b/u.test(n)) return "frutos_secos";
  if (NUT_SNACK.test(n) && !/\b(leche|bebida|crema|turron|chocolate)\b/u.test(n))
    return "frutos_secos";
  if (SWEET_POTATO.test(n)) return "vegetales";
  if (
    FRESH_VEG_LEGUME.test(n) &&
    !/\b(bebida|crema|leche|sopa|harina|pasta|snack|hamburguesa|burger)\b/u.test(n) &&
    (ctx.kcal === undefined || ctx.kcal < 250)
  ) {
    return "vegetales";
  }
  if (
    FRUIT.test(n) &&
    !/\b(bebida|zumo|refresco|yogur|mermelada|helado|sorbete|galleta|batido|cereales)\b/u.test(n) &&
    tags.some((t) => /dessert|fruit|sorbet/.test(t))
  ) {
    return "frutas";
  }
  if (
    MEAT_WORD.test(n) &&
    !VEGGIE_WORD.test(n) &&
    tags.some((t) => t === "en:meat-alternatives" || t === "en:meat-analogues")
  ) {
    return "carnes";
  }
  return null;
}
