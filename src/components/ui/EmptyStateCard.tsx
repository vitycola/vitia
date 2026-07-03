import type { ReactNode } from "react";

interface EmptyStateCardProps {
  title: string;
  icon?: string;
  /**
   * Chart seam (SDD-3): a future chart can be mounted here without
   * changing the card's grid/empty-state layout contract.
   */
  children?: ReactNode;
}

/**
 * Square dashboard card. Shows an empty ("Próximamente") state by default;
 * pass `children` to render real content (e.g. a chart) in its place.
 */
export function EmptyStateCard({ title, icon, children }: EmptyStateCardProps) {
  return (
    <div className="flex aspect-square flex-col rounded-2xl bg-white p-3 shadow-sm">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</h3>
      <div className="flex flex-1 flex-col items-center justify-center gap-1 text-center">
        {children ?? (
          <>
            {icon && <span className="text-2xl leading-none">{icon}</span>}
            <span className="text-xs text-gray-400">Próximamente</span>
          </>
        )}
      </div>
    </div>
  );
}
