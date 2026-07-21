/**
 * Tests for the `imageUrl` fallback chain in normalizeOffProduct
 * (lib/openFoodFacts.ts).
 *
 * lib/openFoodFacts.ts reads `import.meta.env.DEV` at module scope (Vite-only
 * syntax), which ts-jest cannot parse under CommonJS. We mirror the pure
 * fallback logic here instead of importing the module directly — the same
 * pattern used by src/components/__tests__/MealEntryRow.test.ts for logic
 * that lives alongside Vite/DOM-only code.
 */

function resolveImageUrl(p: { image_front_small_url?: string; image_url?: string }): string | null {
  return p.image_front_small_url ?? p.image_url ?? null;
}

/**
 * Mirrors the pure `hasNoNutritionData` predicate from lib/openFoodFacts.ts
 * (search() boundary filter, Issue #48). Not imported directly for the same
 * reason as resolveImageUrl above — the module reads `import.meta.env.DEV`.
 */
function hasNoNutritionData(p: { no_nutrition_data?: boolean | string }): boolean {
  return p.no_nutrition_data === true || p.no_nutrition_data === "on";
}

describe("normalizeOffProduct — imageUrl fallback chain", () => {
  it("prefers image_front_small_url when present", () => {
    expect(
      resolveImageUrl({
        image_front_small_url: "https://example.com/small.jpg",
        image_url: "https://example.com/full.jpg",
      })
    ).toBe("https://example.com/small.jpg");
  });

  it("falls back to image_url when image_front_small_url is absent", () => {
    expect(resolveImageUrl({ image_url: "https://example.com/full.jpg" })).toBe(
      "https://example.com/full.jpg"
    );
  });

  it("is null when neither image field is present", () => {
    expect(resolveImageUrl({})).toBeNull();
  });
});

describe("search() — no-nutrition-data boundary filter (Issue #48)", () => {
  it("drops a product when no_nutrition_data is boolean true", () => {
    expect(hasNoNutritionData({ no_nutrition_data: true })).toBe(true);
  });

  it('drops a product when no_nutrition_data is the CGI-serialized string "on"', () => {
    expect(hasNoNutritionData({ no_nutrition_data: "on" })).toBe(true);
  });

  it("keeps a product when no_nutrition_data is explicitly false", () => {
    expect(hasNoNutritionData({ no_nutrition_data: false })).toBe(false);
  });

  it("keeps a product when no_nutrition_data is absent", () => {
    expect(hasNoNutritionData({})).toBe(false);
  });

  it("keeps a genuine zero-macro product (e.g. water) that is not flagged as no-data", () => {
    // Water: all macros are legitimately zero, and OFF does not flag it as
    // missing nutrition data. The predicate must not use an all-zero macro
    // heuristic — it only looks at no_nutrition_data.
    const water = { no_nutrition_data: undefined as boolean | string | undefined };
    expect(hasNoNutritionData(water)).toBe(false);
  });
});
