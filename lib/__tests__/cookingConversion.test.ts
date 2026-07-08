import { canConvert, convertWeight, directionFor, hasCookingFactor } from "../cookingConversion";

describe("convertWeight", () => {
  it("converts crudo_to_cocido using the category factor", () => {
    const result = convertWeight("cereales_y_granos", 100, "crudo_to_cocido");
    expect(result).toEqual({ kind: "converted", grams: 300 });
  });

  it("converts cocido_to_crudo as the exact inverse", () => {
    const result = convertWeight("cereales_y_granos", 300, "cocido_to_crudo");
    expect(result.kind).toBe("converted");
    if (result.kind === "converted") {
      expect(result.grams).toBeCloseTo(100, 6);
    }
  });

  it("round-trips losslessly (up to float precision)", () => {
    const cooked = convertWeight("carnes", 100, "crudo_to_cocido");
    expect(cooked.kind).toBe("converted");
    if (cooked.kind !== "converted") throw new Error("expected converted");
    const raw = convertWeight("carnes", cooked.grams, "cocido_to_crudo");
    expect(raw.kind).toBe("converted");
    if (raw.kind === "converted") {
      expect(raw.grams).toBeCloseTo(100, 6);
    }
  });

  it("returns 0 grams for 0 input in either direction (no divide-by-zero)", () => {
    expect(convertWeight("cereales_y_granos", 0, "crudo_to_cocido")).toEqual({
      kind: "converted",
      grams: 0,
    });
    expect(convertWeight("cereales_y_granos", 0, "cocido_to_crudo")).toEqual({
      kind: "converted",
      grams: 0,
    });
  });

  it("returns 0 grams for negative input (guarded, never negative output)", () => {
    const result = convertWeight("cereales_y_granos", -50, "crudo_to_cocido");
    expect(result).toEqual({ kind: "converted", grams: 0 });
  });

  it("returns no-factor for an unknown category", () => {
    expect(convertWeight("otros", 100, "crudo_to_cocido")).toEqual({ kind: "no-factor" });
  });

  it("returns no-factor for a null/undefined category", () => {
    expect(convertWeight(null, 100, "crudo_to_cocido")).toEqual({ kind: "no-factor" });
    expect(convertWeight(undefined, 100, "crudo_to_cocido")).toEqual({ kind: "no-factor" });
  });
});

describe("hasCookingFactor", () => {
  it("is true for a category present in COOKING_FACTORS", () => {
    expect(hasCookingFactor("legumbres")).toBe(true);
  });

  it("is false for a category absent from COOKING_FACTORS", () => {
    expect(hasCookingFactor("bebidas")).toBe(false);
  });

  it("is false for null/undefined", () => {
    expect(hasCookingFactor(null)).toBe(false);
    expect(hasCookingFactor(undefined)).toBe(false);
  });
});

describe("canConvert", () => {
  it("is true when both category factor and dataBasis are known", () => {
    expect(canConvert({ category: "carnes", dataBasis: "crudo" })).toBe(true);
  });

  it("is false when category has no factor (basis known)", () => {
    expect(canConvert({ category: "bebidas", dataBasis: "crudo" })).toBe(false);
  });

  it("is false when dataBasis is unresolved (category has a factor)", () => {
    expect(canConvert({ category: "carnes", dataBasis: null })).toBe(false);
  });

  it("is false when both are unknown", () => {
    expect(canConvert({ category: null, dataBasis: null })).toBe(false);
  });
});

describe("directionFor", () => {
  it("returns null when stored basis is unresolved", () => {
    expect(directionFor(null, "cocido")).toBeNull();
    expect(directionFor(undefined, "crudo")).toBeNull();
  });

  it("returns null when entered basis already matches stored basis", () => {
    expect(directionFor("crudo", "crudo")).toBeNull();
    expect(directionFor("cocido", "cocido")).toBeNull();
  });

  it("derives cocido_to_crudo when stored is crudo and entered is cocido", () => {
    expect(directionFor("crudo", "cocido")).toBe("cocido_to_crudo");
  });

  it("derives crudo_to_cocido when stored is cocido and entered is crudo", () => {
    expect(directionFor("cocido", "crudo")).toBe("crudo_to_cocido");
  });
});
