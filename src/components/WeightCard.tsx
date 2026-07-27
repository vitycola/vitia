import { useWeightDashboard } from "@/hooks/useWeightDashboard";
import { WEIGHT_UNIT } from "@/lib/weightDashboard";
import type { DashboardRange } from "@/lib/weightDashboard";
import { useState } from "react";
import { WeightLineChart } from "./WeightLineChart";
import { WeightScrubOverlay } from "./WeightScrubOverlay";

interface WeightCardProps {
  range: DashboardRange;
}

/**
 * Compact (1/3-width) Peso dashboard tile. Mounted as the `children` of
 * `EmptyStateCard title="Peso"` — the card's aspect-square/rounded/shadow
 * shell and title both come from `EmptyStateCard`, so this component owns
 * only the chart and a stats caption, NOT the outer card frame and NOT a
 * label (unlike MeasurementsCard, which moved its label into the body to
 * host a chevron metric-picker — Peso has a single series and no picker).
 * Consumes useWeightDashboard(range). The whole card body is the tap target
 * for the fullscreen scrub chart (`WeightScrubOverlay`), initialized to this
 * card's active range (issue #63 — replaces the previous list overlay).
 */
export function WeightCard({ range }: WeightCardProps) {
  const [overlayOpen, setOverlayOpen] = useState(false);

  const { linePoints, renderState, latest, delta, window } = useWeightDashboard(range);

  const latestText =
    latest === null ? "—" : latest.toLocaleString("es-AR", { maximumFractionDigits: 1 });
  const deltaText =
    delta === null
      ? null
      : `${delta > 0 ? "+" : ""}${delta.toLocaleString("es-AR", { maximumFractionDigits: 1 })} desde inicio`;

  return (
    <>
      {/** biome-ignore lint/a11y/useSemanticElements: card root doubles as a tap target */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Ver historial de peso"
        onClick={() => setOverlayOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            setOverlayOpen(true);
          }
        }}
        className="flex h-full w-full flex-col items-stretch text-left"
      >
        <div className="flex flex-1 flex-col justify-center">
          <WeightLineChart points={linePoints} renderState={renderState} window={window} />
        </div>

        <div>
          <p className="text-sm font-bold text-[#1C1C1E]">
            {latestText} {WEIGHT_UNIT}
          </p>
          {deltaText && <p className="text-[11px] text-[#8E8E93]">{deltaText}</p>}
        </div>
      </div>

      {overlayOpen && (
        <WeightScrubOverlay initialRange={range} onClose={() => setOverlayOpen(false)} />
      )}
    </>
  );
}
