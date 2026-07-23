import { useChartScrub } from "@/hooks/useChartScrub";
import { formatAxisDateLabel, formatFullDayLabel } from "@/lib/date";
import { pickAxisTicks } from "@/lib/scrubChart";
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

/** Horizontal edge alignment, shared by the axis tick labels and the inline
 * tooltip (see AMENDMENT — Inline on-chart tooltip / X-axis date tick
 * labels): a point/tick near the left or right chart edge flips its anchor
 * instead of centering, so its content never clips off-screen. */
type EdgeAlign = "start" | "center" | "end";

const EDGE_THRESHOLD = 0.15;

function resolveEdgeAlign(xFraction: number): EdgeAlign {
  if (xFraction <= EDGE_THRESHOLD) return "start";
  if (xFraction >= 1 - EDGE_THRESHOLD) return "end";
  return "center";
}

/** CSS `transform` that anchors an absolutely-positioned (`left: x%`) element per its edge alignment. */
function alignTransform(align: EdgeAlign): string {
  if (align === "start") return "translateX(0)";
  if (align === "end") return "translateX(-100%)";
  return "translateX(-50%)";
}

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
 * range switcher, a pointer-scrubbable SVG line chart with X-axis date tick
 * labels, and an inline tooltip anchored to the actively-scrubbed point.
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
  const axisTicks = renderState === "line" ? pickAxisTicks(series) : [];

  return (
    <div className="flex-1 px-4 pb-6 pt-4">
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

        {/*
         * Inline tooltip (AMENDMENT — Inline on-chart tooltip): anchored to
         * the active point's REAL xFraction/yFraction — the same geometry
         * driving the dashed indicator above — instead of a fixed DOM slot.
         * Rendered as an absolutely-positioned HTML child of this `relative`
         * plot container (not a `<foreignObject>`) so existing Tailwind
         * text/padding styling keeps working. Edge-clamped via
         * `resolveEdgeAlign` so it never clips off the left/right bounds.
         */}
        {activePoint && (
          <div
            data-testid="scrub-tooltip"
            className="absolute rounded-2xl bg-[#F2F2F7] p-3"
            style={{
              left: `${activePoint.xFraction * 100}%`,
              top: 8,
              transform: alignTransform(resolveEdgeAlign(activePoint.xFraction)),
            }}
          >
            <p className="text-xs whitespace-nowrap" style={{ color: SECONDARY_TEXT_COLOR }}>
              {formatFullDayLabel(activePoint.date)}
            </p>
            <p
              className="text-lg font-bold whitespace-nowrap"
              style={{ color: PRIMARY_TEXT_COLOR }}
            >
              {formatValue(activePoint.value)} {unit}
            </p>
          </div>
        )}
      </div>

      {/*
       * X-axis date tick labels (AMENDMENT — X-axis date tick labels):
       * rendered as HTML spans, NOT SVG <text> — the SVG above uses
       * `preserveAspectRatio="none"`, whose non-uniform stretch would
       * distort SVG text. A small fixed number of evenly-spaced ticks
       * (`pickAxisTicks`), never one per point. Guarded on renderState
       * === "line" only — no tick row for the empty/single states.
       */}
      {axisTicks.length > 0 && (
        <div className="relative mt-2 h-4">
          {axisTicks.map((index) => {
            const point = series[index];
            const align = resolveEdgeAlign(point.xFraction);
            return (
              <span
                key={point.date}
                data-testid="scrub-axis-tick"
                className="absolute top-0 text-[10px] whitespace-nowrap"
                style={{
                  left: `${point.xFraction * 100}%`,
                  transform: alignTransform(align),
                  textAlign: align === "start" ? "left" : align === "end" ? "right" : "center",
                  color: SECONDARY_TEXT_COLOR,
                }}
              >
                {formatAxisDateLabel(point.date)}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
