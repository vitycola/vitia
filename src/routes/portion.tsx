import { getById } from "@/db/repos/foods";
import type { Food, MealEntry } from "@/db/schema";
import { useFavorite } from "@/hooks/useFavorite";
import { todayISO } from "@/lib/date";
import { generateId } from "@/lib/id";
import { scalePortion } from "@/lib/nutrition";
import { CollapsibleSection } from "@/src/components/CollapsibleSection";
import { FavoriteToggle } from "@/src/components/FavoriteToggle";
import { MacroDistributionBar } from "@/src/components/MacroDistributionBar";
import { MealTypeSelect } from "@/src/components/MealTypeSelect";
import { useDayStore } from "@/stores/useDayStore";
import type { MealType } from "@/types";
import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

// Display-only alternate units — grams-only math (Product Decision, confirmed).
// Selecting these never recomputes quantityG or macros.
type DisplayUnit = "g" | "cup" | "tbsp";
type DisplayWeightType = "crudo" | "cocido";

export function PortionRoute() {
  const { foodId } = useParams<{ foodId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { addEntry, updateEntry, entries } = useDayStore();

  const requestedMealType = (searchParams.get("meal") ?? "breakfast") as MealType;
  const entryId = searchParams.get("entryId");

  const [food, setFood] = useState<Food | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [quantityStr, setQuantityStr] = useState("100");
  const [mealType, setMealType] = useState<MealType>(requestedMealType);
  const [saving, setSaving] = useState(false);
  const [displayUnit, setDisplayUnit] = useState<DisplayUnit>("g");
  const [displayWeightType, setDisplayWeightType] = useState<DisplayWeightType>("crudo");

  // Edit mode: `entryId` must resolve to an entry already loaded in the day
  // store. If it doesn't (invalid/stale deep link), fall back to create mode
  // (Scenario: "Invalid entryId").
  const editingEntry: MealEntry | null = entryId
    ? (entries.find((e) => e.id === entryId) ?? null)
    : null;
  const isEditMode = entryId !== null && editingEntry !== null;

  const { isFavorite, toggle: toggleFavorite } = useFavorite(foodId ?? null);

  useEffect(() => {
    if (!foodId) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    getById(foodId)
      .then((f) => {
        if (!f) {
          setNotFound(true);
          return;
        }
        setFood(f);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [foodId]);

  // Prefill from the logged entry (edit mode) or the food's serving size
  // (create mode) once both the food and the entries list are available.
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional — only re-run when food/editingEntry identity changes.
  useEffect(() => {
    if (!food) return;
    if (editingEntry) {
      setQuantityStr(String(editingEntry.quantityG));
      setMealType(editingEntry.mealType);
    } else {
      setQuantityStr(String(food.servingSizeG ?? 100));
      setMealType(requestedMealType);
    }
  }, [food, editingEntry]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-gray-400">Cargando…</p>
      </div>
    );
  }

  if (notFound || !food) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
        <p className="text-center text-sm text-gray-500">Alimento no encontrado.</p>
        <button
          type="button"
          onClick={() => void navigate(-1)}
          className="text-sm font-medium text-accent"
        >
          Volver
        </button>
      </div>
    );
  }

  const grams = Number(quantityStr) || 0;
  const portion = grams > 0 ? scalePortion(food, grams) : null;
  const mealLabel = MEAL_LABELS[mealType];
  const ctaLabel = isEditMode ? "Actualizar" : `Añadir a ${mealLabel}`;

  async function handleConfirm() {
    if (!food || grams <= 0) return;
    setSaving(true);
    try {
      const macros = scalePortion(food, grams);
      if (isEditMode && entryId) {
        await updateEntry(entryId, {
          mealType,
          foodId: food.id,
          foodName: food.name,
          quantityG: grams,
          calories: macros.calories,
          proteinG: macros.proteinG,
          carbsG: macros.carbsG,
          fatG: macros.fatG,
        });
      } else {
        await addEntry({
          id: generateId(),
          date: todayISO(),
          mealType,
          foodId: food.id,
          foodName: food.name,
          quantityG: grams,
          calories: macros.calories,
          proteinG: macros.proteinG,
          carbsG: macros.carbsG,
          fatG: macros.fatG,
        });
      }
      void navigate("/");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      {/* Colored header */}
      <div className="bg-accent px-4 pb-6 pt-4 text-white">
        <div className="mb-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => void navigate(-1)}
            className="text-sm font-medium text-white/90 hover:text-white"
          >
            ← Cancelar
          </button>
          <FavoriteToggle active={isFavorite} onToggle={() => void toggleFavorite()} />
        </div>

        <div className="flex items-center gap-3">
          <FoodAvatar imageUrl={food.imageUrl} name={food.name} />
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold">{food.name}</h1>
            {food.brand && <p className="truncate text-sm text-white/80">{food.brand}</p>}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-md space-y-4 px-4 py-4">
        {/* Macro cards — per 100g, independent of entered quantity */}
        <div className="rounded-2xl bg-white px-4 py-4 shadow-sm">
          <div className="grid grid-cols-4 gap-2 text-center">
            <NutritionCell
              label="Calorías"
              value={`${Math.round(food.caloriesPer100g)}`}
              unit="kcal"
            />
            <NutritionCell
              label="Proteínas"
              value={`${Math.round(food.proteinPer100g)}`}
              unit="g"
            />
            <NutritionCell label="Carboh." value={`${Math.round(food.carbsPer100g)}`} unit="g" />
            <NutritionCell label="Grasas" value={`${Math.round(food.fatPer100g)}`} unit="g" />
          </div>
          <p className="mt-1 text-center text-xs text-gray-400">por 100 g</p>

          <div className="mt-4">
            <MacroDistributionBar
              proteinG={food.proteinPer100g}
              carbsG={food.carbsPer100g}
              fatG={food.fatPer100g}
            />
          </div>
        </div>

        {/* Collapsible nutrition detail */}
        <CollapsibleSection title="Información Nutricional">
          <div className="space-y-2 text-sm text-gray-700">
            <NutritionRow label="Calorías" value={`${Math.round(food.caloriesPer100g)} kcal`} />
            <NutritionRow label="Proteínas" value={`${food.proteinPer100g} g`} />
            <NutritionRow label="Carbohidratos" value={`${food.carbsPer100g} g`} />
            <NutritionRow label="Grasas" value={`${food.fatPer100g} g`} />
            <p className="pt-1 text-xs text-gray-400">Valores por 100 g de producto.</p>
          </div>
        </CollapsibleSection>

        {/* Quantity + display-only unit/weight-type selectors */}
        <div className="rounded-2xl bg-white px-4 py-4 shadow-sm">
          <label htmlFor="quantity" className="mb-2 block text-sm font-medium text-gray-700">
            Cantidad
          </label>
          <div className="grid grid-cols-3 gap-2">
            <input
              id="quantity"
              type="number"
              inputMode="decimal"
              value={quantityStr}
              onChange={(e) => setQuantityStr(e.target.value)}
              min={1}
              className="col-span-1 rounded-xl border border-gray-300 px-3 py-2.5 text-sm text-gray-900 outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
            {/* Display-only — never recomputes quantityG or macros */}
            <select
              aria-label="Unidad (solo visual)"
              value={displayUnit}
              onChange={(e) => setDisplayUnit(e.target.value as DisplayUnit)}
              className="col-span-1 rounded-xl border border-gray-300 bg-white px-2 py-2.5 text-sm text-gray-900 outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            >
              <option value="g">Gramos</option>
              <option value="cup">Tazas</option>
              <option value="tbsp">Cucharadas</option>
            </select>
            {/* Display-only — never recomputes quantityG or macros */}
            <select
              aria-label="Tipo de peso (solo visual)"
              value={displayWeightType}
              onChange={(e) => setDisplayWeightType(e.target.value as DisplayWeightType)}
              className="col-span-1 rounded-xl border border-gray-300 bg-white px-2 py-2.5 text-sm text-gray-900 outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            >
              <option value="crudo">Crudo</option>
              <option value="cocido">Cocido</option>
            </select>
          </div>
        </div>

        {/* Live nutrition preview */}
        {portion && grams > 0 && (
          <div className="rounded-2xl bg-surface px-4 py-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#8E8E93]">
              Para {grams} g
            </p>
            <div className="grid grid-cols-4 gap-2 text-center">
              <NutritionCell
                label="Calorías"
                value={`${Math.round(portion.calories)}`}
                unit="kcal"
                highlight
              />
              <NutritionCell
                label="Proteínas"
                value={`${Math.round(portion.proteinG)}`}
                unit="g"
                highlight
              />
              <NutritionCell
                label="Carboh."
                value={`${Math.round(portion.carbsG)}`}
                unit="g"
                highlight
              />
              <NutritionCell
                label="Grasas"
                value={`${Math.round(portion.fatG)}`}
                unit="g"
                highlight
              />
            </div>
          </div>
        )}

        {/* Meal picker */}
        <div className="rounded-2xl bg-white px-4 py-4 shadow-sm">
          <label className="mb-2 block text-sm font-medium text-gray-700" htmlFor="meal-picker">
            Comida
          </label>
          <div id="meal-picker">
            <MealTypeSelect value={mealType} onChange={setMealType} />
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={saving || grams <= 0}
            className="flex w-full items-center justify-center rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-accent-foreground transition-colors hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Guardando…" : ctaLabel}
          </button>

          <button
            type="button"
            onClick={() => void navigate(-1)}
            className="flex w-full items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-50"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: "Desayuno",
  lunch: "Almuerzo",
  dinner: "Cena",
  snack: "Merienda",
};

function FoodAvatar({ imageUrl, name }: { imageUrl: string | null; name: string }) {
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={name}
        className="h-14 w-14 flex-shrink-0 rounded-full border-2 border-white/40 object-cover"
      />
    );
  }
  return (
    <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full border-2 border-white/40 bg-white/20 text-xl font-bold">
      {name.trim().charAt(0).toUpperCase() || "?"}
    </div>
  );
}

function NutritionRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-900">{value}</span>
    </div>
  );
}

function NutritionCell({
  label,
  value,
  unit,
  highlight = false,
}: {
  label: string;
  value: string;
  unit: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex flex-col items-center">
      <span className={`text-base font-bold ${highlight ? "text-accent" : "text-gray-800"}`}>
        {value}
      </span>
      <span className={`text-xs ${highlight ? "text-accent" : "text-gray-400"}`}>{unit}</span>
      <span className={`text-xs ${highlight ? "text-[#8E8E93]" : "text-gray-400"}`}>{label}</span>
    </div>
  );
}
