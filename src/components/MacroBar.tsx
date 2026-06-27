interface MacroChipProps {
  label: string;
  valueG: number;
  goalG: number;
  color: string;
}

function MacroChip({ label, valueG, goalG, color }: MacroChipProps) {
  const fraction = goalG > 0 ? Math.min(valueG / goalG, 1) : 0;

  return (
    <div className="flex flex-1 flex-col gap-1">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-medium text-[#8E8E93]">{label}</span>
        <span className="text-xs text-[#1C1C1E]">
          {Math.round(valueG)}
          <span className="text-[#8E8E93]">/{Math.round(goalG)}g</span>
        </span>
      </div>
      {/* Progress bar */}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#E5E5EA]">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${fraction * 100}%`, backgroundColor: color }}
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
      <MacroChip label="Proteína" valueG={proteinG} goalG={proteinGoalG} color="#F5A623" />
      <MacroChip label="Carbohidratos" valueG={carbsG} goalG={carbsGoalG} color="#F5A623" />
      <MacroChip label="Grasa" valueG={fatG} goalG={fatGoalG} color="#F5A623" />
    </div>
  );
}
