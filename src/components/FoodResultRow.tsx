import type { SearchResult } from "@/stores/useFoodSearchStore";
import { AlertTriangle } from "lucide-react";

interface FoodResultRowProps {
  food: SearchResult;
  onSelect: (food: SearchResult) => void;
}

export function FoodResultRow({ food, onSelect }: FoodResultRowProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(food)}
      className="flex w-full items-center gap-3 rounded-xl bg-white px-4 py-3 text-left shadow-sm transition-colors hover:bg-gray-50 active:bg-gray-100"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium text-gray-900">{food.name}</span>
          {food.hasMissingData && <AlertTriangle size={14} className="shrink-0 text-amber-500" />}
        </div>
        {food.brand && <p className="truncate text-xs text-gray-400">{food.brand}</p>}
      </div>

      <div className="flex shrink-0 flex-col items-end gap-0.5">
        <span className="text-sm font-semibold text-gray-700">
          {Math.round(food.caloriesPer100g)} kcal
        </span>
        <span className="text-xs text-gray-400">
          P {Math.round(food.proteinPer100g)}g · C {Math.round(food.carbsPer100g)}g · G{" "}
          {Math.round(food.fatPer100g)}g
        </span>
      </div>
    </button>
  );
}
