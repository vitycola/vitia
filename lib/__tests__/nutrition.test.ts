import type { Food } from "@/db/schema";
import { macroCalorieShares, sumIngredientMacros } from "../nutrition";

function makeIngredientFood(
  overrides: Partial<Food> = {}
): Pick<Food, "caloriesPer100g" | "proteinPer100g" | "carbsPer100g" | "fatPer100g"> {
  return {
    caloriesPer100g: 100,
    proteinPer100g: 10,
    carbsPer100g: 15,
    fatPer100g: 3,
    ...overrides,
  };
}

describe("macroCalorieShares", () => {
  it("sums to 1 (100%) within rounding tolerance for a typical food", () => {
    const shares = macroCalorieShares({ proteinG: 10, carbsG: 20, fatG: 5 });
    const total = shares.proteinShare + shares.carbsShare + shares.fatShare;
    expect(total).toBeCloseTo(1, 5);
  });

  it("computes shares using 4/4/9 kcal-per-gram densities", () => {
    // protein: 10*4=40, carbs: 20*4=80, fat: 5*9=45 → total 165
    const shares = macroCalorieShares({ proteinG: 10, carbsG: 20, fatG: 5 });
    expect(shares.proteinShare).toBeCloseTo(40 / 165, 5);
    expect(shares.carbsShare).toBeCloseTo(80 / 165, 5);
    expect(shares.fatShare).toBeCloseTo(45 / 165, 5);
  });

  it("returns all-zero shares when total macro-calories is 0 (divide-by-zero guard)", () => {
    const shares = macroCalorieShares({ proteinG: 0, carbsG: 0, fatG: 0 });
    expect(shares).toEqual({ proteinShare: 0, carbsShare: 0, fatShare: 0 });
  });

  it("attributes 100% to the single non-zero macro", () => {
    const shares = macroCalorieShares({ proteinG: 25, carbsG: 0, fatG: 0 });
    expect(shares.proteinShare).toBe(1);
    expect(shares.carbsShare).toBe(0);
    expect(shares.fatShare).toBe(0);
  });
});

describe("sumIngredientMacros", () => {
  it("computes the weighted sum of two ingredients, returning per-100g macros", () => {
    // huevo: 155 kcal/100g at 50g -> 77.5 kcal, 6.5g protein/100g -> 3.25g
    // queso: 300 kcal/100g at 30g -> 90 kcal
    const huevo = makeIngredientFood({
      caloriesPer100g: 155,
      proteinPer100g: 13,
      carbsPer100g: 1.1,
      fatPer100g: 11,
    });
    const queso = makeIngredientFood({
      caloriesPer100g: 300,
      proteinPer100g: 20,
      carbsPer100g: 2,
      fatPer100g: 24,
    });

    const result = sumIngredientMacros([
      { food: huevo, weightG: 50 },
      { food: queso, weightG: 30 },
    ]);

    // Total weight: 80g
    expect(result.totalWeightG).toBe(80);

    // Total calories: (155*0.5) + (300*0.3) = 77.5 + 90 = 167.5
    // Per-100g: 167.5 / 80 * 100 = 209.375
    expect(result.caloriesPer100g).toBeCloseTo(209.375, 5);
  });

  it("returns the ingredient's own per-100g macros for a single ingredient (identity)", () => {
    const food = makeIngredientFood({ caloriesPer100g: 130, proteinPer100g: 2.7 });
    const result = sumIngredientMacros([{ food, weightG: 100 }]);

    expect(result.totalWeightG).toBe(100);
    expect(result.caloriesPer100g).toBeCloseTo(130, 5);
    expect(result.proteinPer100g).toBeCloseTo(2.7, 5);
  });

  it("tolerates a zero-weight ingredient without dividing by zero for that entry", () => {
    const food = makeIngredientFood({ caloriesPer100g: 200 });
    const zeroWeight = makeIngredientFood({ caloriesPer100g: 9999 });

    const result = sumIngredientMacros([
      { food, weightG: 100 },
      { food: zeroWeight, weightG: 0 },
    ]);

    expect(result.totalWeightG).toBe(100);
    expect(result.caloriesPer100g).toBeCloseTo(200, 5);
  });

  it("throws when given an empty ingredients array (spec: Empty Recipe cannot be saved)", () => {
    expect(() => sumIngredientMacros([])).toThrow(/al menos un ingrediente/i);
  });

  it("retains full precision — does not round a non-integer sum", () => {
    // Use two different foods/weights to force a non-integer per-100g result.
    const foodA = makeIngredientFood({ proteinPer100g: 13 });
    const foodB = makeIngredientFood({ proteinPer100g: 20 });
    const result = sumIngredientMacros([
      { food: foodA, weightG: 37 },
      { food: foodB, weightG: 41 },
    ]);
    // Not a round number — confirms no rounding was applied internally.
    expect(Number.isInteger(result.proteinPer100g * 1000)).toBe(false);
  });
});
