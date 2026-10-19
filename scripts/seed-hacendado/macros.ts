/**
 * Macro extraction and plausibility checks (per 100 g). Pure functions.
 *
 * Plausibility rules (any failure EXCLUDES the row, with a reason code):
 *   - kcal must exist and be within [0, 900]
 *   - protein, carbs and fat must be >= 0
 *   - protein + carbs + fat <= 105 g (a little slack over 100 for rounding)
 *   - Atwater consistency: |kcal - (4P + 4C + 9F)| <= max(30, 25% of the larger
 *     of the two values). The slack covers fibre (2 kcal/g), polyols and
 *     alcohol, which label energy counts but the 4/4/9 formula does not.
 */

export const KJ_PER_KCAL = 4.184;
export const MAX_KCAL = 900;
export const MAX_MACRO_SUM_G = 105;
export const ATWATER_ABS_TOLERANCE_KCAL = 30;
export const ATWATER_REL_TOLERANCE = 0.25;

export interface RawMacros {
  kcal: number | null | undefined;
  kj?: number | null;
  protein: number | null | undefined;
  carbs: number | null | undefined;
  fat: number | null | undefined;
}

export interface Macros {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export type MacroExclusion =
  | "no_calories"
  | "no_macros"
  | "kcal_out_of_range"
  | "negative_macro"
  | "macro_sum_over_105g"
  | "atwater_mismatch";

export type MacroResult = { ok: true; macros: Macros } | { ok: false; reason: MacroExclusion };

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function atwaterKcal(p: number, c: number, f: number): number {
  return 4 * p + 4 * c + 9 * f;
}

export function checkMacros(raw: RawMacros): MacroResult {
  let kcal: number | null = isNum(raw.kcal) ? raw.kcal : null;
  if (kcal === null && isNum(raw.kj)) kcal = raw.kj / KJ_PER_KCAL;
  if (kcal === null) return { ok: false, reason: "no_calories" };
  if (!isNum(raw.protein) && !isNum(raw.carbs) && !isNum(raw.fat)) {
    return { ok: false, reason: "no_macros" };
  }
  const protein = isNum(raw.protein) ? raw.protein : 0;
  const carbs = isNum(raw.carbs) ? raw.carbs : 0;
  const fat = isNum(raw.fat) ? raw.fat : 0;
  if (kcal < 0 || kcal > MAX_KCAL) return { ok: false, reason: "kcal_out_of_range" };
  if (protein < 0 || carbs < 0 || fat < 0) return { ok: false, reason: "negative_macro" };
  if (protein + carbs + fat > MAX_MACRO_SUM_G) return { ok: false, reason: "macro_sum_over_105g" };
  const expected = atwaterKcal(protein, carbs, fat);
  const tolerance = Math.max(
    ATWATER_ABS_TOLERANCE_KCAL,
    ATWATER_REL_TOLERANCE * Math.max(kcal, expected)
  );
  if (Math.abs(kcal - expected) > tolerance) return { ok: false, reason: "atwater_mismatch" };
  return {
    ok: true,
    macros: {
      calories: Math.round(kcal),
      protein: round1(protein),
      carbs: round1(carbs),
      fat: round1(fat),
    },
  };
}
