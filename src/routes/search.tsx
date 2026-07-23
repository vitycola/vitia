import type { Food } from "@/db/schema";
import { AiAddFlow } from "@/src/components/AiAddFlow/AiAddFlow";
import { CreatedFoodsTab } from "@/src/components/search/CreatedFoodsTab";
import { FavoritesTab } from "@/src/components/search/FavoritesTab";
import { FoodDatabaseTab } from "@/src/components/search/FoodDatabaseTab";
import { SearchTabs } from "@/src/components/search/SearchTabs";
import type { SearchTabId } from "@/src/components/search/SearchTabs";
import { useFoodSearchStore } from "@/stores/useFoodSearchStore";
import type { MealType } from "@/types";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

export function SearchRoute() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const mealType = (searchParams.get("meal") ?? "breakfast") as MealType;

  const { search, clear } = useFoodSearchStore();

  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<SearchTabId>("database");

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
      setQuery(q);

      if (debounceRef.current) clearTimeout(debounceRef.current);

      if (!navigator.onLine) {
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

  function handleSelect(food: Food) {
    void navigate(`/portion/${food.id}?meal=${mealType}`);
  }

  return (
    <div className="flex h-full flex-col bg-gray-50">
      {/* Sticky header: search input + tab bar */}
      <div className="z-10 bg-white px-4 pb-0 pt-4 shadow-sm">
        <h1 className="mb-3 text-lg font-bold text-gray-900">Buscar alimento</h1>

        <input
          type="search"
          value={query}
          onChange={handleQueryChange}
          placeholder="Nombre del alimento..."
          className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/20"
        />

        {isOffline && (
          <div className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            Sin conexión — los resultados están limitados a la caché local
          </div>
        )}

        <SearchTabs active={activeTab} onChange={setActiveTab} />
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto pb-20">
        {activeTab === "database" && (
          <FoodDatabaseTab query={query} mealType={mealType} onSelect={handleSelect} />
        )}
        {activeTab === "favorites" && (
          <FavoritesTab mealType={mealType} onSelect={handleSelect} query={query} />
        )}
        {activeTab === "created" && <CreatedFoodsTab onSelect={handleSelect} query={query} />}
        {activeTab === "ai" && <AiAddFlow mealType={mealType} />}
      </div>
    </div>
  );
}
