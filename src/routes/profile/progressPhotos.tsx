import { useProgressPhotoGallery } from "@/hooks/useProgressPhotoGallery";
import { PhotoLightbox } from "@/src/components/PhotoLightbox";
import { ChevronLeft } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

/**
 * Full-screen progress-photos gallery. Lives OUTSIDE TabLayout/ProfileLayout
 * (registered as a top-level route in src/router.tsx, mirroring the
 * portion/create-food escape pattern) so it owns its own back header instead
 * of inheriting the bottom tab bar or the profile RouteTabs header.
 *
 * Renders month-grouped thumbnail sections (most recent month first, driven
 * by useProgressPhotoGallery) and opens PhotoLightbox at the tapped item's
 * index within the gallery's full flattened chronological order — needed so
 * the lightbox's prev/next spans month boundaries, not just within a month
 * (spec: Gallery Route Rendering, Photo Detail / Lightbox Behavior).
 */
export function ProgressPhotosRoute() {
  const navigate = useNavigate();
  const { months, isLoading } = useProgressPhotoGallery();
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Flatten across months to give the lightbox one continuous chronological
  // order to navigate prev/next through (months render newest-first, so this
  // flattened order is also newest-first).
  const flatItems = useMemo(() => months.flatMap((month) => month.items), [months]);

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <div className="flex items-center gap-2 bg-white px-4 py-4 shadow-sm">
        <button
          type="button"
          aria-label="Volver"
          onClick={() => void navigate(-1)}
          className="flex h-8 w-8 items-center justify-center text-gray-700"
        >
          <ChevronLeft size={22} />
        </button>
        <h1 className="text-sm font-semibold text-gray-900">Fotos de progreso</h1>
      </div>

      <div className="px-4 py-4">
        {!isLoading && months.length === 0 && (
          <p className="pt-12 text-center text-sm text-gray-400">
            Aún no hay fotos de progreso
          </p>
        )}

        {months.map((month) => (
          <div key={month.key} className="mb-6">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
              {month.label}
            </h2>
            <div className="grid grid-cols-3 gap-2">
              {month.items.map((item) => {
                const flatIndex = flatItems.indexOf(item);
                return (
                  <button
                    key={item.photo.id}
                    type="button"
                    onClick={() => setLightboxIndex(flatIndex)}
                    className="aspect-square overflow-hidden rounded-xl bg-gray-200"
                  >
                    {/* biome-ignore lint/performance/noImgElement: local blob URL, not a remote/optimizable asset */}
                    <img
                      src={item.url}
                      alt={`Progreso ${item.entry.date}`}
                      className="h-full w-full object-cover"
                    />
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {lightboxIndex !== null && (
        <PhotoLightbox
          items={flatItems}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
        />
      )}
    </div>
  );
}
