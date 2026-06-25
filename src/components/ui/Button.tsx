interface ButtonProps {
  title: string;
  loading?: boolean;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
}

const VARIANT_CLASSES: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary: "bg-green-600 text-white hover:bg-green-700 active:bg-green-800 disabled:bg-green-300",
  secondary:
    "bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-gray-300 disabled:bg-gray-100 disabled:text-gray-400",
  danger: "bg-red-600 text-white hover:bg-red-700 active:bg-red-800 disabled:bg-red-300",
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
