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
import { useCallback, useEffect, useRef, useState } from "react";

export type ExportFormat = "csv" | "pdf";
export type ExportStatus = "idle" | "working" | "ready-to-share" | "error";

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

/**
 * Orchestrates model load -> serialize -> deliver; never throws, reports via `status`.
 * "ready-to-share": the file exists but iOS rejected the share (no user
 * activation after the async work), so `shareNow` must run from a fresh tap.
 */
export function useDataExport(): {
  status: ExportStatus;
  sharing: boolean;
  run: (range: ExportRange, format: ExportFormat) => Promise<void>;
  shareNow: () => Promise<void>;
  reset: () => void;
} {
  const [status, setStatus] = useState<ExportStatus>("idle");
  const [sharing, setSharing] = useState(false);
  const fileRef = useRef<File | null>(null);
  const busyRef = useRef(false);
  const sharingRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      fileRef.current = null;
    };
  }, []);

  const run = useCallback(async (range: ExportRange, format: ExportFormat) => {
    // A concurrent run would deliver the file twice.
    if (busyRef.current) return;
    busyRef.current = true;
    fileRef.current = null;
    setStatus("working");
    try {
      const model = await loadExportModel(range);
      let blob: Blob;
      if (format === "pdf") {
        // Lazy: keeps jspdf out of the main bundle and the CSV flow.
        const { toPdf } = await import("@/lib/exportPdf");
        blob = await toPdf(model);
      } else {
        blob = new Blob([toCsv(model)], { type: CSV_MIME });
      }
      const name = exportFileName(range, format);
      const result = await deliverFile(blob, name);
      if (!mountedRef.current) return;
      if (result === "needs-share") {
        fileRef.current = new File([blob], name, { type: blob.type });
        setStatus("ready-to-share");
      } else {
        setStatus("idle");
      }
    } catch {
      if (mountedRef.current) setStatus("error");
    } finally {
      busyRef.current = false;
    }
  }, []);

  // Must stay free of awaits before navigator.share: it needs the tap's activation.
  const shareNow = useCallback((): Promise<void> => {
    // A second concurrent share would reject with InvalidStateError and lose the file.
    if (sharingRef.current) return Promise.resolve();
    const file = fileRef.current;
    if (!file) return Promise.resolve();
    sharingRef.current = true;
    setSharing(true);
    const release = () => {
      sharingRef.current = false;
      if (mountedRef.current) setSharing(false);
    };
    let pending: Promise<void>;
    try {
      pending = navigator.share({ files: [file] });
    } catch {
      release();
      fileRef.current = null;
      setStatus("error");
      return Promise.resolve();
    }
    return pending.then(
      () => {
        release();
        fileRef.current = null;
        if (mountedRef.current) setStatus("idle");
      },
      (err: unknown) => {
        release();
        // Dismissing the sheet keeps the file so the user can tap again.
        if (err instanceof Error && err.name === "AbortError") return;
        fileRef.current = null;
        if (mountedRef.current) setStatus("error");
      }
    );
  }, []);

  // Selection changes must not disturb a running export or an open share sheet.
  const reset = useCallback(() => {
    if (busyRef.current || sharingRef.current) return;
    fileRef.current = null;
    setStatus("idle");
  }, []);

  return { status, sharing, run, shareNow, reset };
}
