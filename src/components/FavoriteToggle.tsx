import { Heart } from "lucide-react";

interface FavoriteToggleProps {
  active: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

export function FavoriteToggle({ active, onToggle, disabled = false }: FavoriteToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-label={active ? "Quitar de favoritos" : "Añadir a favoritos"}
      aria-pressed={active}
      className="flex h-9 w-9 items-center justify-center rounded-full text-white transition-opacity hover:opacity-80 disabled:opacity-50"
    >
      <Heart size={20} fill={active ? "currentColor" : "none"} className="text-white" />
    </button>
  );
}
