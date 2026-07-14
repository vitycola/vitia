import { scaleAiMacros } from "@/lib/aiMacros";
import type { AIFoodItem } from "@/types/aiFood";

const baseItem: AIFoodItem = {
  foodId: "food-arroz",
  name: "Arroz cocido",
  kcal: 200,
  protein: 4,
  carbs: 44,
  fat: 0.4,
  quantity: 100,
  unit: "g",
  confidence: "high",
};

describe("scaleAiMacros", () => {
  it("returns identity values at original quantity", () => {
    const result = scaleAiMacros(baseItem, 100);
    expect(result.kcal).toBeCloseTo(200);
    expect(result.protein).toBeCloseTo(4);
    expect(result.carbs).toBeCloseTo(44);
    expect(result.fat).toBeCloseTo(0.4);
  });

  it("scales proportionally at double quantity", () => {
    const result = scaleAiMacros(baseItem, 200);
    expect(result.kcal).toBeCloseTo(400);
    expect(result.protein).toBeCloseTo(8);
    expect(result.carbs).toBeCloseTo(88);
    expect(result.fat).toBeCloseTo(0.8);
  });

  it("scales proportionally at half quantity", () => {
    const result = scaleAiMacros(baseItem, 50);
    expect(result.kcal).toBeCloseTo(100);
    expect(result.protein).toBeCloseTo(2);
    expect(result.carbs).toBeCloseTo(22);
    expect(result.fat).toBeCloseTo(0.2);
  });

  it("returns zero macros when quantity is 0", () => {
    const result = scaleAiMacros(baseItem, 0);
    expect(result.kcal).toBe(0);
    expect(result.protein).toBe(0);
    expect(result.carbs).toBe(0);
    expect(result.fat).toBe(0);
  });

  it("returns zero macros when item quantity is 0 (guard division by zero)", () => {
    const zeroItem = { ...baseItem, quantity: 0 };
    const result = scaleAiMacros(zeroItem, 100);
    expect(result.kcal).toBe(0);
    expect(result.protein).toBe(0);
    expect(result.carbs).toBe(0);
    expect(result.fat).toBe(0);
  });
});
