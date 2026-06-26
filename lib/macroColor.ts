// lib/macroColor.ts — Pure helper for macro bar color state logic.
import { Colors } from "./tokens";

/**
 * Returns the bar color for a macro based on consumption state.
 * On-target (80–110% inclusive of goal) → green; otherwise → amber.
 * Guard: goal <= 0 returns amber (no divide-by-zero).
 */
export function getMacroBarColor(consumed: number, goal: number): string {
  if (goal <= 0) return Colors.macroAmber;
  const ratio = consumed / goal;
  return ratio >= 0.8 && ratio <= 1.1 ? Colors.macroOntargetGreen : Colors.macroAmber;
}
