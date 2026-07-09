import type { CookingBasis } from "@/lib/cookingConversion";

/**
 * Ordered, first-match-wins. Maps OFF taxonomy tags that carry a positive
 * cooked/prepared/canned signal to "cocido". Committed in-repo (BR-6,
 * offline-first). Sourced from OFF's published category TAXONOMY (not the
 * product dump).
 *
 * FAIL-CLOSED ASYMMETRY (see `basisFromOffTags`): this list is intentionally
 * one-directional — it only ever asserts "cocido" on a positive signal. There
 * is no equivalent "raw-signal" list because OFF's taxonomy does not reliably
 * mark raw products; absence of a cooked signal must resolve to unknown
 * (null), never "crudo" (spec: "OFF product with no cooked-signal tag").
 */
export const OFF_BASIS_RULES: ReadonlyArray<{ tag: string; basis: CookingBasis }> = [
  { tag: "en:cooked", basis: "cocido" },
  { tag: "en:cooked-foods", basis: "cocido" },
  { tag: "en:canned-foods", basis: "cocido" }, // canned legumes/veg are pre-cooked
  { tag: "en:precooked-foods", basis: "cocido" },
  { tag: "en:prepared-dishes", basis: "cocido" },
  { tag: "en:conserves", basis: "cocido" }, // "conserva"
  { tag: "en:canned-vegetables", basis: "cocido" },
  { tag: "en:canned-legumes", basis: "cocido" },
];

/** Bump when the rule set changes — enables future audit. */
export const OFF_BASIS_VERSION = 1;

/**
 * Returns "cocido" if any cooked-signal tag from OFF_BASIS_RULES is present
 * in the product's `categories_tags`. Otherwise returns null (unknown) —
 * NEVER "crudo". Absence of a cooked signal does not prove the product is
 * raw; many raw products simply lack any raw-signal tag in OFF's taxonomy.
 * Keeping the result null (rather than guessing crudo) keeps the conversion
 * toggle hidden until a curator resolves the basis explicitly (BR-5 spirit).
 */
export function basisFromOffTags(tags: string[] | undefined): CookingBasis | null {
  if (!tags || tags.length === 0) return null;
  const tagSet = new Set(tags);
  for (const rule of OFF_BASIS_RULES) {
    if (tagSet.has(rule.tag)) return rule.basis;
  }
  return null;
}
