/** @jest-environment jsdom */
/**
 * Render tests for WeekCalendarHeader navigation: week chevrons, "Hoy"
 * shortcut, native date picker, selectedDate resync and local-date "today".
 *
 * The fake clock is 2026-10-01T01:30Z which is 2026-09-30 22:30 in the fixed
 * test timezone (America/Argentina/Buenos_Aires, set by the `test` script), so
 * a UTC-based "today" would wrongly resolve to 2026-10-01.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

jest.mock("@/hooks/useWeekProgress", () => ({ useWeekProgress: () => ({}) }));

import { WeekCalendarHeader } from "../WeekCalendarHeader";

const TODAY = "2026-09-30"; // Wednesday; week Mon 09-28 .. Sun 10-04

function setup(selectedDate = TODAY) {
  const onSelectDate = jest.fn();
  const utils = render(
    <WeekCalendarHeader selectedDate={selectedDate} onSelectDate={onSelectDate} />
  );
  const rerenderWith = (date: string) =>
    utils.rerender(<WeekCalendarHeader selectedDate={date} onSelectDate={onSelectDate} />);
  return { onSelectDate, rerenderWith };
}

const hoyButton = () => screen.queryByRole("button", { name: "Hoy" });

beforeEach(() => {
  jest.useFakeTimers({ now: new Date("2026-10-01T01:30:00Z") });
});

afterEach(() => {
  jest.useRealTimers();
});

describe("WeekCalendarHeader — week chevrons (WN-1)", () => {
  it("previous chevron shifts the strip back 7 days without selecting", () => {
    const { onSelectDate } = setup();
    expect(screen.getByLabelText("2026-09-28")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Semana anterior" }));

    expect(screen.getByLabelText("2026-09-21")).toBeInTheDocument();
    expect(screen.getByLabelText("2026-09-27")).toBeInTheDocument();
    expect(screen.queryByLabelText("2026-09-28")).not.toBeInTheDocument();
    expect(onSelectDate).not.toHaveBeenCalled();
  });

  it("next chevron moves into a future week without selecting", () => {
    const { onSelectDate } = setup();

    fireEvent.click(screen.getByRole("button", { name: "Semana siguiente" }));

    expect(screen.getByLabelText("2026-10-05")).toBeInTheDocument();
    expect(screen.getByLabelText("2026-10-11")).toBeInTheDocument();
    expect(onSelectDate).not.toHaveBeenCalled();
  });
});

describe("WeekCalendarHeader — Hoy shortcut (WN-2)", () => {
  it("is hidden when selectedDate is today and the visible week is today's", () => {
    setup(TODAY);
    expect(hoyButton()).not.toBeInTheDocument();
  });

  it("is shown when selectedDate is not today", () => {
    setup("2026-09-01");
    expect(hoyButton()).toBeInTheDocument();
  });

  it("is shown after browsing away with a chevron even if today is selected", () => {
    setup(TODAY);
    fireEvent.click(screen.getByRole("button", { name: "Semana anterior" }));
    expect(hoyButton()).toBeInTheDocument();
  });

  it("selects today and returns to today's week when tapped", () => {
    const { onSelectDate } = setup("2026-09-01");
    expect(screen.getByLabelText("2026-08-31")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Hoy" }));

    expect(onSelectDate).toHaveBeenCalledWith(TODAY);
  });

  it("resets the visible week when today is already selected but the view was browsed away", () => {
    const { onSelectDate } = setup(TODAY);
    fireEvent.click(screen.getByRole("button", { name: "Semana anterior" }));
    expect(screen.queryByLabelText("2026-09-28")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Hoy" }));

    expect(screen.getByLabelText("2026-09-28")).toBeInTheDocument();
    expect(onSelectDate).toHaveBeenCalledWith(TODAY);
    expect(hoyButton()).not.toBeInTheDocument();
  });
});

describe("WeekCalendarHeader — selectedDate resync (WN-4)", () => {
  it("shows the week containing an externally changed selectedDate", () => {
    const { rerenderWith } = setup(TODAY);

    rerenderWith("2026-03-10");

    expect(screen.getByLabelText("2026-03-09")).toBeInTheDocument();
    expect(screen.getByLabelText("2026-03-15")).toBeInTheDocument();
    expect(screen.queryByLabelText("2026-09-28")).not.toBeInTheDocument();
  });

  it("does not snap back a chevron-browsed week while selectedDate is unchanged", () => {
    const { rerenderWith } = setup(TODAY);
    fireEvent.click(screen.getByRole("button", { name: "Semana anterior" }));

    rerenderWith(TODAY);

    expect(screen.getByLabelText("2026-09-21")).toBeInTheDocument();
    expect(screen.queryByLabelText("2026-09-28")).not.toBeInTheDocument();
  });
});

describe("WeekCalendarHeader — date picker (WN-3)", () => {
  it("selects the picked date", () => {
    const { onSelectDate } = setup();

    fireEvent.change(screen.getByLabelText("Elegir fecha"), { target: { value: "2026-03-10" } });

    expect(onSelectDate).toHaveBeenCalledWith("2026-03-10");
  });

  it("ignores an empty value", () => {
    const { onSelectDate } = setup();

    fireEvent.change(screen.getByLabelText("Elegir fecha"), { target: { value: "" } });

    expect(onSelectDate).not.toHaveBeenCalled();
    expect(screen.getByLabelText("2026-09-28")).toBeInTheDocument();
  });
});

describe("WeekCalendarHeader — local-date today (WN-5)", () => {
  it("treats the local date as today even when the UTC date is tomorrow", () => {
    setup("2026-09-30");
    expect(hoyButton()).not.toBeInTheDocument();
  });

  it("treats the UTC date (local tomorrow) as not today", () => {
    setup("2026-10-01");
    expect(hoyButton()).toBeInTheDocument();
  });
});
