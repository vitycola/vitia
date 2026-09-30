import { useCalorieDashboard } from "@/hooks/useCalorieDashboard";
import type { DashboardRange } from "@/lib/calorieDashboard";
import { formatNumber } from "@/lib/formatNumber";
import { useState } from "react";
import { CalorieBarChart } from "./CalorieBarChart";
import { CalorieHistoryOverlay } from "./CalorieHistoryOverlay";

interface CalorieDashboardCardProps {
  range: DashboardRange;
}

// Period-total label + average unit per range, per spec Amendment 1
// ("Calorias Card Stats Block"). Windows are rolling (resolveDashboardWindow:
// 7/30/90 days) and the average is over logged days only (imputedAverage),
// for every range — the labels must say exactly that.
const AVG_PER_LOGGED_DAY = "kcal/día registrado";
const CAPTION_BY_RANGE: Record<DashboardRange, { totalLabel: string; avgUnit: string }> = {
  week: { totalLabel: "total últimos 7 días", avgUnit: AVG_PER_LOGGED_DAY },
  month: { totalLabel: "total últimos 30 días", avgUnit: AVG_PER_LOGGED_DAY },
  "3month": { totalLabel: "total últimos 90 días", avgUnit: AVG_PER_LOGGED_DAY },
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
  const avgText = average === null ? "—" : formatNumber(average);

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="mb-3">
        <h3 className="text-sm font-medium text-gray-500">Calorías</h3>
      </div>

      <div className="mb-3">
        <p className="text-xl font-bold text-[#1C1C1E]">{formatNumber(total)}</p>
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
