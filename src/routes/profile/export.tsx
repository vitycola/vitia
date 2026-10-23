import { type ExportFormat, loadExportModel, useDataExport } from "@/hooks/useDataExport";
import { todayISO } from "@/lib/date";
import {
  type ExportRange,
  type ExportRangeError,
  type ExportSummary,
  presetRange,
  summarize,
  validateRange,
} from "@/lib/exportData";
import { ChevronLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

type Preset = 7 | 30 | 90 | "custom";

const PRESETS: Preset[] = [7, 30, 90, "custom"];

const RANGE_ERRORS: Record<Exclude<ExportRangeError, null>, string> = {
  invalid_order: "La fecha final no puede ser anterior a la inicial",
  future: "No se pueden elegir fechas futuras",
  too_long: "El período no puede superar 366 días",
};

function summaryText(s: ExportSummary): string {
  const days = s.days === 1 ? "1 día" : `${s.days} días`;
  return `${days} · ${s.logged} con registro · ${s.unlogged} sin registro`;
}

/**
 * Full-screen data export page. Lives OUTSIDE TabLayout/ProfileLayout (a
 * top-level route in src/router.tsx, like the progress-photos gallery) so it
 * owns its back header. The summary is derived from the same model the file
 * is built from, so the counts and the download never diverge.
 */
export function ExportRoute() {
  const navigate = useNavigate();
  const today = todayISO();
  const { status, run, reset } = useDataExport();

  const [preset, setPreset] = useState<Preset>(30);
  const [format, setFormat] = useState<ExportFormat>("csv");
  const [customFrom, setCustomFrom] = useState(() => presetRange(30, todayISO()).from);
  const [customTo, setCustomTo] = useState(() => todayISO());
  const [summary, setSummary] = useState<ExportSummary | null>(null);
  const [summaryError, setSummaryError] = useState(false);

  // Any selection change invalidates a previous export error.
  const changePreset = (p: Preset) => {
    setPreset(p);
    reset();
  };
  const changeFormat = (f: ExportFormat) => {
    setFormat(f);
    reset();
  };
  const changeCustomFrom = (v: string) => {
    setCustomFrom(v);
    reset();
  };
  const changeCustomTo = (v: string) => {
    setCustomTo(v);
    reset();
  };

  const range: ExportRange | null =
    preset === "custom"
      ? customFrom && customTo
        ? { from: customFrom, to: customTo }
        : null
      : presetRange(preset, today);
  const rangeError = range ? validateRange(range, today) : null;
  const from = range?.from;
  const to = range?.to;

  // Rebuild the model whenever a valid range changes; ignore stale responses.
  useEffect(() => {
    setSummary(null);
    setSummaryError(false);
    if (!from || !to || validateRange({ from, to }, today)) return;
    let cancelled = false;
    loadExportModel({ from, to })
      .then((model) => {
        if (!cancelled) setSummary(summarize(model));
      })
      .catch(() => {
        if (!cancelled) setSummaryError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [from, to, today]);

  const noData = summary !== null && summary.logged === 0 && !summary.hasProgress;
  const onlyBody = summary !== null && summary.logged === 0 && summary.hasProgress;
  const working = status === "working";
  // A failed summary load must not trap the user: the download reports its own errors.
  const canDownload =
    range !== null && !rangeError && (summary !== null || summaryError) && !noData && !working;
  const formatLabel = format === "csv" ? "CSV" : "PDF";

  return (
    <div className="min-h-screen bg-surface pb-8">
      <div className="flex items-center gap-2 bg-card px-4 py-4 shadow-sm">
        <button
          type="button"
          aria-label="Volver"
          onClick={() => void navigate(-1)}
          className="flex h-8 w-8 items-center justify-center text-primary"
        >
          <ChevronLeft size={22} />
        </button>
        <h1 className="text-sm font-semibold text-primary">Exportar datos</h1>
      </div>

      <div className="space-y-4 px-4 py-4">
        <section className="rounded-2xl bg-card px-4 py-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-secondary">
            Período
          </h2>
          <div className="flex gap-2">
            {PRESETS.map((p) => (
              <ChipButton
                key={p}
                selected={preset === p}
                onClick={() => changePreset(p)}
                label={p === "custom" ? "Personalizado" : String(p)}
              />
            ))}
          </div>

          {preset === "custom" && (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <DateField
                id="export-from"
                label="Desde"
                value={customFrom}
                max={today}
                onChange={changeCustomFrom}
              />
              <DateField
                id="export-to"
                label="Hasta"
                value={customTo}
                max={today}
                onChange={changeCustomTo}
              />
            </div>
          )}

          {rangeError && (
            <p role="alert" className="mt-3 text-xs text-destructive">
              {RANGE_ERRORS[rangeError]}
            </p>
          )}
          {!rangeError && summary && (
            <p className="mt-3 text-sm text-secondary">{summaryText(summary)}</p>
          )}
          {!rangeError && summaryError && (
            <p role="alert" className="mt-3 text-xs text-destructive">
              No se pudo cargar el resumen del período.
            </p>
          )}
          {noData && <p className="mt-2 text-sm text-secondary">No hay datos en este período.</p>}
          {onlyBody && (
            <p className="mt-2 text-sm text-secondary">
              Este período no tiene comidas registradas; solo se exportarán medidas corporales.
            </p>
          )}
        </section>

        <section className="rounded-2xl bg-card px-4 py-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-secondary">
            Formato
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <ChipButton
              selected={format === "csv"}
              onClick={() => changeFormat("csv")}
              label="CSV"
              large
            />
            <ChipButton
              selected={format === "pdf"}
              onClick={() => changeFormat("pdf")}
              label="PDF"
              large
            />
          </div>
        </section>

        {status === "error" && (
          <p role="alert" className="text-xs text-destructive">
            No se pudo generar el archivo. Intentá de nuevo.
          </p>
        )}

        <button
          type="button"
          disabled={!canDownload}
          onClick={() => range && void run(range, format)}
          className="flex w-full items-center justify-center rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-accent-foreground transition-colors hover:opacity-90 disabled:opacity-50"
        >
          {working ? "Generando…" : `Descargar ${formatLabel}`}
        </button>
      </div>
    </div>
  );
}

function ChipButton({
  label,
  selected,
  onClick,
  large = false,
  disabled = false,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  large?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={`rounded-xl border text-sm font-semibold transition-colors disabled:opacity-50 ${
        large ? "py-4" : "px-3 py-2"
      } ${
        selected
          ? "border-accent bg-accent text-accent-foreground"
          : "border-default bg-card text-primary"
      }`}
    >
      {label}
    </button>
  );
}

function DateField({
  id,
  label,
  value,
  max,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  max: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-secondary">
        {label}
      </label>
      <input
        id={id}
        type="date"
        value={value}
        max={max}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-default bg-card px-3 py-2 text-sm text-primary outline-none focus:border-accent"
      />
    </div>
  );
}
