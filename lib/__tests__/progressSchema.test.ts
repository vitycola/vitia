import { progressEntrySchema } from "@/lib/progressSchema";

describe("progressEntrySchema", () => {
  it("rejects submission when weight, measurements, and photos are all empty", () => {
    const result = progressEntrySchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects submission when all fields are empty strings", () => {
    const result = progressEntrySchema.safeParse({
      weightKg: "",
      neckCm: "",
      waistCm: "",
      hipCm: "",
      notes: "",
      photos: [],
    });
    expect(result.success).toBe(false);
  });

  it("accepts weight only", () => {
    const result = progressEntrySchema.safeParse({ weightKg: 70 });
    expect(result.success).toBe(true);
  });

  it("accepts a single measurement only", () => {
    const result = progressEntrySchema.safeParse({ neckCm: 38 });
    expect(result.success).toBe(true);
  });

  it("accepts photos only", () => {
    const result = progressEntrySchema.safeParse({ photos: [{}] });
    expect(result.success).toBe(true);
  });

  it("accepts a combination of weight, measurements, and photos", () => {
    const result = progressEntrySchema.safeParse({
      weightKg: 70,
      neckCm: 38,
      waistCm: 85,
      photos: [{}],
    });
    expect(result.success).toBe(true);
  });

  it("coerces numeric string inputs (weightKg)", () => {
    const result = progressEntrySchema.safeParse({ weightKg: "70.5" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.weightKg).toBe(70.5);
    }
  });

  it("coerces numeric string inputs for measurements", () => {
    const result = progressEntrySchema.safeParse({ neckCm: "38", waistCm: "85", hipCm: "95" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.neckCm).toBe(38);
      expect(result.data.waistCm).toBe(85);
      expect(result.data.hipCm).toBe(95);
    }
  });

  it("rejects a negative weight", () => {
    const result = progressEntrySchema.safeParse({ weightKg: -5 });
    expect(result.success).toBe(false);
  });

  it("rejects a negative measurement", () => {
    const result = progressEntrySchema.safeParse({ neckCm: -1 });
    expect(result.success).toBe(false);
  });

  it("accepts notes alongside other empty fields when notes alone is not sufficient", () => {
    // notes-only is not one of {weight, measurements, photos} — still rejected.
    const result = progressEntrySchema.safeParse({ notes: "Feeling great" });
    expect(result.success).toBe(false);
  });
});
