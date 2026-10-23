/** @jest-environment jsdom */
import { act, renderHook } from "@testing-library/react";
import { useDataExport } from "../useDataExport";

jest.mock("@/db/repos/mealEntries", () => ({
  getLoggedTotalsByDateRange: jest.fn(),
}));
jest.mock("@/db/repos/progress", () => ({ getRange: jest.fn() }));
jest.mock("@/db/repos/profile", () => ({ getProfile: jest.fn() }));
jest.mock("@/lib/exportDelivery", () => ({ deliverFile: jest.fn() }));
jest.mock("@/lib/exportPdf", () => ({ toPdf: jest.fn() }));

import * as mealRepo from "@/db/repos/mealEntries";
import * as profileRepo from "@/db/repos/profile";
import * as progressRepo from "@/db/repos/progress";
import { deliverFile } from "@/lib/exportDelivery";
import { toPdf } from "@/lib/exportPdf";

const getTotals = mealRepo.getLoggedTotalsByDateRange as jest.Mock;
const getRange = progressRepo.getRange as jest.Mock;
const getProfile = profileRepo.getProfile as jest.Mock;
const deliver = deliverFile as jest.Mock;
const pdf = toPdf as jest.Mock;

function readBlob(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

const range = { from: "2026-10-01", to: "2026-10-02" };

beforeEach(() => {
  jest.clearAllMocks();
  getTotals.mockResolvedValue([
    { date: "2026-10-01", calories: 2000, proteinG: 100, carbsG: 200, fatG: 60 },
  ]);
  getRange.mockResolvedValue([]);
  getProfile.mockResolvedValue({
    calorieGoal: 2200,
    proteinGoalG: 150,
    carbsGoalG: 250,
    fatGoalG: 70,
  });
  deliver.mockResolvedValue("downloaded");
  pdf.mockResolvedValue(new Blob(["%PDF"], { type: "application/pdf" }));
});

describe("useDataExport", () => {
  it("reads the facade for the range, builds a CSV and delivers it", async () => {
    const { result } = renderHook(() => useDataExport());
    expect(result.current.status).toBe("idle");

    await act(async () => {
      await result.current.run(range, "csv");
    });

    expect(getTotals).toHaveBeenCalledWith("2026-10-01", "2026-10-02");
    expect(getRange).toHaveBeenCalledWith("2026-10-01", "2026-10-02");
    expect(getProfile).toHaveBeenCalledTimes(1);

    expect(deliver).toHaveBeenCalledTimes(1);
    const [blob, name] = deliver.mock.calls[0] as [Blob, string];
    expect(name).toBe("vitia-2026-10-01_2026-10-02.csv");
    expect(blob.type).toBe("text/csv;charset=utf-8");
    const text = await readBlob(blob);
    expect(text.split("\r\n")[1]).toBe("2026-10-01,true,2000,100,200,60,,,,,,,,,2200,150,250,70");
    expect(result.current.status).toBe("idle");
  });

  it("goes through the working state while generating", async () => {
    let release: (v: string) => void = () => {};
    deliver.mockReturnValue(
      new Promise((r) => {
        release = r;
      })
    );
    const { result } = renderHook(() => useDataExport());

    let pending: Promise<void> = Promise.resolve();
    act(() => {
      pending = result.current.run(range, "csv");
    });
    expect(result.current.status).toBe("working");

    await act(async () => {
      release("downloaded");
      await pending;
    });
    expect(result.current.status).toBe("idle");
  });

  it("sets the error status when generation fails and stays usable", async () => {
    getTotals.mockRejectedValueOnce(new Error("db down"));
    const { result } = renderHook(() => useDataExport());

    await act(async () => {
      await result.current.run(range, "csv");
    });
    expect(result.current.status).toBe("error");

    await act(async () => {
      await result.current.run(range, "csv");
    });
    expect(result.current.status).toBe("idle");
  });

  it("treats a cancelled share as success, not an error", async () => {
    deliver.mockResolvedValue("cancelled");
    const { result } = renderHook(() => useDataExport());
    await act(async () => {
      await result.current.run(range, "csv");
    });
    expect(result.current.status).toBe("idle");
  });

  it("sets error when delivery throws", async () => {
    deliver.mockRejectedValue(new Error("no path"));
    const { result } = renderHook(() => useDataExport());
    await act(async () => {
      await result.current.run(range, "csv");
    });
    expect(result.current.status).toBe("error");
  });
});

describe("useDataExport PDF branch", () => {
  it("lazily builds a PDF and delivers it with a .pdf name", async () => {
    const { result } = renderHook(() => useDataExport());
    await act(async () => {
      await result.current.run(range, "pdf");
    });

    expect(pdf).toHaveBeenCalledTimes(1);
    expect(pdf.mock.calls[0][0]).toMatchObject({ range });
    const [blob, name] = deliver.mock.calls[0] as [Blob, string];
    expect(name).toBe("vitia-2026-10-01_2026-10-02.pdf");
    expect(blob.type).toBe("application/pdf");
    expect(result.current.status).toBe("idle");
  });

  it("never loads the PDF module for a CSV export", async () => {
    const { result } = renderHook(() => useDataExport());
    await act(async () => {
      await result.current.run(range, "csv");
    });
    expect(pdf).not.toHaveBeenCalled();
  });

  it("reports an error when PDF generation fails", async () => {
    pdf.mockRejectedValueOnce(new Error("pdf boom"));
    const { result } = renderHook(() => useDataExport());
    await act(async () => {
      await result.current.run(range, "pdf");
    });
    expect(result.current.status).toBe("error");
    expect(deliver).not.toHaveBeenCalled();
  });
});
