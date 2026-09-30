/** @jest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import type { Food } from "@/db/schema";
import { CreatedFoodsTab } from "../CreatedFoodsTab";

// Uses the real useSwipeReveal (unlike CreatedFoodsTab.test.tsx) to cover the
// desktop mouse sequence: pointerdown → pointermove → pointerup → click.
jest.mock("@/hooks/useCreatedFoodsList", () => ({
  useCreatedFoodsList: jest.fn(),
}));

jest.mock("react-router-dom", () => ({
  useNavigate: () => jest.fn(),
}));

import { useCreatedFoodsList } from "@/hooks/useCreatedFoodsList";

// jsdom has no PointerEvent, so fireEvent.pointer* would drop clientX.
if (typeof window.PointerEvent === "undefined") {
  class PointerEventPolyfill extends MouseEvent {
    pointerId: number;
    pointerType: string;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 1;
      this.pointerType = init.pointerType ?? "";
    }
  }
  Object.defineProperty(window, "PointerEvent", { value: PointerEventPolyfill });
}

const food: Food = {
  id: "food-1",
  name: "Tortilla casera",
  brand: null,
  caloriesPer100g: 150,
  proteinPer100g: 10,
  carbsPer100g: 5,
  fatPer100g: 8,
  servingSizeG: 120,
  source: "custom",
  offProductCode: null,
  nameNormalized: "tortilla casera",
  imageUrl: null,
  category: "huevos",
  dataBasis: null,
  createdAt: "2024-01-01T00:00:00.000Z",
};

describe("CreatedFoodsTab swipe (real useSwipeReveal)", () => {
  const onSelect = jest.fn();

  beforeEach(() => {
    onSelect.mockReset();
    (useCreatedFoodsList as jest.Mock).mockReturnValue({
      items: [food],
      loading: false,
      remove: jest.fn().mockResolvedValue(undefined),
    });
  });

  function rowElements() {
    const button = screen.getByText("Tortilla casera").closest("button") as HTMLElement;
    return { button, row: button.parentElement as HTMLElement };
  }

  it("keeps the row open and does not select when the click follows a mouse drag", () => {
    render(<CreatedFoodsTab onSelect={onSelect} query="" />);
    const { button, row } = rowElements();

    fireEvent.pointerDown(row, { clientX: 300, pointerType: "mouse" });
    fireEvent.pointerMove(row, { clientX: 250 });
    fireEvent.pointerMove(row, { clientX: 200 });
    fireEvent.pointerUp(row);
    fireEvent.click(button, { detail: 1 });

    expect(row.style.transform).toBe("translateX(-96px)");
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("a plain click with no drag still selects the food", () => {
    render(<CreatedFoodsTab onSelect={onSelect} query="" />);
    const { button, row } = rowElements();

    fireEvent.pointerDown(row, { clientX: 300, pointerType: "mouse" });
    fireEvent.pointerUp(row);
    fireEvent.click(button, { detail: 1 });

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "food-1" }));
  });

  it("after a drag, the next genuine click on the open row closes it without selecting", () => {
    render(<CreatedFoodsTab onSelect={onSelect} query="" />);
    const { button, row } = rowElements();

    fireEvent.pointerDown(row, { clientX: 300, pointerType: "mouse" });
    fireEvent.pointerMove(row, { clientX: 200 });
    fireEvent.pointerUp(row);
    fireEvent.click(button, { detail: 1 }); // post-drag click, suppressed
    fireEvent.click(button, { detail: 1 }); // genuine tap on the open row

    expect(row.style.transform).toBe("translateX(0px)");
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("a touch wobble beyond 5px still counts as a tap and selects the food", () => {
    render(<CreatedFoodsTab onSelect={onSelect} query="" />);
    const { button, row } = rowElements();

    fireEvent.pointerDown(row, { clientX: 300, pointerType: "touch" });
    fireEvent.pointerMove(row, { clientX: 292, pointerType: "touch" });
    fireEvent.pointerUp(row, { pointerType: "touch" });
    fireEvent.click(button, { detail: 1 });

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "food-1" }));
  });

  it("a keyboard-style click (detail 0) after a mouse drag is a normal tap, not swallowed", () => {
    render(<CreatedFoodsTab onSelect={onSelect} query="" />);
    const { button, row } = rowElements();

    fireEvent.pointerDown(row, { clientX: 300, pointerType: "mouse" });
    fireEvent.pointerMove(row, { clientX: 200, pointerType: "mouse" });
    fireEvent.pointerUp(row, { pointerType: "mouse" });
    fireEvent.click(button, { detail: 0 });

    expect(row.style.transform).toBe("translateX(0px)");
    expect(onSelect).not.toHaveBeenCalled();
  });
});
