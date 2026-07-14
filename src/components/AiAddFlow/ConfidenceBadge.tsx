import { getConfidenceMeta } from "@/lib/aiConfidence";
import type { AiConfidence } from "@/types/aiFood";

interface ConfidenceBadgeProps {
  confidence: AiConfidence;
}

export function ConfidenceBadge({ confidence }: ConfidenceBadgeProps) {
  const { label, color } = getConfidenceMeta(confidence);
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold"
      style={{ color, backgroundColor: `${color}20` }}
    >
      {label}
    </span>
  );
}
