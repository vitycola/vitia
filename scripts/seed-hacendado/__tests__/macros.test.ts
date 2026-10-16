import { checkMacros } from "../macros";

const ok = (kcal: number, p: number, c: number, f: number) =>
  checkMacros({ kcal, protein: p, carbs: c, fat: f });

describe("checkMacros", () => {
  it("accepts a consistent product and rounds", () => {
    expect(ok(358.4, 12.04, 72.5, 1.5)).toEqual({
      ok: true,
      macros: { calories: 358, protein: 12, carbs: 72.5, fat: 1.5 },
    });
  });
  it("falls back to kJ when kcal is missing", () => {
    const r = checkMacros({ kcal: null, kj: 1500, protein: 12, carbs: 72, fat: 1.5 });
    expect(r).toMatchObject({ ok: true, macros: { calories: 359 } });
  });
  it("rejects missing calories and missing macros", () => {
    expect(checkMacros({ kcal: null, protein: 1, carbs: 1, fat: 1 })).toEqual({
      ok: false,
      reason: "no_calories",
    });
    expect(checkMacros({ kcal: 100, protein: null, carbs: null, fat: null })).toEqual({
      ok: false,
      reason: "no_macros",
    });
  });
  it("rejects out-of-range kcal, negatives and macro sums over 105 g", () => {
    expect(ok(950, 0, 0, 100)).toEqual({ ok: false, reason: "kcal_out_of_range" });
    expect(ok(100, -1, 20, 1)).toEqual({ ok: false, reason: "negative_macro" });
    expect(ok(400, 50, 50, 10)).toEqual({ ok: false, reason: "macro_sum_over_105g" });
  });
  it("rejects Atwater mismatches but tolerates fibre-sized gaps", () => {
    expect(ok(500, 10, 10, 1)).toEqual({ ok: false, reason: "atwater_mismatch" });
    expect(ok(330, 12, 60, 1.5)).toMatchObject({ ok: true }); // expected 301.5
  });
  it("treats a zero-energy product as valid", () => {
    expect(ok(0, 0, 0, 0)).toMatchObject({ ok: true });
  });
});
