import { OFF_CATEGORY_RULES, categoryFromOffTags } from "../offCategoryMap";

describe("OFF_CATEGORY_RULES", () => {
  it("is a non-empty ordered list of { tag, category } pairs", () => {
    expect(OFF_CATEGORY_RULES.length).toBeGreaterThan(0);
    for (const rule of OFF_CATEGORY_RULES) {
      expect(typeof rule.tag).toBe("string");
      expect(rule.tag.length).toBeGreaterThan(0);
      expect(typeof rule.category).toBe("string");
    }
  });
});

describe("categoryFromOffTags", () => {
  it("maps a known OFF tag to its category", () => {
    expect(categoryFromOffTags(["en:rices"])).toBe("cereales_y_granos");
  });

  it("returns the first matching rule when multiple tags are present (first-match-wins ordering)", () => {
    // en:legumes should resolve before an unrelated later tag.
    expect(categoryFromOffTags(["en:some-other-tag", "en:legumes"])).toBe("legumbres");
  });

  it("returns null for an unmapped tag", () => {
    expect(categoryFromOffTags(["en:not-a-real-off-tag"])).toBeNull();
  });

  it("returns null for undefined tags", () => {
    expect(categoryFromOffTags(undefined)).toBeNull();
  });

  it("returns null for an empty tags array", () => {
    expect(categoryFromOffTags([])).toBeNull();
  });
});
