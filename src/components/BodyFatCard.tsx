import { useBodyFatDashboard } from "@/hooks/useBodyFatDashboard";
import { BODY_FAT_UNIT } from "@/lib/bodyFatDashboard";
import type { DashboardRange } from "@/lib/bodyFatDashboard";
import { useState } from "react";
import { BodyFatHistoryOverlay } from "./BodyFatHistoryOverlay";
import { BodyFatLineChart } from "./BodyFatLineChart";

interface BodyFatCardProps {
  range: DashboardRange;
}

/**
 * Compact (1/3-width) % Grasa dashboard tile. Mounted as the `children` of
 * `EmptyStateCard title="% Grasa"` — the card's aspect-square/rounded/shadow
 * shell and title both come from `EmptyStateCard`, so this component owns
 * only the chart and a stats caption, NOT the outer card frame and NOT a
 * label (unlike MeasurementsCard, which moved its label into the body to
 * host a chevron metric-picker — % Grasa has a single series and no
 * picker). Consumes useBodyFatDashboard(range). The whole card body is the
 * tap target for the historical overlay.
 */
export function BodyFatCard({ range }: BodyFatCardProps) {
  const [overlayOpen, setOverlayOpen] = useState(false);

  const { linePoints, renderState, overlayRows, latest, delta, window } =
    useBodyFatDashboard(range);

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
        aria-label="Ver historial de % grasa"
        onClick={() => setOverlayOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            setOverlayOpen(true);
          }
        }}
        className="flex h-full w-full flex-col items-stretch text-left"
      >
        <div className="flex flex-1 flex-col justify-center">
          <BodyFatLineChart points={linePoints} renderState={renderState} window={window} />
        </div>

        <div>
          <p className="text-sm font-bold text-[#1C1C1E]">
            {latestText} {BODY_FAT_UNIT}
          </p>
          {deltaText && <p className="text-[11px] text-[#8E8E93]">{deltaText}</p>}
        </div>
      </div>

      {overlayOpen && (
        <BodyFatHistoryOverlay rows={overlayRows} onClose={() => setOverlayOpen(false)} />
      )}
    </>
  );
}
