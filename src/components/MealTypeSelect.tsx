import { MEAL_EMOJI } from "@/lib/constants";
import type { MealType } from "@/types";
import { ChevronDown } from "lucide-react";

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: "Desayuno",
  lunch: "Almuerzo",
  dinner: "Cena",
  snack: "Merienda",
};

const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

interface MealTypeSelectProps {
  value: MealType;
  onChange: (mealType: MealType) => void;
  disabled?: boolean;
}

export function MealTypeSelect({ value, onChange, disabled = false }: MealTypeSelectProps) {
  return (
    <div className="relative">
      <select
        aria-label="Comida"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as MealType)}
        className="w-full appearance-none rounded-xl border border-gray-300 bg-white px-3 py-2.5 pr-9 text-sm font-medium text-gray-900 outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-50"
      >
        {MEAL_TYPES.map((mealType) => (
          <option key={mealType} value={mealType}>
            {MEAL_EMOJI[mealType]} {MEAL_LABELS[mealType]}
          </option>
        ))}
      </select>
      <ChevronDown
        size={16}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
      />
    </div>
  );
}
