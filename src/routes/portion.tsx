import { getById } from "@/db/repositories/foods";
import type { Food } from "@/db/schema";
import { todayISO } from "@/lib/date";
import { generateId } from "@/lib/id";
import { scalePortion } from "@/lib/nutrition";
import { useDayStore } from "@/stores/useDayStore";
import type { MealType } from "@/types";
import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

export function PortionRoute() {
  const { foodId } = useParams<{ foodId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { addEntry } = useDayStore();

  const mealType = (searchParams.get("meal") ?? "breakfast") as MealType;

  const [food, setFood] = useState<Food | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [quantityStr, setQuantityStr] = useState("100");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!foodId) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    getById(foodId)
      .then((f) => {
        if (!f) setNotFound(true);
        else setFood(f);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [foodId]);

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
          className="text-sm font-medium text-green-600"
        >
          Volver
        </button>
      </div>
    );
  }

  const grams = Number(quantityStr) || 0;
  const portion = grams > 0 ? scalePortion(food, grams) : null;

  async function handleConfirm() {
    if (!food || grams <= 0) return;
    setSaving(true);
    try {
      const macros = scalePortion(food, grams);
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
      void navigate("/");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-md px-4 py-6">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <button
            type="button"
            onClick={() => void navigate(-1)}
            className="text-sm font-medium text-gray-500 hover:text-gray-700"
          >
            ← Cancelar
          </button>
        </div>

        {/* Food info */}
        <div className="mb-6 rounded-2xl bg-white px-4 py-4 shadow-sm">
          <h1 className="text-lg font-bold text-gray-900">{food.name}</h1>
          {food.brand && <p className="text-sm text-gray-400">{food.brand}</p>}

          <div className="mt-3 grid grid-cols-4 gap-2 text-center">
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
        </div>

        {/* Quantity input */}
        <div className="mb-4 rounded-2xl bg-white px-4 py-4 shadow-sm">
          <label htmlFor="quantity" className="mb-2 block text-sm font-medium text-gray-700">
            Cantidad (gramos)
          </label>
          <input
            id="quantity"
            type="number"
            inputMode="decimal"
            value={quantityStr}
            onChange={(e) => setQuantityStr(e.target.value)}
            min={1}
            className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm text-gray-900 outline-none transition-colors focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
          />
        </div>

        {/* Live nutrition preview */}
        {portion && grams > 0 && (
          <div className="mb-6 rounded-2xl bg-green-50 px-4 py-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-green-700">
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

        {/* Actions */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={saving || grams <= 0}
            className="flex w-full items-center justify-center rounded-xl bg-green-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-green-700 disabled:opacity-50"
          >
            {saving ? "Guardando…" : "Agregar al diario"}
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
      <span className={`text-base font-bold ${highlight ? "text-green-800" : "text-gray-800"}`}>
        {value}
      </span>
      <span className={`text-xs ${highlight ? "text-green-600" : "text-gray-400"}`}>{unit}</span>
      <span className={`text-xs ${highlight ? "text-green-600" : "text-gray-400"}`}>{label}</span>
    </div>
  );
}
