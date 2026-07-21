import { useAiAddFlowStore } from "@/stores/useAiAddFlowStore";
import { useShallow } from "zustand/shallow";
import { ConfidenceBadge } from "./ConfidenceBadge";

export function ResultsScreen() {
  const { results, goToConfirmation } = useAiAddFlowStore(
    useShallow((s) => ({ results: s.results, goToConfirmation: s.goToConfirmation }))
  );

  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 p-8 text-center">
        <span className="text-4xl">🔍</span>
        <p className="text-gray-600">
          No se han identificado alimentos. Prueba con otra foto o descripción.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Legend */}
      <div className="flex flex-wrap gap-2 rounded-xl bg-gray-50 p-3">
        <span className="text-xs text-gray-500 font-medium">Confianza:</span>
        {(["high", "medium", "low"] as const).map((c) => (
          <ConfidenceBadge key={c} confidence={c} />
        ))}
      </div>

      {/* Items */}
      <div className="flex flex-col gap-2">
        {results.map((item, i) => (
          <div
            key={`${item.name}-${i}`}
            className="flex flex-col gap-1 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold text-gray-900">{item.name}</p>
              <ConfidenceBadge confidence={item.confidence} />
            </div>
            <p className="text-xs text-gray-500">
              {item.quantity} {item.unit}
            </p>
            <div className="flex gap-3 text-xs text-gray-600">
              <span>{Math.round(item.kcal)} kcal</span>
              <span>P: {item.protein.toFixed(1)}g</span>
              <span>C: {item.carbs.toFixed(1)}g</span>
              <span>G: {item.fat.toFixed(1)}g</span>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={goToConfirmation}
        className="w-full rounded-xl bg-accent py-3 text-sm font-semibold text-white"
      >
        Revisar y confirmar
      </button>
    </div>
  );
}
