import { CSV_HEADERS, CSV_MIME, quoteField, toCsv } from "../exportCsv";
import type { ExportModel, ExportRow } from "../exportData";

const TARGETS = { calorieKcal: 2200, proteinG: 150, carbsG: 250, fatG: 70 };

function row(date: string, over: Partial<ExportRow> = {}): ExportRow {
  return {
    date,
    logged: false,
    caloriesKcal: null,
    proteinG: null,
    carbsG: null,
    fatG: null,
    weightKg: null,
    neckCm: null,
    chestCm: null,
    armCm: null,
    waistCm: null,
    hipCm: null,
    thighCm: null,
    bodyFatPct: null,
    ...over,
  };
}

function model(rows: ExportRow[], targets: ExportModel["targets"] = TARGETS): ExportModel {
  return {
    range: { from: rows[0].date, to: rows[rows.length - 1].date },
    rows,
    targets,
    hasProgress: false,
  };
}

describe("CSV_HEADERS", () => {
  it("has the 18 fixed columns in order", () => {
    expect(CSV_HEADERS.join(",")).toBe(
      "date,logged,calories_kcal,protein_g,carbs_g,fat_g,weight_kg,neck_cm,chest_cm,arm_cm,waist_cm,hip_cm,thigh_cm,body_fat_pct,calorie_target_kcal,protein_target_g,carbs_target_g,fat_target_g"
    );
    expect(CSV_HEADERS).toHaveLength(18);
  });
});

describe("toCsv", () => {
  it("uses CRLF after every line including the last, no BOM, no # lines", () => {
    const csv = toCsv(model([row("2026-10-01"), row("2026-10-02")]));
    expect(csv.endsWith("\r\n")).toBe(true);
    expect(csv.split("\r\n")).toHaveLength(4); // header + 2 rows + trailing empty
    expect(csv.includes("\n") && csv.replace(/\r\n/g, "").includes("\n")).toBe(false);
    expect(csv.charCodeAt(0)).not.toBe(0xfeff);
    expect(csv).not.toMatch(/^#/m);
    expect(CSV_MIME).toBe("text/csv;charset=utf-8");
  });

  it("renders the exact unlogged-day row with constant targets", () => {
    const lines = toCsv(model([row("2026-10-01")])).split("\r\n");
    expect(lines[1]).toBe("2026-10-01,false,,,,,,,,,,,,,2200,150,250,70");
  });

  it("renders the progress-only day row", () => {
    const lines = toCsv(model([row("2026-10-02", { weightKg: 72.5, waistCm: 80 })])).split("\r\n");
    expect(lines[1]).toBe("2026-10-02,false,,,,,72.5,,,,80,,,,2200,150,250,70");
  });

  it("uses dot decimals and rounds kcal to 0dp and others to 1dp", () => {
    const lines = toCsv(
      model([
        row("2026-10-03", {
          logged: true,
          caloriesKcal: 1999.6,
          proteinG: 120.26,
          carbsG: 200,
          fatG: 60.04,
          weightKg: 72.5,
          bodyFatPct: 18.84,
        }),
      ])
    ).split("\r\n");
    expect(lines[1]).toBe("2026-10-03,true,2000,120.3,200,60,72.5,,,,,,,18.8,2200,150,250,70");
    expect(lines[1]).not.toContain("72,5");
  });

  it("leaves targets empty when the profile is missing", () => {
    const lines = toCsv(model([row("2026-10-01")], null)).split("\r\n");
    expect(lines[1]).toBe("2026-10-01,false,,,,,,,,,,,,,,,,");
  });

  it("every line has 18 columns and notes/per-meal data are absent", () => {
    const csv = toCsv(model([row("2026-10-01"), row("2026-10-02", { logged: true })]));
    for (const line of csv.split("\r\n").filter(Boolean)) {
      expect(line.split(",")).toHaveLength(18);
    }
    expect(csv).not.toMatch(/notes|meal/i);
  });
});

describe("quoteField", () => {
  it("quotes comma, quote, CR and LF with doubled quotes", () => {
    expect(quoteField("a,b")).toBe('"a,b"');
    expect(quoteField('say "hi"')).toBe('"say ""hi"""');
    expect(quoteField("a\rb")).toBe('"a\rb"');
    expect(quoteField("a\nb")).toBe('"a\nb"');
    expect(quoteField("plain")).toBe("plain");
    expect(quoteField("")).toBe("");
  });
});
