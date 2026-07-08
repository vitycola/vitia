import { BODY_FAT_UNIT } from "@/lib/bodyFatDashboard";
import { formatFullDayLabel } from "@/lib/date";
import { X } from "lucide-react";

interface OverlayRow {
  date: string;
  value: number;
}

interface BodyFatHistoryOverlayProps {
  rows: OverlayRow[];
  onClose: () => void;
}

/**
 * Bottom-sheet overlay listing the historical logged-day body-fat % values,
 * mirroring WeightHistoryOverlay's chrome exactly. This list is SPARSE —
 * only days with an actual logged body-fat % value appear; unlogged days
 * are omitted entirely, never rendered as a zero/placeholder row. Rows are
 * rendered in the order given by the caller (descending date order per the
 * hook's overlayRows contract). View-only: no edit or delete affordance.
 */
export function BodyFatHistoryOverlay({ rows, onClose }: BodyFatHistoryOverlayProps) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: custom bottom-sheet modal, not a native <dialog>
    <div
      role="dialog"
      aria-label="Historial de % grasa"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
    >
      <div className="flex max-h-[80vh] w-full max-w-sm flex-col rounded-t-2xl bg-white p-4 sm:rounded-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Historial de % grasa</h2>
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
              <span className="text-gray-500">
                {row.value.toLocaleString("es-AR", { maximumFractionDigits: 1 })} {BODY_FAT_UNIT}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
