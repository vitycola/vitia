import type { ExportModel, ExportRow } from "./exportData";

export const CSV_MIME = "text/csv;charset=utf-8";

/** Fixed column set and order — never varies with data content. */
export const CSV_HEADERS: readonly string[] = [
  "date",
  "logged",
  "calories_kcal",
  "protein_g",
  "carbs_g",
  "fat_g",
  "weight_kg",
  "neck_cm",
  "chest_cm",
  "arm_cm",
  "waist_cm",
  "hip_cm",
  "thigh_cm",
  "body_fat_pct",
  "calorie_target_kcal",
  "protein_target_g",
  "carbs_target_g",
  "fat_target_g",
];

const CRLF = "\r\n";

/** RFC 4180: quote fields containing comma, double quote, CR or LF. */
export function quoteField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Round to `decimals` and stringify with a dot separator; null becomes an empty field. */
function num(value: number | null, decimals: number): string {
  if (value === null) return "";
  const factor = 10 ** decimals;
  return String(Math.round(value * factor) / factor);
}

function rowFields(r: ExportRow, targets: ExportModel["targets"]): string[] {
  return [
    r.date,
    r.logged ? "true" : "false",
    num(r.caloriesKcal, 0),
    num(r.proteinG, 1),
    num(r.carbsG, 1),
    num(r.fatG, 1),
    num(r.weightKg, 1),
    num(r.neckCm, 1),
    num(r.chestCm, 1),
    num(r.armCm, 1),
    num(r.waistCm, 1),
    num(r.hipCm, 1),
    num(r.thighCm, 1),
    num(r.bodyFatPct, 1),
    num(targets?.calorieKcal ?? null, 0),
    num(targets?.proteinG ?? null, 1),
    num(targets?.carbsG ?? null, 1),
    num(targets?.fatG ?? null, 1),
  ];
}

/** Serialize the model as a tidy CSV: header + one row per day, CRLF terminated, no BOM. */
export function toCsv(m: ExportModel): string {
  const lines = [CSV_HEADERS.join(",")];
  for (const r of m.rows) {
    lines.push(rowFields(r, m.targets).map(quoteField).join(","));
  }
  return lines.join(CRLF) + CRLF;
}
