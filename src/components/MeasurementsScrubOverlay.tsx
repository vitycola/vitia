import { useMeasurementsDashboard } from "@/hooks/useMeasurementsDashboard";
import type { MetricKey } from "@/lib/measurementsDashboard";
import { METRICS } from "@/lib/measurementsDashboard";
import { buildScrubSeries } from "@/lib/scrubChart";
import type { DashboardRange } from "@/stores/useProgressStore";
import { useState } from "react";
import { FullscreenScrubChart } from "./FullscreenScrubChart";

const MEASUREMENTS_UNIT = "cm";

interface MeasurementsScrubOverlayProps {
  /** The range active on the originating MeasurementsCard when it was tapped. */
  initialRange: DashboardRange;
  /** The field selected via the card's chevron picker — the overlay shows ONLY this field, no picker inside. */
  metric: MetricKey;
  onClose: () => void;
}

function renderStateFor(pointCount: number): "empty" | "single" | "line" {
  if (pointCount === 0) return "empty";
  if (pointCount === 1) return "single";
  return "line";
}

function formatValue(value: number): string {
  return value.toLocaleString("es-AR", { maximumFractionDigits: 1 });
}

/**
 * Thin container — mirrors WeightScrubOverlay/BodyFatScrubOverlay, but also
 * forwards the `metric` selected on the originating card's chevron picker:
 * the overlay shows only that single field's series and tooltip, with no
 * field picker inside it (spec: "Opening from Measurements card"). Owns the
 * in-overlay range switcher's local state (`fsRange`, seeded from the
 * card's active range) and calls the EXISTING
 * `useMeasurementsDashboard(fsRange, metric)`.
 */
export function MeasurementsScrubOverlay({
  initialRange,
  metric,
  onClose,
}: MeasurementsScrubOverlayProps) {
  const [fsRange, setFsRange] = useState<DashboardRange>(initialRange);

  const { points, window } = useMeasurementsDashboard(fsRange, metric);
  const series = buildScrubSeries(points, window);
  const activeMetric = METRICS.find((m) => m.key === metric) ?? METRICS[0];

  return (
    <FullscreenScrubChart
      title={activeMetric.label}
      series={series}
      renderState={renderStateFor(points.length)}
      unit={MEASUREMENTS_UNIT}
      formatValue={formatValue}
      range={fsRange}
      onRangeChange={setFsRange}
      onClose={onClose}
    />
  );
}
