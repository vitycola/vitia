import { useProgressPhotoGallery } from "@/hooks/useProgressPhotoGallery";
import { formatFullDayLabel, todayISO } from "@/lib/date";
import { BodyFatCard } from "@/src/components/BodyFatCard";
import { CalorieDashboardCard } from "@/src/components/CalorieDashboardCard";
import { MeasurementsCard } from "@/src/components/MeasurementsCard";
import { ProgressEntrySheet } from "@/src/components/ProgressEntrySheet";
import { WeightCard } from "@/src/components/WeightCard";
import { EmptyStateCard } from "@/src/components/ui/EmptyStateCard";
import type { DashboardRange } from "@/stores/useProgressStore";
import { useProgressStore } from "@/stores/useProgressStore";
import { ChevronRight, Images, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

const RANGE_OPTIONS: { value: DashboardRange; label: string }[] = [
  { value: "week", label: "Semana" },
  { value: "month", label: "Mes" },
  { value: "3month", label: "3 meses" },
];

/**
 * Dashboard shell plus the progress-log entry point. Calorías renders
 * full-width, driven by `useCalorieDashboard` via `CalorieDashboardCard`,
 * above a 3-column Peso/%Grasa/Medidas row. Medidas renders as a live
 * compact tile (metric picker + line chart + sparse historical overlay)
 * driven by `useMeasurementsDashboard` via `MeasurementsCard`; Peso renders
 * as a live compact tile (line chart + sparse kg historical overlay, no
 * metric picker) driven by `useWeightDashboard` via `WeightCard`; % Grasa
 * renders as a live compact tile (line chart + sparse % historical
 * overlay, no metric picker) driven by `useBodyFatDashboard` via
 * `BodyFatCard`. The segmented range filter (`selectedRange`) drives the
 * Calorías, Peso, Medidas, and % Grasa chart/overlay windows.
 */
export function ProgressRoute() {
  const { current, selectedRange, setRange, loadByDate, saveEntry } = useProgressStore();
  const [sheetOpen, setSheetOpen] = useState(false);
  const today = todayISO();
  const navigate = useNavigate();
  const { months: photoMonths } = useProgressPhotoGallery();

  // Photo count + most recent upload date for the entry-point card, derived
  // from the same month-grouped VM the gallery route uses (months render
  // newest-first, so the first item of the first month is the most recent).
  const photoStats = useMemo(() => {
    const totalCount = photoMonths.reduce((sum, month) => sum + month.items.length, 0);
    const latestDate = photoMonths[0]?.items[0]?.entry.date ?? null;
    return { totalCount, latestDate };
  }, [photoMonths]);

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
        <EmptyStateCard title="Peso">
          <WeightCard range={selectedRange} />
        </EmptyStateCard>
        <EmptyStateCard title="% Grasa">
          <BodyFatCard range={selectedRange} />
        </EmptyStateCard>
        <EmptyStateCard title="">
          <MeasurementsCard range={selectedRange} />
        </EmptyStateCard>
      </div>

      {/* Fixed placement (spec: Entry-Point Card Placement and Content) —
          MUST remain the last element of the content column, after
          CalorieDashboardCard and the Peso/%Grasa/Medidas grid above. */}
      <button
        type="button"
        data-testid="photos-entry-card"
        onClick={() => navigate("/profile/progress/photos")}
        className="flex w-full items-center gap-3 rounded-2xl bg-white p-3 text-left shadow-sm"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500">
          <Images size={18} />
        </span>
        <span className="flex-1">
          <span className="block text-sm font-semibold text-gray-900">Fotos de progreso</span>
          {photoStats.totalCount > 0 && photoStats.latestDate ? (
            <span className="block text-xs text-gray-500">
              {photoStats.totalCount} {photoStats.totalCount === 1 ? "foto" : "fotos"} · última{" "}
              {formatFullDayLabel(photoStats.latestDate)}
            </span>
          ) : (
            <span className="block text-xs text-gray-400">Aún no hay fotos de progreso</span>
          )}
        </span>
        <ChevronRight size={18} className="shrink-0 text-gray-300" />
      </button>

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
