interface PlaceholderTabProps {
  label: string;
}

export function PlaceholderTab({ label }: PlaceholderTabProps) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <p className="mb-2 text-base font-semibold text-gray-700">{label}</p>
      <p className="mb-4 text-sm text-gray-400">Esta sección estará disponible pronto.</p>
      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
        Próximamente
      </span>
    </div>
  );
}
