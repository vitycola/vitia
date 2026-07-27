import { useMeasurementsDashboard } from "@/hooks/useMeasurementsDashboard";
import type { DashboardRange, MetricKey } from "@/lib/measurementsDashboard";
import { METRICS } from "@/lib/measurementsDashboard";
import { Check, ChevronDown } from "lucide-react";
import { useState } from "react";
import { MeasurementsLineChart } from "./MeasurementsLineChart";
import { MeasurementsScrubOverlay } from "./MeasurementsScrubOverlay";

interface MeasurementsCardProps {
  range: DashboardRange;
}

const DEFAULT_METRIC: MetricKey = "waistCm";

/**
 * Compact (1/3-width) Medidas dashboard tile. Mounted as the `children` of
 * `EmptyStateCard` (chart seam, SDD-3) with `title=""` — the card's
 * aspect-square/rounded/shadow shell already comes from `EmptyStateCard`,
 * so this component owns only the header (label + chevron metric-picker),
 * the line chart, and a stats caption, NOT the outer card frame.
 * Consumes useMeasurementsDashboard(range, metric). The whole card body
 * (everything except the chevron) is the tap target for the fullscreen
 * scrub chart (`MeasurementsScrubOverlay`), which is opened for the
 * currently-selected metric only — no field picker inside it (issue #63 —
 * replaces the previous list overlay). Metric selection is local component
 * state, not store state (spec: "Metric Picker Default and Field Mapping").
 */
export function MeasurementsCard({ range }: MeasurementsCardProps) {
  const [metric, setMetric] = useState<MetricKey>(DEFAULT_METRIC);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [overlayOpen, setOverlayOpen] = useState(false);

  const { linePoints, renderState, latest, delta, window } = useMeasurementsDashboard(
    range,
    metric
  );

  const activeMetric = METRICS.find((m) => m.key === metric) ?? METRICS[0];

  function openOverlay() {
    if (pickerOpen) {
      setPickerOpen(false);
      return;
    }
    setOverlayOpen(true);
  }

  function handleChevronClick(event: React.MouseEvent) {
    event.stopPropagation();
    setPickerOpen((open) => !open);
  }

  function handleSelectMetric(event: React.MouseEvent, key: MetricKey) {
    event.stopPropagation();
    setMetric(key);
    setPickerOpen(false);
  }

  const latestText =
    latest === null ? "—" : latest.toLocaleString("es-AR", { maximumFractionDigits: 1 });
  const deltaText =
    delta === null
      ? null
      : `${delta > 0 ? "+" : ""}${delta.toLocaleString("es-AR", { maximumFractionDigits: 1 })} desde inicio`;

  return (
    <>
      {/** biome-ignore lint/a11y/useSemanticElements: card root doubles as a tap target, chevron is its own real button */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Ver historial de medidas"
        onClick={openOverlay}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            openOverlay();
          }
        }}
        className="flex h-full w-full flex-col items-stretch text-left"
      >
        <button
          type="button"
          onClick={handleChevronClick}
          aria-label={`${activeMetric.label} - cambiar medida`}
          className="inline-flex h-8 min-h-8 w-fit min-w-8 items-center gap-1 text-xs font-medium text-[#8E8E93]"
        >
          {activeMetric.label}
          <ChevronDown size={14} />
        </button>

        {pickerOpen && (
          <div className="mt-1 flex flex-col">
            {METRICS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={(event) => handleSelectMetric(event, item.key)}
                className="flex w-full items-center justify-between py-1.5 text-left text-xs text-[#1C1C1E]"
              >
                {item.label}
                {item.key === metric && <Check size={12} color="#F5A623" />}
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-1 flex-col justify-center">
          <MeasurementsLineChart points={linePoints} renderState={renderState} window={window} />
        </div>

        <div>
          <p className="text-sm font-bold text-[#1C1C1E]">{latestText} cm</p>
          {deltaText && <p className="text-[11px] text-[#8E8E93]">{deltaText}</p>}
        </div>
      </div>

      {overlayOpen && (
        <MeasurementsScrubOverlay
          initialRange={range}
          metric={metric}
          onClose={() => setOverlayOpen(false)}
        />
      )}
    </>
  );
}
