import { goalEditorSchema } from "@/lib/goalSchema";

describe("goalEditorSchema", () => {
  const validInput = {
    calorieGoal: 2000,
    proteinGoalG: 150,
    carbsGoalG: 200,
    fatGoalG: 70,
  };

  it("accepts a valid set of goal values", () => {
    const result = goalEditorSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it("accepts macros that do not sum to the calorie goal under 4/4/9", () => {
    const result = goalEditorSchema.safeParse({
      calorieGoal: 2000,
      proteinGoalG: 200,
      carbsGoalG: 200,
      fatGoalG: 200,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a negative calorieGoal", () => {
    const result = goalEditorSchema.safeParse({ ...validInput, calorieGoal: -1 });
    expect(result.success).toBe(false);
  });

  it("rejects a negative proteinGoalG", () => {
    const result = goalEditorSchema.safeParse({ ...validInput, proteinGoalG: -1 });
    expect(result.success).toBe(false);
  });

  it("rejects a negative carbsGoalG", () => {
    const result = goalEditorSchema.safeParse({ ...validInput, carbsGoalG: -1 });
    expect(result.success).toBe(false);
  });

  it("rejects a negative fatGoalG", () => {
    const result = goalEditorSchema.safeParse({ ...validInput, fatGoalG: -1 });
    expect(result.success).toBe(false);
  });

  it("rejects calorieGoal above the 10000 kcal upper bound", () => {
    const result = goalEditorSchema.safeParse({ ...validInput, calorieGoal: 10001 });
    expect(result.success).toBe(false);
  });

  it("rejects macro values above the 1000 g upper bound", () => {
    expect(goalEditorSchema.safeParse({ ...validInput, proteinGoalG: 1001 }).success).toBe(false);
    expect(goalEditorSchema.safeParse({ ...validInput, carbsGoalG: 1001 }).success).toBe(false);
    expect(goalEditorSchema.safeParse({ ...validInput, fatGoalG: 1001 }).success).toBe(false);
  });

  it("rejects non-numeric input", () => {
    const result = goalEditorSchema.safeParse({ ...validInput, calorieGoal: "abc" });
    expect(result.success).toBe(false);
  });

  it("coerces numeric strings the same way as profileFieldsSchema", () => {
    const result = goalEditorSchema.safeParse({
      calorieGoal: "2000",
      proteinGoalG: "150",
      carbsGoalG: "200",
      fatGoalG: "70",
    });
    expect(result.success).toBe(true);
  });
});
