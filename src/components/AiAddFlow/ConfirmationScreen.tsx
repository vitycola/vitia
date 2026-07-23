import { createComposite } from "@/db/repos/foods";
import { getConfidenceMeta } from "@/lib/aiConfidence";
import { scaleAiMacros } from "@/lib/aiMacros";
import { todayISO } from "@/lib/date";
import { generateId } from "@/lib/id";
import { useAiAddFlowStore } from "@/stores/useAiAddFlowStore";
import { useDayStore } from "@/stores/useDayStore";
import type { MealType, NewMealEntry } from "@/types";
import type { AIFoodItem } from "@/types/aiFood";
import { useNavigate } from "react-router-dom";
import { useShallow } from "zustand/shallow";

const MEAL_OPTIONS: { value: MealType; label: string }[] = [
  { value: "breakfast", label: "Desayuno" },
  { value: "lunch", label: "Almuerzo" },
  { value: "dinner", label: "Cena" },
  { value: "snack", label: "Merienda" },
];

function mapToNewMealEntry(
  item: AIFoodItem,
  qty: number,
  meal: MealType,
  foodId: string
): NewMealEntry {
  const scaled = scaleAiMacros(item, qty);
  return {
    id: generateId(),
    date: todayISO(),
    mealType: meal,
    foodId,
    foodName: item.name,
    quantityG: qty,
    calories: scaled.kcal,
    proteinG: scaled.protein,
    carbsG: scaled.carbs,
    fatG: scaled.fat,
    loggedAt: new Date().toISOString(),
  };
}

export function ConfirmationScreen() {
  const {
    results,
    selections,
    quantities,
    selectedMeal,
    inputMode,
    reset,
    toggleItem,
    setQuantity,
    setMeal,
    checkedMacroTotals,
    perItemScaledMacros,
  } = useAiAddFlowStore(
    useShallow((s) => ({
      results: s.results,
      selections: s.selections,
      quantities: s.quantities,
      selectedMeal: s.selectedMeal,
      inputMode: s.inputMode,
      reset: s.reset,
      toggleItem: s.toggleItem,
      setQuantity: s.setQuantity,
      setMeal: s.setMeal,
      checkedMacroTotals: s.checkedMacroTotals,
      perItemScaledMacros: s.perItemScaledMacros,
    }))
  );

  const navigate = useNavigate();

  const totals = checkedMacroTotals();

  const hasCheckedItems = Object.values(selections).some(Boolean);
  const allCheckedQuantitiesValid = results.every(
    (_, i) => !selections[i] || (quantities[i] !== undefined && quantities[i] > 0)
  );
  const canAdd = !!selectedMeal && hasCheckedItems && allCheckedQuantitiesValid;

  async function handleAdd() {
    if (!canAdd || !selectedMeal) return;
    const addEntry = useDayStore.getState().addEntry;
    const checkedItems = results.map((item, i) => ({ item, i })).filter(({ i }) => selections[i]);

    let successCount = 0;
    for (const { item, i } of checkedItems) {
      const qty = quantities[i] ?? item.quantity;
      try {
        const per100 = scaleAiMacros(item, 100);
        const food = await createComposite(
          {
            id: generateId(),
            name: item.name,
            source: inputMode === "photo" ? "ai_photo" : "ai_list",
            caloriesPer100g: per100.kcal,
            proteinPer100g: per100.protein,
            carbsPer100g: per100.carbs,
            fatPer100g: per100.fat,
            servingSizeG: qty,
          },
          []
        );
        await addEntry(mapToNewMealEntry(item, qty, selectedMeal, food.id));
        successCount += 1;
      } catch {
        // Best-effort: skip this item and continue with the rest (D5).
      }
    }
    if (successCount > 0) {
      reset();
      void navigate("/");
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4 pb-8">
      {/* Meal selector */}
      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold text-gray-700">Comida *</p>
        <div className="flex flex-wrap gap-2">
          {MEAL_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setMeal(opt.value)}
              className={[
                "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                selectedMeal === opt.value
                  ? "border-accent bg-accent text-white"
                  : "border-gray-300 bg-white text-gray-700",
              ].join(" ")}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Items list */}
      <div className="flex flex-col gap-2">
        {results.map((item, i) => {
          const { highlight } = getConfidenceMeta(item.confidence);
          const qty = quantities[i] ?? item.quantity;
          const scaled = perItemScaledMacros(i);
          const isChecked = !!selections[i];
          const isInvalidQty = isChecked && (qty === undefined || qty <= 0);

          return (
            <div
              key={`${item.name}-${i}`}
              className={[
                "flex flex-col gap-2 rounded-2xl border p-4",
                highlight ? "border-amber-200 bg-amber-50" : "border-gray-200 bg-white",
              ].join(" ")}
            >
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggleItem(i)}
                  className="h-4 w-4 accent-accent"
                  id={`item-checkbox-${i}`}
                />
                <label htmlFor={`item-checkbox-${i}`} className="flex-1 font-medium text-gray-900">
                  {item.name}
                </label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0.1}
                  step={1}
                  value={qty}
                  onChange={(e) => setQuantity(i, Number.parseFloat(e.target.value))}
                  className={[
                    "w-20 rounded-lg border px-2 py-1 text-sm",
                    isInvalidQty ? "border-red-400" : "border-gray-300",
                  ].join(" ")}
                />
                <span className="text-sm text-gray-500">{item.unit}</span>
              </div>
              {isInvalidQty && (
                <p className="text-xs text-red-500">Introduce una cantidad válida</p>
              )}
              <div className="flex gap-3 text-xs text-gray-500">
                <span>{Math.round(scaled.kcal)} kcal</span>
                <span>P: {scaled.protein.toFixed(1)}g</span>
                <span>C: {scaled.carbs.toFixed(1)}g</span>
                <span>G: {scaled.fat.toFixed(1)}g</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Macro totals bar */}
      <div className="flex justify-between rounded-xl bg-gray-50 px-4 py-3 text-sm font-medium text-gray-700">
        <span>Total</span>
        <div className="flex gap-3">
          <span>{Math.round(totals.kcal)} kcal</span>
          <span>P: {totals.protein.toFixed(1)}g</span>
          <span>C: {totals.carbs.toFixed(1)}g</span>
          <span>G: {totals.fat.toFixed(1)}g</span>
        </div>
      </div>

      {/* CTAs */}
      <button
        type="button"
        onClick={() => void handleAdd()}
        disabled={!canAdd}
        className="w-full rounded-xl bg-accent py-3 text-sm font-semibold text-white transition-opacity disabled:opacity-50"
      >
        Añadir al diario
      </button>
      <button
        type="button"
        onClick={reset}
        className="w-full rounded-xl border border-gray-300 py-3 text-sm font-medium text-gray-700"
      >
        Cancelar
      </button>
    </div>
  );
}
