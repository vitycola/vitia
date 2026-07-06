import { useCalorieDashboard } from "@/hooks/useCalorieDashboard";
import type { DashboardRange } from "@/lib/calorieDashboard";
import { useState } from "react";
import { CalorieBarChart } from "./CalorieBarChart";
import { CalorieHistoryOverlay } from "./CalorieHistoryOverlay";

interface CalorieDashboardCardProps {
  range: DashboardRange;
}

/**
 * Full-width Calorías dashboard card. Consumes `useCalorieDashboard(range)`
 * and renders the bar chart + goal line + imputed-only average/total stats,
 * plus a trigger to open the historical day-list overlay for the same
 * window (spec: "Historical Overlay Window Mapping").
 */
export function CalorieDashboardCard({ range }: CalorieDashboardCardProps) {
  const { bars, average, total, goalLine, overlayRows } = useCalorieDashboard(range);
  const [overlayOpen, setOverlayOpen] = useState(false);

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Calorías</h3>
        <button
          type="button"
          onClick={() => setOverlayOpen(true)}
          className="text-xs font-medium text-accent"
        >
          Ver historial
        </button>
      </div>

      <div className="mb-3 flex items-baseline gap-4">
        <div>
          <p className="text-2xl font-bold text-[#1C1C1E]">
            {average === null ? "—" : Math.round(average).toLocaleString()}
          </p>
          <p className="text-xs text-[#8E8E93]">kcal/día promedio</p>
        </div>
        <div>
          <p className="text-sm text-[#1C1C1E]">{Math.round(total).toLocaleString()}</p>
          <p className="text-xs text-[#8E8E93]">total kcal</p>
        </div>
        <div>
          <p className="text-sm text-[#1C1C1E]">{Math.round(goalLine).toLocaleString()}</p>
          <p className="text-xs text-[#8E8E93]">meta kcal</p>
        </div>
      </div>

      <CalorieBarChart bars={bars} goalLine={goalLine} />

      {overlayOpen && (
        <CalorieHistoryOverlay rows={overlayRows} onClose={() => setOverlayOpen(false)} />
      )}
    </div>
  );
}
