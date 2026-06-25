import {
  ChevronDown,
  ChevronRight,
  MoreVertical,
  Plus,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CopyFromYesterdayBanner } from "@/src/components/CopyFromYesterdayBanner";
import { MealEntryRow } from "@/src/components/MealEntryRow";
import { getByDateAndMeal } from "@/db/repositories/mealEntries";
import { useMealClipboardStore } from "@/stores/useMealClipboardStore";
import type { MealEntry } from "@/types";
import type { MealType } from "@/types";

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: "Desayuno",
  lunch: "Almuerzo",
  dinner: "Cena",
  snack: "Merienda",
};

interface MealSectionProps {
  mealType: MealType;
  entries: MealEntry[];
  onAddFood: (mealType: MealType) => void;
  onDeleteEntry: (id: string) => void;
  selectedDate: string;
  isToday: boolean;
  onRepeatMeal: (mealType: MealType) => Promise<number>;
  onPasteMeal: (mealType: MealType) => Promise<number>;
  onClearMeal: (mealType: MealType) => Promise<void>;
  onAcceptSuggestion: (mealType: MealType) => Promise<number>;
}

export function MealSection({
  mealType,
  entries,
  onAddFood,
  onDeleteEntry,
  selectedDate,
  isToday,
  onRepeatMeal,
  onPasteMeal,
  onClearMeal,
  onAcceptSuggestion,
}: MealSectionProps) {
  const [expanded, setExpanded] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [inFlight, setInFlight] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [previousDayEntries, setPreviousDayEntries] = useState<MealEntry[]>([]);

  const menuRef = useRef<HTMLDivElement>(null);
  const clipboardMeal = useMealClipboardStore((s) => s.clipboardMeal);

  const label = MEAL_LABELS[mealType];
  const mealCalories = entries.reduce((sum, e) => sum + e.calories, 0);
  const mealProtein = entries.reduce((sum, e) => sum + e.proteinG, 0);
  const mealCarbs = entries.reduce((sum, e) => sum + e.carbsG, 0);
  const mealFat = entries.reduce((sum, e) => sum + e.fatG, 0);

  // Reset dismissed state when the selected date changes
  useEffect(() => {
    setDismissed(false);
  }, [selectedDate]);

  // Fetch previous day entries to power the "copy from yesterday" banner
  useEffect(() => {
    if (!isToday) {
      setPreviousDayEntries([]);
      return;
    }
    const [year, month, day] = selectedDate.split("-").map(Number);
    const prev = new Date(year, month - 1, day);
    prev.setDate(prev.getDate() - 1);
    const y = prev.getFullYear();
    const m = String(prev.getMonth() + 1).padStart(2, "0");
    const d = String(prev.getDate()).padStart(2, "0");
    const prevDate = `${y}-${m}-${d}`;

    getByDateAndMeal(prevDate, mealType)
      .then(setPreviousDayEntries)
      .catch(() => setPreviousDayEntries([]));
  }, [selectedDate, mealType, isToday]);

  // Click outside to close context menu
  useEffect(() => {
    if (!menuOpen) return;
    function handleOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [menuOpen]);

  async function runAction(fn: () => Promise<unknown>) {
    if (inFlight) return;
    setInFlight(true);
    setMenuOpen(false);
    try {
      await fn();
    } finally {
      setInFlight(false);
    }
  }

  const showBanner =
    isToday && entries.length === 0 && previousDayEntries.length > 0 && !dismissed;

  const hasClipboard = clipboardMeal !== null && clipboardMeal.entries.length > 0;

  return (
    <div className="mb-3 overflow-hidden rounded-xl bg-white shadow-sm">
      {/* Section header */}
      <div className="flex items-center justify-between px-4 py-3">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex flex-1 items-center gap-2 text-left"
          aria-expanded={expanded}
        >
          {expanded ? (
            <ChevronDown size={18} className="text-gray-400" />
          ) : (
            <ChevronRight size={18} className="text-gray-400" />
          )}
          <span className="text-sm font-semibold text-gray-800">{label}</span>
          {entries.length > 0 && (
            <span className="ml-auto mr-2 text-xs text-gray-400">
              {Math.round(mealProtein)}p · {Math.round(mealCarbs)}c · {Math.round(mealFat)}g
            </span>
          )}
        </button>

        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-700">
            {Math.round(mealCalories)} kcal
          </span>

          {/* Context menu trigger */}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label={`Opciones para ${label}`}
              className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100"
            >
              <MoreVertical size={17} />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-9 z-20 w-44 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
                <button
                  type="button"
                  onClick={() =>
                    runAction(() => {
                      useMealClipboardStore
                        .getState()
                        .copyMeal(entries, mealType);
                      return Promise.resolve();
                    })
                  }
                  className="flex w-full items-center px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50"
                >
                  Copiar
                </button>

                {isToday && hasClipboard && (
                  <button
                    type="button"
                    onClick={() => runAction(() => onPasteMeal(mealType))}
                    className="flex w-full items-center px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Pegar
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => runAction(() => onRepeatMeal(mealType))}
                  className="flex w-full items-center px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50"
                >
                  Repetir comida
                </button>

                {isToday && (
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        window.confirm(
                          `¿Eliminar todas las entradas de ${MEAL_LABELS[mealType]}?`,
                        )
                      ) {
                        void runAction(() => onClearMeal(mealType));
                      } else {
                        setMenuOpen(false);
                      }
                    }}
                    className="flex w-full items-center px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50"
                  >
                    Vaciar comida
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Collapsible content */}
      {expanded && (
        <>
          {/* Copy-from-yesterday banner */}
          {showBanner && (
            <CopyFromYesterdayBanner
              count={previousDayEntries.length}
              busy={inFlight}
              onAccept={() => runAction(() => onAcceptSuggestion(mealType))}
              onDismiss={() => setDismissed(true)}
            />
          )}

          {/* Entry rows */}
          {entries.length > 0 && (
            <div className="border-t border-gray-100">
              {entries.map((entry) => (
                <MealEntryRow key={entry.id} entry={entry} onDelete={onDeleteEntry} />
              ))}
            </div>
          )}

          {/* Add food button */}
          <div className="border-t border-gray-100">
            <button
              type="button"
              onClick={() => onAddFood(mealType)}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-green-600 hover:bg-green-50 active:bg-green-100"
            >
              <Plus size={16} />
              <span>Agregar alimento</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
