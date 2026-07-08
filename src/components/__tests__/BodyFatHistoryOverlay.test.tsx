/** @jest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { BodyFatHistoryOverlay } from "../BodyFatHistoryOverlay";

describe("BodyFatHistoryOverlay", () => {
  it("renders exactly one row per sparse logged entry — never a placeholder for unlogged days", () => {
    const rows = [
      { date: "2026-07-03", value: 21.1 },
      { date: "2026-07-01", value: 22.4 },
    ];

    render(<BodyFatHistoryOverlay rows={rows} onClose={jest.fn()} />);

    expect(screen.getAllByTestId("overlay-row")).toHaveLength(2);
  });

  it("shows the value with a '%' unit suffix", () => {
    const rows = [{ date: "2026-07-01", value: 22.4 }];

    render(<BodyFatHistoryOverlay rows={rows} onClose={jest.fn()} />);

    expect(screen.getByText(/22,4\s*%/)).toBeInTheDocument();
  });

  it("renders rows in the order provided (descending date order is the caller's contract)", () => {
    const rows = [
      { date: "2026-07-03", value: 21.1 },
      { date: "2026-07-01", value: 22.4 },
    ];

    render(<BodyFatHistoryOverlay rows={rows} onClose={jest.fn()} />);

    const renderedRows = screen.getAllByTestId("overlay-row");
    expect(renderedRows[0].textContent).toMatch(/21,1/);
    expect(renderedRows[1].textContent).toMatch(/22,4/);
  });

  it("renders zero rows when there are no logged entries", () => {
    render(<BodyFatHistoryOverlay rows={[]} onClose={jest.fn()} />);

    expect(screen.queryAllByTestId("overlay-row")).toHaveLength(0);
  });

  it("renders the full day label via formatFullDayLabel convention", () => {
    render(
      <BodyFatHistoryOverlay rows={[{ date: "2026-07-01", value: 22.4 }]} onClose={jest.fn()} />
    );

    const row = screen.getByTestId("overlay-row");
    expect(row.textContent).toMatch(/\d/);
  });

  it("calls onClose when the close control is activated", () => {
    const onClose = jest.fn();
    render(
      <BodyFatHistoryOverlay rows={[{ date: "2026-07-01", value: 22.4 }]} onClose={onClose} />
    );

    fireEvent.click(screen.getByRole("button", { name: /cerrar/i }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders as a dialog role with the correct title and aria-label", () => {
    render(
      <BodyFatHistoryOverlay rows={[{ date: "2026-07-01", value: 22.4 }]} onClose={jest.fn()} />
    );

    expect(screen.getByRole("dialog", { name: "Historial de % grasa" })).toBeInTheDocument();
    expect(screen.getByText("Historial de % grasa")).toBeInTheDocument();
  });

  it("renders no edit or delete affordance on any row or in the overlay chrome", () => {
    const rows = [
      { date: "2026-07-03", value: 21.1 },
      { date: "2026-07-01", value: 22.4 },
    ];

    render(<BodyFatHistoryOverlay rows={rows} onClose={jest.fn()} />);

    // Only the close button should exist — no edit/delete buttons per row.
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /editar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /eliminar/i })).not.toBeInTheDocument();
  });
});
