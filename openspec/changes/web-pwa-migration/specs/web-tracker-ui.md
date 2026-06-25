# Spec: web-tracker-ui — Web Tracker UI

Slice 1 capability. Every screen and component from `app/` and `components/` is rewritten from React Native primitives (`View`, `Text`, `Pressable`, NativeWind) to HTML/JSX elements styled with plain Tailwind CSS and icons from `lucide-react`. The rewrite is purely presentational — `stores/` (Zustand) and `lib/` (nutrition, date, OFF, ID) are reused without any logic change. Feature parity with the native app is the success criterion: every user-facing action available in the native app is available in the web app.

---

## Non-Goals (Slice 1)

- Backend calls, cloud sync, AI entry, or progress photos.
- Barcode scanner integration.
- Push notifications.
- Multi-user support.
- Animation or gesture parity (deferred; match behavior, not motion).
- React Native / Expo code remaining in the web build.

---

## Reused Modules (MUST NOT change logic)

| Path | What it provides |
|------|-----------------|
| `stores/useDayStore.ts` | Day navigation, entry CRUD, repeat/paste/clear meal, clipboard integration |
| `stores/useFoodSearchStore.ts` | Food search state and OFF query execution |
| `stores/useMealClipboardStore.ts` | Copy/paste meal clipboard |
| `stores/useProfileStore.ts` | Profile load/save |
| `lib/date.ts` | `todayISO()`, `addDays()`, date formatting helpers |
| `lib/nutrition.ts` | `computeBMR()`, `computeTDEE()`, `deriveCalorieGoal()`, `deriveMacros()` |
| `lib/openFoodFacts.ts` | `search()`, `normalizeOffProduct()` |
| `lib/id.ts` | `generateId()` (post-swap: `crypto.randomUUID()` per web-local-storage spec) |
| `types/` | `MealType`, `Sex`, `ActivityLevel`, `Goal` |
| `db/schema.ts` | Type definitions (`MealEntry`, `Food`, etc.) |

No file in `stores/`, `lib/`, or `types/` **MAY** be modified to accommodate the web UI rewrite.

---

## Screens

The following screens correspond 1:1 to the native screens in `app/`. Each **MUST** be reimplemented for web:

| Native path | Web route | Description |
|-------------|-----------|-------------|
| `app/(tabs)/index.tsx` | `/` (day diary) | Day view with meal sections, totals, day navigation |
| `app/(tabs)/search.tsx` | `/search` | Food search with results and add-to-meal flow |
| `app/(tabs)/profile.tsx` | `/profile` | Profile view and edit |
| `app/onboarding.tsx` | `/onboarding` | First-run profile setup wizard |
| `app/portion.tsx` | `/portion` (or modal) | Portion selection for a food before logging |
| `app/custom-food.tsx` | `/custom-food` | Create a custom food entry |

Routing mechanism (React Router, TanStack Router, etc.) is a design-phase decision. The spec only asserts that each screen is reachable at a stable URL and that back-navigation works correctly.

---

## Components

The following components **MUST** be reimplemented as HTML/JSX + Tailwind equivalents:

| Native component | Description |
|-----------------|-------------|
| `components/CalorieRing.tsx` | Circular progress ring showing calorie goal completion |
| `components/CopyFromYesterdayBanner.tsx` | Suggestion banner to copy yesterday's meal entries |
| `components/DateNavigator.tsx` | Previous/next day navigation controls with current date display |
| `components/FoodResultRow.tsx` | Single food result row in search results |
| `components/MacroBar.tsx` | Horizontal progress bar(s) for protein/carbs/fat |
| `components/MealEntryRow.tsx` | Single logged meal entry with delete action |
| `components/MealSection.tsx` | Grouped meal slot (breakfast/lunch/dinner/snack) with entries and add button |
| `components/ui/Button.tsx` | Primary action button |
| `components/ui/Input.tsx` | Text input field with label and optional error message |

---

## Requirements

### R1 — Day diary view

**MUST** display:

- Current selected date with a `DateNavigator` component (previous / next day controls).
- A `CalorieRing` or equivalent summary showing calories consumed vs. goal.
- `MacroBar` component(s) for protein, carbs, and fat (consumed vs. goal).
- Four `MealSection` components: breakfast, lunch, dinner, snack.
- Each `MealSection` **MUST** list its logged `MealEntryRow` items for the selected date.
- Each `MealSection` **MUST** provide an "Add food" affordance that navigates to the food search screen.

### R2 — Day navigation

**MUST** allow the user to navigate to any previous day. Navigation to future dates (past today) **MUST** be blocked — the "next day" control is disabled when `selectedDate >= todayISO()`.

This behavior is governed by `useDayStore.goNextDay()` (which already enforces this guard) and **MUST** be reflected in the disabled state of the UI control.

### R3 — Food search

**MUST** provide a text input that queries `lib/openFoodFacts.ts`'s `search()` function.

- Search **MUST** be debounced (implementation detail of debounce duration is a design decision; behavior requirement: the OFF API is not called on every keystroke).
- When the device is online, results are fetched from OFF and displayed as `FoodResultRow` components.
- When the device is offline (`navigator.onLine === false`), the search returns no results and **SHOULD** display an offline indicator.
- Selecting a result navigates to the portion selection screen.
- The search input **MUST** be cleared when the user navigates away from the screen.

### R4 — Portion selection and meal entry creation

On the portion screen:

**MUST** display the food name, calories-per-100g, and macro breakdown.

**MUST** provide a numeric input for quantity in grams.

**MUST** default the quantity to the food's `servingSizeG` when available, or to 100 g otherwise.

**MUST** show a live preview of the macros calculated for the entered quantity.

**MUST** call `useDayStore.addEntry()` on confirmation, which inserts the entry into the local database and updates the day diary optimistically.

After confirmation, **MUST** navigate back to the day diary and the new entry **MUST** appear in the correct meal section.

### R5 — Edit meal entry

**MUST** allow the user to delete a meal entry from the `MealEntryRow` (swipe, button, or equivalent web affordance — design decision).

Calling `useDayStore.deleteEntry(id)` **MUST** remove the entry optimistically from the UI and from the local database.

Daily totals (calories, macros) **MUST** recalculate immediately after deletion without a page reload.

### R6 — Custom food creation

**MUST** provide a form to create a custom food with: name (required), calories per 100 g (required), protein per 100 g, carbs per 100 g, fat per 100 g, and optional serving size.

On save, the food **MUST** be persisted to the local `foods` table via `db/repositories/foods.ts`'s `upsert()` with `source: "custom"` and an ID from `generateId()`.

After save, the new food **MUST** be selectable from the search screen.

### R7 — CopyFromYesterdayBanner

When a meal section is empty and yesterday's equivalent meal had entries, the `CopyFromYesterdayBanner` component **MUST** appear inside that meal section, offering to copy those entries.

- "Count" displayed in the banner = number of entries in yesterday's matching meal.
- Accepting the banner **MUST** call `useDayStore.repeatMeal(mealType)` and the copied entries **MUST** appear in the meal section immediately.
- Dismissing the banner **MUST** hide it for the current session without copying anything.
- The banner is presentational (no internal state) — host screen manages visibility state.

### R8 — Profile view and edit

**MUST** display the current profile fields: age, height, weight, sex, activity level, goal, and computed calorie/macro targets.

**MUST** allow the user to edit these fields via a form equivalent to `app/(tabs)/profile.tsx`.

On save, `useProfileStore.saveProfile()` **MUST** be called, which persists to the local database.

After save, the updated targets **MUST** be reflected in the day diary's calorie ring and macro bars without a page reload.

### R9 — Onboarding flow

On first launch (no profile in the local database), the user **MUST** be redirected to the onboarding screen.

The onboarding form **MUST** collect: age, height (cm), weight (kg), sex, activity level, and goal.

**MUST** display a live TDEE and macro preview as the user fills in the form (equivalent to `TDEEPreview` in `app/onboarding.tsx`), computed via `lib/nutrition.ts`.

**MUST** validate inputs with the same rules as the native form:
- Age: integer, 10–120
- Height: 50–280 cm
- Weight: 10–600 kg
- Sex, activity level, goal: required selection

On valid submission, `useProfileStore.saveProfile()` **MUST** be called and the user **MUST** be redirected to the day diary.

### R10 — Daily totals recalculate on every entry change

Whenever a meal entry is added or deleted (via `useDayStore`), the calorie ring and macro bars in the day diary **MUST** update to reflect the new totals without a page reload.

The calculation **MUST** use the same logic as the native app: sum over `useDayStore.entries` filtered to `selectedDate`, using the denormalized `calories`, `proteinG`, `carbsG`, `fatG` fields on each entry.

### R11 — No React Native primitives in web build

The web build **MUST NOT** import or depend on:
- `react-native` or any `@react-native-*` package.
- `expo-*` packages (except those explicitly replaced per `web-local-storage` spec).
- `NativeWind` or `nativewind`.

Styling **MUST** use plain Tailwind CSS classes on HTML elements.

### R12 — Icons via lucide-react

All icons **MUST** use `lucide-react` components. No icon font, emoji, or inline SVG **MAY** be used as a primary icon system.

### R13 — Accessibility baseline

Interactive elements (buttons, inputs, links) **MUST** have accessible labels that screen readers can announce. `aria-label` or visible text is acceptable. This is a minimum baseline, not a full WCAG audit.

---

## Scenarios

### Scenario 3.1 — First launch redirects to onboarding

```
Given the local database has no profile record
When the user opens the app at the root URL
Then the user is redirected to the onboarding screen
And the day diary is not shown
```

### Scenario 3.2 — Onboarding completes and redirects to day diary

```
Given the user is on the onboarding screen
When the user fills in all required fields with valid values
And submits the form
Then useProfileStore.saveProfile() is called with the entered values
And the user is redirected to the day diary (/)
And the calorie ring reflects the newly computed goal
```

### Scenario 3.3 — TDEE preview updates live during onboarding

```
Given the user is on the onboarding screen
When the user changes any of age, height, weight, sex, activity level, or goal
Then the TDEE preview updates immediately using lib/nutrition.ts
Without requiring a form submission
```

### Scenario 3.4 — Day diary shows today's entries on load

```
Given the user has profile and meal entries for today
When the user opens the root URL
Then the day diary shows today's date in the DateNavigator
And each MealSection shows the correct entries for that meal type
And the CalorieRing and MacroBar reflect the sum of today's entries
```

### Scenario 3.5 — Navigating to a previous day loads that day's entries

```
Given the user is on the day diary viewing today
When the user taps the "previous day" control in DateNavigator
Then useDayStore.goPreviousDay() is called
And the diary re-renders showing the previous day's entries
And the CalorieRing and MacroBar update accordingly
```

### Scenario 3.6 — Next day navigation is blocked at today

```
Given the user is viewing today's date in the day diary
When the user attempts to tap the "next day" control
Then the control is disabled (not clickable)
And useDayStore.goNextDay() is not called
And the date does not change
```

### Scenario 3.7 — Food search returns results and navigates to portion screen

```
Given the user is on the food search screen
And the device is online
When the user types a query (debounce window has elapsed)
Then lib/openFoodFacts.ts search() is called once with the query
And results are displayed as FoodResultRow components
When the user taps a result
Then the user is navigated to the portion selection screen for that food
```

### Scenario 3.8 — Food search shows offline indicator when offline

```
Given the device is offline (navigator.onLine === false)
When the user navigates to the food search screen and types a query
Then no network request is made to the OFF API
And the results list is empty or an offline indicator is shown
And no error is thrown to the user
```

### Scenario 3.9 — Adding a meal entry updates the diary immediately

```
Given the user selects a food and enters a quantity on the portion screen
When the user confirms the addition
Then useDayStore.addEntry() is called with the correct NewMealEntry data
And the user is returned to the day diary
And the new entry appears in the correct MealSection
And the CalorieRing and MacroBar totals are updated without a page reload
```

### Scenario 3.10 — Deleting a meal entry recalculates totals

```
Given the day diary shows at least one meal entry
When the user deletes an entry via its MealEntryRow delete control
Then useDayStore.deleteEntry(id) is called
And the entry disappears from the MealSection immediately
And the CalorieRing and MacroBar totals decrease by the deleted entry's values
```

### Scenario 3.11 — CopyFromYesterdayBanner appears for empty meal with yesterday's data

```
Given today's breakfast MealSection is empty
And yesterday's breakfast had at least one entry
When the day diary renders today
Then CopyFromYesterdayBanner appears inside the breakfast MealSection
And it displays the correct count of yesterday's breakfast entries
```

### Scenario 3.12 — Accepting CopyFromYesterdayBanner copies entries

```
Given the CopyFromYesterdayBanner is visible for a meal section
When the user taps the accept button
Then useDayStore.repeatMeal(mealType) is called
And the copied entries appear in the meal section immediately
And the CalorieRing and MacroBar update accordingly
And the banner is no longer visible
```

### Scenario 3.13 — Dismissing CopyFromYesterdayBanner hides it

```
Given the CopyFromYesterdayBanner is visible for a meal section
When the user taps the dismiss button
Then the banner is hidden
And no entries are copied
And the meal section remains empty
```

### Scenario 3.14 — Custom food is created and searchable

```
Given the user navigates to the custom food creation screen
When the user fills in name and calories per 100 g (minimum required fields) and submits
Then db/repositories/foods.ts upsert() is called with source "custom"
And the food appears in subsequent food search results
```

### Scenario 3.15 — Profile edit updates day diary targets

```
Given the user is on the profile screen
When the user edits weight and saves
Then useProfileStore.saveProfile() is called
And the day diary's CalorieRing and MacroBar goals reflect the updated targets
Without a page reload
```

### Scenario 3.16 — No RN primitives in web build

```
Given the web build artifact is produced
When the bundle is inspected for react-native, expo-*, or nativewind imports
Then none are found
```
