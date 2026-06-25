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
        <span className="text-xs font-medium text-gray-500">{label}</span>
        <span className="text-xs text-gray-700">
          {Math.round(valueG)}
          <span className="text-gray-400">/{Math.round(goalG)}g</span>
        </span>
      </div>
      {/* Progress bar */}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
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
      <MacroChip label="Proteína" valueG={proteinG} goalG={proteinGoalG} color="#3b82f6" />
      <MacroChip label="Carbohidratos" valueG={carbsG} goalG={carbsGoalG} color="#f59e0b" />
      <MacroChip label="Grasa" valueG={fatG} goalG={fatGoalG} color="#ef4444" />
    </div>
  );
}
