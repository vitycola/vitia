import { formatDayLabel, todayISO } from "@/lib/date";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface DateNavigatorProps {
  selectedDate: string;
  onPrevious: () => void;
  onNext: () => void;
}

export function DateNavigator({ selectedDate, onPrevious, onNext }: DateNavigatorProps) {
  const isToday = selectedDate === todayISO();

  return (
    <div className="flex items-center justify-between px-4 py-3">
      <button
        type="button"
        onClick={onPrevious}
        aria-label="Día anterior"
        className="flex h-9 w-9 items-center justify-center rounded-full text-gray-600 hover:bg-gray-100 active:bg-gray-200"
      >
        <ChevronLeft size={22} />
      </button>

      <span className="text-base font-semibold text-gray-900">{formatDayLabel(selectedDate)}</span>

      <button
        type="button"
        onClick={onNext}
        aria-label="Día siguiente"
        disabled={isToday}
        className={`flex h-9 w-9 items-center justify-center rounded-full text-gray-600 hover:bg-gray-100 active:bg-gray-200 ${
          isToday ? "opacity-30 cursor-not-allowed" : ""
        }`}
      >
        <ChevronRight size={22} />
      </button>
    </div>
  );
}
