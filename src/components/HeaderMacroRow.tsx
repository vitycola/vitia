import {
  CAL_GOAL_HIGH,
  CAL_GOAL_LOW,
  MACRO_GOAL_HIGH,
  MACRO_GOAL_LOW,
  ON_TARGET_COLOR,
  isWithinGoalRange,
} from "@/lib/constants";

const CALORIE_GOAL_FALLBACK = 2000;
const DEFAULT_BAR_COLOR = "#F5A623";

interface ChipProps {
  label: string;
  consumed: number;
  goal: number;
  unit: string;
  goalLow: number;
  goalHigh: number;
}

function MacroChip({ label, consumed, goal, unit, goalLow, goalHigh }: ChipProps) {
  const pct = goal > 0 ? Math.min((consumed / goal) * 100, 100) : 0;
  const onTarget = isWithinGoalRange(consumed, goal, goalLow, goalHigh);
  const color = onTarget ? ON_TARGET_COLOR : DEFAULT_BAR_COLOR;
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
    <div className="grid overflow-hidden" style={{ gridTemplateRows: `${progress}fr` }}>
      <div className="min-h-0">
        <div className="flex items-center bg-surface px-2 py-2" style={{ opacity: progress }}>
          <MacroChip
            label="kcal"
            consumed={calories}
            goal={effectiveCalorieGoal}
            unit=""
            goalLow={CAL_GOAL_LOW}
            goalHigh={CAL_GOAL_HIGH}
          />
          <div className="h-6 w-px bg-gray-200" />
          <MacroChip
            label="Proteínas"
            consumed={proteinG}
            goal={proteinGoalG}
            unit="g"
            goalLow={MACRO_GOAL_LOW}
            goalHigh={MACRO_GOAL_HIGH}
          />
          <div className="h-6 w-px bg-gray-200" />
          <MacroChip
            label="Carbs"
            consumed={carbsG}
            goal={carbsGoalG}
            unit="g"
            goalLow={MACRO_GOAL_LOW}
            goalHigh={MACRO_GOAL_HIGH}
          />
          <div className="h-6 w-px bg-gray-200" />
          <MacroChip
            label="Grasas"
            consumed={fatG}
            goal={fatGoalG}
            unit="g"
            goalLow={MACRO_GOAL_LOW}
            goalHigh={MACRO_GOAL_HIGH}
          />
        </div>
      </div>
    </div>
  );
}
