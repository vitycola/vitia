const CALORIE_GOAL_FALLBACK = 2000;

interface ChipProps {
  label: string;
  consumed: number;
  goal: number;
  unit: string;
  color: string;
}

function MacroChip({ label, consumed, goal, unit, color }: ChipProps) {
  const pct = goal > 0 ? Math.min((consumed / goal) * 100, 100) : 0;
  return (
    <div className="flex flex-1 flex-col items-center px-1">
      <span className="text-[10px] font-medium text-[#8E8E93]">{label}</span>
      <span className="text-xs font-semibold text-[#1C1C1E]">
        {Math.round(consumed)}
        <span className="font-normal text-[#8E8E93]">/{Math.round(goal)}</span>
        <span className="ml-0.5 text-[9px] text-[#8E8E93]">{unit}</span>
      </span>
      <div className="mt-0.5 h-1 w-full rounded-full bg-[#E5E5EA]">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

interface HeaderMacroRowProps {
  calories: number;
  calorieGoal: number;
  proteinG: number;
  proteinGoalG: number;
  carbsG: number;
  carbsGoalG: number;
  fatG: number;
  fatGoalG: number;
  progress?: number;
}

export function HeaderMacroRow({
  calories,
  calorieGoal,
  proteinG,
  proteinGoalG,
  carbsG,
  carbsGoalG,
  fatG,
  fatGoalG,
  progress = 0,
}: HeaderMacroRowProps) {
  const effectiveCalorieGoal = calorieGoal > 0 ? calorieGoal : CALORIE_GOAL_FALLBACK;

  return (
    <div
      className="grid overflow-hidden"
      style={{ gridTemplateRows: `${progress}fr` }}
    >
    <div className="min-h-0">
    <div
      className="flex items-center bg-surface px-2 py-2"
      style={{ opacity: progress }}
    >
      <MacroChip
        label="kcal"
        consumed={calories}
        goal={effectiveCalorieGoal}
        unit=""
        color="#F5A623"
      />
      <div className="h-6 w-px bg-gray-200" />
      <MacroChip
        label="Proteínas"
        consumed={proteinG}
        goal={proteinGoalG}
        unit="g"
        color="#F5A623"
      />
      <div className="h-6 w-px bg-gray-200" />
      <MacroChip label="Carbs" consumed={carbsG} goal={carbsGoalG} unit="g" color="#F5A623" />
      <div className="h-6 w-px bg-gray-200" />
      <MacroChip label="Grasas" consumed={fatG} goal={fatGoalG} unit="g" color="#F5A623" />
    </div>
    </div>
    </div>
  );
}
