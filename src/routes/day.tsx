import type { MealEntryView } from "@/db/repos/mealEntries";
import { useDailyTotals } from "@/hooks/useDailyTotals";
import { todayISO } from "@/lib/date";
import { CalorieCard } from "@/src/components/CalorieCard";
import { DateNavigator } from "@/src/components/DateNavigator";
import { HeaderMacroRow } from "@/src/components/HeaderMacroRow";
import { MealSection } from "@/src/components/MealSection";
import { useDayStore } from "@/stores/useDayStore";
import { useProfileStore } from "@/stores/useProfileStore";
import type { MealType } from "@/types";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

export function DayScreen() {
  const navigate = useNavigate();

  const {
    selectedDate,
    entries,
    loadEntries,
    goPreviousDay,
    goNextDay,
    deleteEntry,
    repeatMeal,
    pasteEntries,
    clearMeal,
  } = useDayStore();
  const { profile, load } = useProfileStore();

  const totals = useDailyTotals(entries);
  const isToday = selectedDate === todayISO();

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const calorieCardRef = useRef<HTMLDivElement>(null);
  const [headerProgress, setHeaderProgress] = useState(0);

  function handleScroll() {
    const container = scrollContainerRef.current;
    const card = calorieCardRef.current;
    if (!container || !card) return;
    const cardHeight = card.offsetHeight;
    const scrollTop = container.scrollTop;
    const progress = Math.min(Math.max((scrollTop - cardHeight * 0.75) / (cardHeight * 0.25), 0), 1);
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
    <div className="flex h-[100dvh] flex-col bg-surface">
      {/* Sticky header — sibling above scroll container */}
      <div className="sticky top-0 z-10 bg-surface">
        <DateNavigator
          selectedDate={selectedDate}
          onPrevious={() => void goPreviousDay()}
          onNext={() => void goNextDay()}
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
        />
        </div>

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
        </div>
      </div>
    </div>
  );
}
