import { groupResultsByMeal } from "@/lib/aiMealGroups";
import type { AIFoodItem } from "@/types/aiFood";

function item(name: string, mealType?: AIFoodItem["mealType"]): AIFoodItem {
  return {
    name,
    kcal: 100,
    protein: 1,
    carbs: 1,
    fat: 1,
    quantity: 100,
    unit: "g",
    confidence: "high",
    mealType,
  };
}

describe("groupResultsByMeal", () => {
  it("groups items by meal in canonical order regardless of input order", () => {
    const results = [item("Pasta", "lunch"), item("Tostada", "breakfast"), item("Pollo", "lunch")];
    expect(groupResultsByMeal(results)).toEqual([
      { mealType: "breakfast", label: "Desayuno", indices: [1] },
      { mealType: "lunch", label: "Almuerzo", indices: [0, 2] },
    ]);
  });

  it("uses the shared labels, including Merienda for snack", () => {
    const groups = groupResultsByMeal([item("Fruta", "snack"), item("Sopa", "dinner")]);
    expect(groups.map((g) => g.label)).toEqual(["Merienda", "Cena"]);
  });

  it("returns a single header-less group when items are untagged", () => {
    expect(groupResultsByMeal([item("A"), item("B")])).toEqual([
      { mealType: null, label: null, indices: [0, 1] },
    ]);
  });

  it("puts untagged items in a trailing header-less group next to tagged ones", () => {
    expect(groupResultsByMeal([item("A"), item("B", "dinner")])).toEqual([
      { mealType: "dinner", label: "Cena", indices: [1] },
      { mealType: null, label: null, indices: [0] },
    ]);
  });

  it("returns no groups for empty results", () => {
    expect(groupResultsByMeal([])).toEqual([]);
  });
});
