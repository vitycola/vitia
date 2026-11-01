import { addDays } from "../date";
import { buildExportModel } from "../exportData";
import { toPdf } from "../exportPdf";

const mockText = jest.fn();
const mockAutoTable = jest.fn();
const mockDoc = {
  setFont: jest.fn(),
  setFontSize: jest.fn(),
  setTextColor: jest.fn(),
  setFillColor: jest.fn(),
  setDrawColor: jest.fn(),
  roundedRect: jest.fn(),
  text: mockText,
  addPage: jest.fn(),
  output: jest.fn(() => new Blob(["%PDF"], { type: "application/pdf" })),
  internal: { pageSize: { getWidth: () => 210, getHeight: () => 297 } },
  lastAutoTable: { finalY: 120 },
};

jest.mock("jspdf", () => ({ jsPDF: jest.fn(() => mockDoc) }));
jest.mock("jspdf-autotable", () => ({
  __esModule: true,
  default: (...args: unknown[]) => mockAutoTable(...args),
}));

const profile = {
  calorieGoal: 2200,
  proteinGoalG: 150,
  carbsGoalG: 250,
  fatGoalG: 70,
} as Parameters<typeof buildExportModel>[3];

const range = { from: "2026-10-01", to: "2026-10-04" };

function buildModel() {
  return buildExportModel(
    range,
    [
      { date: "2026-10-01", calories: 2000, proteinG: 100, carbsG: 200, fatG: 60 },
      { date: "2026-10-03", calories: 1000, proteinG: 50, carbsG: 100, fatG: 30.5 },
    ],
    [
      { date: "2026-10-02", weightKg: 72.5, waistCm: 80 },
      { date: "2026-10-03", weightKg: null, waistCm: 81 },
    ] as unknown as Parameters<typeof buildExportModel>[2],
    profile
  );
}

function tableOptions() {
  return mockAutoTable.mock.calls[0][1] as {
    head: string[][];
    body: unknown[][];
    headStyles: { fillColor: number[]; textColor: number[]; fontStyle: string };
    didParseCell: (data: unknown) => void;
  };
}

function allText(): string {
  return mockText.mock.calls.map((c) => String(c[0])).join("\n");
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("toPdf", () => {
  it("returns a PDF blob", async () => {
    const blob = await toPdf(buildModel());
    expect(blob).toBeInstanceOf(Blob);
    expect(mockDoc.output).toHaveBeenCalledWith("blob");
  });

  it("uses Spanish headers and an accent-colored table header", async () => {
    await toPdf(buildModel());
    const opts = tableOptions();
    expect(opts.head).toEqual([["Fecha", "kcal", "P", "C", "G", "Meta", "Peso"]]);
    expect(opts.headStyles.fillColor).toEqual([245, 166, 35]);
    expect(opts.headStyles.textColor).toEqual([255, 255, 255]);
    expect(opts.headStyles.fontStyle).toBe("bold");
  });

  it("right-aligns numeric header cells and keeps Fecha left, matching the body", async () => {
    await toPdf(buildModel());
    const opts = tableOptions();
    const cols = opts as unknown as { columnStyles: Record<number, { halign: string }> };
    for (let i = 0; i <= 6; i++) {
      const cell = {
        section: "head",
        column: { index: i },
        row: { index: 0 },
        cell: { styles: {} as Record<string, unknown> },
      };
      opts.didParseCell(cell);
      if (i === 0) {
        expect(cell.cell.styles.halign).toBeUndefined();
      } else {
        expect(cell.cell.styles.halign).toBe("right");
        expect(cols.columnStyles[i].halign).toBe("right");
      }
    }
  });

  it("always prints weight with one decimal and comma", async () => {
    const m = buildExportModel(
      range,
      [],
      [
        { date: "2026-10-01", weightKg: 80, waistCm: null },
        { date: "2026-10-02", weightKg: 79.9, waistCm: null },
      ] as unknown as Parameters<typeof buildExportModel>[2],
      null
    );
    await toPdf(m);
    const { body } = tableOptions();
    expect(body[0][3]).toBe("80,0");
    expect(body[1][3]).toBe("79,9");
  });

  it("renders one body row per day, unlogged days as Sin registro, weight kept", async () => {
    await toPdf(buildModel());
    const { body } = tableOptions();
    expect(body).toHaveLength(4);
    expect(body[0]).toEqual(["01/10/2026", "2000", "100,0", "200,0", "60,0", "2200", "—"]);
    expect(body[1]).toEqual([
      "02/10/2026",
      { content: "Sin registro", colSpan: 4 },
      "2200",
      "72,5",
    ]);
    expect(body[2]).toEqual(["03/10/2026", "1000", "50,0", "100,0", "30,5", "2200", "—"]);
    expect(body[3]).toEqual(["04/10/2026", { content: "Sin registro", colSpan: 4 }, "2200", "—"]);
  });

  it("mutes unlogged rows through didParseCell", async () => {
    await toPdf(buildModel());
    const { didParseCell } = tableOptions();

    const unlogged = {
      section: "body",
      row: { index: 1 },
      column: { index: 1 },
      cell: { styles: {} as Record<string, unknown> },
    };
    didParseCell(unlogged);
    expect(unlogged.cell.styles.textColor).toBeDefined();

    const logged = {
      section: "body",
      row: { index: 0 },
      column: { index: 1 },
      cell: { styles: {} as Record<string, unknown> },
    };
    didParseCell(logged);
    expect(logged.cell.styles.textColor).toBeUndefined();
  });

  it("renders header, averages over logged days, targets and the footnote", async () => {
    await toPdf(buildModel());
    const text = allText();
    expect(text).toContain("Vitia");
    expect(text).toContain("01/10/2026");
    expect(text).toContain("04/10/2026");
    expect(text).toContain("Generado");
    // avg of 2000 and 1000 kcal over the 2 logged days (not over 4 days)
    expect(text).toContain("1500");
    expect(text).toContain("75,0"); // avg protein, one decimal
    expect(text).toContain("150,0"); // target protein, one decimal
    expect(text).toContain("2200");
    expect(text).toContain("METAS DEL PERÍODO");
    expect(text).toContain("Cada día muestra la meta vigente en esa fecha.");
    expect(text).not.toContain("no se guarda historial");
  });

  describe("goals that change within the range", () => {
    const goal = (effectiveFrom: string, calorieGoal: number) => ({
      effectiveFrom,
      calorieGoal,
      proteinGoalG: 150,
      carbsGoalG: 250,
      fatGoalG: 70,
      useManualGoals: false,
    });
    const changed = () =>
      buildExportModel(range, [], [], profile, [
        goal("2026-01-01", 1700),
        goal("2026-10-03", 1500),
      ]);

    it("lists the goal per period instead of a single tile row", async () => {
      await toPdf(changed());
      const text = allText();
      expect(text).toContain("METAS POR PERÍODO");
      expect(text).toContain("01/10/2026 – 02/10/2026");
      expect(text).toContain("1700 kcal");
      expect(text).toContain("03/10/2026 – 04/10/2026");
      expect(text).toContain("1500 kcal");
      expect(text).not.toContain("METAS DEL PERÍODO");
    });

    // One distinct goal per day: `n` periods.
    const periodsModel = (n: number) =>
      buildExportModel(
        { from: "2026-01-01", to: addDays("2026-01-01", n - 1) },
        [],
        [],
        profile,
        Array.from({ length: n }, (_, i) => goal(addDays("2026-01-01", i), 1000 + i))
      );

    it.each([8, 10])("lists %i periods in full", async (n) => {
      await toPdf(periodsModel(n));
      const text = allText();
      for (let i = 0; i < n; i++) expect(text).toContain(`${1000 + i} kcal`);
      expect(text).not.toContain("cambios de meta");
    });

    it("collapses 11+ periods to first, last and a summary line", async () => {
      await toPdf(periodsModel(11));
      const text = allText();
      expect(text).toContain("1000 kcal");
      expect(text).toContain("1010 kcal");
      expect(text).not.toContain("1005 kcal");
      expect(text).toContain("10 cambios de meta en el período; ver la columna Meta");
    });

    it("keeps the table start inside the page for 50 periods", async () => {
      await toPdf(periodsModel(50));
      const opts = tableOptions() as unknown as { startY: number };
      expect(opts.startY).toBeLessThan(120);
      expect(allText()).toContain("49 cambios de meta en el período; ver la columna Meta");
    });

    it("puts each day's own goal in the table and moves it below the period list", async () => {
      await toPdf(changed());
      const opts = tableOptions() as unknown as { body: unknown[][]; startY: number };
      expect(opts.body.map((r) => r[r.length - 2])).toEqual(["1700", "1700", "1500", "1500"]);
      expect(opts.startY).toBeGreaterThan(86);
    });
  });

  it("shows a dash for averages when nothing is logged and omits other measurements", async () => {
    const empty = buildExportModel(range, [], [], null);
    await toPdf(empty);
    const text = allText();
    expect(text).toContain("—");
    expect(text).not.toMatch(/cintura|cuello|cadera|waist/i);
    expect(tableOptions().head[0]).toHaveLength(7);
  });

  it("includes every row of a long range", async () => {
    const long = buildExportModel({ from: "2025-10-23", to: "2026-10-23" }, [], [], null);
    await toPdf(long);
    expect(tableOptions().body).toHaveLength(366);
  });
});
