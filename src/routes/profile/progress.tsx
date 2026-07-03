import { EmptyStateCard } from "@/src/components/ui/EmptyStateCard";
import { PhotoStubCard } from "@/src/components/ui/PhotoStubCard";
import { Flame, Percent, Ruler, Scale } from "lucide-react";

/**
 * 2x2 empty-state dashboard shell. No chart library or data model is
 * introduced in this SDD — each card shows a "Próximamente" placeholder.
 * SDD-3 mounts a chart via EmptyStateCard's children slot without
 * changing this grid layout.
 */
export function ProgressRoute() {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <EmptyStateCard title="Calorías" icon={<Flame size={24} />} />
        <EmptyStateCard title="Peso" icon={<Scale size={24} />} />
        <EmptyStateCard title="% Grasa" icon={<Percent size={24} />} />
        <EmptyStateCard title="Medidas" icon={<Ruler size={24} />} />
      </div>

      <PhotoStubCard />
    </div>
  );
}
