// lib/tokens.ts — Single source of truth for all semantic color values.
// ESM-only. No imports from Tailwind or CSS files.

// ── Base tokens ──
export const surface = "#F2F2F7";
export const card = "#FFFFFF";
export const accent = "#F5A623";
export const textPrimary = "#1C1C1E";
export const textSecondary = "#8E8E93";
export const textDisabled = "#C7C7CC";
export const border = "#E5E5EA";
export const destructive = "#FF3B30";

// ── Macro bar state tokens ──
// macroAmber has the same hex as accent but is a DISTINCT semantic token.
// Do NOT collapse into accent — future re-theming must decouple them.
export const macroAmber = "#F5A623";
export const macroOntargetGreen = "#16a34a";

// ── Grouped export for ergonomic destructuring ──
export const Colors = {
  surface,
  card,
  accent,
  textPrimary,
  textSecondary,
  textDisabled,
  border,
  destructive,
  macroAmber,
  macroOntargetGreen,
} as const;

export type ColorToken = keyof typeof Colors;
