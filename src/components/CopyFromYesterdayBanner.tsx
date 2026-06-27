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
    <div className="mx-4 mb-2 flex items-center justify-between rounded-lg border border-[#E5E5EA] bg-surface px-3 py-2">
      <div>
        <p className="text-sm font-semibold text-[#1C1C1E]">¿Copiar de ayer?</p>
        <p className="text-xs text-[#8E8E93]">
          {count} alimento{count !== 1 ? "s" : ""}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onAccept}
          disabled={busy}
          aria-label="Aceptar"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-accent-foreground hover:opacity-90 disabled:opacity-50"
        >
          {busy ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent-foreground border-t-transparent" />
          ) : (
            <Check size={16} />
          )}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          disabled={busy}
          aria-label="Descartar"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-[#E5E5EA] text-[#8E8E93] hover:opacity-80 disabled:opacity-50"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
