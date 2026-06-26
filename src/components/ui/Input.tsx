import type { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, id, className, ...rest }: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-primary">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`w-full rounded-xl border px-3 py-2.5 text-sm text-primary placeholder-disabled outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/20 ${
          error ? "border-red-400 focus:border-red-500 focus:ring-red-500/20" : "border-default"
        } ${className ?? ""}`}
        {...rest}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
