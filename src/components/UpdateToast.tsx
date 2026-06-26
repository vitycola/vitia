import { useRegisterSW } from "virtual:pwa-register/react";

/**
 * UpdateToast — shows a non-blocking banner when a new service worker is waiting.
 * The user can click "Actualizar" to skip the waiting SW and reload, or dismiss
 * the toast and update on the next natural reload.
 */
export function UpdateToast() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, _registration) {
      // SW registered — nothing extra needed here
    },
  });

  if (!needRefresh) return null;

  return (
    <output
      aria-live="polite"
      className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-xl bg-gray-900 px-4 py-3 text-sm text-white shadow-lg"
    >
      <span>Nueva versión disponible</span>
      <button
        type="button"
        onClick={() => void updateServiceWorker(true)}
        className="rounded-lg bg-accent px-3 py-1 font-medium text-white hover:bg-accent/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        Actualizar
      </button>
      <button
        type="button"
        aria-label="Cerrar aviso de actualización"
        onClick={() => setNeedRefresh(false)}
        className="text-gray-400 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
      >
        ✕
      </button>
    </output>
  );
}
