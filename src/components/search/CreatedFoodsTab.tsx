import type { Food } from "@/db/schema";
import { useCreatedFoodsList } from "@/hooks/useCreatedFoodsList";
import { categoryIcon } from "@/lib/foodCategories";
import { useRef } from "react";
import { useNavigate } from "react-router-dom";

/** Mirrors MealEntryRow's swipe-to-delete threshold — same gesture app-wide. */
const SWIPE_THRESHOLD = 80;

interface CreatedFoodsTabProps {
  onSelect: (food: Food) => void;
  query: string;
}

export function CreatedFoodsTab({ onSelect, query }: CreatedFoodsTabProps) {
  const { items, loading, remove } = useCreatedFoodsList(query);
  const navigate = useNavigate();

  if (loading) {
    return <p className="py-4 text-center text-sm text-gray-400">Cargando…</p>;
  }

  return (
    <div className="px-4 pt-3">
      <button
        type="button"
        onClick={() => navigate("/create-food")}
        className="mb-3 w-full rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground transition-colors hover:opacity-90"
      >
        Crear alimento
      </button>

      {items.length === 0 && query.trim().length > 0 && (
        <p className="py-4 text-center text-sm text-gray-400">
          Sin resultados para &ldquo;{query}&rdquo; en tus alimentos creados.
        </p>
      )}

      {items.length === 0 && query.trim().length === 0 && (
        <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
          <p className="mb-2 text-base font-semibold text-gray-700">
            Todavía no has creado ningún alimento
          </p>
          <p className="text-sm text-gray-400">
            Crea alimentos manualmente o combinando ingredientes para encontrarlos aquí.
          </p>
        </div>
      )}

      {items.length > 0 && (
        <div className="flex flex-col gap-2">
          {items.map((food) => (
            <CreatedFoodRow key={food.id} food={food} onSelect={onSelect} onRemove={remove} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Tap opens the food (same "select to log" behavior as Base/Favoritos);
 * swipe left deletes it — no confirmation, matching MealEntryRow's gesture
 * (the app-wide swipe-to-delete convention). Editing a created food happens
 * from its detail screen (portion.tsx "more options" menu), not from here.
 */
function CreatedFoodRow({
  food,
  onSelect,
  onRemove,
}: {
  food: Food;
  onSelect: (food: Food) => void;
  onRemove: (foodId: string) => Promise<void>;
}) {
  const startX = useRef<number | null>(null);
  const didSwipe = useRef(false);

  function handlePointerDown(e: React.PointerEvent) {
    startX.current = e.clientX;
    didSwipe.current = false;
  }

  function handlePointerUp(e: React.PointerEvent) {
    if (startX.current !== null && Math.abs(e.clientX - startX.current) >= SWIPE_THRESHOLD) {
      didSwipe.current = true;
      void onRemove(food.id);
    }
    startX.current = null;
  }

  function handleTap() {
    if (didSwipe.current) {
      didSwipe.current = false;
      return;
    }
    onSelect(food);
  }

  return (
    <div
      className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-sm"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
    >
      <button
        type="button"
        onClick={handleTap}
        className="flex min-w-0 flex-1 items-center gap-3 text-left transition-colors active:opacity-70"
      >
        <span className="shrink-0 text-lg leading-none" aria-hidden="true">
          {categoryIcon(food.category)}
        </span>
        <div className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-gray-900">{food.name}</span>
          {food.brand && <p className="truncate text-xs text-gray-400">{food.brand}</p>}
        </div>
        <span className="shrink-0 text-sm font-semibold text-gray-700">
          {Math.round(food.caloriesPer100g)} kcal
        </span>
      </button>
    </div>
  );
}
