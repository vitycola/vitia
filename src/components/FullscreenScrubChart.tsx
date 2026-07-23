import { useChartScrub } from "@/hooks/useChartScrub";
import { formatFullDayLabel } from "@/lib/date";
import type { ScrubSeriesPoint } from "@/lib/scrubChart";
import type { DashboardRange } from "@/stores/useProgressStore";
import { X } from "lucide-react";
import { useRef } from "react";

const TRACK_COLOR = "#E5E5EA";
const ACCENT_COLOR = "#F5A623";
const PRIMARY_TEXT_COLOR = "#1C1C1E";
const SECONDARY_TEXT_COLOR = "#8E8E93";

const VIEW_WIDTH = 100;
const VIEW_HEIGHT = 100;
const DOT_RADIUS = 3;

const RANGE_OPTIONS: { value: DashboardRange; label: string }[] = [
  { value: "week", label: "Semana" },
  { value: "month", label: "Mes" },
  { value: "3month", label: "3 meses" },
];

export interface FullscreenScrubChartProps {
  /** Dialog aria-label + heading; also used as the SVG's accessible name. */
  title: string;
  series: ScrubSeriesPoint[];
  renderState: "empty" | "single" | "line";
  unit: string;
  /** Metric-specific value formatting (e.g. 1-decimal for % Grasa). */
  formatValue: (value: number) => string;
  range: DashboardRange;
  onRangeChange: (range: DashboardRange) => void;
  onClose: () => void;
}

/**
 * Shared fullscreen scrub-detail chart (issue #63) reused by Weight/BodyFat/
 * Measurements via their thin *ScrubOverlay containers. Mirrors
 * `PhotoLightbox`'s fixed-overlay chrome conventions (role="dialog", single
 * X close, no back-chevron — see design "Header affordance"), but replaces
 * the previous bottom-sheet row list (`*HistoryOverlay`) with an in-view
 * range switcher, a fixed-position tooltip card, and a pointer-scrubbable
 * SVG line chart.
 *
 * `ScrubChartBody` is remounted via `key={range}` whenever the active range
 * changes, so `useChartScrub`'s internal activeIndex always resets to the
 * new series' default (last point) instead of carrying over a stale index
 * from the previous range's series (spec: "Switching range re-derives
 * points ... any active scrub state is cleared").
 */
export function FullscreenScrubChart({
  title,
  series,
  renderState,
  unit,
  formatValue,
  range,
  onRangeChange,
  onClose,
}: FullscreenScrubChartProps) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: custom full-screen modal, not a native <dialog>
    <div role="dialog" aria-label={title} className="fixed inset-0 z-50 flex flex-col bg-white">
      <div className="flex items-center justify-between px-4 pt-4">
        <h2 className="text-sm font-semibold" style={{ color: PRIMARY_TEXT_COLOR }}>
          {title}
        </h2>
        <button
          type="button"
          aria-label="Cerrar"
          onClick={onClose}
          className="p-1"
          style={{ color: SECONDARY_TEXT_COLOR }}
        >
          <X size={20} />
        </button>
      </div>

      <div className="mx-4 mt-3 flex gap-2 rounded-2xl bg-[#F2F2F7] p-1">
        {RANGE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onRangeChange(option.value)}
            className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
              range === option.value
                ? "bg-accent text-accent-foreground"
                : "text-gray-500 hover:bg-gray-50"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <ScrubChartBody
        key={range}
        title={title}
        series={series}
        renderState={renderState}
        unit={unit}
        formatValue={formatValue}
      />
    </div>
  );
}

interface ScrubChartBodyProps {
  title: string;
  series: ScrubSeriesPoint[];
  renderState: "empty" | "single" | "line";
  unit: string;
  formatValue: (value: number) => string;
}

/** Owns the `useChartScrub` instance — split out so `key={range}` on the parent forces a clean remount (and hook reset) on every range switch. */
function ScrubChartBody({ title, series, renderState, unit, formatValue }: ScrubChartBodyProps) {
  const plotRef = useRef<HTMLDivElement>(null);

  const { activeIndex, onPointerDown, onPointerMove, onPointerUp } = useChartScrub({
    series,
    getPlotRect: () => {
      const rect = plotRef.current?.getBoundingClientRect();
      return { left: rect?.left ?? 0, width: rect?.width ?? 0 };
    },
  });

  if (renderState === "empty") {
    return (
      <div className="flex flex-1 items-center justify-center px-4">
        <span className="text-[11px]" style={{ color: SECONDARY_TEXT_COLOR }}>
          Sin datos
        </span>
      </div>
    );
  }

  const activePoint = activeIndex !== null ? series[activeIndex] : null;

  return (
    <>
      <div className="px-4 pt-3">
        <div className="rounded-2xl bg-[#F2F2F7] p-3">
          <p className="text-xs" style={{ color: SECONDARY_TEXT_COLOR }}>
            {activePoint ? formatFullDayLabel(activePoint.date) : "Sin datos"}
          </p>
          {activePoint && (
            <p className="text-lg font-bold" style={{ color: PRIMARY_TEXT_COLOR }}>
              {formatValue(activePoint.value)} {unit}
            </p>
          )}
        </div>
      </div>

      <div className="flex-1 px-4 pb-8 pt-4">
        <div
          ref={plotRef}
          data-testid="scrub-plot"
          className="relative h-full touch-none"
          onPointerDown={(e) => onPointerDown({ clientX: e.clientX })}
          onPointerMove={(e) => onPointerMove({ clientX: e.clientX })}
          onPointerUp={onPointerUp}
        >
          <svg
            viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
            preserveAspectRatio="none"
            className="h-full w-full"
            role="img"
            aria-label={title}
          >
            {renderState === "line" && (
              <polyline
                data-testid="scrub-line"
                points={series
                  .map(
                    (p) => `${p.xFraction * VIEW_WIDTH},${VIEW_HEIGHT - p.yFraction * VIEW_HEIGHT}`
                  )
                  .join(" ")}
                fill="none"
                stroke={ACCENT_COLOR}
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
              />
            )}

            {renderState === "single" &&
              series.map((p) => (
                <circle
                  key={p.date}
                  data-testid="scrub-dot"
                  cx={p.xFraction * VIEW_WIDTH}
                  cy={VIEW_HEIGHT - p.yFraction * VIEW_HEIGHT}
                  r={DOT_RADIUS}
                  fill={ACCENT_COLOR}
                />
              ))}

            {renderState === "line" && activePoint && (
              <line
                data-testid="scrub-indicator"
                x1={activePoint.xFraction * VIEW_WIDTH}
                y1={0}
                x2={activePoint.xFraction * VIEW_WIDTH}
                y2={VIEW_HEIGHT}
                stroke={SECONDARY_TEXT_COLOR}
                strokeWidth={1}
                strokeDasharray="4 3"
                vectorEffect="non-scaling-stroke"
              />
            )}

            <line
              x1={0}
              y1={VIEW_HEIGHT}
              x2={VIEW_WIDTH}
              y2={VIEW_HEIGHT}
              stroke={TRACK_COLOR}
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        </div>
      </div>
    </>
  );
}
