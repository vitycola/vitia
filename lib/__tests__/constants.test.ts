import type { MealType } from "@/types";
import { MEAL_EMOJI } from "../constants";

const ALL_MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

describe("MEAL_EMOJI", () => {
  it("covers all 4 meal types", () => {
    for (const mealType of ALL_MEAL_TYPES) {
      expect(MEAL_EMOJI[mealType]).toBeDefined();
    }
  });

  it("breakfast maps to 🍳", () => {
    expect(MEAL_EMOJI.breakfast).toBe("🍳");
  });

  it("lunch maps to 🍽️", () => {
    expect(MEAL_EMOJI.lunch).toBe("🍽️");
  });

  it("dinner maps to 🌙", () => {
    expect(MEAL_EMOJI.dinner).toBe("🌙");
  });

  it("snack maps to 🍎", () => {
    expect(MEAL_EMOJI.snack).toBe("🍎");
  });

  it("no meal type maps to an empty string", () => {
    for (const mealType of ALL_MEAL_TYPES) {
      expect(MEAL_EMOJI[mealType].length).toBeGreaterThan(0);
    }
  });
});
