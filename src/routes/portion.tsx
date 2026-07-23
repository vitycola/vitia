import { getById, getIngredients } from "@/db/repos/foods";
import type { Food, MealEntry } from "@/db/schema";
import { useFavorite } from "@/hooks/useFavorite";
import { MEAL_LABELS } from "@/lib/constants";
import { canConvert, convertWeight, directionFor } from "@/lib/cookingConversion";
import type { CookingBasis } from "@/lib/cookingConversion";
import { todayISO } from "@/lib/date";
import { generateId } from "@/lib/id";
import { scalePortion } from "@/lib/nutrition";
import { CollapsibleSection } from "@/src/components/CollapsibleSection";
import { FavoriteToggle } from "@/src/components/FavoriteToggle";
import { MacroDistributionBar } from "@/src/components/MacroDistributionBar";
import { MealPicker } from "@/src/components/MealPicker";
import { MealTypeSelect } from "@/src/components/MealTypeSelect";
import { useDayStore } from "@/stores/useDayStore";
import type { MealType } from "@/types";
import { MoreVertical } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

// Display-only alternate unit — grams-only math (Product Decision, confirmed).
// Selecting this never recomputes quantityG or macros.
type DisplayUnit = "g" | "cup" | "tbsp";

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
  // Functional basis control (repurposed from the former display-only
  // selector — design D4): the entered grams is what the user weighed;
  // `basis` says which basis that weight is in. Direction is derived (D6.5)
  // from this vs. the food's resolved dataBasis, never assumed.
  const [basis, setBasis] = useState<CookingBasis>("crudo");

  // Edit mode: `entryId` must resolve to an entry already loaded in the day
  // store. If it doesn't (invalid/stale deep link), fall back to create mode
  // (Scenario: "Invalid entryId").
  const editingEntry: MealEntry | null = entryId
    ? (entries.find((e) => e.id === entryId) ?? null)
    : null;
  const isEditMode = entryId !== null && editingEntry !== null;

  const {
    isFavorite,
    setMeals: setFavoriteMeals,
    remove: removeFavorite,
  } = useFavorite(foodId ?? null);
  const [showMealPicker, setShowMealPicker] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [isComposite, setIsComposite] = useState(false);

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
        // Only created (custom) foods can be edited — and only composite
        // ones (with a persisted recipe) go to the recipe editor rather
        // than the manual-food editor.
        if (f.source === "custom") {
          return getIngredients(f.id).then((rows) => setIsComposite(rows.length > 0));
        }
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
  const showConversionToggle = canConvert(food);
  // Convert the entered weight to the food's stored basis before deriving
  // macros (design D4/D6.5). `directionFor` returns null when the gate is
  // false (dataBasis unresolved) or when the entered basis already matches
  // the stored basis — in either case the entered grams are used unchanged.
  const conversionDirection = showConversionToggle ? directionFor(food.dataBasis, basis) : null;
  const conversionResult = conversionDirection
    ? convertWeight(food.category, grams, conversionDirection)
    : null;
  // showConversionToggle (canConvert) already guarantees hasCookingFactor(food.category)
  // whenever conversionDirection is non-null, so "converted" is always the
  // actual branch here — the fallback keeps this expression total.
  const effectiveGrams = conversionResult?.kind === "converted" ? conversionResult.grams : grams;
  const portion = grams > 0 ? scalePortion(food, effectiveGrams) : null;
  const mealLabel = MEAL_LABELS[mealType];
  const ctaLabel = isEditMode ? "Actualizar" : `Añadir a ${mealLabel}`;

  async function handleConfirm() {
    if (!food || grams <= 0) return;
    setSaving(true);
    try {
      const macros = scalePortion(food, effectiveGrams);
      if (isEditMode && entryId) {
        await updateEntry(entryId, {
          mealType,
          foodId: food.id,
          foodName: food.name,
          quantityG: effectiveGrams,
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
          quantityG: effectiveGrams,
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
          <div className="flex items-center gap-1">
            <FavoriteToggle
              active={isFavorite}
              onToggle={() => {
                if (isFavorite) {
                  setShowRemoveConfirm(true);
                } else {
                  setShowMealPicker(true);
                }
              }}
            />
            {(food.source === "custom" ||
              food.source === "ai_photo" ||
              food.source === "ai_list") && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowOptionsMenu((v) => !v)}
                  aria-label="Más opciones"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-white transition-opacity hover:opacity-80"
                >
                  <MoreVertical size={20} />
                </button>
                {showOptionsMenu && (
                  <div className="absolute right-0 top-full z-10 mt-1 min-w-[8rem] rounded-xl bg-white py-1 shadow-lg">
                    <button
                      type="button"
                      onClick={() => {
                        setShowOptionsMenu(false);
                        void navigate(
                          isComposite
                            ? `/create-food/${food.id}/edit`
                            : `/create-food/manual/${food.id}`
                        );
                      }}
                      className="block w-full px-4 py-2 text-left text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Editar
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <FoodAvatar imageUrl={food.imageUrl} name={food.name} />
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold">{food.name}</h1>
            <p className="truncate text-sm text-white/80">
              {food.brand ??
                (food.source === "generic"
                  ? "Genérico"
                  : food.source === "ai_photo"
                    ? "Creado con IA · Foto"
                    : food.source === "ai_list"
                      ? "Creado con IA · Lista"
                      : null)}
            </p>
          </div>
        </div>

        {showRemoveConfirm && (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-white/10 px-3 py-2 text-sm">
            <span>¿Quitar de favoritos?</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowRemoveConfirm(false)}
                className="rounded-lg px-3 py-1.5 font-medium text-white/90 hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  void removeFavorite();
                  setShowRemoveConfirm(false);
                }}
                className="rounded-lg bg-white/20 px-3 py-1.5 font-semibold text-white hover:bg-white/30"
              >
                Quitar
              </button>
            </div>
          </div>
        )}
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

        {/* Quantity + unit selector + (when convertible) the functional
            crudo/cocido basis toggle */}
        <div className="rounded-2xl bg-white px-4 py-4 shadow-sm">
          <label htmlFor="quantity" className="mb-2 block text-sm font-medium text-gray-700">
            Cantidad
          </label>
          <div
            className={showConversionToggle ? "grid grid-cols-3 gap-2" : "grid grid-cols-2 gap-2"}
          >
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
            {/* Functional — repurposed from display-only (design D4). Hidden
                when canConvert(food) is false: no known factor OR unresolved
                dataBasis (fail-closed, BR-5). Drives real conversion of the
                entered grams before macros are computed/persisted. */}
            {showConversionToggle && (
              <select
                aria-label="Tipo de peso"
                value={basis}
                onChange={(e) => setBasis(e.target.value as CookingBasis)}
                className="col-span-1 rounded-xl border border-gray-300 bg-white px-2 py-2.5 text-sm text-gray-900 outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              >
                <option value="crudo">Crudo</option>
                <option value="cocido">Cocido</option>
              </select>
            )}
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

      {showMealPicker && (
        <MealPicker
          activeMealType={mealType}
          onCancel={() => setShowMealPicker(false)}
          onConfirm={(mealTypes) => {
            void setFavoriteMeals(mealTypes);
            setShowMealPicker(false);
          }}
        />
      )}
    </div>
  );
}

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
