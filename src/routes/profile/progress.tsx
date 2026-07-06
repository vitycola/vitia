import { todayISO } from "@/lib/date";
import { CalorieDashboardCard } from "@/src/components/CalorieDashboardCard";
import { ProgressEntrySheet } from "@/src/components/ProgressEntrySheet";
import { EmptyStateCard } from "@/src/components/ui/EmptyStateCard";
import type { DashboardRange } from "@/stores/useProgressStore";
import { useProgressStore } from "@/stores/useProgressStore";
import { Percent, Plus, Ruler, Scale } from "lucide-react";
import { useEffect, useState } from "react";

const RANGE_OPTIONS: { value: DashboardRange; label: string }[] = [
  { value: "week", label: "Semana" },
  { value: "month", label: "Mes" },
  { value: "3month", label: "3 meses" },
];

/**
 * Dashboard shell plus the progress-log entry point. Calorías renders
 * full-width, driven by `useCalorieDashboard` via `CalorieDashboardCard`,
 * above a 3-column Peso/%Grasa/Medidas row that still shows "Próximamente"
 * empty-state placeholders (no data model for those 3 yet). The segmented
 * range filter (`selectedRange`) drives the Calorías chart/overlay window;
 * it remains inert for Peso/%Grasa/Medidas.
 */
export function ProgressRoute() {
  const { current, selectedRange, setRange, loadByDate, saveEntry } = useProgressStore();
  const [sheetOpen, setSheetOpen] = useState(false);
  const today = todayISO();

  useEffect(() => {
    void loadByDate(today);
  }, [loadByDate, today]);

  // Convert stored photo Blobs into object URLs for the sheet's thumbnail
  // preview (edit mode). Ownership of the created URLs — and their cleanup —
  // belongs here (the caller), not ProgressEntrySheet, which stays
  // presentational/stateless.
  const [existingPhotoUrls, setExistingPhotoUrls] = useState<{ id: string; url: string }[]>([]);

  useEffect(() => {
    const photos = current?.photos ?? [];
    const urls = photos.map((photo) => ({ id: photo.id, url: URL.createObjectURL(photo.blob) }));
    setExistingPhotoUrls(urls);

    return () => {
      for (const { url } of urls) {
        URL.revokeObjectURL(url);
      }
    };
  }, [current?.photos]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Añadir progreso"
          onClick={() => setSheetOpen(true)}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-accent bg-white text-accent"
        >
          <Plus size={18} />
        </button>

        <div className="flex flex-1 gap-2 rounded-2xl bg-white p-1 shadow-sm">
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
      </div>

      <CalorieDashboardCard range={selectedRange} />

      <div className="grid grid-cols-3 gap-3">
        <EmptyStateCard title="Peso" icon={<Scale size={24} />} />
        <EmptyStateCard title="% Grasa" icon={<Percent size={24} />} />
        <EmptyStateCard title="Medidas" icon={<Ruler size={24} />} />
      </div>

      {sheetOpen && (
        <ProgressEntrySheet
          mode={current ? "edit" : "create"}
          initial={
            current
              ? {
                  weightKg: current.weightKg,
                  neckCm: current.neckCm,
                  chestCm: current.chestCm,
                  armCm: current.armCm,
                  waistCm: current.waistCm,
                  hipCm: current.hipCm,
                  thighCm: current.thighCm,
                  notes: current.notes,
                }
              : undefined
          }
          existingPhotos={current ? existingPhotoUrls : undefined}
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
