import { useRef, useState } from "react";

/** Horizontal travel (px) beyond which a gesture counts as a drag, not a tap. */
const DRAG_CLICK_THRESHOLD = 5;

interface UseSwipeRevealOptions {
  /** Width in px of the action revealed behind the row when swiped open. */
  revealWidth: number;
}

interface UseSwipeRevealResult {
  /** Current horizontal offset (0 = closed, -revealWidth = fully open). */
  translateX: number;
  isOpen: boolean;
  /** True while actively dragging — disables the snap transition so the row follows the finger. */
  isDragging: boolean;
  onPointerDown: (e: { clientX: number; pointerType?: string }) => void;
  onPointerMove: (e: { clientX: number }) => void;
  onPointerUp: () => void;
  /**
   * Returns true once if the gesture that just ended was a drag, then resets.
   * Call it first in the row's click handler: mouse browsers fire a `click`
   * after pointerup on the same element even after a drag (touch browsers
   * suppress it), which would otherwise select the row or close it right
   * after the swipe opened it.
   */
  consumeDragClick: () => boolean;
  close: () => void;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Swipe-left-to-reveal gesture (behind-the-row action button), following the
 * finger while dragging and snapping open/closed on release based on which
 * side of the halfway point it's released. Distinct from MealEntryRow's
 * threshold-triggers-instant-delete pattern: here the swipe only reveals the
 * action — the user must tap the revealed button to actually act, which
 * doubles as the confirmation step.
 *
 * Gating and the "current position" are tracked in refs, not just state:
 * pointerdown/move/up can fire back-to-back faster than React flushes a
 * render (e.g. a fast real swipe, or synchronous event dispatch in tests),
 * so reading `isDragging`/`translateX` state inside these handlers risked
 * seeing a stale value from before the previous handler's update landed.
 */
export function useSwipeReveal({ revealWidth }: UseSwipeRevealOptions): UseSwipeRevealResult {
  const [translateX, setTranslateXState] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const translateXRef = useRef(0);
  const isDraggingRef = useRef(false);
  const startX = useRef(0);
  const startTranslateX = useRef(0);
  const didDragRef = useRef(false);
  const pointerTypeRef = useRef<string | undefined>(undefined);

  function setTranslateX(value: number) {
    translateXRef.current = value;
    setTranslateXState(value);
  }

  function onPointerDown(e: { clientX: number; pointerType?: string }) {
    startX.current = e.clientX;
    startTranslateX.current = translateXRef.current;
    didDragRef.current = false;
    pointerTypeRef.current = e.pointerType;
    isDraggingRef.current = true;
    setIsDragging(true);
  }

  function onPointerMove(e: { clientX: number }) {
    if (!isDraggingRef.current) return;
    const delta = e.clientX - startX.current;
    // Only mouse needs this: touch/pen browsers already suppress the click
    // after a swipe, and a small finger wobble must still count as a tap.
    const isMouse = pointerTypeRef.current === undefined || pointerTypeRef.current === "mouse";
    if (isMouse && Math.abs(delta) > DRAG_CLICK_THRESHOLD) didDragRef.current = true;
    setTranslateX(clamp(startTranslateX.current + delta, -revealWidth, 0));
  }

  function onPointerUp() {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setIsDragging(false);
    const shouldOpen = translateXRef.current <= -revealWidth / 2;
    setTranslateX(shouldOpen ? -revealWidth : 0);
    setIsOpen(shouldOpen);
  }

  function consumeDragClick(): boolean {
    const didDrag = didDragRef.current;
    didDragRef.current = false;
    return didDrag;
  }

  function close() {
    setTranslateX(0);
    setIsOpen(false);
  }

  return {
    translateX,
    isOpen,
    isDragging,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    consumeDragClick,
    close,
  };
}
