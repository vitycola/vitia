import type { Food } from "@/db/schema";
import { useCreatedFoodsList } from "@/hooks/useCreatedFoodsList";
import { categoryIcon } from "@/lib/foodCategories";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

interface CreatedFoodsTabProps {
  onSelect: (food: Food) => void;
  query: string;
}

export function CreatedFoodsTab({ onSelect, query }: CreatedFoodsTabProps) {
  const { items, loading, compositeIds, remove } = useCreatedFoodsList(query);
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
            <CreatedFoodRow
              key={food.id}
              food={food}
              isComposite={compositeIds.has(food.id)}
              onSelect={onSelect}
              onRemove={remove}
              onEditRecipe={() => navigate(`/create-food/${food.id}/edit`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CreatedFoodRow({
  food,
  isComposite,
  onSelect,
  onRemove,
  onEditRecipe,
}: {
  food: Food;
  isComposite: boolean;
  onSelect: (food: Food) => void;
  onRemove: (foodId: string) => Promise<void>;
  onEditRecipe: () => void;
}) {
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);

  return (
    <div>
      <div className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-sm">
        <button
          type="button"
          onClick={() => onSelect(food)}
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
        {isComposite && (
          <button
            type="button"
            aria-label={`Editar receta de ${food.name}`}
            onClick={onEditRecipe}
            className="shrink-0 text-sm font-medium text-gray-400 hover:text-accent"
          >
            ✎
          </button>
        )}
        <button
          type="button"
          aria-label={`Eliminar ${food.name}`}
          onClick={() => setShowRemoveConfirm(true)}
          className="shrink-0 text-sm font-medium text-gray-400 hover:text-red-500"
        >
          🗑
        </button>
      </div>

      {showRemoveConfirm && (
        <div className="mt-1 flex items-center justify-between gap-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <span>¿Eliminar este alimento?</span>
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
                void onRemove(food.id);
                setShowRemoveConfirm(false);
              }}
              className="rounded-lg bg-amber-200 px-2 py-1 font-semibold hover:bg-amber-300"
            >
              Eliminar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
