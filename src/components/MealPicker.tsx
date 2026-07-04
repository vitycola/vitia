import { MEAL_LABELS, MEAL_ORDER } from "@/lib/constants";
import type { MealType } from "@/types";
import { useState } from "react";

interface MealPickerProps {
  /** Meal type to pre-check when the picker opens (e.g. active logging context). */
  activeMealType?: MealType | null;
  onConfirm: (mealTypes: MealType[]) => void;
  onCancel: () => void;
}

/**
 * Multi-select meal-type picker used to favorite a food under one or more
 * meals. Pre-checks the active logging meal (if given) but allows the user
 * to check/uncheck any options, including confirming with zero selections
 * (which results in an "unassigned" favorite).
 */
export function MealPicker({ activeMealType, onConfirm, onCancel }: MealPickerProps) {
  const [selected, setSelected] = useState<Set<MealType>>(
    () => new Set(activeMealType ? [activeMealType] : [])
  );

  function toggleMeal(mealType: MealType) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(mealType)) {
        next.delete(mealType);
      } else {
        next.add(mealType);
      }
      return next;
    });
  }

  return (
    // biome-ignore lint/a11y/useSemanticElements: custom bottom-sheet modal, not a native <dialog>
    <div
      role="dialog"
      aria-label="Elegir comidas para favorito"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
    >
      <div className="w-full max-w-sm rounded-t-2xl bg-white p-4 sm:rounded-2xl">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">¿En qué comidas?</h2>

        <div className="flex flex-col gap-2">
          {MEAL_ORDER.map((mealType) => (
            <label
              key={mealType}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-gray-50"
            >
              <input
                type="checkbox"
                checked={selected.has(mealType)}
                onChange={() => toggleMeal(mealType)}
                className="h-4 w-4 rounded border-gray-300 text-amber-500 focus:ring-amber-400"
              />
              <span className="text-sm text-gray-800">{MEAL_LABELS[mealType]}</span>
            </label>
          ))}
        </div>

        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onConfirm(Array.from(selected))}
            className="flex-1 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-amber-600"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}
