/** @jest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { CalorieHistoryOverlay } from "../CalorieHistoryOverlay";

describe("CalorieHistoryOverlay", () => {
  it("renders exactly one row per entry in the window (7-day)", () => {
    const rows = [
      { date: "2026-07-01", kcal: 2000 },
      { date: "2026-07-02", kcal: 0 },
      { date: "2026-07-03", kcal: 1900 },
      { date: "2026-07-04", kcal: 0 },
      { date: "2026-07-05", kcal: 2100 },
      { date: "2026-07-06", kcal: 0 },
      { date: "2026-07-07", kcal: 1800 },
    ];

    render(<CalorieHistoryOverlay rows={rows} onClose={jest.fn()} />);

    expect(screen.getAllByTestId("overlay-row")).toHaveLength(7);
  });

  it("shows un-logged days as an explicit '0 kcal' row — never omitted", () => {
    const rows = [{ date: "2026-07-02", kcal: 0 }];

    render(<CalorieHistoryOverlay rows={rows} onClose={jest.fn()} />);

    expect(screen.getByText(/0 kcal/)).toBeInTheDocument();
  });

  it("renders 90 rows without re-bucketing when given a 90-row window", () => {
    const rows = Array.from({ length: 90 }, (_, i) => ({
      date: `day-${i}`,
      kcal: i,
    }));

    render(<CalorieHistoryOverlay rows={rows} onClose={jest.fn()} />);

    expect(screen.getAllByTestId("overlay-row")).toHaveLength(90);
  });

  it("calls onClose when the close control is activated", () => {
    const onClose = jest.fn();
    render(<CalorieHistoryOverlay rows={[{ date: "2026-07-01", kcal: 2000 }]} onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: /cerrar/i }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders as a dialog role for accessibility", () => {
    render(
      <CalorieHistoryOverlay rows={[{ date: "2026-07-01", kcal: 2000 }]} onClose={jest.fn()} />
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
