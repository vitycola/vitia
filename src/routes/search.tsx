import { FoodResultRow } from "@/src/components/FoodResultRow";
import { useFoodSearchStore } from "@/stores/useFoodSearchStore";
import type { MealType } from "@/types";
import { useCallback, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

export function SearchRoute() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const mealType = (searchParams.get("meal") ?? "breakfast") as MealType;

  const { query, results, isLoading, search, clear } = useFoodSearchStore();

  // Debounce timer ref
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear store on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      clear();
    };
  }, [clear]);

  const handleQueryChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const q = e.target.value;

      if (debounceRef.current) clearTimeout(debounceRef.current);

      if (!navigator.onLine) {
        // Offline: clear results, show banner, do NOT call search
        clear();
        return;
      }

      debounceRef.current = setTimeout(() => {
        void search(q);
      }, 300);
    },
    [search, clear]
  );

  const isOffline = !navigator.onLine;

  function handleSelect(food: Parameters<typeof FoodResultRow>[0]["food"]) {
    void navigate(`/portion/${food.id}?meal=${mealType}`);
  }

  function handleCustomFood() {
    void navigate(`/custom-food?meal=${mealType}`);
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white px-4 pb-3 pt-4 shadow-sm">
        <h1 className="mb-3 text-lg font-bold text-gray-900">Buscar alimento</h1>

        <input
          type="search"
          defaultValue={query}
          onChange={handleQueryChange}
          placeholder="Nombre del alimento..."
          className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/20"
        />

        {isOffline && (
          <div className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            Sin conexión — los resultados están limitados a la caché local
          </div>
        )}
      </div>

      {/* Results */}
      <div className="px-4 pt-3">
        {isLoading && <p className="py-4 text-center text-sm text-gray-400">Buscando…</p>}

        {!isLoading && results.length === 0 && query.length >= 2 && (
          <p className="py-4 text-center text-sm text-gray-400">Sin resultados para "{query}"</p>
        )}

        <div className="flex flex-col gap-2">
          {results.map((food) => (
            <FoodResultRow key={food.id} food={food} onSelect={handleSelect} />
          ))}
        </div>
      </div>

      {/* Custom food button */}
      <div className="fixed bottom-20 left-0 right-0 px-4">
        <button
          type="button"
          onClick={handleCustomFood}
          className="flex w-full items-center justify-center rounded-xl border border-accent bg-white px-4 py-3 text-sm font-semibold text-accent transition-colors hover:opacity-90"
        >
          + Crear alimento personalizado
        </button>
      </div>
    </div>
  );
}
