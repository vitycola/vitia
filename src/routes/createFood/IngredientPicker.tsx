import { getCompositeFoodIds } from "@/db/repos/foods";
import { FoodResultRow } from "@/src/components/FoodResultRow";
import type { SearchResult } from "@/stores/useFoodSearchStore";
import { useFoodSearchStore } from "@/stores/useFoodSearchStore";
import { useRecipeBuilderStore } from "@/stores/useRecipeBuilderStore";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

/**
 * Ingredient picker sub-route (`/create-food/ingredients/add`). Reuses the
 * same search store (`useFoodSearchStore`) and result row (`FoodResultRow`)
 * as the main search screen's `FoodDatabaseTab`, but:
 *  - excludes composite foods from the results (nested-composite guard, UI
 *    layer — `getCompositeFoodIds()`, per design)
 *  - `onSelect` appends the food to the in-progress recipe
 *    (`useRecipeBuilderStore`) and pops back to the builder route, instead of
 *    navigating to `/portion/:foodId` like the logging flow does.
 */
export function IngredientPickerRoute() {
  const navigate = useNavigate();
  const { results, status, error, search, clear } = useFoodSearchStore();

  const [query, setQuery] = useState("");
  const [compositeIds, setCompositeIds] = useState<Set<string>>(new Set());

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getCompositeFoodIds().then((ids) => {
      if (!cancelled) setCompositeIds(new Set(ids));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      clear();
    };
  }, [clear]);

  const handleQueryChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const q = e.target.value;
      setQuery(q);

      if (debounceRef.current) clearTimeout(debounceRef.current);

      debounceRef.current = setTimeout(() => {
        void search(q);
      }, 300);
    },
    [search]
  );

  function handleCancel() {
    void navigate(-1);
  }

  function handleSelect(food: SearchResult) {
    useRecipeBuilderStore.getState().addIngredient(food);
    void navigate(-1);
  }

  // Filter out composite foods per the nested-composite guard (UI layer).
  const filteredResults = results.filter((f) => !compositeIds.has(f.id));

  return (
    <div className="bg-gray-50">
      <div className="sticky top-0 z-10 bg-white px-4 pb-0 pt-4 shadow-sm">
        <div className="mb-3 flex items-center gap-3">
          <button
            type="button"
            onClick={handleCancel}
            className="text-sm font-medium text-gray-500 hover:text-gray-700"
          >
            ← Cancelar
          </button>
        </div>

        <h1 className="mb-3 text-lg font-bold text-gray-900">Añadir ingrediente</h1>

        <input
          type="search"
          value={query}
          onChange={handleQueryChange}
          placeholder="Nombre del alimento..."
          className="mb-4 w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
      </div>

      <div className="px-4 pb-20 pt-3">
        {status === "error" && (
          <div className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            {error ?? "Error al buscar en Open Food Facts. Mostrando resultados en caché."}
          </div>
        )}

        {status === "loading" && (
          <p className="py-4 text-center text-sm text-gray-400">Buscando…</p>
        )}

        {status === "empty" && (
          <p className="py-4 text-center text-sm text-gray-400">
            Sin resultados para &ldquo;{query}&rdquo;. Prueba con otro término.
          </p>
        )}

        {status === "idle" && (
          <p className="py-4 text-center text-sm text-gray-400">
            Escribe al menos 2 caracteres para buscar.
          </p>
        )}

        {status === "results" && filteredResults.length === 0 && (
          <p className="py-4 text-center text-sm text-gray-400">
            Sin resultados para &ldquo;{query}&rdquo;. Prueba con otro término.
          </p>
        )}

        {filteredResults.length > 0 && (
          <div className="flex flex-col gap-2">
            {filteredResults.map((food) => (
              <FoodResultRow
                key={food.id}
                food={food}
                onSelect={handleSelect}
                showFavorite={false}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
