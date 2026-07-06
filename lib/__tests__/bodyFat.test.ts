import { computeNavyBodyFat } from "@/lib/bodyFat";

describe("computeNavyBodyFat", () => {
  it("computes body fat % for a male with valid neck/waist/height (known vector)", () => {
    const result = computeNavyBodyFat({
      sex: "male",
      heightCm: 180,
      neckCm: 38,
      waistCm: 85,
    });
    expect(result).toBe(16.1);
  });

  it("computes body fat % for a female with valid neck/waist/hip/height (known vector)", () => {
    const result = computeNavyBodyFat({
      sex: "female",
      heightCm: 165,
      neckCm: 32,
      waistCm: 70,
      hipCm: 95,
    });
    expect(result).toBe(24.9);
  });

  it("returns null for a male when neck is missing", () => {
    const result = computeNavyBodyFat({
      sex: "male",
      heightCm: 180,
      waistCm: 85,
    });
    expect(result).toBeNull();
  });

  it("returns null for a male when waist is missing", () => {
    const result = computeNavyBodyFat({
      sex: "male",
      heightCm: 180,
      neckCm: 38,
    });
    expect(result).toBeNull();
  });

  it("returns null for a female when hip is missing (required for female)", () => {
    const result = computeNavyBodyFat({
      sex: "female",
      heightCm: 165,
      neckCm: 32,
      waistCm: 70,
    });
    expect(result).toBeNull();
  });

  it("returns null when height is missing/zero", () => {
    const result = computeNavyBodyFat({
      sex: "male",
      heightCm: 0,
      neckCm: 38,
      waistCm: 85,
    });
    expect(result).toBeNull();
  });

  it("returns null when waist - neck <= 0 (log10 argument non-positive, male)", () => {
    const result = computeNavyBodyFat({
      sex: "male",
      heightCm: 180,
      neckCm: 40,
      waistCm: 40,
    });
    expect(result).toBeNull();
  });

  it("returns null when waist + hip - neck <= 0 (log10 argument non-positive, female)", () => {
    const result = computeNavyBodyFat({
      sex: "female",
      heightCm: 165,
      neckCm: 100,
      waistCm: 10,
      hipCm: 10,
    });
    expect(result).toBeNull();
  });

  it("clamps the result to a maximum of 75", () => {
    const result = computeNavyBodyFat({
      sex: "male",
      heightCm: 250,
      neckCm: 20,
      waistCm: 150,
    });
    expect(result).not.toBeNull();
    expect(result as number).toBeLessThanOrEqual(75);
  });

  it("clamps the result to a minimum of 0", () => {
    const result = computeNavyBodyFat({
      sex: "male",
      heightCm: 100,
      neckCm: 50,
      waistCm: 51,
    });
    expect(result).not.toBeNull();
    expect(result as number).toBeGreaterThanOrEqual(0);
  });

  it("rounds the result to 1 decimal place", () => {
    const result = computeNavyBodyFat({
      sex: "male",
      heightCm: 180,
      neckCm: 38,
      waistCm: 85,
    });
    expect(result).toBe(Math.round((result as number) * 10) / 10);
  });
});
