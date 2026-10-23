/** @jest-environment jsdom */
import { buildExportModel } from "@/lib/exportData";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";
import { ExportRoute } from "../export";

jest.mock("@/lib/date", () => ({
  ...jest.requireActual("@/lib/date"),
  todayISO: () => "2026-10-23",
}));

const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => mockNavigate,
}));

const mockRun = jest.fn();
let mockStatus: "idle" | "working" | "error" = "idle";
const mockLoad = jest.fn();
jest.mock("@/hooks/useDataExport", () => ({
  useDataExport: () => ({ status: mockStatus, run: mockRun }),
  loadExportModel: (range: unknown) => mockLoad(range),
}));

type Range = { from: string; to: string };

/** Model with `meals` days of meals (from the start) and optional progress dates. */
function setData(meals: number, progressOffsets: number[] = []) {
  mockLoad.mockImplementation(async (range: Range) => {
    const days = buildExportModel(range, [], [], null).rows.map((r) => r.date);
    const totals = days
      .slice(0, meals)
      .map((date) => ({ date, calories: 2000, proteinG: 100, carbsG: 200, fatG: 60 }));
    const progress = progressOffsets.map(
      (i) => ({ date: days[i], weightKg: 70 }) as unknown as import("@/db/schema").ProgressEntry
    );
    return buildExportModel(range, totals, progress, null);
  });
}

function renderRoute() {
  return render(
    <MemoryRouter>
      <ExportRoute />
    </MemoryRouter>
  );
}

function pickCustom(from: string, to: string) {
  fireEvent.click(screen.getByRole("button", { name: "Personalizado" }));
  fireEvent.change(screen.getByLabelText("Desde"), { target: { value: from } });
  fireEvent.change(screen.getByLabelText("Hasta"), { target: { value: to } });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockStatus = "idle";
  setData(24);
});

describe("ExportRoute presets and summary", () => {
  it("defaults to 30 days and shows the exact summary", async () => {
    renderRoute();
    expect(await screen.findByText("30 días · 24 con registro · 6 sin registro")).toBeVisible();
    expect(screen.getByRole("button", { name: "30" })).toHaveAttribute("aria-pressed", "true");
    expect(mockLoad).toHaveBeenCalledWith({ from: "2026-09-24", to: "2026-10-23" });
  });

  it("offers 7, 90 and Personalizado and updates the summary on change", async () => {
    renderRoute();
    await screen.findByText(/30 días/);
    fireEvent.click(screen.getByRole("button", { name: "7" }));
    expect(await screen.findByText("7 días · 7 con registro · 0 sin registro")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "90" }));
    expect(await screen.findByText("90 días · 24 con registro · 66 sin registro")).toBeVisible();
    expect(screen.getByRole("button", { name: "Personalizado" })).toBeVisible();
  });

  it("counts progress-only days as sin registro", async () => {
    setData(4, [5, 6]);
    renderRoute();
    fireEvent.click(screen.getByRole("button", { name: "7" }));
    expect(await screen.findByText("7 días · 4 con registro · 3 sin registro")).toBeVisible();
  });

  it("uses singular for a single day", async () => {
    setData(1);
    renderRoute();
    pickCustom("2026-10-20", "2026-10-20");
    expect(await screen.findByText("1 día · 1 con registro · 0 sin registro")).toBeVisible();
  });
});

describe("ExportRoute custom range validation", () => {
  it("reveals Desde/Hasta only for Personalizado", async () => {
    renderRoute();
    expect(screen.queryByLabelText("Desde")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Personalizado" }));
    expect(screen.getByLabelText("Desde")).toBeVisible();
    expect(screen.getByLabelText("Hasta")).toBeVisible();
  });

  it.each([
    ["2026-10-10", "2026-10-09", "La fecha final no puede ser anterior a la inicial"],
    ["2026-10-20", "2026-10-24", "No se pueden elegir fechas futuras"],
    ["2025-10-22", "2026-10-23", "El período no puede superar 366 días"],
  ])("shows an error and disables download for %s..%s", async (from, to, message) => {
    renderRoute();
    await screen.findByText(/30 días/);
    pickCustom(from, to);
    expect(await screen.findByText(message)).toBeVisible();
    expect(screen.getByRole("button", { name: "Descargar CSV" })).toBeDisabled();
    expect(screen.queryByText(/con registro/)).not.toBeInTheDocument();
  });

  it("accepts exactly 366 days", async () => {
    renderRoute();
    pickCustom("2025-10-23", "2026-10-23");
    expect(await screen.findByText(/^366 días/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Descargar CSV" })).toBeEnabled();
  });
});

describe("ExportRoute format and download", () => {
  it("labels the cards CSV and PDF and defaults to CSV", async () => {
    renderRoute();
    await screen.findByText(/30 días/);
    expect(screen.getByRole("button", { name: "CSV" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "PDF" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Descargar CSV" })).toBeEnabled();
  });

  it("runs the export with the current range and format", async () => {
    renderRoute();
    const button = await screen.findByRole("button", { name: "Descargar CSV" });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    expect(mockRun).toHaveBeenCalledWith({ from: "2026-09-24", to: "2026-10-23" }, "csv");
  });

  it("is disabled and shows a busy label while working", async () => {
    mockStatus = "working";
    renderRoute();
    await screen.findByText(/30 días/);
    expect(screen.getByRole("button", { name: /Generando/ })).toBeDisabled();
  });

  it("shows an error message when generation failed", async () => {
    mockStatus = "error";
    renderRoute();
    expect(
      await screen.findByText("No se pudo generar el archivo. Intentá de nuevo.")
    ).toBeVisible();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Descargar CSV" })).toBeEnabled()
    );
  });
});

describe("ExportRoute empty states", () => {
  it("shows the empty notice and disables download with no meals and no progress", async () => {
    setData(0);
    renderRoute();
    expect(await screen.findByText("No hay datos en este período.")).toBeVisible();
    expect(screen.getByText("30 días · 0 con registro · 30 sin registro")).toBeVisible();
    expect(screen.getByRole("button", { name: "Descargar CSV" })).toBeDisabled();
  });

  it("allows download with only progress and shows an informational note", async () => {
    setData(0, [3]);
    renderRoute();
    expect(
      await screen.findByText(
        "Este período no tiene comidas registradas; solo se exportarán medidas corporales."
      )
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Descargar CSV" })).toBeEnabled();
    expect(screen.queryByText("No hay datos en este período.")).not.toBeInTheDocument();
  });
});

describe("ExportRoute navigation", () => {
  it("goes back with the ChevronLeft button", async () => {
    renderRoute();
    await screen.findByText(/30 días/);
    fireEvent.click(screen.getByRole("button", { name: "Volver" }));
    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });
});
