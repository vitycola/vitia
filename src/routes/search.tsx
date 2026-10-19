import type { Food } from "@/db/schema";
import { AiAddFlow } from "@/src/components/AiAddFlow/AiAddFlow";
import { CreatedFoodsTab } from "@/src/components/search/CreatedFoodsTab";
import { FavoritesTab } from "@/src/components/search/FavoritesTab";
import { FoodDatabaseTab } from "@/src/components/search/FoodDatabaseTab";
import { SearchTabs, parseSearchTab } from "@/src/components/search/SearchTabs";
import type { SearchTabId } from "@/src/components/search/SearchTabs";
import { useFoodSearchStore } from "@/stores/useFoodSearchStore";
import type { MealType } from "@/types";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useNavigationType, useSearchParams } from "react-router-dom";

export function SearchRoute() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const navigationType = useNavigationType();
  const mealType = (searchParams.get("meal") ?? "breakfast") as MealType;

  const { search, clear } = useFoodSearchStore();

  const urlQ = searchParams.get("q") ?? "";
  const activeTab = parseSearchTab(searchParams.get("tab"));

  // The URL is the source of truth; `query` is local state only for responsive typing.
  const [query, setQuery] = useState(urlQ);
  const initialQueryRef = useRef(urlQ);

  // Always points at the latest setter: its identity (and the `prev` it merges
  // against) changes with every URL update, so the debounce tick must not capture it.
  const setSearchParamsRef = useRef(setSearchParams);
  setSearchParamsRef.current = setSearchParams;

  // Debounce timer ref
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateParam = useCallback((key: string, value: string | null) => {
    setSearchParamsRef.current(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value === null) next.delete(key);
        else next.set(key, value);
        return next;
      },
      { replace: true }
    );
  }, []);

  // Re-run the search on mount (restores results after returning from a food detail)
  // and clear the store on unmount.
  useEffect(() => {
    if (initialQueryRef.current && navigator.onLine) void search(initialQueryRef.current);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      clear();
    };
  }, [search, clear]);

  // External navigation to /search (e.g. bottom tab bar link to bare /search, or
  // history pop) keeps this screen mounted: resync the input from the URL. Own
  // writes are always `replace`, so skipping REPLACE never reverts in-flight typing.
  // Keyed on location.key (not `q`) so it also fires when the URL had no `q`.
  const isFirstLocationRef = useRef(true);
  // biome-ignore lint/correctness/useExhaustiveDependencies: location.key is the trigger; urlQ is read for that navigation
  useEffect(() => {
    if (isFirstLocationRef.current) {
      isFirstLocationRef.current = false;
      return;
    }
    if (navigationType === "REPLACE") return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setQuery(urlQ);
    if (urlQ && navigator.onLine) void search(urlQ);
    else clear();
  }, [location.key]);

  const handleQueryChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const q = e.target.value;
      setQuery(q);

      if (debounceRef.current) clearTimeout(debounceRef.current);

      if (!navigator.onLine) clear();

      debounceRef.current = setTimeout(() => {
        const written = q.trim() === "" ? "" : q;
        updateParam("q", written === "" ? null : written);
        if (navigator.onLine) void search(q);
      }, 300);
    },
    [search, clear, updateParam]
  );

  const handleTabChange = useCallback(
    (id: SearchTabId) => updateParam("tab", id === "database" ? null : id),
    [updateParam]
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

        <SearchTabs active={activeTab} onChange={handleTabChange} />
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
