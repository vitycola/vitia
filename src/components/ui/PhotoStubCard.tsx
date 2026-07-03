/**
 * Full-width inert stub for the progress-photo affordance (SDD-4 seam).
 * Intentionally exposes no `onClick` prop and is rendered `disabled` —
 * no file picker, network call, or storage write happens in this SDD.
 */
export function PhotoStubCard() {
  return (
    <button
      type="button"
      disabled
      className="flex w-full items-center justify-center rounded-2xl border border-accent bg-white px-4 py-4 text-sm font-semibold text-accent opacity-50"
    >
      Agregar foto de progreso — Próximamente
    </button>
  );
}
