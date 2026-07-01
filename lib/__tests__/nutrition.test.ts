import { macroCalorieShares } from "../nutrition";

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
