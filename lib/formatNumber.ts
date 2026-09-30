export interface FormatNumberOptions {
  minFractionDigits?: number;
  maxFractionDigits?: number;
  fallback?: string;
}

const LOCALE = "es-ES";
const formatters = new Map<string, Intl.NumberFormat>();

function getFormatter(min: number, max: number): Intl.NumberFormat {
  const key = `${min}|${max}`;
  let fmt = formatters.get(key);
  if (!fmt) {
    fmt = new Intl.NumberFormat(LOCALE, {
      minimumFractionDigits: min,
      maximumFractionDigits: max,
    });
    formatters.set(key, fmt);
  }
  return fmt;
}

/**
 * Formats a number for display using es-ES (comma decimal, dot thousands
 * only from 5 integer digits). Returns `fallback` for null/undefined/non-finite.
 */
export function formatNumber(
  value: number | null | undefined,
  opts: FormatNumberOptions = {}
): string {
  const { minFractionDigits = 0, maxFractionDigits = 0, fallback = "—" } = opts;
  if (value === null || value === undefined || !Number.isFinite(value)) return fallback;
  const max = Math.max(maxFractionDigits, minFractionDigits);
  return getFormatter(minFractionDigits, max).format(value);
}
