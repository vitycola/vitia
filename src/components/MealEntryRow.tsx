import type { MealEntryView } from "@/db/repos/mealEntries";
import { MEAL_EMOJI } from "@/lib/constants";
import type { MealType } from "@/types";
import { Trash2 } from "lucide-react";
import { useRef } from "react";

const SWIPE_THRESHOLD = 80;

interface MealEntryRowProps {
  entry: MealEntryView;
  mealType: MealType;
  onDelete: (id: string) => void;
  onEdit?: (entry: MealEntryView) => void;
}

export function MealEntryRow({ entry, mealType, onDelete, onEdit }: MealEntryRowProps) {
  const startX = useRef<number | null>(null);
  const didSwipe = useRef(false);

  function handlePointerDown(e: React.PointerEvent) {
    startX.current = e.clientX;
    didSwipe.current = false;
  }

  function handlePointerUp(e: React.PointerEvent) {
    if (startX.current !== null && Math.abs(e.clientX - startX.current) >= SWIPE_THRESHOLD) {
      didSwipe.current = true;
      onDelete(entry.id);
    }
    startX.current = null;
  }

  function handleTap() {
    // A swipe already triggered delete — don't also open edit mode.
    if (didSwipe.current) {
      didSwipe.current = false;
      return;
    }
    onEdit?.(entry);
  }

  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
    >
      {/* Emoji square */}
      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center text-lg">
        {MEAL_EMOJI[mealType]}
      </span>

      {/* Name + brand — tap to edit (distinct from the delete control) */}
      <button
        type="button"
        onClick={handleTap}
        className="min-w-0 flex-1 text-left"
        aria-label={`Editar ${entry.foodName}`}
      >
        <p className="truncate text-sm font-medium text-gray-900">{entry.foodName}</p>
        {entry.brand && <p className="truncate text-xs text-gray-400">{entry.brand}</p>}
      </button>

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
