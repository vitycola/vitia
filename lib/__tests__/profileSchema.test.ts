import { profileFieldsSchema } from "@/lib/profileSchema";

describe("profileFieldsSchema", () => {
  const validInput = {
    age: 30,
    heightCm: 175,
    weightKg: 70,
    sex: "male",
    activityLevel: "moderately_active",
  };

  it("accepts a valid set of profile fields", () => {
    const result = profileFieldsSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it("rejects age below the minimum", () => {
    const result = profileFieldsSchema.safeParse({ ...validInput, age: 5 });
    expect(result.success).toBe(false);
  });

  it("rejects age above the maximum", () => {
    const result = profileFieldsSchema.safeParse({ ...validInput, age: 200 });
    expect(result.success).toBe(false);
  });

  it("rejects heightCm outside the 50-280 range", () => {
    expect(profileFieldsSchema.safeParse({ ...validInput, heightCm: 10 }).success).toBe(false);
    expect(profileFieldsSchema.safeParse({ ...validInput, heightCm: 300 }).success).toBe(false);
  });

  it("rejects weightKg outside the 10-600 range", () => {
    expect(profileFieldsSchema.safeParse({ ...validInput, weightKg: 5 }).success).toBe(false);
    expect(profileFieldsSchema.safeParse({ ...validInput, weightKg: 700 }).success).toBe(false);
  });

  it("rejects an invalid sex enum value", () => {
    const result = profileFieldsSchema.safeParse({ ...validInput, sex: "other" });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid activityLevel enum value", () => {
    const result = profileFieldsSchema.safeParse({ ...validInput, activityLevel: "extreme" });
    expect(result.success).toBe(false);
  });

  it("coerces numeric strings the same way as onboarding's form inputs", () => {
    const result = profileFieldsSchema.safeParse({
      ...validInput,
      age: "30",
      heightCm: "175",
      weightKg: "70",
    });
    expect(result.success).toBe(true);
  });
});
