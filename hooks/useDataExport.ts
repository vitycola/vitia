import * as mealRepo from "@/db/repos/mealEntries";
import * as profileRepo from "@/db/repos/profile";
import * as progressRepo from "@/db/repos/progress";
import { CSV_MIME, toCsv } from "@/lib/exportCsv";
import {
  type ExportModel,
  type ExportRange,
  buildExportModel,
  exportFileName,
} from "@/lib/exportData";
import { deliverFile } from "@/lib/exportDelivery";
import { useCallback, useState } from "react";

export type ExportFormat = "csv" | "pdf";
export type ExportStatus = "idle" | "working" | "error";

/**
 * Read the range through the db/repos facade (the only data source) and
 * assemble the pure export model. Shared by the route (summary line) and the
 * download flow so the summary and the file never diverge.
 */
export async function loadExportModel(range: ExportRange): Promise<ExportModel> {
  const [totals, progress, profile] = await Promise.all([
    mealRepo.getLoggedTotalsByDateRange(range.from, range.to),
    progressRepo.getRange(range.from, range.to),
    profileRepo.getProfile(),
  ]);
  return buildExportModel(range, totals, progress, profile);
}

/** Orchestrates model load -> serialize -> deliver; never throws, reports via `status`. */
export function useDataExport(): {
  status: ExportStatus;
  run: (range: ExportRange, format: ExportFormat) => Promise<void>;
} {
  const [status, setStatus] = useState<ExportStatus>("idle");

  const run = useCallback(async (range: ExportRange, format: ExportFormat) => {
    setStatus("working");
    try {
      const model = await loadExportModel(range);
      const blob = new Blob([toCsv(model)], { type: CSV_MIME });
      await deliverFile(blob, exportFileName(range, format));
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }, []);

  return { status, run };
}
