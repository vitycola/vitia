import { macroCalorieShares } from "@/lib/nutrition";

interface MacroDistributionBarProps {
  proteinG: number;
  carbsG: number;
  fatG: number;
}

// Distinct semantic palette from the goal-based MacroBar/HeaderMacroRow —
// this bar renders a share-of-total-macro-calories distribution, not a
// value/goal progress fill.
const SEGMENT_COLORS = {
  protein: "#F5A623", // accent/macroAmber
  carbs: "#34C759",
  fat: "#5AC8FA",
} as const;

export function MacroDistributionBar({ proteinG, carbsG, fatG }: MacroDistributionBarProps) {
  const { proteinShare, carbsShare, fatShare } = macroCalorieShares({ proteinG, carbsG, fatG });

  return (
    <div>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          style={{ width: `${proteinShare * 100}%`, backgroundColor: SEGMENT_COLORS.protein }}
          className="h-full"
        />
        <div
          style={{ width: `${carbsShare * 100}%`, backgroundColor: SEGMENT_COLORS.carbs }}
          className="h-full"
        />
        <div
          style={{ width: `${fatShare * 100}%`, backgroundColor: SEGMENT_COLORS.fat }}
          className="h-full"
        />
      </div>
      <div className="mt-2 flex justify-between text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: SEGMENT_COLORS.protein }}
          />
          Proteínas {Math.round(proteinShare * 100)}%
        </span>
        <span className="flex items-center gap-1">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: SEGMENT_COLORS.carbs }}
          />
          Carbohidratos {Math.round(carbsShare * 100)}%
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: SEGMENT_COLORS.fat }} />
          Grasas {Math.round(fatShare * 100)}%
        </span>
      </div>
    </div>
  );
}
