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

  it("reset() returns an errored hook to idle", async () => {
    deliver.mockRejectedValue(new Error("no path"));
    const { result } = renderHook(() => useDataExport());
    await act(async () => {
      await result.current.run(range, "csv");
    });
    expect(result.current.status).toBe("error");

    act(() => result.current.reset());
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

function deferred<T>() {
  let resolve: (v: T) => void = () => {};
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe("useDataExport selection changes during a run", () => {
  it("reset() is a no-op while working and a second run is ignored", async () => {
    const gate = deferred<string>();
    deliver.mockReturnValue(gate.promise);
    const { result } = renderHook(() => useDataExport());

    let first: Promise<void> = Promise.resolve();
    act(() => {
      first = result.current.run(range, "csv");
    });
    expect(result.current.status).toBe("working");

    act(() => result.current.reset());
    expect(result.current.status).toBe("working");

    await act(async () => {
      await result.current.run(range, "csv");
    });
    expect(getProfile).toHaveBeenCalledTimes(1);

    await act(async () => {
      gate.resolve("downloaded");
      await first;
    });
    expect(deliver).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe("idle");
  });

  it("reset() clears a previous error", async () => {
    deliver.mockRejectedValueOnce(new Error("no path"));
    const { result } = renderHook(() => useDataExport());
    await act(async () => {
      await result.current.run(range, "csv");
    });
    expect(result.current.status).toBe("error");
    act(() => result.current.reset());
    expect(result.current.status).toBe("idle");
  });
});

describe("useDataExport share step (iOS)", () => {
  const originalShare = Object.getOwnPropertyDescriptor(navigator, "share");
  let share: jest.Mock;

  beforeEach(() => {
    share = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", { value: share, configurable: true });
    deliver.mockResolvedValue("needs-share");
  });

  afterEach(() => {
    if (originalShare) Object.defineProperty(navigator, "share", originalShare);
    else Reflect.deleteProperty(navigator, "share");
  });

  async function runToReady() {
    const hook = renderHook(() => useDataExport());
    await act(async () => {
      await hook.result.current.run(range, "csv");
    });
    return hook;
  }

  it("enters ready-to-share when delivery needs a fresh tap", async () => {
    const { result } = await runToReady();
    expect(result.current.status).toBe("ready-to-share");
    expect(share).not.toHaveBeenCalled();
  });

  it("shareNow shares the stored file synchronously and returns to idle", async () => {
    const { result } = await runToReady();

    let pending: Promise<void> = Promise.resolve();
    act(() => {
      pending = result.current.shareNow();
    });
    // Called inside the tap handler tick, before any await resumes.
    expect(share).toHaveBeenCalledTimes(1);
    const arg = share.mock.calls[0][0] as { files: File[] };
    expect(arg.files).toHaveLength(1);
    expect(arg.files[0]).toBeInstanceOf(File);
    expect(arg.files[0].name).toBe("vitia-2026-10-01_2026-10-02.csv");
    expect(arg.files[0].type).toBe("text/csv;charset=utf-8");
    expect(deliver).toHaveBeenCalledTimes(1);

    await act(async () => {
      await pending;
    });
    expect(result.current.status).toBe("idle");

    // The stored file was cleared: a second shareNow is a no-op.
    await act(async () => {
      await result.current.shareNow();
    });
    expect(share).toHaveBeenCalledTimes(1);
  });

  it("stays ready-to-share when the share sheet is dismissed", async () => {
    share.mockRejectedValue(Object.assign(new Error("cancel"), { name: "AbortError" }));
    const { result } = await runToReady();
    await act(async () => {
      await result.current.shareNow();
    });
    expect(result.current.status).toBe("ready-to-share");

    share.mockResolvedValue(undefined);
    await act(async () => {
      await result.current.shareNow();
    });
    expect(share).toHaveBeenCalledTimes(2);
    expect(result.current.status).toBe("idle");
  });

  it("sets error when sharing fails for another reason", async () => {
    share.mockRejectedValue(Object.assign(new Error("denied"), { name: "NotAllowedError" }));
    const { result } = await runToReady();
    await act(async () => {
      await result.current.shareNow();
    });
    expect(result.current.status).toBe("error");
  });

  it("sets error when navigator.share throws synchronously", async () => {
    share.mockImplementation(() => {
      throw new TypeError("nope");
    });
    const { result } = await runToReady();
    await act(async () => {
      await result.current.shareNow();
    });
    expect(result.current.status).toBe("error");
  });

  it("reset() clears the stored file and returns to idle", async () => {
    const { result } = await runToReady();
    act(() => result.current.reset());
    expect(result.current.status).toBe("idle");
    await act(async () => {
      await result.current.shareNow();
    });
    expect(share).not.toHaveBeenCalled();
  });

  it("does not share after unmount", async () => {
    const { result, unmount } = await runToReady();
    const { shareNow } = result.current;
    unmount();
    await shareNow();
    expect(share).not.toHaveBeenCalled();
  });
});
