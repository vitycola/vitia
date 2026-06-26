import { useDailyTotals } from "@/hooks/useDailyTotals";
import { todayISO } from "@/lib/date";
import { CalorieRing } from "@/src/components/CalorieRing";
import { DateNavigator } from "@/src/components/DateNavigator";
import { MacroBar } from "@/src/components/MacroBar";
import { MealSection } from "@/src/components/MealSection";
import { useDayStore } from "@/stores/useDayStore";
import { useProfileStore } from "@/stores/useProfileStore";
import type { MealType } from "@/types";
import { useEffect, useRef } from "react";
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

  // Load entries on mount and whenever date changes
  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  const profileLoadAttempted = useRef(false);
  useEffect(() => {
    if (!profileLoadAttempted.current) {
      profileLoadAttempted.current = true;
      void load().then(() => {
        const current = useProfileStore.getState().profile;
        if (!current) navigate("/onboarding", { replace: true });
      });
    }
  }, [load, navigate]);

  function handleAddFood(mealType: MealType) {
    void navigate(`/search?meal=${mealType}`);
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

  // "Accept suggestion" = repeat meal from the previous day
  async function handleAcceptSuggestion(mealType: MealType): Promise<number> {
    return repeatMeal(mealType);
  }

  return (
    <div className="min-h-screen bg-surface pb-20">
      {/* Date navigator */}
      <DateNavigator
        selectedDate={selectedDate}
        onPrevious={() => void goPreviousDay()}
        onNext={() => void goNextDay()}
      />

      {/* Calorie ring card */}
      <div className="mx-4 mb-3 flex flex-col items-center rounded-2xl bg-white px-4 py-5 shadow-sm">
        <CalorieRing consumed={totals.calories} goal={profile?.calorieGoal ?? 2000} />

        {!isToday && <p className="mt-2 text-xs text-disabled">Día anterior — solo lectura</p>}

        {/* Daily totals summary */}
        <p className="mt-3 text-xs text-secondary">
          <span className="font-semibold text-primary">{Math.round(totals.calories)}</span>
          {" / "}
          {Math.round(profile?.calorieGoal ?? 2000)} kcal consumidas
        </p>
      </div>

      {/* Macro bar card */}
      <div className="mx-4 mb-4 rounded-2xl bg-white px-4 py-4 shadow-sm">
        <MacroBar
          proteinG={totals.proteinG}
          carbsG={totals.carbsG}
          fatG={totals.fatG}
          proteinGoalG={profile?.proteinGoalG ?? 150}
          carbsGoalG={profile?.carbsGoalG ?? 250}
          fatGoalG={profile?.fatGoalG ?? 70}
        />
      </div>

      {/* Meal sections */}
      <div className="px-4">
        {MEAL_TYPES.map((mealType) => (
          <MealSection
            key={mealType}
            mealType={mealType}
            entries={entries.filter((e) => e.mealType === mealType)}
            onAddFood={handleAddFood}
            onDeleteEntry={(id) => void deleteEntry(id)}
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
  );
}
