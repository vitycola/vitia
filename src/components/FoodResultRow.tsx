import { useFavorite } from "@/hooks/useFavorite";
import type { SearchResult } from "@/stores/useFoodSearchStore";
import type { MealType } from "@/types";
import { useState } from "react";
import { FavoriteToggle } from "./FavoriteToggle";
import { MealPicker } from "./MealPicker";

interface FoodResultRowProps {
  food: SearchResult;
  onSelect: (food: SearchResult) => void;
  /** Active logging meal context, pre-checked in the meal picker. */
  mealType?: MealType;
  /** Show the favorite heart slot. Defaults to true. */
  showFavorite?: boolean;
}

export function FoodResultRow({
  food,
  onSelect,
  mealType,
  showFavorite = true,
}: FoodResultRowProps) {
  const { isFavorite, setMeals, remove } = useFavorite(food.id);
  const [showMealPicker, setShowMealPicker] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);

  return (
    <div>
      <div className="flex w-full items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-sm transition-colors hover:bg-gray-50">
        {showFavorite && (
          <FavoriteToggle
            variant="compact"
            active={isFavorite}
            onToggle={() => {
              if (isFavorite) {
                setShowRemoveConfirm(true);
              } else {
                setShowMealPicker(true);
              }
            }}
          />
        )}

        <button
          type="button"
          onClick={() => onSelect(food)}
          className="flex min-w-0 flex-1 items-center gap-3 text-left active:opacity-70"
        >
          <div className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-gray-900">{food.name}</span>
            <p className="truncate text-xs text-gray-400">
              {food.brand ?? (food.source === "generic" ? "Genérico" : null)}
            </p>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-0.5">
            <span className="text-sm font-semibold text-gray-700">
              {Math.round(food.caloriesPer100g)} kcal/100g
            </span>
            <span className="text-xs text-gray-400">
              P {Math.round(food.proteinPer100g)}g · C {Math.round(food.carbsPer100g)}g · G{" "}
              {Math.round(food.fatPer100g)}g
            </span>
          </div>
        </button>
      </div>

      {showRemoveConfirm && (
        <div className="mt-1 flex items-center justify-between gap-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <span>¿Quitar de favoritos?</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowRemoveConfirm(false)}
              className="rounded-lg px-2 py-1 font-medium hover:bg-amber-100"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => {
                void remove();
                setShowRemoveConfirm(false);
              }}
              className="rounded-lg bg-amber-200 px-2 py-1 font-semibold hover:bg-amber-300"
            >
              Quitar
            </button>
          </div>
        </div>
      )}

      {showMealPicker && (
        <MealPicker
          activeMealType={mealType}
          onCancel={() => setShowMealPicker(false)}
          onConfirm={(mealTypes) => {
            void setMeals(mealTypes);
            setShowMealPicker(false);
          }}
        />
      )}
    </div>
  );
}
