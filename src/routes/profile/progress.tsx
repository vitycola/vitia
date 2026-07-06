import { todayISO } from "@/lib/date";
import { ProgressEntrySheet } from "@/src/components/ProgressEntrySheet";
import { EmptyStateCard } from "@/src/components/ui/EmptyStateCard";
import type { DashboardRange } from "@/stores/useProgressStore";
import { useProgressStore } from "@/stores/useProgressStore";
import { Flame, Percent, Plus, Ruler, Scale } from "lucide-react";
import { useEffect, useState } from "react";

const RANGE_OPTIONS: { value: DashboardRange; label: string }[] = [
  { value: "week", label: "Semana" },
  { value: "month", label: "Mes" },
  { value: "3month", label: "3 meses" },
];

/**
 * 2x2 empty-state dashboard shell plus the progress-log entry point. No
 * chart library or data model is introduced for the dashboard cards — each
 * shows a "Próximamente" placeholder. The segmented range filter only holds
 * UI state (spec: "Segmented range filter is UI-only") — it does not fetch
 * or render any chart/dashboard content.
 */
export function ProgressRoute() {
  const { current, selectedRange, setRange, loadByDate, saveEntry } = useProgressStore();
  const [sheetOpen, setSheetOpen] = useState(false);
  const today = todayISO();

  useEffect(() => {
    void loadByDate(today);
  }, [loadByDate, today]);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <EmptyStateCard title="Calorías" icon={<Flame size={24} />} />
        <EmptyStateCard title="Peso" icon={<Scale size={24} />} />
        <EmptyStateCard title="% Grasa" icon={<Percent size={24} />} />
        <EmptyStateCard title="Medidas" icon={<Ruler size={24} />} />
      </div>

      <div className="flex gap-2 rounded-2xl bg-white p-1 shadow-sm">
        {RANGE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setRange(option.value)}
            className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
              selectedRange === option.value
                ? "bg-accent text-accent-foreground"
                : "text-gray-500 hover:bg-gray-50"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-accent bg-white px-4 py-4 text-sm font-semibold text-accent"
      >
        <Plus size={18} />
        Añadir progreso
      </button>

      {sheetOpen && (
        <ProgressEntrySheet
          mode={current ? "edit" : "create"}
          initial={
            current
              ? {
                  weightKg: current.weightKg,
                  neckCm: current.neckCm,
                  waistCm: current.waistCm,
                  hipCm: current.hipCm,
                  notes: current.notes,
                }
              : undefined
          }
          onSave={async (input) => {
            await saveEntry({ date: today, ...input });
            setSheetOpen(false);
          }}
          onClose={() => setSheetOpen(false)}
        />
      )}
    </div>
  );
}
