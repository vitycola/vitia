import {
  METRICS,
  buildLine,
  buildOverlayRows,
  deltaFromFirst,
  latestValue,
  toPoints,
} from "../measurementsDashboard";

type ProgressEntryRow = {
  date: string;
  waistCm: number | null;
  hipCm: number | null;
  neckCm: number | null;
  chestCm: number | null;
  armCm: number | null;
  thighCm: number | null;
};

function row(date: string, overrides: Partial<ProgressEntryRow> = {}): ProgressEntryRow {
  return {
    date,
    waistCm: null,
    hipCm: null,
    neckCm: null,
    chestCm: null,
    armCm: null,
    thighCm: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// METRICS
// ---------------------------------------------------------------------------

describe("METRICS", () => {
  it("lists the 6 metrics in the exact order and mapping from spec", () => {
    expect(METRICS).toEqual([
      { key: "waistCm", label: "Cintura" },
      { key: "hipCm", label: "Cadera" },
      { key: "neckCm", label: "Cuello" },
      { key: "chestCm", label: "Pecho" },
      { key: "armCm", label: "Brazo" },
      { key: "thighCm", label: "Muslo" },
    ]);
  });
});

// ---------------------------------------------------------------------------
// toPoints
// ---------------------------------------------------------------------------

describe("toPoints", () => {
  it("keeps only rows where the active metric's field is non-null (sparse)", () => {
    const rows: ProgressEntryRow[] = [
      row("2026-07-01", { waistCm: 90 }),
      row("2026-07-02"),
      row("2026-07-03", { waistCm: 89 }),
      row("2026-07-04"),
      row("2026-07-05"),
    ];

    const points = toPoints(rows, "waistCm");

    expect(points).toEqual([
      { date: "2026-07-01", value: 90 },
      { date: "2026-07-03", value: 89 },
    ]);
  });

  it("returns points in ascending date order", () => {
    const rows: ProgressEntryRow[] = [
      row("2026-07-03", { waistCm: 89 }),
      row("2026-07-01", { waistCm: 90 }),
    ];

    const points = toPoints(rows, "waistCm");

    expect(points.map((p) => p.date)).toEqual(["2026-07-01", "2026-07-03"]);
  });

  it("refilters the same entries for a different metric", () => {
    const rows: ProgressEntryRow[] = [
      row("2026-07-01", { waistCm: 90, hipCm: 100 }),
      row("2026-07-02", { hipCm: 101 }),
    ];

    expect(toPoints(rows, "waistCm")).toEqual([{ date: "2026-07-01", value: 90 }]);
    expect(toPoints(rows, "hipCm")).toEqual([
      { date: "2026-07-01", value: 100 },
      { date: "2026-07-02", value: 101 },
    ]);
  });

  it("returns an empty array when no row has the active metric logged", () => {
    const rows: ProgressEntryRow[] = [row("2026-07-01"), row("2026-07-02")];
    expect(toPoints(rows, "waistCm")).toEqual([]);
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
    const points = [{ date: "2026-07-02", value: 90 }];
    const line = buildLine("month", points, "2026-06-07", "2026-07-06");
    expect(line.renderState).toBe("single");
    expect(line.points).toHaveLength(1);
  });

  it("renderState 'line' when two or more points, connecting only real points", () => {
    const points = [
      { date: "2026-07-01", value: 90 },
      { date: "2026-07-11", value: 89 },
      { date: "2026-07-21", value: 88 },
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
    const points = [{ date: "2026-04-23", value: 91 }]; // day -75 inside bucket1

    const line = buildLine("3month", points, "2026-04-08", "2026-07-06");

    expect(line.points).toHaveLength(3);
    expect(line.points[0].value).toBe(91);
    expect(line.points[1].value).toBe(91); // carried forward, not null
    expect(line.points[2].value).toBe(91); // still carried forward
  });

  it("leading buckets before the first-ever log stay null", () => {
    const points = [{ date: "2026-06-27", value: 80 }]; // within bucket 3 (day -10 from 07-06... approx)

    const line = buildLine("3month", points, "2026-04-08", "2026-07-06");

    expect(line.points[0].value).toBeNull();
    expect(line.points[1].value).toBeNull();
    expect(line.points[2].value).toBe(80);
  });

  it("bucket value is the most recent point at/before bucket end, never averaged", () => {
    const points = [
      { date: "2026-06-17", value: 90.0 },
      { date: "2026-07-02", value: 89.0 },
    ];

    const line = buildLine("3month", points, "2026-04-08", "2026-07-06");

    // both points fall in bucket 3 (06-07..07-06)
    expect(line.points[2].value).toBe(89.0);
  });

  it("renderState is 'empty' when all 3 buckets are null", () => {
    const line = buildLine("3month", [], "2026-04-08", "2026-07-06");
    expect(line.renderState).toBe("empty");
  });

  it("renderState is 'single' when exactly one bucket is non-null", () => {
    const points = [{ date: "2026-06-27", value: 80 }];
    const line = buildLine("3month", points, "2026-04-08", "2026-07-06");
    expect(line.renderState).toBe("single");
  });

  it("renderState is 'line' when at least 2 buckets are non-null, omitting leading null buckets", () => {
    const points = [{ date: "2026-04-23", value: 91 }]; // bucket 1, carries into 2 and 3
    const line = buildLine("3month", points, "2026-04-08", "2026-07-06");
    expect(line.renderState).toBe("line");
    expect(line.points.every((p) => p.value !== null)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// buildOverlayRows
// ---------------------------------------------------------------------------

describe("buildOverlayRows", () => {
  it("lists only logged days, sparse — never a placeholder row for unlogged days", () => {
    const rows: ProgressEntryRow[] = [
      row("2026-07-01", { waistCm: 90 }),
      row("2026-07-02"),
      row("2026-07-03", { waistCm: 89 }),
    ];

    const overlayRows = buildOverlayRows(rows, "waistCm");

    expect(overlayRows).toEqual([
      { date: "2026-07-03", value: 89 },
      { date: "2026-07-01", value: 90 },
    ]);
  });

  it("returns rows in descending date order — most recent first", () => {
    const rows: ProgressEntryRow[] = [
      row("2026-07-01", { waistCm: 90 }),
      row("2026-07-05", { waistCm: 88 }),
      row("2026-07-03", { waistCm: 89 }),
    ];

    const overlayRows = buildOverlayRows(rows, "waistCm");

    expect(overlayRows.map((r) => r.date)).toEqual(["2026-07-05", "2026-07-03", "2026-07-01"]);
  });

  it("returns an empty array when no day has the active metric logged", () => {
    const rows: ProgressEntryRow[] = [row("2026-07-01"), row("2026-07-02")];
    expect(buildOverlayRows(rows, "waistCm")).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// latestValue / deltaFromFirst
// ---------------------------------------------------------------------------

describe("latestValue", () => {
  it("returns the last point's value", () => {
    const points = [
      { date: "2026-07-01", value: 90 },
      { date: "2026-07-03", value: 89 },
    ];
    expect(latestValue(points)).toBe(89);
  });

  it("returns null when there are no points", () => {
    expect(latestValue([])).toBeNull();
  });
});

describe("deltaFromFirst", () => {
  it("returns the difference between the last and first point's value", () => {
    const points = [
      { date: "2026-07-01", value: 90 },
      { date: "2026-07-03", value: 88.5 },
    ];
    expect(deltaFromFirst(points)).toBe(-1.5);
  });

  it("returns null when there are fewer than 2 points", () => {
    expect(deltaFromFirst([])).toBeNull();
    expect(deltaFromFirst([{ date: "2026-07-01", value: 90 }])).toBeNull();
  });
});
