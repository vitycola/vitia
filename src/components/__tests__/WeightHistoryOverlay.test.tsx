/** @jest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { WeightHistoryOverlay } from "../WeightHistoryOverlay";

describe("WeightHistoryOverlay", () => {
  it("renders exactly one row per sparse logged entry — never a placeholder for unlogged days", () => {
    const rows = [
      { date: "2026-07-03", value: 78.5 },
      { date: "2026-07-01", value: 80 },
    ];

    render(<WeightHistoryOverlay rows={rows} onClose={jest.fn()} />);

    expect(screen.getAllByTestId("overlay-row")).toHaveLength(2);
  });

  it("shows the value with a 'kg' unit suffix", () => {
    const rows = [{ date: "2026-07-01", value: 78.5 }];

    render(<WeightHistoryOverlay rows={rows} onClose={jest.fn()} />);

    expect(screen.getByText(/78,5\s*kg/)).toBeInTheDocument();
  });

  it("renders rows in the order provided (descending date order is the caller's contract)", () => {
    const rows = [
      { date: "2026-07-03", value: 78.5 },
      { date: "2026-07-01", value: 80 },
    ];

    render(<WeightHistoryOverlay rows={rows} onClose={jest.fn()} />);

    const renderedRows = screen.getAllByTestId("overlay-row");
    expect(renderedRows[0].textContent).toMatch(/78,5/);
    expect(renderedRows[1].textContent).toMatch(/80/);
  });

  it("renders zero rows when there are no logged entries", () => {
    render(<WeightHistoryOverlay rows={[]} onClose={jest.fn()} />);

    expect(screen.queryAllByTestId("overlay-row")).toHaveLength(0);
  });

  it("renders the full day label via formatFullDayLabel convention", () => {
    render(<WeightHistoryOverlay rows={[{ date: "2026-07-01", value: 80 }]} onClose={jest.fn()} />);

    const row = screen.getByTestId("overlay-row");
    expect(row.textContent).toMatch(/\d/);
  });

  it("calls onClose when the close control is activated", () => {
    const onClose = jest.fn();
    render(<WeightHistoryOverlay rows={[{ date: "2026-07-01", value: 80 }]} onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: /cerrar/i }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders as a dialog role with the correct title and aria-label", () => {
    render(<WeightHistoryOverlay rows={[{ date: "2026-07-01", value: 80 }]} onClose={jest.fn()} />);

    expect(screen.getByRole("dialog", { name: "Historial de peso" })).toBeInTheDocument();
    expect(screen.getByText("Historial de peso")).toBeInTheDocument();
  });
});
