import { Check, X } from "lucide-react";

interface CopyFromYesterdayBannerProps {
  count: number;
  busy: boolean;
  onAccept: () => void;
  onDismiss: () => void;
}

export function CopyFromYesterdayBanner({
  count,
  busy,
  onAccept,
  onDismiss,
}: CopyFromYesterdayBannerProps) {
  return (
    <div className="mx-4 mb-2 flex items-center justify-between rounded-lg border border-green-200 bg-green-50 px-3 py-2">
      <div>
        <p className="text-sm font-semibold text-green-800">¿Copiar de ayer?</p>
        <p className="text-xs text-green-600">
          {count} alimento{count !== 1 ? "s" : ""}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onAccept}
          disabled={busy}
          aria-label="Aceptar"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-700 hover:bg-green-200 disabled:opacity-50"
        >
          {busy ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-green-600 border-t-transparent" />
          ) : (
            <Check size={16} />
          )}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          disabled={busy}
          aria-label="Descartar"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-700 hover:bg-green-200 disabled:opacity-50"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
