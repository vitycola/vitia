import type { MealEntry } from "@/types";
import { Trash2 } from "lucide-react";

interface MealEntryRowProps {
  entry: MealEntry;
  onDelete: (id: string) => void;
}

export function MealEntryRow({ entry, onDelete }: MealEntryRowProps) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <div className="flex-1 min-w-0">
        <p className="truncate text-sm font-medium text-primary">{entry.foodName}</p>
        <p className="text-xs text-disabled">
          {entry.quantityG}g · {Math.round(entry.proteinG)}p · {Math.round(entry.carbsG)}c ·{" "}
          {Math.round(entry.fatG)}g
        </p>
      </div>
      <div className="ml-3 flex items-center gap-3">
        <span className="text-sm font-semibold text-primary">
          {Math.round(entry.calories)} kcal
        </span>
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
