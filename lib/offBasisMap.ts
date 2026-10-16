import type { CookingBasis } from "@/lib/cookingConversion";

/**
 * Ordered, first-match-wins. Maps OFF taxonomy tags that carry a positive
 * cooked/prepared/canned signal to "cocido". Committed in-repo (BR-6,
 * offline-first). Sourced from OFF's published category TAXONOMY (not the
 * product dump).
 *
 * FAIL-CLOSED ASYMMETRY (see `basisFromOffTags`): this TAG list is
 * intentionally one-directional — it only ever asserts "cocido" on a positive
 * signal. OFF's taxonomy has no reliable raw tag, so tags alone never yield
 * "crudo". The only path to "crudo" is the separate, narrow staple rule in
 * lib/offBasisInference.ts (pasta/rice/dried legumes/quinoa-type grains,
 * energy-density based). Every other product with no cooked signal stays
 * unknown (null).
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
export const OFF_BASIS_VERSION = 2; // v2: staple energy-density inference lives in offBasisInference.ts

/**
 * Returns "cocido" if any cooked-signal tag from OFF_BASIS_RULES is present
 * in the product's `categories_tags`. Otherwise returns null (unknown); this
 * function alone never returns "crudo", since absence of a cooked signal does
 * not prove the product is raw. Callers that have the product's kcal/100 g
 * should use `resolveOffBasis` (lib/offBasisInference.ts), which adds the
 * staple-only raw inference on top of this function.
 */
export function basisFromOffTags(tags: string[] | undefined): CookingBasis | null {
  if (!tags || tags.length === 0) return null;
  const tagSet = new Set(tags);
  for (const rule of OFF_BASIS_RULES) {
    if (tagSet.has(rule.tag)) return rule.basis;
  }
  return null;
}
