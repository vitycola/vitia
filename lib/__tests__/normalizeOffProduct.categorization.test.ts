/**
 * Tests for the `category`/`dataBasis` resolution logic that
 * `normalizeOffProduct` (lib/openFoodFacts.ts) wires in for every OFF
 * product, via `categoryFromOffTags` (lib/offCategoryMap.ts) and
 * `basisFromOffTags` (lib/offBasisMap.ts).
 *
 * lib/openFoodFacts.ts reads `import.meta.env.DEV` at module scope
 * (Vite-only syntax), which ts-jest cannot parse under CommonJS. We mirror
 * the pure categorization step here instead of importing the module
 * directly — the same pattern used by lib/__tests__/openFoodFacts.test.ts.
 */
import { basisFromOffTags } from "../offBasisMap";
import { categoryFromOffTags } from "../offCategoryMap";

/** Mirrors the two lines added to normalizeOffProduct's returned object. */
function resolveCategoryAndBasis(p: { categories_tags?: string[] }) {
  return {
    category: categoryFromOffTags(p.categories_tags) ?? null,
    dataBasis: basisFromOffTags(p.categories_tags) ?? null,
  };
}

describe("normalizeOffProduct — category + dataBasis resolution", () => {
  it("resolves both category and dataBasis for a product with matching tags", () => {
    const result = resolveCategoryAndBasis({
      categories_tags: ["en:legumes", "en:canned-foods"],
    });
    expect(result).toEqual({ category: "legumbres", dataBasis: "cocido" });
  });

  it("resolves category but leaves dataBasis null when no cooked-signal tag is present", () => {
    const result = resolveCategoryAndBasis({ categories_tags: ["en:rices"] });
    expect(result).toEqual({ category: "cereales_y_granos", dataBasis: null });
  });

  it("leaves both null for an untagged product", () => {
    const result = resolveCategoryAndBasis({});
    expect(result).toEqual({ category: null, dataBasis: null });
  });

  it("never resolves dataBasis to crudo, even with an unrelated tag set", () => {
    const result = resolveCategoryAndBasis({ categories_tags: ["en:meats"] });
    expect(result.dataBasis).not.toBe("crudo");
    expect(result.dataBasis).toBeNull();
  });
});
