import type { CellDef } from "jspdf-autotable";
import { todayISO } from "./date";
import {
  type ExportModel,
  type ExportRow,
  type TargetPeriod,
  summarize,
  targetPeriods,
} from "./exportData";
import { formatNumber } from "./formatNumber";

const ACCENT: [number, number, number] = [245, 166, 35];
const MUTED: [number, number, number] = [150, 150, 156];
const TEXT: [number, number, number] = [28, 28, 30];
const TILE_BG: [number, number, number] = [242, 242, 247];
const MARGIN = 14;

/** More periods than this collapse to first + last + a count, so the list fits page 1. */
const MAX_LISTED_PERIODS = 10;

const FOOTNOTE = "Cada día muestra la meta vigente en esa fecha.";

/** YYYY-MM-DD -> DD/MM/YYYY without going through Date (no UTC shifting). */
function displayDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

const kcal = (v: number | null) => formatNumber(v, { maxFractionDigits: 0 });
const grams = (v: number | null) => formatNumber(v, { minFractionDigits: 1, maxFractionDigits: 1 });

function periodLine(p: TargetPeriod): string {
  const { calorieKcal, proteinG, carbsG, fatG } = p.targets;
  return (
    `${displayDate(p.from)} – ${displayDate(p.to)}: ${kcal(calorieKcal)} kcal · ` +
    `P ${grams(proteinG)} g · C ${grams(carbsG)} g · G ${grams(fatG)} g`
  );
}

function bodyRow(r: ExportRow): (string | CellDef)[] {
  const weight = grams(r.weightKg);
  const goal = kcal(r.targets?.calorieKcal ?? null);
  if (!r.logged) {
    return [displayDate(r.date), { content: "Sin registro", colSpan: 4 }, goal, weight];
  }
  return [
    displayDate(r.date),
    kcal(r.caloriesKcal),
    grams(r.proteinG),
    grams(r.carbsG),
    grams(r.fatG),
    goal,
    weight,
  ];
}

/**
 * Render the model as a Spanish, human-readable PDF. jsPDF and autotable are
 * loaded lazily so they never reach the main bundle or the CSV flow.
 */
export async function toPdf(m: ExportModel): Promise<Blob> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const summary = summarize(m);

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...ACCENT);
  doc.text("Vitia", MARGIN, 20);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...TEXT);
  doc.text(`Período: ${displayDate(m.range.from)} – ${displayDate(m.range.to)}`, MARGIN, 27);
  doc.text(`Generado: ${displayDate(todayISO())}`, MARGIN, 32);

  // Summary tiles: daily averages over logged days, then the goals of the period
  const tiles: { label: string; value: string }[] = [
    { label: "kcal", value: kcal(summary.avg?.kcal ?? null) },
    { label: "Proteínas (g)", value: grams(summary.avg?.proteinG ?? null) },
    { label: "Carbohidratos (g)", value: grams(summary.avg?.carbsG ?? null) },
    { label: "Grasas (g)", value: grams(summary.avg?.fatG ?? null) },
  ];
  // One period: same tiles as the averages. Several: one text line per period.
  const periods = targetPeriods(m.rows);
  const constantTargets = periods.length <= 1 ? (periods[0]?.targets ?? null) : null;
  const targetTiles: { label: string; value: string }[] = [
    { label: "kcal", value: kcal(constantTargets?.calorieKcal ?? null) },
    { label: "Proteínas (g)", value: grams(constantTargets?.proteinG ?? null) },
    { label: "Carbohidratos (g)", value: grams(constantTargets?.carbsG ?? null) },
    { label: "Grasas (g)", value: grams(constantTargets?.fatG ?? null) },
  ];
  const GOAL_LINE_HEIGHT = 6;
  let tableStartY = 86;
  const tileWidth = (pageWidth - MARGIN * 2 - 3 * 3) / 4;

  const drawTiles = (title: string, items: typeof tiles, y: number) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text(title, MARGIN, y);
    items.forEach((tile, i) => {
      const x = MARGIN + i * (tileWidth + 3);
      doc.setFillColor(...TILE_BG);
      doc.roundedRect(x, y + 2, tileWidth, 14, 2, 2, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(...TEXT);
      doc.text(tile.value, x + 3, y + 9);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(...MUTED);
      doc.text(tile.label, x + 3, y + 14);
    });
  };
  drawTiles("PROMEDIO DIARIO (DÍAS CON REGISTRO)", tiles, 42);
  if (periods.length <= 1) {
    drawTiles("METAS DEL PERÍODO", targetTiles, 64);
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text("METAS POR PERÍODO", MARGIN, 64);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...TEXT);
    const lines =
      periods.length <= MAX_LISTED_PERIODS
        ? periods.map(periodLine)
        : [
            periodLine(periods[0]),
            `${periods.length - 1} cambios de meta en el período; ver la columna Meta`,
            periodLine(periods[periods.length - 1]),
          ];
    lines.forEach((line, i) => {
      doc.text(line, MARGIN, 72 + i * GOAL_LINE_HEIGHT);
    });
    tableStartY = 72 + lines.length * GOAL_LINE_HEIGHT + 4;
  }

  // Daily table, paged with a repeated header
  autoTable(doc, {
    startY: tableStartY,
    margin: { left: MARGIN, right: MARGIN },
    head: [["Fecha", "kcal", "P", "C", "G", "Meta", "Peso"]],
    body: m.rows.map(bodyRow),
    headStyles: { fillColor: ACCENT, textColor: [255, 255, 255], fontStyle: "bold" },
    styles: { fontSize: 9, cellPadding: 1.8, textColor: TEXT },
    columnStyles: {
      1: { halign: "right" },
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right" },
      5: { halign: "right" },
      6: { halign: "right" },
    },
    showHead: "everyPage",
    didParseCell: (data) => {
      // Header alignment must mirror the body's (columnStyles only reach the body here)
      if (data.section === "head" && data.column.index > 0) {
        data.cell.styles.halign = "right";
      }
      if (data.section === "body" && !m.rows[data.row.index]?.logged) {
        data.cell.styles.textColor = MUTED;
        data.cell.styles.fontStyle = "italic";
      }
    },
  });

  // Footnote below the table, on a new page if there is no room left
  let y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  if (y > pageHeight - 15) {
    doc.addPage();
    y = 20;
  }
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(FOOTNOTE, MARGIN, y);

  return doc.output("blob");
}
