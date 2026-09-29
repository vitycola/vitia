/** @jest-environment jsdom */
/**
 * Regression tests for the MealSection context menu:
 * - no ancestor of the menu clips it (jsdom cannot measure layout, so we
 *   assert the absence of the clipping utility class on the ancestor chain)
 * - outside taps dismiss it via pointerdown (iOS Safari does not synthesize
 *   mousedown for taps on non-clickable targets)
 * - "Vaciar comida", the copy-from-previous-day banner and "Repetir comida"
 *   are available on any day (no isToday gating)
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

const mockGetByDateAndMeal = jest.fn();
jest.mock("@/db/repos/mealEntries", () => ({
  getByDateAndMeal: (...args: unknown[]) => mockGetByDateAndMeal(...args),
}));

import type { MealEntryView } from "@/db/repos/mealEntries";
import type { MealEntry } from "@/db/schema";
import { todayISO } from "@/lib/date";
import { useMealClipboardStore } from "@/stores/useMealClipboardStore";
import { MealSection } from "../MealSection";

function makeEntry(overrides: Partial<MealEntryView> = {}): MealEntryView {
  return {
    id: "e1",
    date: "2026-09-20",
    mealType: "breakfast",
    foodId: "f1",
    foodName: "Avena",
    quantityG: 50,
    calories: 190,
    proteinG: 7,
    carbsG: 32,
    fatG: 3,
    loggedAt: "2026-09-20T08:00:00.000Z",
    brand: null,
    ...overrides,
  } as MealEntryView;
}

function renderSection(
  props: Partial<React.ComponentProps<typeof MealSection>> = {}
): ReturnType<typeof render> {
  return render(
    <MealSection
      mealType="breakfast"
      entries={[]}
      onAddFood={jest.fn()}
      onDeleteEntry={jest.fn()}
      onEditEntry={jest.fn()}
      selectedDate="2026-09-20"
      onRepeatMeal={jest.fn().mockResolvedValue(0)}
      onPasteMeal={jest.fn().mockResolvedValue(0)}
      onClearMeal={jest.fn().mockResolvedValue(undefined)}
      onAcceptSuggestion={jest.fn().mockResolvedValue(0)}
      {...props}
    />
  );
}

function openMenu() {
  fireEvent.click(screen.getByRole("button", { name: "Opciones para Desayuno" }));
}

/** Ancestors of the menu panel (excluding the panel itself) up to the render container. */
function menuAncestors(container: HTMLElement): HTMLElement[] {
  const menu = screen.getByText("Copiar").parentElement as HTMLElement;
  const chain: HTMLElement[] = [];
  let node = menu.parentElement;
  while (node && node !== container.parentElement) {
    chain.push(node);
    node = node.parentElement;
  }
  return chain;
}

beforeEach(() => {
  mockGetByDateAndMeal.mockReset().mockResolvedValue([]);
  useMealClipboardStore.setState({ clipboardMeal: null });
});

describe("MealSection menu — not clipped by ancestors", () => {
  it("has no overflow-hidden ancestor on an empty card", () => {
    const { container } = renderSection({ entries: [] });
    openMenu();

    const chain = menuAncestors(container);
    expect(chain.length).toBeGreaterThan(1);
    expect(chain.filter((el) => el.classList.contains("overflow-hidden"))).toHaveLength(0);
  });

  it("has no overflow-hidden ancestor on a card with entries", () => {
    const { container } = renderSection({ entries: [makeEntry()] });
    openMenu();

    const chain = menuAncestors(container);
    expect(screen.getByText("Avena")).toBeInTheDocument();
    expect(chain.filter((el) => el.classList.contains("overflow-hidden"))).toHaveLength(0);
  });

  it("has no overflow-hidden ancestor when the card is collapsed", () => {
    const { container } = renderSection({ entries: [makeEntry()] });
    fireEvent.click(screen.getByRole("button", { expanded: true }));
    expect(screen.queryByText("Avena")).not.toBeInTheDocument();
    openMenu();

    const chain = menuAncestors(container);
    expect(screen.getByText("Copiar")).toBeInTheDocument();
    expect(chain.filter((el) => el.classList.contains("overflow-hidden"))).toHaveLength(0);
  });
});

describe("MealSection menu — outside dismissal on touch", () => {
  it("closes when a pointerdown happens outside the menu", () => {
    renderSection();
    openMenu();
    expect(screen.getByText("Copiar")).toBeInTheDocument();

    fireEvent.pointerDown(document.body);

    expect(screen.queryByText("Copiar")).not.toBeInTheDocument();
  });

  it("stays open when a pointerdown happens inside the menu", () => {
    renderSection();
    openMenu();

    fireEvent.pointerDown(screen.getByText("Copiar"));

    expect(screen.getByText("Copiar")).toBeInTheDocument();
    expect(screen.getByText("Repetir comida")).toBeInTheDocument();
  });
});

describe("MealSection menu — Repetir comida", () => {
  it.each(["2026-09-20", "2099-01-05", todayISO()])(
    "calls onRepeatMeal with only the meal type on %s",
    async (selectedDate) => {
      const onRepeatMeal = jest.fn().mockResolvedValue(0);
      renderSection({ selectedDate, onRepeatMeal });
      openMenu();

      fireEvent.click(screen.getByText("Repetir comida"));

      await waitFor(() => expect(onRepeatMeal).toHaveBeenCalledTimes(1));
      expect(onRepeatMeal).toHaveBeenCalledWith("breakfast");
    }
  );
});

describe("MealSection menu — Vaciar comida on any day", () => {
  it.each(["2026-09-20", "2099-01-05", todayISO()])(
    "clears the meal on %s after confirming",
    async (selectedDate) => {
      const onClearMeal = jest.fn().mockResolvedValue(undefined);
      const confirmSpy = jest.spyOn(window, "confirm").mockReturnValue(true);
      renderSection({ selectedDate, entries: [makeEntry()], onClearMeal });
      openMenu();

      fireEvent.click(screen.getByText("Vaciar comida"));

      await waitFor(() => expect(onClearMeal).toHaveBeenCalledWith("breakfast"));
      confirmSpy.mockRestore();
    }
  );

  it("does not clear when the confirmation is canceled", () => {
    const onClearMeal = jest.fn();
    const confirmSpy = jest.spyOn(window, "confirm").mockReturnValue(false);
    renderSection({ selectedDate: "2026-09-20", entries: [makeEntry()], onClearMeal });
    openMenu();

    fireEvent.click(screen.getByText("Vaciar comida"));

    expect(onClearMeal).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });
});

describe("MealSection — copy-from-previous-day banner", () => {
  const previousRow = makeEntry({ id: "p1", date: "2026-09-19" });

  it("shows the previous-day title on a past day and looks up date - 1", async () => {
    mockGetByDateAndMeal.mockResolvedValue([previousRow]);
    renderSection({ selectedDate: "2026-09-20" });

    expect(await screen.findByText("¿Copiar del día anterior?")).toBeInTheDocument();
    expect(mockGetByDateAndMeal).toHaveBeenCalledWith("2026-09-19", "breakfast");
  });

  it("shows the previous-day title on a future day", async () => {
    mockGetByDateAndMeal.mockResolvedValue([previousRow]);
    renderSection({ selectedDate: "2099-01-05" });

    expect(await screen.findByText("¿Copiar del día anterior?")).toBeInTheDocument();
  });

  it("shows '¿Copiar de ayer?' on today", async () => {
    mockGetByDateAndMeal.mockResolvedValue([previousRow]);
    renderSection({ selectedDate: todayISO() });

    expect(await screen.findByText("¿Copiar de ayer?")).toBeInTheDocument();
    expect(screen.queryByText("¿Copiar del día anterior?")).not.toBeInTheDocument();
  });

  it("is absent when the meal already has entries", async () => {
    mockGetByDateAndMeal.mockResolvedValue([previousRow]);
    renderSection({ selectedDate: "2026-09-20", entries: [makeEntry()] });

    await waitFor(() => expect(screen.getByText("Avena")).toBeInTheDocument());
    expect(screen.queryByText("¿Copiar del día anterior?")).not.toBeInTheDocument();
    expect(mockGetByDateAndMeal).not.toHaveBeenCalled();
  });

  it("is absent when the previous day has no entries", async () => {
    mockGetByDateAndMeal.mockResolvedValue([]);
    renderSection({ selectedDate: "2026-09-20" });

    await waitFor(() =>
      expect(mockGetByDateAndMeal).toHaveBeenCalledWith("2026-09-19", "breakfast")
    );
    expect(screen.queryByText("¿Copiar del día anterior?")).not.toBeInTheDocument();
  });
});

describe("MealSection menu — Pegar available on any day", () => {
  function fillClipboard() {
    useMealClipboardStore.getState().copyMeal([makeEntry() as unknown as MealEntry], "breakfast");
  }

  it("shows Pegar and calls onPasteMeal on a non-today day with a clipboard", async () => {
    fillClipboard();
    const onPasteMeal = jest.fn().mockResolvedValue(1);
    renderSection({ onPasteMeal });
    openMenu();

    fireEvent.click(screen.getByText("Pegar"));

    await waitFor(() => expect(onPasteMeal).toHaveBeenCalledWith("breakfast"));
  });

  it("shows Pegar and calls onPasteMeal on today with a clipboard", async () => {
    fillClipboard();
    const onPasteMeal = jest.fn().mockResolvedValue(1);
    renderSection({ selectedDate: todayISO(), onPasteMeal });
    openMenu();

    fireEvent.click(screen.getByText("Pegar"));

    await waitFor(() => expect(onPasteMeal).toHaveBeenCalledWith("breakfast"));
  });

  it("hides Pegar when the clipboard is empty", () => {
    renderSection();
    openMenu();

    expect(screen.queryByText("Pegar")).not.toBeInTheDocument();
  });
});
