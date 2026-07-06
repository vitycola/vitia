import { buildBars, buildBuckets, buildOverlayRows, imputedAverage } from "../calorieDashboard";

type DayTotals = { date: string; calories: number };

// ---------------------------------------------------------------------------
// imputedAverage
// ---------------------------------------------------------------------------

describe("imputedAverage", () => {
  it("returns null for an empty rows array", () => {
    expect(imputedAverage([])).toBeNull();
  });

  it("divides by rows.length, not calendar days (partial window)", () => {
    const rows: DayTotals[] = [
      { date: "2026-07-01", calories: 2100 },
      { date: "2026-07-02", calories: 1900 },
      { date: "2026-07-03", calories: 2000 },
    ];
    expect(imputedAverage(rows)).toBe(2000);
  });

  it("returns the single value when only one row is imputed", () => {
    expect(imputedAverage([{ date: "2026-07-01", calories: 1800 }])).toBe(1800);
  });

  it("averages correctly even when a logged day has 0 calories", () => {
    const rows: DayTotals[] = [
      { date: "2026-07-01", calories: 0 },
      { date: "2026-07-02", calories: 2000 },
    ];
    expect(imputedAverage(rows)).toBe(1000);
  });
});

// ---------------------------------------------------------------------------
// buildBars
// ---------------------------------------------------------------------------

describe("buildBars", () => {
  it("week range: renders exactly 7 bars, absent days as zero/empty", () => {
    const byDate = new Map<string, number>([
      ["2026-06-30", 2100],
      ["2026-07-01", 1900],
      ["2026-07-02", 2000],
      // 2026-07-03, 04, 05, 06 absent
    ]);

    const bars = buildBars("week", byDate, "2026-06-30", "2026-07-06");

    expect(bars).toHaveLength(7);
    expect(bars[0]).toMatchObject({ kcal: 2100, imputed: true });
    expect(bars[1]).toMatchObject({ kcal: 1900, imputed: true });
    expect(bars[2]).toMatchObject({ kcal: 2000, imputed: true });
    expect(bars[3]).toMatchObject({ kcal: 0, imputed: false });
    expect(bars[4]).toMatchObject({ kcal: 0, imputed: false });
    expect(bars[5]).toMatchObject({ kcal: 0, imputed: false });
    expect(bars[6]).toMatchObject({ kcal: 0, imputed: false });
  });

  it("month range: renders exactly 30 daily bars", () => {
    const byDate = new Map<string, number>();
    const bars = buildBars("month", byDate, "2026-06-07", "2026-07-06");
    expect(bars).toHaveLength(30);
    expect(bars.every((b) => b.kcal === 0 && b.imputed === false)).toBe(true);
  });

  it("3month range: collapses to exactly 3 average bars", () => {
    const byDate = new Map<string, number>([
      ["2026-06-07", 2000],
      ["2026-06-08", 2200],
    ]);

    const bars = buildBars("3month", byDate, "2026-04-08", "2026-07-06");

    expect(bars).toHaveLength(3);
    // bucket 3 (Últimos 30 días) = 2026-06-07..2026-07-06 — includes both logged days
    expect(bars[2]).toMatchObject({ kcal: 2100, imputed: true, label: "Últimos 30 días" });
    // buckets 1 and 2 have zero imputed days
    expect(bars[0]).toMatchObject({ kcal: 0, imputed: false, label: "Hace 61-90 días" });
    expect(bars[1]).toMatchObject({ kcal: 0, imputed: false, label: "Hace 31-60 días" });
  });
});

// ---------------------------------------------------------------------------
// buildBuckets
// ---------------------------------------------------------------------------

describe("buildBuckets", () => {
  it("excludes un-logged days from bucket average (numerator AND denominator)", () => {
    const rows: DayTotals[] = [];
    // 20 imputed days in bucket 3 summing to 41000
    const bucketDays = [
      "2026-06-07",
      "2026-06-08",
      "2026-06-09",
      "2026-06-10",
      "2026-06-11",
      "2026-06-12",
      "2026-06-13",
      "2026-06-14",
      "2026-06-15",
      "2026-06-16",
      "2026-06-17",
      "2026-06-18",
      "2026-06-19",
      "2026-06-20",
      "2026-06-21",
      "2026-06-22",
      "2026-06-23",
      "2026-06-24",
      "2026-06-25",
      "2026-06-26",
    ];
    for (const date of bucketDays) {
      rows.push({ date, calories: 41000 / 20 });
    }

    const buckets = buildBuckets(rows, "2026-04-08", "2026-07-06");

    expect(buckets).toHaveLength(3);
    expect(buckets[2].average).toBe(2050);
  });

  it("returns null average for a bucket with zero logged days", () => {
    const buckets = buildBuckets([], "2026-04-08", "2026-07-06");
    expect(buckets).toHaveLength(3);
    for (const bucket of buckets) {
      expect(bucket.average).toBeNull();
    }
  });

  it("labels buckets oldest to newest with the relative label strings", () => {
    const buckets = buildBuckets([], "2026-04-08", "2026-07-06");
    expect(buckets.map((b) => b.label)).toEqual([
      "Hace 61-90 días",
      "Hace 31-60 días",
      "Últimos 30 días",
    ]);
  });
});

// ---------------------------------------------------------------------------
// buildOverlayRows
// ---------------------------------------------------------------------------

describe("buildOverlayRows", () => {
  it("row count always equals window size (7 days)", () => {
    const byDate = new Map<string, number>([["2026-07-01", 2000]]);
    const rows = buildOverlayRows("2026-06-30", "2026-07-06", byDate);
    expect(rows).toHaveLength(7);
  });

  it("row count always equals window size (30 days)", () => {
    const byDate = new Map<string, number>();
    const rows = buildOverlayRows("2026-06-07", "2026-07-06", byDate);
    expect(rows).toHaveLength(30);
  });

  it("row count always equals window size (90 days)", () => {
    const byDate = new Map<string, number>();
    const rows = buildOverlayRows("2026-04-08", "2026-07-06", byDate);
    expect(rows).toHaveLength(90);
  });

  it("absent day renders as 0 kcal — never omitted", () => {
    const byDate = new Map<string, number>([["2026-07-01", 2000]]);
    const rows = buildOverlayRows("2026-06-30", "2026-07-02", byDate);

    expect(rows).toEqual([
      { date: "2026-07-02", kcal: 0 },
      { date: "2026-07-01", kcal: 2000 },
      { date: "2026-06-30", kcal: 0 },
    ]);
  });

  it("returns rows in descending date order — most recent (to) first, oldest (from) last", () => {
    const byDate = new Map<string, number>();
    const rows = buildOverlayRows("2026-06-30", "2026-07-06", byDate);

    expect(rows[0].date).toBe("2026-07-06");
    expect(rows[rows.length - 1].date).toBe("2026-06-30");
    expect(rows.map((r) => r.date)).toEqual([
      "2026-07-06",
      "2026-07-05",
      "2026-07-04",
      "2026-07-03",
      "2026-07-02",
      "2026-07-01",
      "2026-06-30",
    ]);
  });

  it("keeps descending order even when every day in the window is absent (empty window edge case)", () => {
    const byDate = new Map<string, number>();
    const rows = buildOverlayRows("2026-04-08", "2026-07-06", byDate);

    expect(rows).toHaveLength(90);
    expect(rows.every((r) => r.kcal === 0)).toBe(true);
    expect(rows[0].date).toBe("2026-07-06");
    expect(rows[89].date).toBe("2026-04-08");
  });
});
