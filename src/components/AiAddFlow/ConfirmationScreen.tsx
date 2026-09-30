import { createComposite } from "@/db/repos/foods";
import { getConfidenceMeta } from "@/lib/aiConfidence";
import { scaleAiMacros } from "@/lib/aiMacros";
import { groupResultsByMeal } from "@/lib/aiMealGroups";
import { MEAL_LABELS, MEAL_ORDER } from "@/lib/constants";
import { formatNumber } from "@/lib/formatNumber";
import { generateId } from "@/lib/id";
import { useAiAddFlowStore } from "@/stores/useAiAddFlowStore";
import { useDayStore } from "@/stores/useDayStore";
import type { MealType, NewMealEntry } from "@/types";
import type { AIFoodItem } from "@/types/aiFood";
import { Pencil } from "lucide-react";
import { useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useShallow } from "zustand/shallow";

const MEAL_OPTIONS = MEAL_ORDER.map((value) => ({ value, label: MEAL_LABELS[value] }));

function mapToNewMealEntry(
  item: AIFoodItem,
  qty: number,
  meal: MealType,
  foodId: string,
  date: string
): NewMealEntry {
  const scaled = scaleAiMacros(item, qty);
  return {
    id: generateId(),
    date,
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
  const quantityInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  const totals = checkedMacroTotals();

  const checkedCount = results.filter((_, i) => selections[i]).length;
  const hasCheckedItems = Object.values(selections).some(Boolean);
  const allCheckedQuantitiesValid = results.every(
    (_, i) => !selections[i] || (quantities[i] !== undefined && quantities[i] > 0)
  );
  const needsMealSelector = results.some((r) => !r.mealType);
  const canAdd =
    (!needsMealSelector || !!selectedMeal) && hasCheckedItems && allCheckedQuantitiesValid;

  async function handleAdd() {
    if (!canAdd) return;
    const { addEntry, selectedDate } = useDayStore.getState();
    const checkedItems = results.map((item, i) => ({ item, i })).filter(({ i }) => selections[i]);

    let successCount = 0;
    for (const { item, i } of checkedItems) {
      const meal = item.mealType ?? selectedMeal;
      if (!meal) continue;
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
        await addEntry(mapToNewMealEntry(item, qty, meal, food.id, selectedDate));
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
      {/* Meal selector: only needed for items without their own meal (photo results) */}
      {needsMealSelector && (
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
      )}

      {/* Items list, grouped by meal */}
      {groupResultsByMeal(results).map((group) => (
        <div key={group.mealType ?? "untagged"} className="flex flex-col gap-2">
          {group.label && <h3 className="text-base font-bold text-gray-900">{group.label}</h3>}
          {group.indices.map((i) => {
            const item = results[i];
            const { highlight } = getConfidenceMeta(item.confidence);
            const qty = quantities[i] ?? item.quantity;
            const scaled = perItemScaledMacros(i);
            const isChecked = !!selections[i];
            const isInvalidQty = isChecked && (qty === undefined || qty <= 0);

            return (
              <div
                key={`${item.name}-${i}`}
                data-selected={isChecked}
                className={[
                  "flex flex-col gap-2 rounded-2xl border p-4 transition-opacity",
                  isChecked ? "" : "opacity-50",
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
                  <label
                    htmlFor={`item-checkbox-${i}`}
                    className={[
                      "flex-1 font-medium text-gray-900",
                      isChecked ? "" : "line-through",
                    ].join(" ")}
                  >
                    {item.name}
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    ref={(el) => {
                      quantityInputRefs.current[i] = el;
                    }}
                    type="number"
                    min={0.1}
                    step="any"
                    value={qty}
                    onChange={(e) => setQuantity(i, Number.parseFloat(e.target.value))}
                    className={[
                      "w-20 rounded-lg border px-2 py-1 text-sm",
                      isInvalidQty ? "border-red-400" : "border-gray-300",
                    ].join(" ")}
                  />
                  <span className="text-sm text-gray-500">{item.unit}</span>
                  <button
                    type="button"
                    aria-label={`Editar cantidad de ${item.name}`}
                    onClick={() => quantityInputRefs.current[i]?.focus()}
                    className="rounded-full p-1.5 text-gray-500 transition-colors active:bg-gray-100"
                  >
                    <Pencil size={14} aria-hidden="true" />
                  </button>
                </div>
                {isInvalidQty && (
                  <p className="text-xs text-red-500">Introduce una cantidad válida</p>
                )}
                <div className="flex gap-3 text-xs text-gray-500">
                  <span>{Math.round(scaled.kcal)} kcal</span>
                  <span>
                    P:{" "}
                    {formatNumber(scaled.protein, { minFractionDigits: 1, maxFractionDigits: 1 })}g
                  </span>
                  <span>
                    C: {formatNumber(scaled.carbs, { minFractionDigits: 1, maxFractionDigits: 1 })}g
                  </span>
                  <span>
                    G: {formatNumber(scaled.fat, { minFractionDigits: 1, maxFractionDigits: 1 })}g
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ))}

      {/* Macro totals bar */}
      <div className="flex justify-between rounded-xl bg-gray-50 px-4 py-3 text-sm font-medium text-gray-700">
        <div className="flex flex-col">
          <span>Total</span>
          <span className="text-xs font-normal text-gray-500">
            {checkedCount} de {results.length} alimentos seleccionados
          </span>
        </div>
        <div className="flex gap-3">
          <span>{Math.round(totals.kcal)} kcal</span>
          <span>
            P: {formatNumber(totals.protein, { minFractionDigits: 1, maxFractionDigits: 1 })}g
          </span>
          <span>
            C: {formatNumber(totals.carbs, { minFractionDigits: 1, maxFractionDigits: 1 })}g
          </span>
          <span>
            G: {formatNumber(totals.fat, { minFractionDigits: 1, maxFractionDigits: 1 })}g
          </span>
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
