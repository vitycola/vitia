import { useCalorieDashboard } from "@/hooks/useCalorieDashboard";
import type { DashboardRange } from "@/lib/calorieDashboard";
import { useState } from "react";
import { CalorieBarChart } from "./CalorieBarChart";
import { CalorieHistoryOverlay } from "./CalorieHistoryOverlay";

interface CalorieDashboardCardProps {
  range: DashboardRange;
}

// Period-total label + average unit per range, per spec Amendment 1
// ("Calorias Card Stats Block").
const CAPTION_BY_RANGE: Record<DashboardRange, { totalLabel: string; avgUnit: string }> = {
  week: { totalLabel: "total esta semana", avgUnit: "kcal prom/día" },
  month: { totalLabel: "total este mes", avgUnit: "kcal prom/día" },
  "3month": { totalLabel: "total últimos 3 meses", avgUnit: "kcal prom/mes" },
};

/**
 * Full-width Calorías dashboard card. Consumes `useCalorieDashboard(range)`
 * and renders the bar chart + goal line + a single grouped stats block
 * (period total + average caption), plus a "Ver historial" link below the
 * chart to open the historical day-list overlay for the same window (spec:
 * "Historical Overlay Window Mapping").
 */
export function CalorieDashboardCard({ range }: CalorieDashboardCardProps) {
  const { bars, average, total, goalLine, overlayRows } = useCalorieDashboard(range);
  const [overlayOpen, setOverlayOpen] = useState(false);

  const { totalLabel, avgUnit } = CAPTION_BY_RANGE[range];
  const avgText = average === null ? "—" : Math.round(average).toLocaleString("es-AR");

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="mb-3">
        <h3 className="text-sm font-medium text-gray-500">Calorías</h3>
      </div>

      <div className="mb-3">
        <p className="text-xl font-bold text-[#1C1C1E]">
          {Math.round(total).toLocaleString("es-AR")}
        </p>
        <p className="text-[11px] text-[#8E8E93]">
          {totalLabel} · {avgText} {avgUnit}
        </p>
      </div>

      <CalorieBarChart bars={bars} goalLine={goalLine} range={range} />

      <div className="mt-3 text-right">
        <button
          type="button"
          onClick={() => setOverlayOpen(true)}
          className="text-[11px] font-medium text-accent"
        >
          Ver historial
        </button>
      </div>

      {overlayOpen && (
        <CalorieHistoryOverlay rows={overlayRows} onClose={() => setOverlayOpen(false)} />
      )}
    </div>
  );
}
