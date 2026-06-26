import type { MealEntryView } from "@/db/repositories/mealEntries";
import { MEAL_EMOJI } from "@/lib/constants";
import type { MealType } from "@/types";
import { Trash2 } from "lucide-react";
import { useRef } from "react";

const SWIPE_THRESHOLD = 80;

interface MealEntryRowProps {
  entry: MealEntryView;
  mealType: MealType;
  onDelete: (id: string) => void;
}

export function MealEntryRow({ entry, mealType, onDelete }: MealEntryRowProps) {
  const startX = useRef<number | null>(null);

  function handlePointerDown(e: React.PointerEvent) {
    startX.current = e.clientX;
  }

  function handlePointerUp(e: React.PointerEvent) {
    if (startX.current !== null && Math.abs(e.clientX - startX.current) >= SWIPE_THRESHOLD) {
      onDelete(entry.id);
    }
    startX.current = null;
  }

  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
    >
      {/* Emoji square */}
      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100 text-lg">
        {MEAL_EMOJI[mealType]}
      </span>

      {/* Name + brand */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-900">{entry.foodName}</p>
        {entry.brand && <p className="truncate text-xs text-gray-400">{entry.brand}</p>}
      </div>

      {/* Qty + kcal + delete */}
      <div className="flex flex-shrink-0 items-center gap-3">
        <div className="text-right">
          <p className="text-xs text-gray-500">{entry.quantityG}g</p>
          <p className="text-sm font-semibold text-gray-700">{Math.round(entry.calories)} kcal</p>
        </div>
        <button
          type="button"
          onClick={() => onDelete(entry.id)}
          aria-label={`Eliminar ${entry.foodName}`}
          className="flex h-8 w-8 items-center justify-center rounded-full text-red-400 hover:bg-red-50 hover:text-red-600 active:bg-red-100"
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
}
