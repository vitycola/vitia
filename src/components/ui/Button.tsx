interface ButtonProps {
  title: string;
  loading?: boolean;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
}

const VARIANT_CLASSES: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary: "bg-accent text-white hover:bg-accent/90 active:bg-accent/80 disabled:bg-accent/50",
  secondary:
    "bg-surface text-primary hover:bg-gray-200 active:bg-gray-300 disabled:bg-surface disabled:text-disabled",
  danger: "bg-destructive text-white hover:bg-red-700 active:bg-red-800 disabled:bg-red-300",
};

export function Button({
  title,
  loading = false,
  variant = "primary",
  disabled = false,
  onClick,
  type = "button",
}: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`flex w-full items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${VARIANT_CLASSES[variant]}`}
    >
      {loading ? <span className="mr-2">…</span> : null}
      {title}
    </button>
  );
}
