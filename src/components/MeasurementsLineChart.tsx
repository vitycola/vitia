import type { LinePoint, RenderState } from "@/lib/measurementsDashboard";

const TRACK_COLOR = "#E5E5EA";
const ACCENT_COLOR = "#F5A623";
const EMPTY_TEXT_COLOR = "#8E8E93";

const CHART_HEIGHT_PX = 72;
const VIEW_WIDTH = 100;
const VIEW_HEIGHT = 100;
const DOT_RADIUS = 3;

interface MeasurementsLineChartProps {
  points: LinePoint[];
  renderState: RenderState;
}

/**
 * Hand-rolled SVG line chart (no charting library) — mirrors CalorieBarChart's
 * no-library approach, but draws a line (not bars) connecting only real
 * logged points, with no goal line (no "goal" concept for measurements).
 * Three explicit render states: "empty" (no data), "single" (one dot, no
 * line), "line" (polyline connecting >=2 real points). X positions are
 * spaced proportionally by index among the drawable (non-null) points —
 * there is no fabricated per-day cell.
 */
export function MeasurementsLineChart({ points, renderState }: MeasurementsLineChartProps) {
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

  const coords = drawable.map((p, index) => {
    const x = drawable.length === 1 ? VIEW_WIDTH / 2 : (index / (drawable.length - 1)) * VIEW_WIDTH;
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
