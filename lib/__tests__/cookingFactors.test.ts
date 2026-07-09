import { COOKING_FACTORS, COOKING_FACTORS_VERSION } from "../cookingFactors";
import { FOOD_CATEGORIES } from "../foodCategories";

describe("COOKING_FACTORS", () => {
  it("only contains keys that are valid FoodCategory keys", () => {
    const validKeys = new Set(Object.keys(FOOD_CATEGORIES));
    for (const key of Object.keys(COOKING_FACTORS)) {
      expect(validKeys.has(key)).toBe(true);
    }
  });

  it("every factor is a positive finite number", () => {
    for (const factor of Object.values(COOKING_FACTORS)) {
      expect(typeof factor).toBe("number");
      expect(Number.isFinite(factor)).toBe(true);
      expect(factor as number).toBeGreaterThan(0);
    }
  });

  it("has at least one entry for each of the categories called out in scope (cereales_y_granos, legumbres, carnes, pescados_y_mariscos, huevos, vegetales)", () => {
    const scoped = [
      "cereales_y_granos",
      "legumbres",
      "carnes",
      "pescados_y_mariscos",
      "huevos",
      "vegetales",
    ] as const;
    for (const key of scoped) {
      expect(COOKING_FACTORS[key]).toBeDefined();
    }
  });

  it("intentionally omits categories with no defensible raw/cooked pair", () => {
    // Eaten raw / no meaningful cooked-weight transformation.
    const factors: Partial<Record<string, number>> = COOKING_FACTORS;
    expect(factors.bebidas).toBeUndefined();
    expect(factors.condimentos_y_salsas).toBeUndefined();
  });
});

describe("COOKING_FACTORS_VERSION", () => {
  it("is a positive integer", () => {
    expect(Number.isInteger(COOKING_FACTORS_VERSION)).toBe(true);
    expect(COOKING_FACTORS_VERSION).toBeGreaterThan(0);
  });
});
