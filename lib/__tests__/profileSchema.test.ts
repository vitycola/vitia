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

  it("rejects weightKg outside the 10-400 range", () => {
    expect(profileFieldsSchema.safeParse({ ...validInput, weightKg: 5 }).success).toBe(false);
    expect(profileFieldsSchema.safeParse({ ...validInput, weightKg: 401 }).success).toBe(false);
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

  describe("validation messages", () => {
    const messagesFor = (input: Record<string, unknown>) => {
      const result = profileFieldsSchema.safeParse({ ...validInput, ...input });
      return result.success
        ? []
        : result.error.issues.map((issue) => ({ path: issue.path[0], message: issue.message }));
    };

    it.each(["age", "heightCm", "weightKg"])("reports %s as required when empty", (field) => {
      expect(messagesFor({ [field]: "" })).toEqual([{ path: field, message: "Campo obligatorio" }]);
    });

    it.each([
      ["age", 5, "Debe estar entre 10 y 120 años"],
      ["age", 121, "Debe estar entre 10 y 120 años"],
      ["heightCm", 10, "Debe estar entre 50 y 280 cm"],
      ["heightCm", 300, "Debe estar entre 50 y 280 cm"],
      ["weightKg", 5, "Debe estar entre 10 y 400 kg"],
      ["weightKg", 600, "Debe estar entre 10 y 400 kg"],
    ])("reports a range message for %s=%s", (field, value, message) => {
      expect(messagesFor({ [field]: value })).toEqual([{ path: field, message }]);
    });

    it("reports whitespace-only input as required", () => {
      expect(messagesFor({ weightKg: "  " })).toEqual([
        { path: "weightKg", message: "Campo obligatorio" },
      ]);
    });

    it("reports non-numeric input as required", () => {
      expect(messagesFor({ heightCm: "abc" })).toEqual([
        { path: "heightCm", message: "Campo obligatorio" },
      ]);
    });

    it("accepts a comma as decimal separator", () => {
      const result = profileFieldsSchema.safeParse({ ...validInput, weightKg: "80,5" });
      expect(result.success).toBe(true);
      expect(result.success && result.data.weightKg).toBe(80.5);
    });

    it("rejects a non-integer age", () => {
      expect(messagesFor({ age: 25.5 })).toEqual([
        { path: "age", message: "Debe ser un número entero" },
      ]);
    });

    it("accepts weight at the 400 kg boundary", () => {
      expect(profileFieldsSchema.safeParse({ ...validInput, weightKg: 400 }).success).toBe(true);
    });

    it.each(["sex", "activityLevel"])("reports %s as a required option when empty", (field) => {
      expect(messagesFor({ [field]: "" })).toEqual([
        { path: field, message: "Opción obligatoria" },
      ]);
    });

    it("never exposes raw Zod English messages when submitted empty", () => {
      const result = profileFieldsSchema.safeParse({
        age: "",
        heightCm: "",
        weightKg: "",
        sex: "",
        activityLevel: "",
      });
      expect(result.success).toBe(false);
      const messages = result.success ? [] : result.error.issues.map((i) => i.message);
      expect(messages).toHaveLength(5);
      for (const message of messages) {
        expect(message).not.toMatch(/Invalid|Expected|Required|received/);
      }
    });
  });
});
