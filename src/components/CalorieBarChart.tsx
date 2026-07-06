import type { BarDatum } from "@/lib/calorieDashboard";

const TRACK_COLOR = "#E5E5EA";
const BAR_COLOR = "#F5A623";
const EMPTY_BAR_COLOR = "#E5E5EA";
const GOAL_LINE_COLOR = "#9CA3AF";

const CHART_HEIGHT_PX = 96;

interface CalorieBarChartProps {
  bars: BarDatum[];
  goalLine: number;
}

/**
 * Hand-rolled flex bar chart (no charting library) — mirrors CalorieCard's
 * arc-gauge approach. Bar count varies (7 | 30 | 3) and each bar is
 * `flex-1 min-w-0` so the chart handles any count fluidly and responsively.
 * A dashed goal-reference line overlays at the goal's proportional height.
 */
export function CalorieBarChart({ bars, goalLine }: CalorieBarChartProps) {
  const maxValue = Math.max(goalLine, ...bars.map((b) => b.kcal), 1);
  const goalLineTopPct = 100 - (goalLine / maxValue) * 100;

  return (
    <div className="relative" style={{ height: CHART_HEIGHT_PX }}>
      <div
        data-testid="calorie-goal-line"
        className="absolute left-0 right-0 border-t-2 border-dashed"
        style={{ top: `${goalLineTopPct}%`, borderColor: GOAL_LINE_COLOR }}
      />

      <div className="flex h-full items-end gap-px">
        {bars.map((bar) => {
          const heightPct = Math.max((bar.kcal / maxValue) * 100, bar.imputed ? 2 : 4);
          return (
            <div
              key={bar.key}
              data-testid="calorie-bar"
              data-imputed={bar.imputed}
              title={`${bar.label}: ${bar.imputed ? `${Math.round(bar.kcal)} kcal` : "sin datos"}`}
              className="min-w-0 flex-1 rounded-sm"
              style={{
                height: `${heightPct}%`,
                backgroundColor: bar.imputed ? BAR_COLOR : EMPTY_BAR_COLOR,
              }}
            />
          );
        })}
      </div>

      <div className="absolute inset-x-0 bottom-0 border-t" style={{ borderColor: TRACK_COLOR }} />
    </div>
  );
}
