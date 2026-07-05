import type { Food } from "@/db/schema";
import { useCreatedFoodsList } from "@/hooks/useCreatedFoodsList";
import { categoryIcon } from "@/lib/foodCategories";
import { useNavigate } from "react-router-dom";

interface CreatedFoodsTabProps {
  onSelect: (food: Food) => void;
  query: string;
}

export function CreatedFoodsTab({ onSelect, query }: CreatedFoodsTabProps) {
  const { items, loading, compositeIds } = useCreatedFoodsList(query);
  const navigate = useNavigate();

  if (loading) {
    return <p className="py-4 text-center text-sm text-gray-400">Cargando…</p>;
  }

  if (items.length === 0 && query.trim().length > 0) {
    return (
      <p className="py-4 text-center text-sm text-gray-400">
        Sin resultados para &ldquo;{query}&rdquo; en tus alimentos creados.
      </p>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
        <p className="mb-2 text-base font-semibold text-gray-700">
          Todavía no has creado ningún alimento
        </p>
        <p className="mb-4 text-sm text-gray-400">
          Crea alimentos manualmente o combinando ingredientes para encontrarlos aquí.
        </p>
        <button
          type="button"
          onClick={() => navigate("/create-food")}
          className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground transition-colors hover:opacity-90"
        >
          Crear alimento
        </button>
      </div>
    );
  }

  return (
    <div className="px-4 pt-3">
      <div className="flex flex-col gap-2">
        {items.map((food) => (
          <div
            key={food.id}
            className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-sm"
          >
            <button
              type="button"
              onClick={() => onSelect(food)}
              className="flex min-w-0 flex-1 items-center gap-3 text-left transition-colors active:opacity-70"
            >
              <span className="shrink-0 text-lg leading-none" aria-hidden="true">
                {categoryIcon(food.category)}
              </span>
              <div className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-gray-900">
                  {food.name}
                </span>
                {food.brand && <p className="truncate text-xs text-gray-400">{food.brand}</p>}
              </div>
              <span className="shrink-0 text-sm font-semibold text-gray-700">
                {Math.round(food.caloriesPer100g)} kcal
              </span>
            </button>
            {compositeIds.has(food.id) && (
              <button
                type="button"
                aria-label={`Editar receta de ${food.name}`}
                onClick={() => navigate(`/create-food/${food.id}/edit`)}
                className="shrink-0 text-sm font-medium text-gray-400 hover:text-accent"
              >
                ✎
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
