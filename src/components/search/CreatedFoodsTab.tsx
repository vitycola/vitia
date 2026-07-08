import type { Food } from "@/db/schema";
import { useCreatedFoodsList } from "@/hooks/useCreatedFoodsList";
import { useSwipeReveal } from "@/hooks/useSwipeReveal";
import { categoryIcon } from "@/lib/foodCategories";
import { useNavigate } from "react-router-dom";

/** Width of the revealed red delete action, in px. */
const REVEAL_WIDTH = 96;

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
 * Tap opens the food (same "select to log" behavior as Base/Favoritos).
 * Swipe left reveals a red "Eliminar" button behind the row — tapping that
 * button is what actually deletes, so the reveal itself doubles as the
 * confirmation step. Editing a created food happens from its detail screen
 * (portion.tsx "more options" menu), not from here.
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
  const { translateX, isOpen, isDragging, onPointerDown, onPointerMove, onPointerUp, close } =
    useSwipeReveal({ revealWidth: REVEAL_WIDTH });

  function handleTap() {
    if (isOpen) {
      close();
      return;
    }
    onSelect(food);
  }

  function handleDelete() {
    close();
    void onRemove(food.id);
  }

  return (
    <div className="relative overflow-hidden rounded-xl">
      <div className="absolute inset-y-0 right-0 flex" style={{ width: REVEAL_WIDTH }}>
        <button
          type="button"
          onClick={handleDelete}
          aria-label={`Eliminar ${food.name}`}
          className="flex flex-1 items-center justify-center bg-red-500 text-sm font-semibold text-white transition-colors hover:bg-red-600"
        >
          Eliminar
        </button>
      </div>

      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        style={{
          transform: `translateX(${translateX}px)`,
          transition: isDragging ? "none" : "transform 200ms ease-out",
        }}
        className="relative flex items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-sm"
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
            {Math.round(food.caloriesPer100g)} kcal/100g
          </span>
        </button>
      </div>
    </div>
  );
}
