import { FoodResultRow } from "@/src/components/FoodResultRow";
import type { SearchResult } from "@/stores/useFoodSearchStore";
import { useFoodSearchStore } from "@/stores/useFoodSearchStore";
import type { MealType } from "@/types";

interface FoodDatabaseTabProps {
  query: string;
  mealType: MealType;
  onSelect: (food: SearchResult) => void;
}

export function FoodDatabaseTab({ query, mealType: _mealType, onSelect }: FoodDatabaseTabProps) {
  const { results, status, error } = useFoodSearchStore();

  return (
    <div className="px-4 pt-3">
      {/* Error banner — shown alongside any cached results */}
      {status === "error" && (
        <div className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
          {error ?? "Error al buscar en Open Food Facts. Mostrando resultados en caché."}
        </div>
      )}

      {/* Loading */}
      {status === "loading" && <p className="py-4 text-center text-sm text-gray-400">Buscando…</p>}

      {/* Empty state */}
      {status === "empty" && (
        <p className="py-4 text-center text-sm text-gray-400">
          Sin resultados para &ldquo;{query}&rdquo; en Open Food Facts. Prueba con otro término.
        </p>
      )}

      {/* Idle prompt */}
      {status === "idle" && (
        <p className="py-4 text-center text-sm text-gray-400">
          Escribe al menos 2 caracteres para buscar.
        </p>
      )}

      {/* Results list — visible in results and error states (cached) */}
      {results.length > 0 && (
        <div className="flex flex-col gap-2">
          {results.map((food) => (
            <FoodResultRow key={food.id} food={food} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  );
}
