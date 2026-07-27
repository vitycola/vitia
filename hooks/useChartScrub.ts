import { nearestIndex } from "@/lib/scrubChart";
import type { ScrubSeriesPoint } from "@/lib/scrubChart";
import { useRef, useState } from "react";

interface PlotRect {
  left: number;
  width: number;
}

interface UseChartScrubOptions {
  /** The currently-rendered series. Both its length AND each point's real
   * (date-proportional) `xFraction` are used for snapping — see
   * `indexFromClientX` below. */
  series: ScrubSeriesPoint[];
  /** Injected so the plot's bounds are testable without real layout (jsdom rects are always 0). */
  getPlotRect: () => PlotRect;
}

interface UseChartScrubResult {
  /** Index of the snapped point, defaulting to the last (latest) point. Null only when pointCount is 0. */
  activeIndex: number | null;
  /** True while a pointer drag is in progress — disables the position transition so the indicator follows the finger. */
  isScrubbing: boolean;
  onPointerDown: (e: { clientX: number }) => void;
  onPointerMove: (e: { clientX: number }) => void;
  onPointerUp: () => void;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Map a pointer's clientX to the nearest point INDEX using the series' REAL
 * per-point (date-proportional) `xFraction` geometry, via
 * `lib/scrubChart.ts`'s `nearestIndex` — NOT uniform index spacing. Logged
 * points are frequently unevenly spaced across a range (a burst of logged
 * days followed by a gap), so snapping by index position alone can land on
 * a visually/date-wrong point; snapping against the real series geometry is
 * what the spec's "nearest logged point" scrub scenario requires.
 */
function indexFromClientX(clientX: number, series: ScrubSeriesPoint[], rect: PlotRect): number {
  if (series.length <= 1) return 0;
  const rawFraction = rect.width === 0 ? 0 : (clientX - rect.left) / rect.width;
  const xFraction = clamp(rawFraction, 0, 1);
  return nearestIndex(series, xFraction);
}

/**
 * Pointer-driven scrub-to-snap interaction for the fullscreen chart
 * (issue #63). Follows `useSwipeReveal`'s ref-tracked pattern to avoid
 * stale closures when down/move/up are dispatched back-to-back within a
 * single flush (e.g. a fast real drag, or synchronous test dispatch).
 *
 * Native Pointer Events only (no library, works for touch + mouse
 * identically since only `clientX` is read); does NOT call
 * `setPointerCapture` (unsupported in jsdom, and unnecessary here since the
 * plot rect is re-read via the injected `getPlotRect` on every move rather
 * than cached from the initial down).
 */
export function useChartScrub({ series, getPlotRect }: UseChartScrubOptions): UseChartScrubResult {
  const pointCount = series.length;
  const defaultIndex = pointCount > 0 ? pointCount - 1 : null;

  const [activeIndexState, setActiveIndexState] = useState<number | null>(defaultIndex);
  const [isScrubbing, setIsScrubbing] = useState(false);

  const activeIndexRef = useRef<number | null>(defaultIndex);
  const isScrubbingRef = useRef(false);

  function setActiveIndex(index: number | null) {
    activeIndexRef.current = index;
    setActiveIndexState(index);
  }

  function onPointerDown(e: { clientX: number }) {
    if (pointCount === 0) return;
    isScrubbingRef.current = true;
    setIsScrubbing(true);
    setActiveIndex(indexFromClientX(e.clientX, series, getPlotRect()));
  }

  function onPointerMove(e: { clientX: number }) {
    if (!isScrubbingRef.current || pointCount === 0) return;
    setActiveIndex(indexFromClientX(e.clientX, series, getPlotRect()));
  }

  function onPointerUp() {
    if (!isScrubbingRef.current) return;
    isScrubbingRef.current = false;
    setIsScrubbing(false);
    // activeIndex/activeIndexRef already hold the last snapped value — persisted as-is (spec: "Releasing the pointer keeps the last snapped state").
  }

  return {
    activeIndex: activeIndexState,
    isScrubbing,
    onPointerDown,
    onPointerMove,
    onPointerUp,
  };
}
