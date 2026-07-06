import { formatFullDayLabel } from "@/lib/date";
import { X } from "lucide-react";

interface OverlayRow {
  date: string;
  kcal: number;
}

interface CalorieHistoryOverlayProps {
  rows: OverlayRow[];
  onClose: () => void;
}

/**
 * Bottom-sheet overlay listing the historical daily kcal totals for the
 * window/granularity of whichever range was active when opened (spec:
 * "Historical Overlay Window Mapping"). Always daily rows, even for the
 * 3-Month range — never re-bucketed. Un-logged days show "0 kcal" — never
 * omitted — so row count always equals window size (7/30/90).
 */
export function CalorieHistoryOverlay({ rows, onClose }: CalorieHistoryOverlayProps) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: custom bottom-sheet modal, not a native <dialog>
    <div
      role="dialog"
      aria-label="Historial de calorías"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
    >
      <div className="flex max-h-[80vh] w-full max-w-sm flex-col rounded-t-2xl bg-white p-4 sm:rounded-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Historial de calorías</h2>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={onClose}
            className="p-1 text-[#C7C7CC]"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {rows.map((row) => (
            <div
              key={row.date}
              data-testid="overlay-row"
              className="flex items-center justify-between border-b border-gray-100 py-2 text-sm last:border-b-0"
            >
              <span className="text-gray-700">{formatFullDayLabel(row.date)}</span>
              <span className="text-gray-500">{Math.round(row.kcal).toLocaleString()} kcal</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
