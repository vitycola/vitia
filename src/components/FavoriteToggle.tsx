import { Heart } from "lucide-react";

interface FavoriteToggleProps {
  active: boolean;
  onToggle: () => void;
  disabled?: boolean;
  /** "header" (default, white on accent background) or "compact" (list row, amber accent). */
  variant?: "header" | "compact";
}

const VARIANT_STYLES: Record<
  NonNullable<FavoriteToggleProps["variant"]>,
  { button: string; icon: string; size: number }
> = {
  header: {
    button: "flex h-9 w-9 items-center justify-center rounded-full text-white",
    icon: "text-white",
    size: 20,
  },
  compact: {
    button: "flex h-6 w-6 items-center justify-center rounded-full text-amber-500",
    icon: "text-amber-500",
    size: 15,
  },
};

export function FavoriteToggle({
  active,
  onToggle,
  disabled = false,
  variant = "header",
}: FavoriteToggleProps) {
  const styles = VARIANT_STYLES[variant];
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-label={active ? "Quitar de favoritos" : "Añadir a favoritos"}
      aria-pressed={active}
      className={`${styles.button} transition-opacity hover:opacity-80 disabled:opacity-50`}
    >
      <Heart size={styles.size} fill={active ? "currentColor" : "none"} className={styles.icon} />
    </button>
  );
}
