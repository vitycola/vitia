/**
 * Name and brand cleaning for Open Food Facts rows. Pure functions.
 */

const SMALL_WORDS = new Set([
  "de",
  "del",
  "la",
  "las",
  "el",
  "los",
  "y",
  "e",
  "con",
  "en",
  "a",
  "al",
]);

const LEADING_EMOJI_RE = /^(?:\p{Extended_Pictographic}|\p{Emoji_Presentation}|️|‍|\s)+/u;

const CYRILLIC_LOOKALIKES: Record<string, string> = {
  а: "a",
  е: "e",
  о: "o",
  р: "p",
  с: "c",
  у: "y",
  х: "x",
  к: "k",
  м: "m",
  т: "t",
  А: "A",
  В: "B",
  Е: "E",
  К: "K",
  М: "M",
  Н: "H",
  О: "O",
  Р: "P",
  С: "C",
  Т: "T",
  Х: "X",
};

export function hasCyrillic(s: string): boolean {
  return /\p{Script=Cyrillic}/u.test(s);
}

/**
 * Replaces Cyrillic letters that look like Latin ones, but only when EVERY
 * Cyrillic letter in the string is such a lookalike and the string also has
 * Latin letters (a Spanish name with a stray Cyrillic character). Genuine
 * Cyrillic text is left untouched (and flagged in review.csv).
 */
export function normalizeCyrillicLookalikes(s: string): string {
  if (!hasCyrillic(s) || !/\p{Script=Latin}/u.test(s)) return s;
  const cyr = s.match(/\p{Script=Cyrillic}/gu) ?? [];
  if (!cyr.every((c) => c in CYRILLIC_LOOKALIKES)) return s;
  return s.replace(/\p{Script=Cyrillic}/gu, (c) => CYRILLIC_LOOKALIKES[c] ?? c);
}

export function collapseWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** True when the string has letters and none of them is lowercase. */
export function isAllCaps(s: string): boolean {
  const letters = s.match(/\p{L}/gu);
  if (!letters || letters.length < 3) return false;
  return s === s.toLocaleUpperCase("es") && s !== s.toLocaleLowerCase("es");
}

export function toSentenceCase(s: string): string {
  const lower = s.toLocaleLowerCase("es");
  const first = lower.search(/\p{L}/u);
  if (first < 0) return lower;
  return (
    lower.slice(0, first) + lower.charAt(first).toLocaleUpperCase("es") + lower.slice(first + 1)
  );
}

/** Pack-size noise such as "500 g", "1kg", "x6", "6 x 125 g", "1,5 L", "400 ml". */
const SIZE = String.raw`\d+(?:[.,]\d+)?\s*(?:kg|g|gr|grs|l|lt|ml|cl|ud|uds|unidades)\b\.?`;
const PACK_SIZE_RE = new RegExp(
  String.raw`(?:^|[\s,;(\-–])(?:(?:\d+\s*[x×]\s*)?${SIZE}|[x×]\s*\d+\b)\)?\s*$`,
  "iu"
);

export function stripPackSize(s: string): string {
  let out = s;
  // Repeat: "Garbanzos cocidos 400 g (2 x 200 g)".
  for (let i = 0; i < 3; i++) {
    const next = out.replace(PACK_SIZE_RE, "").replace(/[\s,;\-–(]+$/u, "");
    if (next === out) break;
    out = next;
  }
  return out;
}

export function stripBrandFromName(name: string, brandVariants: string[]): string {
  let out = name;
  for (const b of brandVariants) {
    const v = collapseWhitespace(b);
    if (v.length < 3) continue;
    const re = new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(v)}(?![\\p{L}\\p{N}])`, "giu");
    out = out.replace(re, "$1");
  }
  return collapseWhitespace(out.replace(/^[\s,;:\-–]+|[\s,;:\-–]+$/gu, ""));
}

/**
 * Cleans a display name. Returns null when nothing meaningful is left
 * (fail-closed: the caller excludes the row and lists it for review).
 */
export function cleanName(
  raw: string | null | undefined,
  brandVariants: string[] = []
): string | null {
  if (!raw) return null;
  let s = collapseWhitespace(raw);
  s = collapseWhitespace(s.replace(LEADING_EMOJI_RE, ""));
  s = normalizeCyrillicLookalikes(s);
  if (!s) return null;
  s = stripBrandFromName(s, brandVariants);
  s = stripPackSize(s);
  s = s.replace(/\(\s*\)|\[\s*\]/g, " ");
  s = collapseWhitespace(s.replace(/^[\s,;:\-–]+|[\s,;:\-–]+$/gu, ""));
  if (!/\p{L}/u.test(s)) return null;
  if (isAllCaps(s)) s = toSentenceCase(s);
  else if (/^\p{Ll}/u.test(s)) s = s.charAt(0).toLocaleUpperCase("es") + s.slice(1);
  return s;
}

// ── Brand ────────────────────────────────────────────────────────────────────

export const HACENDADO = "Hacendado";

export function isHacendadoBrand(
  brands: string | null | undefined,
  brandTags: string[] = []
): boolean {
  if (brands && /hacendado/i.test(brands)) return true;
  return brandTags.some((t) => /hacendado/i.test(t));
}

/**
 * Mercadona rule: a brand of "Mercadona" is Mercadona's store brand, which for
 * food is Hacendado. We only canonicalize it when OFF itself backs that up:
 * the brand string lists Hacendado alongside Mercadona (covered by
 * isHacendadoBrand), or stores_tags contains "mercadona". A bare "Mercadona"
 * brand without that store evidence is left as written.
 */
export function isMercadonaStoreBrand(
  brands: string | null | undefined,
  brandTags: string[] = [],
  storeTags: string[] = []
): boolean {
  if (isHacendadoBrand(brands, brandTags)) return true;
  const mentionsMercadona =
    /^\s*mercadona\s*$/i.test((brands ?? "").split(",")[0] ?? "") ||
    brandTags.some((t) => /(^|:)mercadona$/i.test(t));
  return mentionsMercadona && storeTags.some((t) => t.toLowerCase() === "mercadona");
}

function titleCaseWord(w: string, index: number): string {
  const lower = w.toLocaleLowerCase("es");
  if (index > 0 && SMALL_WORDS.has(lower)) return lower;
  return lower.charAt(0).toLocaleUpperCase("es") + lower.slice(1);
}

/**
 * Display brand. All Hacendado variants collapse to "Hacendado". For other
 * brands the first comma-separated entry is used; a fully upper- or lower-case
 * brand is title-cased, mixed-case brands are kept as written.
 */
export function canonicalBrand(
  brands: string | null | undefined,
  brandTags: string[] = [],
  storeTags: string[] = []
): string | null {
  if (isMercadonaStoreBrand(brands, brandTags, storeTags)) return HACENDADO;
  if (!brands) return null;
  const first = collapseWhitespace(brands.split(",")[0] ?? "");
  if (!first || !/\p{L}/u.test(first)) return null;
  if (first === first.toLocaleUpperCase("es") || first === first.toLocaleLowerCase("es")) {
    return first
      .split(" ")
      .map((w, i) => titleCaseWord(w, i))
      .join(" ");
  }
  return first;
}

/** Brand strings (raw + canonical) to strip from the product name. */
export function brandVariantsFor(
  brands: string | null | undefined,
  canonical: string | null
): string[] {
  const out = new Set<string>();
  if (canonical) out.add(canonical);
  if (canonical === HACENDADO) {
    out.add("Hacendado");
    out.add("Mercadona");
  }
  for (const b of (brands ?? "").split(",")) {
    const t = collapseWhitespace(b);
    if (t) out.add(t);
  }
  return [...out];
}
