import { windowSpanDays } from "@/lib/measurementsDashboard";
import type { LinePoint, RenderState } from "@/lib/measurementsDashboard";

const TRACK_COLOR = "#E5E5EA";
const ACCENT_COLOR = "#F5A623";
const EMPTY_TEXT_COLOR = "#8E8E93";

const CHART_HEIGHT_PX = 72;
const VIEW_WIDTH = 100;
const VIEW_HEIGHT = 100;
const DOT_RADIUS = 3;

// ISO date format (YYYY-MM-DD) — used to distinguish week/month LinePoints
// (whose `key` is a real logged date) from 3-month bucket LinePoints (whose
// `key` is "bucket-{index}" and are already evenly spaced by construction).
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

interface MeasurementsLineChartProps {
  points: LinePoint[];
  renderState: RenderState;
  /**
   * The fetch window {from, to} for the active range. Required to compute
   * date-proportional X positions for week/month (date-keyed) points. Not
   * needed for 3-month bucket points, which are spaced by index since each
   * bucket already represents a uniform 30-day span.
   */
  window?: { from: string; to: string };
}

/**
 * Hand-rolled SVG line chart (no charting library) — mirrors CalorieBarChart's
 * no-library approach, but draws a line (not bars) connecting only real
 * logged points, with no goal line (no "goal" concept for measurements).
 * Three explicit render states: "empty" (no data), "single" (one dot, no
 * line), "line" (polyline connecting >=2 real points).
 *
 * X positions: week/month points (LinePoint.key is a real ISO date) are
 * spaced DATE-PROPORTIONALLY within the fetch window, so a longer gap
 * between logged days renders as a visually longer flat segment (the gap is
 * implicit in the slope, not annotated) — see design Decision 2. 3-month
 * bucket points (LinePoint.key is "bucket-{index}") are spaced by index,
 * which is already correct/equivalent since each bucket is a uniform
 * 30-day span by construction.
 */
export function MeasurementsLineChart({ points, renderState, window }: MeasurementsLineChartProps) {
  const drawable = points.filter((p) => p.value !== null) as (LinePoint & { value: number })[];

  if (renderState === "empty") {
    return (
      <div className="flex items-center justify-center" style={{ height: CHART_HEIGHT_PX }}>
        <span className="text-[11px]" style={{ color: EMPTY_TEXT_COLOR }}>
          Sin datos
        </span>
      </div>
    );
  }

  const values = drawable.map((p) => p.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = maxValue - minValue || 1;

  const isDateKeyed = drawable.length > 0 && ISO_DATE_RE.test(drawable[0].key);
  const spanDays = isDateKeyed && window ? windowSpanDays(window.from, window.to) : 0;

  const coords = drawable.map((p, index) => {
    let x: number;
    if (drawable.length === 1) {
      x = VIEW_WIDTH / 2;
    } else if (isDateKeyed && window) {
      const daysElapsed = windowSpanDays(window.from, p.key);
      x = (daysElapsed / spanDays) * VIEW_WIDTH;
    } else {
      // 3-month bucket points (index-keyed) — buckets are uniform-width by
      // construction, so index-based spacing is already correct here.
      x = (index / (drawable.length - 1)) * VIEW_WIDTH;
    }
    const y = VIEW_HEIGHT - ((p.value - minValue) / range) * VIEW_HEIGHT;
    return { x, y, key: p.key };
  });

  return (
    <div className="relative" style={{ height: CHART_HEIGHT_PX }}>
      <svg
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        preserveAspectRatio="none"
        className="h-full w-full"
        role="img"
        aria-label="Gráfico de medidas"
      >
        {renderState === "line" && (
          <polyline
            data-testid="measurements-line"
            points={coords.map((c) => `${c.x},${c.y}`).join(" ")}
            fill="none"
            stroke={ACCENT_COLOR}
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
          />
        )}

        {renderState === "single" &&
          coords.map((c) => (
            <circle
              key={c.key}
              data-testid="measurements-dot"
              cx={c.x}
              cy={c.y}
              r={DOT_RADIUS}
              fill={ACCENT_COLOR}
            />
          ))}

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
  );
}
