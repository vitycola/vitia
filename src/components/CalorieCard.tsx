import { MoreHorizontal, Pencil } from "lucide-react";

// --- Arc geometry: wide shallow bow (like Fitia) ---
// The arc is a small section of a very large circle, spanning the card width.
// Circle center sits far below the SVG, producing a gentle upward bow.

const VW = 320; // viewBox width
const VH = 68; // viewBox height
const STROKE = 9;
const R = 310; // large radius → gentle curve
const PAD = 14; // horizontal padding from SVG edges
const Y_END = 52; // y-coordinate of arc endpoints

const X_LEFT = PAD;
const X_RIGHT = VW - PAD;
const HALF_CHORD = (X_RIGHT - X_LEFT) / 2;
const D = Math.sqrt(R * R - HALF_CHORD * HALF_CHORD); // dist from chord to center
const CX = VW / 2;
const CY = Y_END + D; // circle center (below SVG)

// Angles at left and right endpoints (radians, standard math)
const ANGLE_LEFT = Math.atan2(Y_END - CY, X_LEFT - CX);
const ANGLE_RIGHT = Math.atan2(Y_END - CY, X_RIGHT - CX);
const SWEEP_TOTAL = ANGLE_RIGHT - ANGLE_LEFT; // positive → CCW

function arcPoint(t: number): { x: number; y: number; angle: number } {
  const angle = ANGLE_LEFT + t * SWEEP_TOTAL;
  return { x: CX + R * Math.cos(angle), y: CY + R * Math.sin(angle), angle };
}

function svgArcPath(from: { x: number; y: number }, to: { x: number; y: number }): string {
  // sweep-flag=1 (CW in SVG Y-down coords) bows the arc upward
  return `M ${from.x.toFixed(2)} ${from.y.toFixed(2)} A ${R} ${R} 0 0 1 ${to.x.toFixed(2)} ${to.y.toFixed(2)}`;
}

const TRACK_COLOR = "#E5E5EA";
const PROGRESS_COLOR = "#F5A623";

// --- Exported helpers (kept for any tests that import them) ---
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
  const largeArcFlag = endAngle - startAngle <= 180 ? 0 : 1;
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;
}
export function describeTick(
  angleDeg: number,
  cx = 100,
  cy = 100,
  radius = 92,
  tickLen = 10
): { x1: number; y1: number; x2: number; y2: number } {
  const p = polarToCartesian(cx, cy, radius, angleDeg);
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x1: p.x - (tickLen / 2) * Math.cos(rad),
    y1: p.y - (tickLen / 2) * Math.sin(rad),
    x2: p.x + (tickLen / 2) * Math.cos(rad),
    y2: p.y + (tickLen / 2) * Math.sin(rad),
  };
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

function MacroColumn({ label, consumed, goal }: { label: string; consumed: number; goal: number }) {
  const pct = goal > 0 ? Math.min((consumed / goal) * 100, 100) : 0;
  return (
    <div className="flex flex-1 flex-col items-center gap-0.5 px-1">
      <span className="text-xs font-medium text-[#8E8E93]">{label}</span>
      <span className="text-sm text-[#1C1C1E]">
        {Math.round(consumed)}
        <span className="text-[#8E8E93]"> / {Math.round(goal)} g</span>
      </span>
      <div className="h-1.5 w-full rounded-full bg-[#E5E5EA]">
        <div className="h-full rounded-full bg-[#F5A623]" style={{ width: `${pct}%` }} />
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
  // Arc spans 0 → 2×goal; goal sits at t=0.5 (the visual peak/center).
  // Progress fills left-to-center proportionally.
  const fraction = goal > 0 ? Math.min(consumed / goal, 1) : 0;
  const progressT = fraction * 0.5;

  const trackStart = arcPoint(0);
  const trackEnd = arcPoint(1);
  const trackPath = svgArcPath(trackStart, trackEnd);

  const progressPath = progressT > 0 ? svgArcPath(trackStart, arcPoint(progressT)) : null;

  // Ticks at −10% (t=0.45) and +10% (t=0.55) of goal, centered on the arc peak
  const tickTs = [0.45, 0.55];
  const ticks = tickTs.map((t) => {
    const p = arcPoint(t);
    const TICK_H = 11;
    const cosA = Math.cos(p.angle);
    const sinA = Math.sin(p.angle);
    return {
      x1: p.x - (TICK_H / 2) * cosA,
      y1: p.y - (TICK_H / 2) * sinA,
      x2: p.x + (TICK_H / 2) * cosA,
      y2: p.y + (TICK_H / 2) * sinA,
      labelX: p.x,
      labelY: p.y + 10,
      anchor: t < 0.5 ? ("end" as const) : ("start" as const),
      kcal: Math.round(goal * (t < 0.5 ? 0.9 : 1.1)),
    };
  });

  return (
    <div className="mb-3 rounded-3xl bg-white px-4 py-4 shadow-sm">
      {/* Header row */}
      <div className="mb-1 flex items-center justify-between">
        <button type="button" aria-label="Edit calorie goal" className="p-1 text-[#C7C7CC]">
          <Pencil size={16} />
        </button>
        <div className="text-center">
          <p className="text-2xl font-bold text-[#1C1C1E]">
            {Math.round(consumed).toLocaleString()} / {Math.round(goal).toLocaleString()}
          </p>
          <p className="text-xs text-[#8E8E93]">kcal</p>
        </div>
        <button type="button" aria-label="More options" className="p-1 text-[#C7C7CC]">
          <MoreHorizontal size={16} />
        </button>
      </div>

      {/* Bow arc */}
      <svg width="100%" viewBox={`0 0 ${VW} ${VH}`} aria-hidden="true">
        {/* Track */}
        <path
          d={trackPath}
          fill="none"
          stroke={TRACK_COLOR}
          strokeWidth={STROKE}
          strokeLinecap="round"
        />
        {/* Progress */}
        {progressPath && (
          <path
            d={progressPath}
            fill="none"
            stroke={PROGRESS_COLOR}
            strokeWidth={STROKE}
            strokeLinecap="round"
          />
        )}
        {/* Tick marks + labels */}
        {ticks.map((tk) => (
          <g key={tk.kcal}>
            <line x1={tk.x1} y1={tk.y1} x2={tk.x2} y2={tk.y2} stroke="#9ca3af" strokeWidth={2} />
            <text
              x={tk.labelX}
              y={tk.labelY}
              textAnchor={tk.anchor}
              dominantBaseline="hanging"
              fontSize={9}
              fill="#9ca3af"
            >
              {tk.kcal.toLocaleString()}
            </text>
          </g>
        ))}
      </svg>

      {/* Macro columns */}
      <div className="mt-3 flex gap-2">
        <MacroColumn label="Proteínas" consumed={proteinG} goal={proteinGoalG} />
        <MacroColumn label="Carbs" consumed={carbsG} goal={carbsGoalG} />
        <MacroColumn label="Grasas" consumed={fatG} goal={fatGoalG} />
      </div>
    </div>
  );
}
