import { OFF_BASIS_RULES, OFF_BASIS_VERSION, basisFromOffTags } from "../offBasisMap";

describe("OFF_BASIS_RULES", () => {
  it("is a non-empty ordered list of { tag, basis } pairs, all cooked-signal only", () => {
    expect(OFF_BASIS_RULES.length).toBeGreaterThan(0);
    for (const rule of OFF_BASIS_RULES) {
      expect(typeof rule.tag).toBe("string");
      expect(rule.basis).toBe("cocido"); // fail-closed asymmetry: never "crudo" here
    }
  });
});

describe("basisFromOffTags", () => {
  it("resolves cocido for a cooked-signal tag", () => {
    expect(basisFromOffTags(["en:canned-foods"])).toBe("cocido");
  });

  it("resolves null (not crudo) when no cooked-signal tag is present", () => {
    expect(basisFromOffTags(["en:rices"])).toBeNull();
  });

  it("resolves null for undefined tags", () => {
    expect(basisFromOffTags(undefined)).toBeNull();
  });

  it("resolves null for an empty tags array", () => {
    expect(basisFromOffTags([])).toBeNull();
  });

  it("never returns crudo — the function's return type only allows cocido or null", () => {
    // Type-level guarantee spot-checked at runtime: scanning every rule's
    // basis value confirms none is "crudo".
    const values = OFF_BASIS_RULES.map((r) => r.basis);
    expect(values).not.toContain("crudo");
  });
});

describe("OFF_BASIS_VERSION", () => {
  it("is a positive integer", () => {
    expect(Number.isInteger(OFF_BASIS_VERSION)).toBe(true);
    expect(OFF_BASIS_VERSION).toBeGreaterThan(0);
  });
});
