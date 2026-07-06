/**
 * US Navy body-fat % method (metric units, log10-based).
 *
 * Male:   495 / (1.0324 - 0.19077*log10(waist - neck) + 0.15456*log10(height)) - 450
 * Female: 495 / (1.29579 - 0.35004*log10(waist + hip - neck) + 0.22100*log10(height)) - 450
 *
 * Required fields: male -> neck + waist; female -> neck + waist + hip.
 * Returns null when any required field (or height) is missing/<=0, or when
 * the log10 argument would be non-positive. Result is clamped to [0, 75]
 * and rounded to 1 decimal place.
 *
 * Design: sdd/progress-log/design — "Navy method input mapping".
 */

const MIN_BODY_FAT_PCT = 0;
const MAX_BODY_FAT_PCT = 75;

export interface NavyInput {
  sex: "male" | "female";
  heightCm: number;
  neckCm?: number | null;
  waistCm?: number | null;
  hipCm?: number | null;
}

function isPositive(value: number | null | undefined): value is number {
  return typeof value === "number" && value > 0;
}

function clampAndRound(value: number): number {
  const clamped = Math.min(Math.max(value, MIN_BODY_FAT_PCT), MAX_BODY_FAT_PCT);
  return Math.round(clamped * 10) / 10;
}

export function computeNavyBodyFat(input: NavyInput): number | null {
  const { sex, heightCm, neckCm, waistCm, hipCm } = input;

  if (!isPositive(heightCm) || !isPositive(neckCm) || !isPositive(waistCm)) {
    return null;
  }

  if (sex === "male") {
    const logArg = waistCm - neckCm;
    if (logArg <= 0) return null;

    const value =
      495 / (1.0324 - 0.19077 * Math.log10(logArg) + 0.15456 * Math.log10(heightCm)) - 450;
    return clampAndRound(value);
  }

  // Female requires hip in addition to neck + waist.
  if (!isPositive(hipCm)) return null;

  const logArg = waistCm + hipCm - neckCm;
  if (logArg <= 0) return null;

  const value = 495 / (1.29579 - 0.35004 * Math.log10(logArg) + 0.221 * Math.log10(heightCm)) - 450;
  return clampAndRound(value);
}
