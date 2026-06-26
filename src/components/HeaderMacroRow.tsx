const CALORIE_GOAL_FALLBACK = 2000;

interface HeaderMacroRowProps {
  calories: number;
  calorieGoal: number;
  proteinG: number;
  proteinGoalG: number;
  carbsG: number;
  carbsGoalG: number;
  fatG: number;
  fatGoalG: number;
}

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
      <span className="text-[10px] font-medium text-gray-500">{label}</span>
      <span className="text-xs font-semibold text-gray-800">
        {Math.round(consumed)}
        <span className="font-normal text-gray-400">/{Math.round(goal)}</span>
        <span className="ml-0.5 text-[9px] text-gray-400">{unit}</span>
      </span>
      <div className="mt-0.5 h-1 w-full rounded-full bg-gray-200">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
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
}: HeaderMacroRowProps) {
  const effectiveCalorieGoal = calorieGoal > 0 ? calorieGoal : CALORIE_GOAL_FALLBACK;

  return (
    <div className="flex items-center border-b border-gray-100 bg-white px-2 py-2 shadow-sm">
      <MacroChip
        label="kcal"
        consumed={calories}
        goal={effectiveCalorieGoal}
        unit=""
        color="#22c55e"
      />
      <div className="h-6 w-px bg-gray-200" />
      <MacroChip label="P" consumed={proteinG} goal={proteinGoalG} unit="g" color="#3b82f6" />
      <div className="h-6 w-px bg-gray-200" />
      <MacroChip label="C" consumed={carbsG} goal={carbsGoalG} unit="g" color="#f97316" />
      <div className="h-6 w-px bg-gray-200" />
      <MacroChip label="G" consumed={fatG} goal={fatGoalG} unit="g" color="#eab308" />
    </div>
  );
}
