import { buildLine, deltaFromFirst, latestValue, toPoints } from "../bodyFatDashboard";

type ProgressEntryRow = {
  date: string;
  bodyFatPct: number | null;
};

function row(date: string, overrides: Partial<ProgressEntryRow> = {}): ProgressEntryRow {
  return {
    date,
    bodyFatPct: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// toPoints
// ---------------------------------------------------------------------------

describe("toPoints", () => {
  it("keeps only rows where bodyFatPct is non-null (sparse)", () => {
    const rows: ProgressEntryRow[] = [
      row("2026-07-01", { bodyFatPct: 22.4 }),
      row("2026-07-02"),
      row("2026-07-03", { bodyFatPct: 21.1 }),
      row("2026-07-04"),
      row("2026-07-05"),
    ];

    const points = toPoints(rows);

    expect(points).toEqual([
      { date: "2026-07-01", value: 22.4 },
      { date: "2026-07-03", value: 21.1 },
    ]);
  });

  it("returns points in ascending date order", () => {
    const rows: ProgressEntryRow[] = [
      row("2026-07-03", { bodyFatPct: 21.1 }),
      row("2026-07-01", { bodyFatPct: 22.4 }),
    ];

    const points = toPoints(rows);

    expect(points.map((p) => p.date)).toEqual(["2026-07-01", "2026-07-03"]);
  });

  it("returns an empty array when no row has bodyFatPct logged", () => {
    const rows: ProgressEntryRow[] = [row("2026-07-01"), row("2026-07-02")];
    expect(toPoints(rows)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// buildLine — week/month (one LinePoint per logged point, not per calendar day)
// ---------------------------------------------------------------------------

describe("buildLine — week/month", () => {
  it("renderState 'empty' when zero points in window", () => {
    const line = buildLine("week", [], "2026-06-30", "2026-07-06");
    expect(line.renderState).toBe("empty");
    expect(line.points).toEqual([]);
  });

  it("renderState 'single' when exactly one point in window", () => {
    const points = [{ date: "2026-07-02", value: 22.4 }];
    const line = buildLine("month", points, "2026-06-07", "2026-07-06");
    expect(line.renderState).toBe("single");
    expect(line.points).toHaveLength(1);
  });

  it("renderState 'line' when two or more points, connecting only real points", () => {
    const points = [
      { date: "2026-07-01", value: 22.4 },
      { date: "2026-07-11", value: 21.9 },
      { date: "2026-07-21", value: 21.1 },
    ];
    const line = buildLine("month", points, "2026-06-22", "2026-07-21");
    expect(line.renderState).toBe("line");
    expect(line.points).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// buildLine — 3month carry-forward bucketing
// ---------------------------------------------------------------------------

describe("buildLine — 3month carry-forward bucketing", () => {
  it("bucket inherits the prior bucket's last value when it has zero logged points inside it", () => {
    // 90-day window: 2026-04-08..2026-07-06
    // bucket1 = 04-08..05-07, bucket2 = 05-08..06-06, bucket3 = 06-07..07-06
    const points = [{ date: "2026-04-23", value: 23.5 }]; // day -75 inside bucket1

    const line = buildLine("3month", points, "2026-04-08", "2026-07-06");

    expect(line.points).toHaveLength(3);
    expect(line.points[0].value).toBe(23.5);
    expect(line.points[1].value).toBe(23.5); // carried forward, not null
    expect(line.points[2].value).toBe(23.5); // still carried forward
  });

  it("leading buckets before the first-ever log stay null", () => {
    const points = [{ date: "2026-06-27", value: 20.0 }]; // within bucket 3

    const line = buildLine("3month", points, "2026-04-08", "2026-07-06");

    expect(line.points[0].value).toBeNull();
    expect(line.points[1].value).toBeNull();
    expect(line.points[2].value).toBe(20.0);
  });

  it("bucket value is the most recent point at/before bucket end, never averaged", () => {
    const points = [
      { date: "2026-06-17", value: 21.0 },
      { date: "2026-07-02", value: 20.2 },
    ];

    const line = buildLine("3month", points, "2026-04-08", "2026-07-06");

    // both points fall in bucket 3 (06-07..07-06)
    expect(line.points[2].value).toBe(20.2);
  });

  it("renderState is 'empty' when all 3 buckets are null", () => {
    const line = buildLine("3month", [], "2026-04-08", "2026-07-06");
    expect(line.renderState).toBe("empty");
  });

  it("renderState is 'single' when exactly one bucket is non-null", () => {
    const points = [{ date: "2026-06-27", value: 20.0 }];
    const line = buildLine("3month", points, "2026-04-08", "2026-07-06");
    expect(line.renderState).toBe("single");
  });

  it("renderState is 'line' when at least 2 buckets are non-null, omitting leading null buckets", () => {
    const points = [{ date: "2026-04-23", value: 23.5 }]; // bucket 1, carries into 2 and 3
    const line = buildLine("3month", points, "2026-04-08", "2026-07-06");
    expect(line.renderState).toBe("line");
    expect(line.points.every((p) => p.value !== null)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// latestValue / deltaFromFirst
// ---------------------------------------------------------------------------

describe("latestValue", () => {
  it("returns the last point's value", () => {
    const points = [
      { date: "2026-07-01", value: 22.4 },
      { date: "2026-07-03", value: 21.1 },
    ];
    expect(latestValue(points)).toBe(21.1);
  });

  it("returns null when there are no points", () => {
    expect(latestValue([])).toBeNull();
  });
});

describe("deltaFromFirst", () => {
  it("returns the difference between the last and first point's value", () => {
    const points = [
      { date: "2026-07-01", value: 22.4 },
      { date: "2026-07-03", value: 21.1 },
    ];
    expect(deltaFromFirst(points)).toBeCloseTo(-1.3);
  });

  it("returns null when there are fewer than 2 points", () => {
    expect(deltaFromFirst([])).toBeNull();
    expect(deltaFromFirst([{ date: "2026-07-01", value: 22.4 }])).toBeNull();
  });
});
