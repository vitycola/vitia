import { useWeekProgress } from "@/hooks/useWeekProgress";
import type { DayStatus } from "@/hooks/useWeekProgress";
import { formatFullDayLabel, startOfWeek, weekDays } from "@/lib/date";
import { useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DAY_LETTERS = ["L", "M", "M", "J", "V", "S", "D"] as const;
const SWIPE_THRESHOLD = 60;

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface DotIndicatorProps {
  status: DayStatus;
  isFuture: boolean;
}

function DotIndicator({ status, isFuture }: DotIndicatorProps) {
  // Future days and empty days both show gray
  if (isFuture || status === "empty") {
    return <span className="block h-1.5 w-1.5 rounded-full bg-gray-300" />;
  }
  if (status === "complete") {
    return <span className="block h-1.5 w-1.5 rounded-full bg-green-500" />;
  }
  // partial
  return <span className="block h-1.5 w-1.5 rounded-full bg-yellow-400" />;
}

interface DayCellProps {
  isoDate: string;
  dayLetter: string;
  dayNumber: number;
  isSelected: boolean;
  isFuture: boolean;
  status: DayStatus;
  onTap: (date: string) => void;
}

function DayCell({
  isoDate,
  dayLetter,
  dayNumber,
  isSelected,
  isFuture,
  status,
  onTap,
}: DayCellProps) {
  return (
    <button
      type="button"
      onClick={() => onTap(isoDate)}
      className="flex flex-col items-center gap-0.5 py-1"
      aria-label={isoDate}
      aria-pressed={isSelected}
    >
      {/* Day letter — black circle when selected */}
      <span
        className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
          isSelected ? "bg-gray-900 text-white" : "text-gray-500"
        }`}
      >
        {dayLetter}
      </span>

      {/* Day number — accent color when selected */}
      <span
        className={`text-sm font-medium leading-none ${
          isSelected ? "text-accent" : isFuture ? "text-gray-300" : "text-gray-700"
        }`}
      >
        {dayNumber}
      </span>

      {/* Progress dot */}
      <DotIndicator status={status} isFuture={isFuture} />
    </button>
  );
}

// ---------------------------------------------------------------------------
// WeekCalendarHeader
// ---------------------------------------------------------------------------

export interface WeekCalendarHeaderProps {
  selectedDate: string;
  onSelectDate: (date: string) => void;
}

export function WeekCalendarHeader({ selectedDate, onSelectDate }: WeekCalendarHeaderProps) {
  // visibleWeekStart is a local offset — starts at the week containing
  // selectedDate, then shifts ±7 via swipe without changing selection.
  const [visibleWeekStart, setVisibleWeekStart] = useState<string>(() => startOfWeek(selectedDate));

  const days = weekDays(visibleWeekStart);
  const progress = useWeekProgress(visibleWeekStart);

  // ── Swipe handling (pointer-delta pattern from MealEntryRow) ──────────
  const startX = useRef<number | null>(null);
  const didSwipe = useRef(false);

  function handlePointerDown(e: React.PointerEvent) {
    startX.current = e.clientX;
    didSwipe.current = false;
  }

  function handlePointerUp(e: React.PointerEvent) {
    if (startX.current === null) return;

    const delta = e.clientX - startX.current;
    startX.current = null;

    if (Math.abs(delta) < SWIPE_THRESHOLD) return;

    didSwipe.current = true;

    // Swipe left → next week; swipe right → previous week
    const shift = delta < 0 ? 7 : -7;
    setVisibleWeekStart((prev) => {
      const [y, m, d] = prev.split("-").map(Number);
      const date = new Date(y, m - 1, d);
      date.setDate(date.getDate() + shift);
      const yy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, "0");
      const dd = String(date.getDate()).padStart(2, "0");
      return `${yy}-${mm}-${dd}`;
    });
  }

  function handleTap(date: string) {
    if (didSwipe.current) {
      didSwipe.current = false;
      return;
    }
    onSelectDate(date);
    // If the tapped day is outside the visible week, realign to that week.
    const weekOfTapped = startOfWeek(date);
    if (weekOfTapped !== visibleWeekStart) {
      setVisibleWeekStart(weekOfTapped);
    }
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="select-none px-4 pt-3 pb-1">
      {/* Week strip */}
      <div
        className="grid grid-cols-7 touch-pan-y"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
      >
        {days.map((isoDate, idx) => {
          const [, , dayStr] = isoDate.split("-");
          return (
            <DayCell
              key={isoDate}
              isoDate={isoDate}
              dayLetter={DAY_LETTERS[idx]}
              dayNumber={Number.parseInt(dayStr, 10)}
              isSelected={isoDate === selectedDate}
              isFuture={isoDate > today}
              status={progress[isoDate] ?? "empty"}
              onTap={handleTap}
            />
          );
        })}
      </div>
    </div>
  );
}
