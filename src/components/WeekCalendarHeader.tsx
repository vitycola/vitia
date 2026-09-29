import { useWeekProgress } from "@/hooks/useWeekProgress";
import type { DayStatus } from "@/hooks/useWeekProgress";
import { addDays, formatFullDayLabel, startOfWeek, todayISO, weekDays } from "@/lib/date";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";

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

  const today = todayISO();

  // Keep the visible week in sync with selectedDate changes from any source
  // (Hoy, picker, day tap, store actions). Chevron browsing only moves
  // visibleWeekStart, so it is preserved until selectedDate changes.
  useEffect(() => {
    setVisibleWeekStart(startOfWeek(selectedDate));
  }, [selectedDate]);

  function shiftWeek(weeks: number) {
    setVisibleWeekStart((prev) => addDays(prev, weeks * 7));
  }

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
    shiftWeek(delta < 0 ? 1 : -1);
  }

  function handleTap(date: string) {
    if (didSwipe.current) {
      didSwipe.current = false;
      return;
    }
    onSelectDate(date);
  }

  function handleToday() {
    onSelectDate(today);
    setVisibleWeekStart(startOfWeek(today));
  }

  function handlePickDate(e: React.ChangeEvent<HTMLInputElement>) {
    // Some browsers (iOS "Borrar") emit an empty value — never select "".
    if (e.target.value === "") return;
    onSelectDate(e.target.value);
  }

  return (
    <div className="select-none px-4 pt-3 pb-1">
      {/* Toolbar: date label + picker, Hoy shortcut, week chevrons */}
      <div className="mb-1 flex items-center justify-between">
        <div className="relative">
          <span className="text-sm font-semibold text-gray-900">
            {formatFullDayLabel(selectedDate)}
          </span>
          <input
            type="date"
            aria-label="Elegir fecha"
            value={selectedDate}
            onChange={handlePickDate}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </div>
        <div className="flex items-center gap-1">
          {(selectedDate !== today || visibleWeekStart !== startOfWeek(today)) && (
            <button
              type="button"
              onClick={handleToday}
              className="rounded-full px-2 py-1 text-xs font-semibold text-accent"
            >
              Hoy
            </button>
          )}
          <button
            type="button"
            aria-label="Semana anterior"
            onClick={() => shiftWeek(-1)}
            className="rounded-full p-1 text-gray-500"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            aria-label="Semana siguiente"
            onClick={() => shiftWeek(1)}
            className="rounded-full p-1 text-gray-500"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

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
