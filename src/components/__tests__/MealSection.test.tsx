/** @jest-environment jsdom */
/**
 * Regression tests for the MealSection context menu:
 * - no ancestor of the menu clips it (jsdom cannot measure layout, so we
 *   assert the absence of the clipping utility class on the ancestor chain)
 * - outside taps dismiss it via pointerdown (iOS Safari does not synthesize
 *   mousedown for taps on non-clickable targets)
 * - "Repetir comida" source-date behavior is unchanged
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

const mockGetByDateAndMeal = jest.fn();
jest.mock("@/db/repos/mealEntries", () => ({
  getByDateAndMeal: (...args: unknown[]) => mockGetByDateAndMeal(...args),
}));

import type { MealEntryView } from "@/db/repos/mealEntries";
import type { MealEntry } from "@/db/schema";
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
      isToday={false}
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

describe("MealSection menu — Repetir comida unchanged", () => {
  it("passes the selected date as source when not today", async () => {
    const onRepeatMeal = jest.fn().mockResolvedValue(0);
    renderSection({ isToday: false, selectedDate: "2026-09-20", onRepeatMeal });
    openMenu();

    fireEvent.click(screen.getByText("Repetir comida"));

    await waitFor(() => expect(onRepeatMeal).toHaveBeenCalledWith("breakfast", "2026-09-20"));
  });

  it("passes undefined as source when today", async () => {
    const onRepeatMeal = jest.fn().mockResolvedValue(0);
    renderSection({ isToday: true, selectedDate: "2026-09-29", onRepeatMeal });
    openMenu();

    fireEvent.click(screen.getByText("Repetir comida"));

    await waitFor(() => expect(onRepeatMeal).toHaveBeenCalledWith("breakfast", undefined));
  });
});

describe("MealSection menu — Pegar available on any day", () => {
  function fillClipboard() {
    useMealClipboardStore.getState().copyMeal([makeEntry() as unknown as MealEntry], "breakfast");
  }

  it("shows Pegar and calls onPasteMeal on a non-today day with a clipboard", async () => {
    fillClipboard();
    const onPasteMeal = jest.fn().mockResolvedValue(1);
    renderSection({ isToday: false, onPasteMeal });
    openMenu();

    fireEvent.click(screen.getByText("Pegar"));

    await waitFor(() => expect(onPasteMeal).toHaveBeenCalledWith("breakfast"));
  });

  it("shows Pegar and calls onPasteMeal on today with a clipboard", async () => {
    fillClipboard();
    const onPasteMeal = jest.fn().mockResolvedValue(1);
    renderSection({ isToday: true, selectedDate: "2026-09-29", onPasteMeal });
    openMenu();

    fireEvent.click(screen.getByText("Pegar"));

    await waitFor(() => expect(onPasteMeal).toHaveBeenCalledWith("breakfast"));
  });

  it("hides Pegar when the clipboard is empty", () => {
    renderSection({ isToday: false });
    openMenu();

    expect(screen.queryByText("Pegar")).not.toBeInTheDocument();
  });
});
