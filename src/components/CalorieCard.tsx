const SIZE = 200;
const STROKE_WIDTH = 16;
const START_ANGLE = -225;
const SWEEP = 270;
const RADIUS = (SIZE - STROKE_WIDTH) / 2;
const CENTER = SIZE / 2;
const TICK_LEN = 10;

const TRACK_COLOR = "#e5e7eb";
const NORMAL_COLOR = "#22c55e";
const OVER_TARGET_COLOR = "#f59e0b";

export function polarToCartesian(
  cx: number,
  cy: number,
  radius: number,
  angleDeg: number
): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
}

export function describeArc(
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number
): string {
  const start = polarToCartesian(cx, cy, radius, startAngle);
  const end = polarToCartesian(cx, cy, radius, endAngle);
  const sweep = endAngle - startAngle;
  const largeArcFlag = sweep <= 180 ? 0 : 1;
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;
}

export function describeTick(angle: number): { x1: number; y1: number; x2: number; y2: number } {
  const inner = polarToCartesian(CENTER, CENTER, RADIUS - TICK_LEN / 2, angle);
  const outer = polarToCartesian(CENTER, CENTER, RADIUS + TICK_LEN / 2, angle);
  return { x1: inner.x, y1: inner.y, x2: outer.x, y2: outer.y };
}

interface CalorieCardProps {
  consumed: number;
  goal: number;
  proteinG: number;
  proteinGoalG: number;
  carbsG: number;
  carbsGoalG: number;
  fatG: number;
  fatGoalG: number;
}

function MacroRow({
  label,
  consumed,
  goal,
  color,
}: {
  label: string;
  consumed: number;
  goal: number;
  color: string;
}) {
  const pct = goal > 0 ? Math.min((consumed / goal) * 100, 100) : 0;
  return (
    <div className="mb-2 w-full">
      <div className="mb-1 flex justify-between text-xs text-gray-600">
        <span>{label}</span>
        <span>
          {Math.round(consumed)}g / {Math.round(goal)}g
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-gray-200">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

export function CalorieCard({
  consumed,
  goal,
  proteinG,
  proteinGoalG,
  carbsG,
  carbsGoalG,
  fatG,
  fatGoalG,
}: CalorieCardProps) {
  const fraction = goal > 0 ? Math.min(consumed / goal, 1) : 0;
  const progressEndAngle = START_ANGLE + SWEEP * fraction;
  const overTarget = consumed > goal;
  const progressColor = overTarget ? OVER_TARGET_COLOR : NORMAL_COLOR;

  const tickAngles = [0.9, 1.1].map((f) => START_ANGLE + SWEEP * Math.min(f, 1));

  const trackPath = describeArc(CENTER, CENTER, RADIUS, START_ANGLE, START_ANGLE + SWEEP);
  const progressPath =
    fraction > 0 ? describeArc(CENTER, CENTER, RADIUS, START_ANGLE, progressEndAngle) : null;

  return (
    <div className="mx-4 mb-3 rounded-2xl bg-white px-4 py-5 shadow-sm">
      <div className="flex flex-col items-center">
        <div className="relative" style={{ width: SIZE, height: SIZE }}>
          <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
            <path
              d={trackPath}
              fill="none"
              stroke={TRACK_COLOR}
              strokeWidth={STROKE_WIDTH}
              strokeLinecap="round"
            />
            {progressPath && (
              <path
                d={progressPath}
                fill="none"
                stroke={progressColor}
                strokeWidth={STROKE_WIDTH}
                strokeLinecap="round"
              />
            )}
            {tickAngles.map((angle) => {
              const t = describeTick(angle);
              return (
                <line
                  key={angle}
                  x1={t.x1}
                  y1={t.y1}
                  x2={t.x2}
                  y2={t.y2}
                  stroke="#9ca3af"
                  strokeWidth={2}
                />
              );
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-gray-900">{Math.round(consumed)}</span>
            <span className="text-xs text-gray-500">de {Math.round(goal)} kcal</span>
          </div>
        </div>

        <div className="mt-4 w-full">
          <MacroRow label="Proteínas" consumed={proteinG} goal={proteinGoalG} color="#3b82f6" />
          <MacroRow label="Carbs" consumed={carbsG} goal={carbsGoalG} color="#f97316" />
          <MacroRow label="Grasas" consumed={fatG} goal={fatGoalG} color="#eab308" />
        </div>

        <button
          type="button"
          className="mt-4 rounded-xl bg-gray-100 px-6 py-2 text-sm font-medium text-gray-700"
        >
          Terminar Día
        </button>
      </div>
    </div>
  );
}
