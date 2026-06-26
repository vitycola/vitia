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
        if (!f) {
          setNotFound(true);
        } else {
          setFood(f);
          setQuantityStr(String(f.servingSizeG ?? 100));
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [foodId]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-disabled">Cargando…</p>
      </div>
    );
  }

  if (notFound || !food) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
        <p className="text-center text-sm text-secondary">Alimento no encontrado.</p>
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
    <div className="min-h-screen bg-surface">
      <div className="mx-auto max-w-md px-4 py-6">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <button
            type="button"
            onClick={() => void navigate(-1)}
            className="text-sm font-medium text-secondary hover:text-primary"
          >
            ← Cancelar
          </button>
        </div>

        {/* Food info */}
        <div className="mb-6 rounded-2xl bg-white px-4 py-4 shadow-sm">
          <h1 className="text-lg font-bold text-primary">{food.name}</h1>
          {food.brand && <p className="text-sm text-disabled">{food.brand}</p>}

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
          <p className="mt-1 text-center text-xs text-disabled">por 100 g</p>
        </div>

        {/* Quantity input */}
        <div className="mb-4 rounded-2xl bg-white px-4 py-4 shadow-sm">
          <label htmlFor="quantity" className="mb-2 block text-sm font-medium text-primary">
            Cantidad (gramos)
          </label>
          <input
            id="quantity"
            type="number"
            inputMode="decimal"
            value={quantityStr}
            onChange={(e) => setQuantityStr(e.target.value)}
            min={1}
            className="w-full rounded-xl border border-default px-3 py-2.5 text-sm text-primary outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
        </div>

        {/* Live nutrition preview */}
        {portion && grams > 0 && (
          <div className="mb-6 rounded-2xl bg-accent/5 px-4 py-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-accent">
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
            className="flex w-full items-center justify-center rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent/90 disabled:opacity-50"
          >
            {saving ? "Guardando…" : "Agregar al diario"}
          </button>

          <button
            type="button"
            onClick={() => void navigate(-1)}
            className="flex w-full items-center justify-center rounded-xl border border-default bg-white px-4 py-3 text-sm font-semibold text-secondary transition-colors hover:bg-surface"
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
      <span className={`text-base font-bold ${highlight ? "text-accent" : "text-primary"}`}>
        {value}
      </span>
      <span className={`text-xs ${highlight ? "text-accent" : "text-disabled"}`}>{unit}</span>
      <span className={`text-xs ${highlight ? "text-accent" : "text-disabled"}`}>{label}</span>
    </div>
  );
}
