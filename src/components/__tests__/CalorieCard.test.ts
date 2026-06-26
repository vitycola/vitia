import { describeArc, describeTick, polarToCartesian } from "../CalorieCard";

const FLOAT_TOLERANCE = 0.01;
const SIZE = 200;
const STROKE_WIDTH = 16;
const RADIUS = (SIZE - STROKE_WIDTH) / 2;
const CENTER = SIZE / 2;
const START_ANGLE = -225;
const SWEEP = 270;

function approx(a: number, b: number) {
  return Math.abs(a - b) < FLOAT_TOLERANCE;
}

describe("polarToCartesian", () => {
  it("0° maps to (cx+r, cy)", () => {
    const { x, y } = polarToCartesian(CENTER, CENTER, RADIUS, 0);
    expect(approx(x, CENTER + RADIUS)).toBe(true);
    expect(approx(y, CENTER)).toBe(true);
  });

  it("90° maps to (cx, cy+r)", () => {
    const { x, y } = polarToCartesian(CENTER, CENTER, RADIUS, 90);
    expect(approx(x, CENTER)).toBe(true);
    expect(approx(y, CENTER + RADIUS)).toBe(true);
  });

  it("-90° maps to (cx, cy-r)", () => {
    const { x, y } = polarToCartesian(CENTER, CENTER, RADIUS, -90);
    expect(approx(x, CENTER)).toBe(true);
    expect(approx(y, CENTER - RADIUS)).toBe(true);
  });
});

describe("fraction and progressEndAngle", () => {
  function calcFraction(consumed: number, goal: number) {
    return goal > 0 ? Math.min(consumed / goal, 1) : 0;
  }

  it("consumed=0 → fraction=0", () => {
    expect(calcFraction(0, 2000)).toBe(0);
  });

  it("consumed=goal → fraction=1", () => {
    expect(calcFraction(2000, 2000)).toBe(1);
  });

  it("consumed=2×goal → fraction clamped to 1", () => {
    expect(calcFraction(4000, 2000)).toBe(1);
  });

  it("goal=0 → fraction=0 (no division by zero)", () => {
    expect(calcFraction(500, 0)).toBe(0);
  });

  it("fraction=0.7 → progressEndAngle=-36", () => {
    const fraction = calcFraction(1400, 2000);
    const progressEndAngle = START_ANGLE + SWEEP * fraction;
    expect(approx(progressEndAngle, -36)).toBe(true);
  });
});

describe("over-target detection", () => {
  it("consumed > goal → overTarget=true", () => {
    const consumed = 2500;
    const goal = 2000;
    expect(consumed > goal).toBe(true);
  });

  it("consumed = goal → overTarget=false", () => {
    const consumed = 2000;
    const goal = 2000;
    expect(consumed > goal).toBe(false);
  });
});

describe("tick angles", () => {
  it("tick at 0.9 fraction → 18°", () => {
    const angle = START_ANGLE + SWEEP * Math.min(0.9, 1);
    expect(approx(angle, -225 + 0.9 * 270)).toBe(true); // 18°
  });

  it("tick at 1.1 fraction caps at sweep end → 45°", () => {
    const angle = START_ANGLE + SWEEP * Math.min(1.1, 1);
    expect(approx(angle, -225 + 270)).toBe(true); // 45°
  });
});

describe("describeArc", () => {
  it("270° sweep → largeArcFlag=1 in path string", () => {
    const path = describeArc(CENTER, CENTER, RADIUS, START_ANGLE, START_ANGLE + SWEEP);
    expect(path).toContain(" 1 1 ");
  });

  it("90° sweep → largeArcFlag=0 in path string", () => {
    const path = describeArc(CENTER, CENTER, RADIUS, 0, 90);
    expect(path).toContain(" 0 1 ");
  });

  it("starts with M", () => {
    const path = describeArc(CENTER, CENTER, RADIUS, START_ANGLE, START_ANGLE + SWEEP);
    expect(path.startsWith("M ")).toBe(true);
  });
});

describe("describeTick", () => {
  it("returns 4 numeric coordinates", () => {
    const tick = describeTick(0);
    expect(typeof tick.x1).toBe("number");
    expect(typeof tick.y1).toBe("number");
    expect(typeof tick.x2).toBe("number");
    expect(typeof tick.y2).toBe("number");
  });

  it("tick at 0° — x1 < x2 (outer is further right)", () => {
    const tick = describeTick(0);
    expect(tick.x2).toBeGreaterThan(tick.x1);
  });
});
