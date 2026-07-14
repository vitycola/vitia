import type { AiConfidence, ConfidenceLabel } from "@/types/aiFood";

export interface ConfidenceMeta {
  label: ConfidenceLabel;
  /** Hex color for the badge. */
  color: string;
  /** Whether the item should be checked by default in the confirmation screen. */
  defaultChecked: boolean;
  /** Whether the row should be visually highlighted (amber tint) in the confirmation screen. */
  highlight: boolean;
}

const CONFIDENCE_MAP: Record<AiConfidence, ConfidenceMeta> = {
  high: { label: "Alta", color: "#16a34a", defaultChecked: true, highlight: false },
  medium: { label: "Revisar", color: "#F5A623", defaultChecked: true, highlight: true },
  low: { label: "Editar", color: "#FF3B30", defaultChecked: false, highlight: false },
};

export function getConfidenceMeta(confidence: AiConfidence): ConfidenceMeta {
  return CONFIDENCE_MAP[confidence];
}
