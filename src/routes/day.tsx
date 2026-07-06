import type { MealEntryView } from "@/db/repos/mealEntries";
import { useDailyTotals } from "@/hooks/useDailyTotals";
import { formatFullDayLabel, todayISO } from "@/lib/date";
import { CalorieCard } from "@/src/components/CalorieCard";
import { GoalEditorSheet } from "@/src/components/GoalEditorSheet";
import { HeaderMacroRow } from "@/src/components/HeaderMacroRow";
import { MealSection } from "@/src/components/MealSection";
import { ProgressEntrySheet } from "@/src/components/ProgressEntrySheet";
import { WeekCalendarHeader } from "@/src/components/WeekCalendarHeader";
import { useDayStore } from "@/stores/useDayStore";
import { useProfileStore } from "@/stores/useProfileStore";
import { useProgressStore } from "@/stores/useProgressStore";
import type { MealType } from "@/types";
import { Pencil, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

export function DayScreen() {
  const navigate = useNavigate();

  const {
    selectedDate,
    entries,
    loadEntries,
    setDate,
    deleteEntry,
    repeatMeal,
    pasteEntries,
    clearMeal,
  } = useDayStore();
  const { profile, load, overrideGoals } = useProfileStore();
  const {
    current: progressEntry,
    loadByDate,
    saveEntry,
    deleteEntry: deleteProgressEntry,
  } = useProgressStore();

  const totals = useDailyTotals(entries);
  const isToday = selectedDate === todayISO();

  const [editingGoals, setEditingGoals] = useState(false);
  const [progressSheetMode, setProgressSheetMode] = useState<"create" | "edit" | null>(null);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  useEffect(() => {
    void loadByDate(selectedDate);
  }, [loadByDate, selectedDate]);

  // Convert stored photo Blobs into object URLs for the sheet's thumbnail
  // preview (edit mode). Ownership of the created URLs — and their cleanup —
  // belongs here (the caller), not ProgressEntrySheet, which stays
  // presentational/stateless.
  const [existingPhotoUrls, setExistingPhotoUrls] = useState<{ id: string; url: string }[]>([]);

  useEffect(() => {
    const photos = progressEntry?.photos ?? [];
    const urls = photos.map((photo) => ({ id: photo.id, url: URL.createObjectURL(photo.blob) }));
    setExistingPhotoUrls(urls);

    return () => {
      for (const { url } of urls) {
        URL.revokeObjectURL(url);
      }
    };
  }, [progressEntry?.photos]);

  async function handleDeleteProgress(): Promise<void> {
    if (!window.confirm("¿Eliminar el progreso de este día?")) return;
    await deleteProgressEntry(selectedDate);
  }

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const calorieCardRef = useRef<HTMLDivElement>(null);
  const [headerProgress, setHeaderProgress] = useState(0);

  function handleScroll() {
    const container = scrollContainerRef.current;
    const card = calorieCardRef.current;
    if (!container || !card) return;
    const cardHeight = card.offsetHeight;
    const scrollTop = container.scrollTop;
    const progress = Math.min(
      Math.max((scrollTop - cardHeight * 0.75) / (cardHeight * 0.25), 0),
      1
    );
    setHeaderProgress(progress);
  }

  const profileLoadAttempted = useRef(false);
  useEffect(() => {
    if (!profileLoadAttempted.current) {
      profileLoadAttempted.current = true;
      void load().then(() => {
        const current = useProfileStore.getState().profile;
        console.log("[DayScreen] load() resolved — profile:", current);
        if (!current) {
          console.warn("[DayScreen] no profile found — redirecting to /onboarding");
          navigate("/onboarding", { replace: true });
        }
      });
    }
  }, [load, navigate]);

  function handleAddFood(mealType: MealType) {
    void navigate(`/search?meal=${mealType}`);
  }

  function handleEditEntry(entry: MealEntryView) {
    void navigate(`/portion/${entry.foodId}?meal=${entry.mealType}&entryId=${entry.id}`);
  }

  async function handleRepeatMeal(mealType: MealType, sourceDate?: string): Promise<number> {
    return repeatMeal(mealType, sourceDate);
  }

  async function handlePasteMeal(mealType: MealType): Promise<number> {
    return pasteEntries(mealType);
  }

  async function handleClearMeal(mealType: MealType): Promise<void> {
    return clearMeal(mealType);
  }

  async function handleAcceptSuggestion(mealType: MealType): Promise<number> {
    return repeatMeal(mealType);
  }

  const calorieGoal = profile?.calorieGoal ?? 2000;
  const proteinGoalG = profile?.proteinGoalG ?? 150;
  const carbsGoalG = profile?.carbsGoalG ?? 250;
  const fatGoalG = profile?.fatGoalG ?? 70;

  return (
    <div className="flex h-full flex-col bg-surface">
      {/* Sticky header — sibling above scroll container */}
      <div className="z-10 bg-surface">
        <p className="px-4 pt-3 text-sm font-semibold text-gray-900">
          {formatFullDayLabel(selectedDate)}
        </p>
        <WeekCalendarHeader
          selectedDate={selectedDate}
          onSelectDate={(date) => void setDate(date)}
        />
        <HeaderMacroRow
          calories={totals.calories}
          calorieGoal={calorieGoal}
          proteinG={totals.proteinG}
          proteinGoalG={proteinGoalG}
          carbsG={totals.carbsG}
          carbsGoalG={carbsGoalG}
          fatG={totals.fatG}
          fatGoalG={fatGoalG}
          progress={headerProgress}
        />
      </div>

      {/* Scrollable content */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto pb-20 pt-2"
      >
        <div ref={calorieCardRef} className="px-4">
          <CalorieCard
            consumed={totals.calories}
            goal={calorieGoal}
            proteinG={totals.proteinG}
            proteinGoalG={proteinGoalG}
            carbsG={totals.carbsG}
            carbsGoalG={carbsGoalG}
            fatG={totals.fatG}
            fatGoalG={fatGoalG}
            onEditGoals={() => setEditingGoals(true)}
          />
        </div>

        {editingGoals && profile && (
          <GoalEditorSheet
            initial={{
              calorieGoal: profile.calorieGoal,
              proteinGoalG: profile.proteinGoalG,
              carbsGoalG: profile.carbsGoalG,
              fatGoalG: profile.fatGoalG,
            }}
            onSave={async (goals) => {
              await overrideGoals(goals);
              setEditingGoals(false);
            }}
            onClose={() => setEditingGoals(false)}
          />
        )}

        {!isToday && (
          <p className="mb-2 text-center text-xs text-gray-400">Día anterior — solo lectura</p>
        )}

        <div className="px-4">
          {MEAL_TYPES.map((mealType) => (
            <MealSection
              key={mealType}
              mealType={mealType}
              entries={entries.filter((e) => e.mealType === mealType)}
              onAddFood={handleAddFood}
              onDeleteEntry={(id) => void deleteEntry(id)}
              onEditEntry={handleEditEntry}
              selectedDate={selectedDate}
              isToday={isToday}
              onRepeatMeal={handleRepeatMeal}
              onPasteMeal={handlePasteMeal}
              onClearMeal={handleClearMeal}
              onAcceptSuggestion={handleAcceptSuggestion}
            />
          ))}

          {progressEntry ? (
            <div
              data-testid="progress-summary-widget"
              className="mt-3 flex w-full items-center justify-between gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3"
            >
              <div className="flex flex-col items-start gap-1">
                <span className="text-sm font-semibold text-gray-900">Progreso registrado</span>
                <span className="text-xs text-gray-500">
                  {progressEntry.weightKg != null && `Peso: ${progressEntry.weightKg} kg`}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label="Editar progreso"
                  onClick={() => setProgressSheetMode("edit")}
                  className="rounded-full p-2 text-gray-500 transition-colors hover:bg-gray-100"
                >
                  <Pencil size={16} />
                </button>
                <button
                  type="button"
                  aria-label="Eliminar progreso"
                  onClick={() => void handleDeleteProgress()}
                  className="rounded-full p-2 text-red-500 transition-colors hover:bg-red-50"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setProgressSheetMode("create")}
              className="mt-3 w-full rounded-2xl border border-accent bg-white px-4 py-3 text-sm font-semibold text-accent transition-colors hover:bg-accent/5"
            >
              Añadir progreso
            </button>
          )}
        </div>
      </div>

      {progressSheetMode && (
        <ProgressEntrySheet
          mode={progressSheetMode}
          initial={
            progressSheetMode === "edit" && progressEntry
              ? {
                  weightKg: progressEntry.weightKg,
                  neckCm: progressEntry.neckCm,
                  chestCm: progressEntry.chestCm,
                  armCm: progressEntry.armCm,
                  waistCm: progressEntry.waistCm,
                  hipCm: progressEntry.hipCm,
                  thighCm: progressEntry.thighCm,
                  notes: progressEntry.notes,
                }
              : undefined
          }
          existingPhotos={progressSheetMode === "edit" ? existingPhotoUrls : undefined}
          onSave={async (input) => {
            await saveEntry({ date: selectedDate, ...input });
            setProgressSheetMode(null);
          }}
          onClose={() => setProgressSheetMode(null)}
        />
      )}
    </div>
  );
}
