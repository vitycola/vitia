/** @jest-environment jsdom */
import { act, renderHook } from "@testing-library/react";
import { useSwipeReveal } from "../useSwipeReveal";

describe("useSwipeReveal", () => {
  it("starts closed at translateX 0", () => {
    const { result } = renderHook(() => useSwipeReveal({ revealWidth: 96 }));
    expect(result.current.translateX).toBe(0);
    expect(result.current.isOpen).toBe(false);
  });

  it("follows the finger while dragging, clamped to [-revealWidth, 0]", () => {
    const { result } = renderHook(() => useSwipeReveal({ revealWidth: 96 }));

    act(() => result.current.onPointerDown({ clientX: 300 }));
    act(() => result.current.onPointerMove({ clientX: 260 })); // dragged left 40px
    expect(result.current.translateX).toBe(-40);
    expect(result.current.isDragging).toBe(true);

    act(() => result.current.onPointerMove({ clientX: 150 })); // dragged left 150px — clamps to -96
    expect(result.current.translateX).toBe(-96);
  });

  it("does not drag past 0 to the right", () => {
    const { result } = renderHook(() => useSwipeReveal({ revealWidth: 96 }));

    act(() => result.current.onPointerDown({ clientX: 300 }));
    act(() => result.current.onPointerMove({ clientX: 400 })); // dragged right — clamps to 0
    expect(result.current.translateX).toBe(0);
  });

  it("snaps open when released past the halfway point", () => {
    const { result } = renderHook(() => useSwipeReveal({ revealWidth: 96 }));

    act(() => result.current.onPointerDown({ clientX: 300 }));
    act(() => result.current.onPointerMove({ clientX: 240 })); // -60, past halfway (-48)
    act(() => result.current.onPointerUp());

    expect(result.current.translateX).toBe(-96);
    expect(result.current.isOpen).toBe(true);
    expect(result.current.isDragging).toBe(false);
  });

  it("snaps closed when released before the halfway point", () => {
    const { result } = renderHook(() => useSwipeReveal({ revealWidth: 96 }));

    act(() => result.current.onPointerDown({ clientX: 300 }));
    act(() => result.current.onPointerMove({ clientX: 270 })); // -30, before halfway
    act(() => result.current.onPointerUp());

    expect(result.current.translateX).toBe(0);
    expect(result.current.isOpen).toBe(false);
  });

  it("close() resets to closed regardless of current state", () => {
    const { result } = renderHook(() => useSwipeReveal({ revealWidth: 96 }));

    act(() => result.current.onPointerDown({ clientX: 300 }));
    act(() => result.current.onPointerMove({ clientX: 200 }));
    act(() => result.current.onPointerUp());
    expect(result.current.isOpen).toBe(true);

    act(() => result.current.close());
    expect(result.current.translateX).toBe(0);
    expect(result.current.isOpen).toBe(false);
  });

  it("can re-open from an already-open state, dragging further left is a no-op past the clamp", () => {
    const { result } = renderHook(() => useSwipeReveal({ revealWidth: 96 }));
    act(() => result.current.onPointerDown({ clientX: 300 }));
    act(() => result.current.onPointerMove({ clientX: 200 }));
    act(() => result.current.onPointerUp());
    expect(result.current.isOpen).toBe(true);

    // Starting a new drag from the open position (startTranslateX = -96) and
    // dragging right should close it smoothly.
    act(() => result.current.onPointerDown({ clientX: 200 }));
    act(() => result.current.onPointerMove({ clientX: 280 })); // +80 from -96 => -16
    expect(result.current.translateX).toBe(-16);
    act(() => result.current.onPointerUp());
    expect(result.current.isOpen).toBe(false); // -16 is above halfway -48, snaps closed
    expect(result.current.translateX).toBe(0);
  });

  it("handles down/move/up dispatched back-to-back with no render flush in between (real fast swipes, or synchronous test/dispatch)", () => {
    // Regression: an earlier version gated onPointerMove/onPointerUp on
    // `isDragging`/`translateX` *state*, which is only guaranteed fresh
    // after React re-renders — reading it synchronously right after the
    // previous handler saw a stale value and silently no-opped. Internal
    // gating and position tracking must use refs, not state, so a whole
    // gesture batched into one flush still works.
    const { result } = renderHook(() => useSwipeReveal({ revealWidth: 96 }));

    act(() => {
      result.current.onPointerDown({ clientX: 300 });
      result.current.onPointerMove({ clientX: 240 });
      result.current.onPointerUp();
    });

    expect(result.current.translateX).toBe(-96);
    expect(result.current.isOpen).toBe(true);
  });
});
