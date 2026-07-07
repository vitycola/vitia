/** @jest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MeasurementsHistoryOverlay } from "../MeasurementsHistoryOverlay";

describe("MeasurementsHistoryOverlay", () => {
  it("renders exactly one row per sparse logged entry — never a placeholder for unlogged days", () => {
    const rows = [
      { date: "2026-07-03", value: 89 },
      { date: "2026-07-01", value: 90 },
    ];

    render(<MeasurementsHistoryOverlay rows={rows} onClose={jest.fn()} />);

    expect(screen.getAllByTestId("overlay-row")).toHaveLength(2);
  });

  it("shows the value with a 'cm' unit suffix", () => {
    const rows = [{ date: "2026-07-01", value: 92 }];

    render(<MeasurementsHistoryOverlay rows={rows} onClose={jest.fn()} />);

    expect(screen.getByText(/92([.,]0)?\s*cm/)).toBeInTheDocument();
  });

  it("renders rows in the order provided (descending date order is the caller's contract)", () => {
    const rows = [
      { date: "2026-07-03", value: 89 },
      { date: "2026-07-01", value: 90 },
    ];

    render(<MeasurementsHistoryOverlay rows={rows} onClose={jest.fn()} />);

    const renderedRows = screen.getAllByTestId("overlay-row");
    expect(renderedRows[0].textContent).toMatch(/89/);
    expect(renderedRows[1].textContent).toMatch(/90/);
  });

  it("renders zero rows when there are no logged entries", () => {
    render(<MeasurementsHistoryOverlay rows={[]} onClose={jest.fn()} />);

    expect(screen.queryAllByTestId("overlay-row")).toHaveLength(0);
  });

  it("calls onClose when the close control is activated", () => {
    const onClose = jest.fn();
    render(
      <MeasurementsHistoryOverlay rows={[{ date: "2026-07-01", value: 90 }]} onClose={onClose} />
    );

    fireEvent.click(screen.getByRole("button", { name: /cerrar/i }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders as a dialog role for accessibility", () => {
    render(
      <MeasurementsHistoryOverlay rows={[{ date: "2026-07-01", value: 90 }]} onClose={jest.fn()} />
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
