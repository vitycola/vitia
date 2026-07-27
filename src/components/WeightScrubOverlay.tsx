import { useWeightDashboard } from "@/hooks/useWeightDashboard";
import { buildScrubSeries } from "@/lib/scrubChart";
import { WEIGHT_UNIT } from "@/lib/weightDashboard";
import type { DashboardRange } from "@/stores/useProgressStore";
import { useState } from "react";
import { FullscreenScrubChart } from "./FullscreenScrubChart";

interface WeightScrubOverlayProps {
  /** The range active on the originating WeightCard when it was tapped. */
  initialRange: DashboardRange;
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
 * Thin container: owns the in-overlay range switcher's local state
 * (`fsRange`, seeded from the card's active range) and calls the EXISTING
 * `useWeightDashboard(fsRange)` — mounted only while the overlay is open, so
 * there's no fetch when closed and switching range auto-refetches. Derives
 * the non-bucketed scrub series via `buildScrubSeries(points, window)`
 * (`points` is already sparse/per-day for every range — see
 * `lib/scrubChart.ts`), then renders the shared `FullscreenScrubChart`.
 */
export function WeightScrubOverlay({ initialRange, onClose }: WeightScrubOverlayProps) {
  const [fsRange, setFsRange] = useState<DashboardRange>(initialRange);

  const { points, window } = useWeightDashboard(fsRange);
  const series = buildScrubSeries(points, window);

  return (
    <FullscreenScrubChart
      title="Peso"
      series={series}
      renderState={renderStateFor(points.length)}
      unit={WEIGHT_UNIT}
      formatValue={formatValue}
      range={fsRange}
      onRangeChange={setFsRange}
      onClose={onClose}
    />
  );
}
