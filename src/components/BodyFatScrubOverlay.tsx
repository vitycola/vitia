import { useBodyFatDashboard } from "@/hooks/useBodyFatDashboard";
import { BODY_FAT_UNIT } from "@/lib/bodyFatDashboard";
import { buildScrubSeries } from "@/lib/scrubChart";
import type { DashboardRange } from "@/stores/useProgressStore";
import { useState } from "react";
import { FullscreenScrubChart } from "./FullscreenScrubChart";

interface BodyFatScrubOverlayProps {
  /** The range active on the originating BodyFatCard when it was tapped. */
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
 * Thin container — mirrors WeightScrubOverlay: owns the in-overlay range
 * switcher's local state (`fsRange`, seeded from the card's active range)
 * and calls the EXISTING `useBodyFatDashboard(fsRange)`. Derives the
 * non-bucketed scrub series via `buildScrubSeries(points, window)` and
 * renders the shared `FullscreenScrubChart` with the % unit and 1-decimal
 * value formatting.
 */
export function BodyFatScrubOverlay({ initialRange, onClose }: BodyFatScrubOverlayProps) {
  const [fsRange, setFsRange] = useState<DashboardRange>(initialRange);

  const { points, window } = useBodyFatDashboard(fsRange);
  const series = buildScrubSeries(points, window);

  return (
    <FullscreenScrubChart
      title="% Grasa"
      series={series}
      renderState={renderStateFor(points.length)}
      unit={BODY_FAT_UNIT}
      formatValue={formatValue}
      range={fsRange}
      onRangeChange={setFsRange}
      onClose={onClose}
    />
  );
}
