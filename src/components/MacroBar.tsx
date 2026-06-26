import { getMacroBarColor } from "@/lib/macroColor";

interface MacroChipProps {
  label: string;
  valueG: number;
  goalG: number;
}

function MacroChip({ label, valueG, goalG }: MacroChipProps) {
  const fraction = goalG > 0 ? Math.min(valueG / goalG, 1) : 0;
  const barColor = getMacroBarColor(valueG, goalG);

  return (
    <div className="flex flex-1 flex-col gap-1">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-medium text-secondary">{label}</span>
        <span className="text-xs text-primary">
          {Math.round(valueG)}
          <span className="text-disabled">/{Math.round(goalG)}g</span>
        </span>
      </div>
      {/* Progress bar */}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${fraction * 100}%`, backgroundColor: barColor }}
        />
      </div>
    </div>
  );
}

interface MacroBarProps {
  proteinG: number;
  carbsG: number;
  fatG: number;
  proteinGoalG: number;
  carbsGoalG: number;
  fatGoalG: number;
}

export function MacroBar({
  proteinG,
  carbsG,
  fatG,
  proteinGoalG,
  carbsGoalG,
  fatGoalG,
}: MacroBarProps) {
  return (
    <div className="flex gap-4">
      <MacroChip label="Proteína" valueG={proteinG} goalG={proteinGoalG} />
      <MacroChip label="Carbohidratos" valueG={carbsG} goalG={carbsGoalG} />
      <MacroChip label="Grasa" valueG={fatG} goalG={fatGoalG} />
    </div>
  );
}
