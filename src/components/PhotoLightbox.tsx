import type { GalleryItem } from "@/hooks/useProgressPhotoGallery";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

interface PhotoLightboxProps {
  /** The gallery's full chronological photo order (across all months). */
  items: GalleryItem[];
  /** Index of the currently displayed item within `items`. */
  index: number;
  onClose: () => void;
  /** Called with the target index when the prev/next chevron is tapped. */
  onNavigate: (index: number) => void;
}

/** Renders a stat cell value, falling back to an em-dash when the metric was not logged that day. */
function StatCell({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-xs uppercase tracking-wide text-white/60">{label}</span>
      <span className="text-sm font-semibold text-white">{value ?? "—"}</span>
    </div>
  );
}

/**
 * Full-screen photo detail dialog. Mirrors WeightHistoryOverlay's chrome
 * conventions (role="dialog", fixed inset-0 z-50, dark overlay) but as a
 * full-bleed black lightbox rather than a bottom sheet: full photo + a dark
 * rounded 3-column stats panel (Peso / % Grasa / Cintura) for that photo's
 * entry date, with prev/next chevron navigation across the gallery's full
 * chronological order (spec: Photo Detail / Lightbox Behavior).
 *
 * Each stat field independently degrades to "—" when its value was not
 * logged that day — never renders `undefined`/`NaN`, never throws, even
 * when all three fields are null (photo-only day is a valid state).
 */
export function PhotoLightbox({ items, index, onClose, onNavigate }: PhotoLightboxProps) {
  const item = items[index];
  if (!item) return null;

  const { entry, url } = item;
  const hasPrev = index > 0;
  const hasNext = index < items.length - 1;

  const weightLabel = entry.weightKg != null ? `${entry.weightKg} kg` : null;
  const bodyFatLabel = entry.bodyFatPct != null ? `${entry.bodyFatPct.toFixed(1)} %` : null;
  const waistLabel = entry.waistCm != null ? `${entry.waistCm} cm` : null;

  return (
    // biome-ignore lint/a11y/useSemanticElements: custom full-screen modal, not a native <dialog>
    <div role="dialog" aria-label="Foto de progreso" className="fixed inset-0 z-50 bg-black/80">
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onClose}
        className="absolute right-4 top-4 z-10 p-1 text-white/80 hover:text-white"
      >
        <X size={22} />
      </button>

      {hasPrev && (
        <button
          type="button"
          aria-label="Anterior"
          onClick={() => onNavigate(index - 1)}
          className="absolute left-2 top-1/2 z-10 -translate-y-1/2 p-2 text-white/80 hover:text-white"
        >
          <ChevronLeft size={28} />
        </button>
      )}

      {hasNext && (
        <button
          type="button"
          aria-label="Siguiente"
          onClick={() => onNavigate(index + 1)}
          className="absolute right-2 top-1/2 z-10 -translate-y-1/2 p-2 text-white/80 hover:text-white"
        >
          <ChevronRight size={28} />
        </button>
      )}

      <div className="flex h-full flex-col items-center justify-center gap-4 px-4 py-8">
        <img
          src={url}
          alt={`Progreso ${entry.date}`}
          className="max-h-[70vh] max-w-full rounded-xl object-contain"
        />

        <div className="grid w-full max-w-sm grid-cols-3 gap-2 rounded-2xl bg-black/40 p-4">
          <StatCell label="Peso" value={weightLabel} />
          <StatCell label="% Grasa" value={bodyFatLabel} />
          <StatCell label="Cintura" value={waistLabel} />
        </div>
      </div>
    </div>
  );
}
