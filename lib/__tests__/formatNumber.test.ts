import { formatNumber } from "../formatNumber";

describe("formatNumber", () => {
  it("does not group 4-digit numbers", () => {
    expect(formatNumber(1234)).toBe("1234");
  });

  it("groups 5+ digit numbers with a dot", () => {
    expect(formatNumber(10839)).toBe("10.839");
  });

  it("uses a comma as decimal separator", () => {
    expect(formatNumber(81.2, { maxFractionDigits: 1 })).toBe("81,2");
  });

  it("caps fraction digits", () => {
    const out = formatNumber(81.25, { maxFractionDigits: 1 });
    expect(out).toMatch(/^81,[23]$/);
  });

  it("does not pad integers by default", () => {
    expect(formatNumber(72, { maxFractionDigits: 1 })).toBe("72");
  });

  it("pads when minFractionDigits is requested", () => {
    expect(formatNumber(72, { minFractionDigits: 1, maxFractionDigits: 1 })).toBe("72,0");
  });

  it("does not throw when min > max", () => {
    expect(() => formatNumber(1.5, { minFractionDigits: 2, maxFractionDigits: 1 })).not.toThrow();
  });

  it("returns the fallback for null, undefined, NaN and Infinity", () => {
    for (const v of [null, undefined, Number.NaN, Number.POSITIVE_INFINITY]) {
      const out = formatNumber(v);
      expect(out).toBe("—");
      expect(out).not.toMatch(/NaN|null|undefined/);
    }
  });

  it("supports a custom fallback", () => {
    expect(formatNumber(null, { fallback: "" })).toBe("");
  });
});
