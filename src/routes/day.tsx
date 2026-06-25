import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { CalorieRing } from "@/src/components/CalorieRing";
import { DateNavigator } from "@/src/components/DateNavigator";
import { MacroBar } from "@/src/components/MacroBar";
import { MealSection } from "@/src/components/MealSection";
import { useDailyTotals } from "@/hooks/useDailyTotals";
import { todayISO } from "@/lib/date";
import { useDayStore } from "@/stores/useDayStore";
import { useProfileStore } from "@/stores/useProfileStore";
import type { MealType } from "@/types";

const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

export function DayScreen() {
  const navigate = useNavigate();

  const { selectedDate, entries, loadEntries, goPreviousDay, goNextDay, deleteEntry, repeatMeal, pasteEntries, clearMeal } =
    useDayStore();
  const { profile, load, hasProfile } = useProfileStore();

  const totals = useDailyTotals(entries);
  const isToday = selectedDate === todayISO();

  // Load entries on mount and whenever date changes
  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  // Load profile on mount — idempotent
  useEffect(() => {
    if (!hasProfile) {
      void load();
    }
  }, [load, hasProfile]);

  function handleAddFood(mealType: MealType) {
    void navigate(`/search?meal=${mealType}`);
  }

  async function handleRepeatMeal(mealType: MealType): Promise<number> {
    return repeatMeal(mealType);
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
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Date navigator */}
      <DateNavigator
        selectedDate={selectedDate}
        onPrevious={() => void goPreviousDay()}
        onNext={() => void goNextDay()}
      />

      {/* Calorie ring card */}
      <div className="mx-4 mb-3 flex flex-col items-center rounded-2xl bg-white px-4 py-5 shadow-sm">
        <CalorieRing consumed={totals.calories} goal={profile?.calorieGoal ?? 2000} />

        {!isToday && (
          <p className="mt-2 text-xs text-gray-400">Día anterior — solo lectura</p>
        )}

        {/* Daily totals summary */}
        <p className="mt-3 text-xs text-gray-500">
          <span className="font-semibold text-gray-700">{Math.round(totals.calories)}</span>
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
          carbsGoalG={profile?.carbsGoalG ?? 200}
          fatGoalG={profile?.fatGoalG ?? 65}
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
