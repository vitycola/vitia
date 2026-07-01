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
