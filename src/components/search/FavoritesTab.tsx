import type { Food } from "@/db/schema";
import { useFavoritesList } from "@/hooks/useFavoritesList";
import { MEAL_LABELS } from "@/lib/constants";
import type { MealType } from "@/types";
import { useState } from "react";

interface FavoritesTabProps {
  mealType: MealType;
  onSelect: (food: Food) => void;
}

export function FavoritesTab({ mealType: _mealType, onSelect }: FavoritesTabProps) {
  const { sections, loading, query, setQuery, remove } = useFavoritesList();

  if (loading) {
    return <p className="py-4 text-center text-sm text-gray-400">Cargando…</p>;
  }

  const hasAnyFavorites = sections.length > 0 || query.trim().length > 0;

  return (
    <div className="px-4 pt-3">
      {hasAnyFavorites && (
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar en favoritos..."
          aria-label="Buscar en favoritos"
          className="mb-3 w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
      )}

      {sections.length === 0 && query.trim().length > 0 && (
        <p className="py-4 text-center text-sm text-gray-400">
          Sin resultados para &ldquo;{query}&rdquo; en tus favoritos.
        </p>
      )}

      {sections.length === 0 && query.trim().length === 0 && (
        <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
          <p className="mb-2 text-base font-semibold text-gray-700">Sin favoritos todavía</p>
          <p className="text-sm text-gray-400">
            Marca alimentos con el corazón para encontrarlos rápido acá.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {sections.map((section) => (
          <div key={section.mealType ?? "unassigned"}>
            <p className="mb-1.5 px-1 text-xs font-medium text-gray-400">
              {section.mealType ? MEAL_LABELS[section.mealType] : "Sin asignar"}
            </p>
            <div className="flex flex-col gap-2">
              {section.items.map((item) => (
                <FavoriteRow key={item.id} item={item} onSelect={onSelect} onRemove={remove} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FavoriteRow({
  item,
  onSelect,
  onRemove,
}: {
  item: ReturnType<typeof useFavoritesList>["sections"][number]["items"][number];
  onSelect: (food: Food) => void;
  onRemove: (foodId: string) => Promise<void>;
}) {
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);

  return (
    <div>
      <div className="flex w-full items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-sm transition-colors hover:bg-gray-50">
        <button
          type="button"
          onClick={() => setShowRemoveConfirm(true)}
          aria-label="Quitar de favoritos"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-amber-500 hover:opacity-80"
        >
          ♥
        </button>

        <button
          type="button"
          onClick={() => onSelect(item)}
          className="flex flex-1 items-center gap-3 text-left active:opacity-70"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-sm font-medium text-gray-900">{item.name}</span>
              {item.otherMeals.length > 0 && (
                <span className="shrink-0 truncate text-xs text-gray-400">
                  también en {item.otherMeals.map((m) => MEAL_LABELS[m]).join(", ")}
                </span>
              )}
            </div>
            {item.brand && <p className="truncate text-xs text-gray-400">{item.brand}</p>}
          </div>

          <span className="shrink-0 text-sm font-semibold text-gray-700">
            {Math.round(item.caloriesPer100g)} kcal
          </span>
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
                void onRemove(item.id);
                setShowRemoveConfirm(false);
              }}
              className="rounded-lg bg-amber-200 px-2 py-1 font-semibold hover:bg-amber-300"
            >
              Quitar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
