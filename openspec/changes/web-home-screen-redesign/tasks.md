# Implementation Tasks: web-home-screen-redesign

## Dependency Overview

```
T1 (schema type)
T2 (repo LEFT JOIN)  ← depends on T1
T3 (store widening)  ← depends on T1, T2
T4 (MEAL_EMOJI)      ← no deps (pure constant)
T5 (CalorieCard)     ← depends on T1 (uses no store directly, but types needed)
T6 (HeaderMacroRow)  ← no deps (pure props)
T7 (MealSection)     ← depends on T1, T3
T8 (MealEntryRow)    ← depends on T1, T4
T9 (delete CalorieRing) ← depends on T5 (T5 must exist first)
T10 (day.tsx assembly) ← depends on T3, T5, T6, T7, T8, T9
```

---

## Tasks

---

### T1 — Add MealEntryView type to schema/repo

**Depends on**: —

**Files**:
- `db/repositories/mealEntries.ts` — add type export
- `types/index.ts` — re-export

**What**: Export `MealEntryView = MealEntry & { brand: string | null }` from `db/repositories/mealEntries.ts`. Re-export it through `types/index.ts` alongside the existing `MealEntry` re-export so all consumers can import from `@/types`.

**Tests**: Type-level only — no runtime test needed for the type alias. Covered by T2's repo tests.

**Done when**:
- `export type MealEntryView = MealEntry & { brand: string | null }` exists in `db/repositories/mealEntries.ts`
- `types/index.ts` re-exports `MealEntryView`
- `npm run typecheck` passes

---

### T2 — Add LEFT JOIN brand to getByDate

**Depends on**: T1

**Files**:
- `db/repositories/mealEntries.ts`

**What**: Modify the `getByDate` function to LEFT JOIN the `foods` table on `mealEntries.foodId = foods.id`, selecting `foods.brand`. Map results to `MealEntryView[]`. Do NOT change `getByDateAndMeal` (it feeds the copy-from-yesterday banner and doesn't need brand).

**Design reference (exact shape)**:
```ts
export async function getByDate(date: string): Promise<MealEntryView[]> {
  const rows = await db
    .select({ entry: mealEntries, brand: foods.brand })
    .from(mealEntries)
    .leftJoin(foods, eq(mealEntries.foodId, foods.id))
    .where(eq(mealEntries.date, date))
    .orderBy(asc(mealEntries.loggedAt));
  return rows.map((r) => ({ ...r.entry, brand: r.brand ?? null }));
}
```

**Tests** (create `db/repositories/__tests__/mealEntries.brand.test.ts` or add to existing test):
- `getByDate` returns `brand = "Mercadona"` when joined food has brand
- `getByDate` returns `brand = null` when joined food has null brand
- `getByDate` returns `brand = null` when no matching food row (LEFT JOIN miss)
- All original `MealEntry` fields are present unchanged

**Done when**:
- `getByDate` returns `MealEntryView[]`
- Tests pass (`npm test`)
- `npm run typecheck` passes

---

### T3 — Widen useDayStore entries to MealEntryView[]

**Depends on**: T1, T2

**Files**:
- `stores/useDayStore.ts`

**What**: Change the `entries` state field type from `MealEntry[]` to `MealEntryView[]`. Update the `addEntry` optimistic path to append `brand: null` (the insert returns a `MealEntry` without brand — set brand:null for the optimistic row; a subsequent `loadEntries` refresh will correct it).

**Tests**: No new runtime tests needed; typecheck is the gate.

**Done when**:
- `entries: MealEntryView[]` in store state interface
- `addEntry` optimistic push sets `brand: null`
- `npm run typecheck` passes

---

### T4 — Add MEAL_EMOJI constant

**Depends on**: —

**Files**:
- `lib/constants.ts` (create if missing)

**What**: Create (or extend) `lib/constants.ts` with a static `MEAL_EMOJI: Record<MealType, string>` mapping: `breakfast → "🍳"`, `lunch → "🍽️"`, `dinner → "🌙"`, `snack → "🍎"`.

**Tests** (create `lib/__tests__/constants.test.ts`):
- Each `MealType` key maps to the correct emoji
- No key is missing (Object.keys(MEAL_EMOJI) covers all 4 meal types)

**Done when**:
- `MEAL_EMOJI` exported from `lib/constants.ts`
- Tests pass

---

### T5 — Create CalorieCard component

**Depends on**: T1

**Files**:
- `src/components/CalorieCard.tsx` (create)
- `src/components/__tests__/CalorieCard.test.tsx` (create)

**What**: Implement the SVG 270° open-arc gauge component. Export pure helper functions (`polarToCartesian`, `describeArc`, `describeTick`) alongside the component so they can be unit-tested. The SVG track is a full 270° arc in `gray-200`; the progress arc starts at `START_ANGLE` and ends at `START_ANGLE + SWEEP * fraction` in green (or amber when over-target). Two `<line>` ticks mark the 90% and 110% (capped at 100%) positions. Below the gauge: three macro rows (Proteínas/Carbs/Grasas) each with consumed/goal text and a `<div>` progress bar. A visual-only `<button type="button">Terminar Día</button>` with no `onClick`.

**Constants from design**:
- `SIZE=200`, `STROKE_WIDTH=16`, `START_ANGLE=-225`, `SWEEP=270`
- Over-target color: `#f59e0b` (amber-500); normal: `#22c55e` (green-500); track: `#e5e7eb` (gray-200)

**Props**:
```ts
interface CalorieCardProps {
  consumed: number;
  goal: number;
  proteinG: number; proteinGoalG: number;
  carbsG: number;   carbsGoalG: number;
  fatG: number;     fatGoalG: number;
}
```

**Tests** (`src/components/__tests__/CalorieCard.test.tsx`):
- `polarToCartesian` at 0° returns `(cx+r, cy)`, at 90° returns `(cx, cy+r)` (±0.001 float tolerance)
- `fraction` clamps: consumed=0→0, consumed=goal→1, consumed=2×goal→1, goal=0→0
- `progressEndAngle`: fraction=0.7 → -225 + 0.7×270 = -36
- Over-target (consumed > goal): fraction=1, progress color = amber `#f59e0b`
- Tick angles: 0.9 → -225 + 0.9×270 = 18°; 1.1 caps → -225 + 270 = 45°
- `describeArc` largeArcFlag: sweep≤180→0, sweep>180→1 (270°→1)
- Component renders a `<button>` with text "Terminar Día" that does nothing when clicked
- Component renders 2 `<line>` elements (the ticks)
- Zero consumption: progress `<path>` is not rendered (or has fraction=0)

**Done when**:
- All arc-geometry tests pass
- Component renders without crash for all spec scenarios
- `npm run typecheck` passes

---

### T6 — Create HeaderMacroRow component

**Depends on**: —

**Files**:
- `src/components/HeaderMacroRow.tsx` (create)
- `src/components/__tests__/HeaderMacroRow.test.tsx` (create)

**What**: A horizontal row of 4 inline chips: kcal (with `calorieGoal` denominator, fallback 2000 kcal), Proteínas, Carbs, Grasas. Each chip shows the consumed value, a "/" separator, goal, and a thin inline progress bar below the text. No external deps; pure Tailwind.

**Props**:
```ts
interface HeaderMacroRowProps {
  calories: number;    calorieGoal: number;
  proteinG: number;    proteinGoalG: number;
  carbsG: number;      carbsGoalG: number;
  fatG: number;        fatGoalG: number;
}
```

**Tests** (`src/components/__tests__/HeaderMacroRow.test.tsx`):
- `calorieGoal=0` falls back to 2000 in the denominator display
- Zero consumption → all progress bars have zero width
- Each macro label renders (`kcal`, `P`, `C`, `G` or equivalent)

**Done when**:
- Tests pass
- `npm run typecheck` passes

---

### T7 — Update MealSection to Fitia-style header

**Depends on**: T1, T3

**Files**:
- `src/components/MealSection.tsx`

**What**: Widen `entries` prop from `MealEntry[]` to `MealEntryView[]`. Add a macro summary line below the meal title: `🔥 {kcal} kcal · {P}P | {C}C | {G}G` using totals computed from `entries`. Pass `mealType` prop down to each `MealEntryRow`. All existing behavior (collapse, add-food, copy/paste/clear menu, CopyFromYesterdayBanner) is preserved unchanged.

**Tests** (add to existing or create `src/components/__tests__/MealSection.test.tsx`):
- Header renders `🔥 {kcal} kcal · {P}P | {C}C | {G}G` with correct totals
- Empty section: summary shows zeros; `+` add-food button is rendered
- `mealType` prop flows through to each `MealEntryRow`

**Done when**:
- Summary line renders correctly
- `npm run typecheck` passes
- Tests pass

---

### T8 — Update MealEntryRow to Fitia layout + swipe-to-delete

**Depends on**: T1, T4

**Files**:
- `src/components/MealEntryRow.tsx`

**What**: Widen `entry` to `MealEntryView`; add `mealType: MealType` prop. New layout: `[emoji square] [name + brand stack (brand: text-xs text-gray-400, hidden when null)] [qty + kcal right-aligned]`. Add web pointer-event swipe-to-delete: `onPointerDown` records start X; `onPointerMove` tracks delta; `onPointerUp` triggers `onDelete` when horizontal displacement ≥ 80 px. Keep the existing trash `<button>` as the keyboard/click fallback (a11y). Use `MEAL_EMOJI[mealType]` from `lib/constants.ts` for the emoji square.

**Tests** (update/create `src/components/__tests__/MealEntryRow.test.tsx`):
- Renders brand line when `entry.brand` is non-null (small gray text)
- Does NOT render brand line when `entry.brand` is null
- Renders correct `MEAL_EMOJI` for each of the 4 meal types
- Swipe `onPointerDown → onPointerMove (≥80px) → onPointerUp` → `onDelete` called
- Sub-threshold swipe (<80px) → `onDelete` NOT called
- Trash button click → `onDelete` called

**Done when**:
- All tests pass
- `npm run typecheck` passes

---

### T9 — Delete CalorieRing component

**Depends on**: T5 (T5 must exist before CalorieRing is removed)

**Files**:
- `src/components/CalorieRing.tsx` (DELETE)

**What**: Delete the file. Verify no other file imports it after T10 has removed the `day.tsx` import. If `MacroBar.tsx` has no other consumer after the day.tsx rewrite, leave it in place (out of scope for this slice).

**Tests**: `npm run typecheck` and `npm run build` pass (no dangling imports).

**Done when**:
- `src/components/CalorieRing.tsx` does not exist
- `rg "CalorieRing" src/` returns no results
- Build passes

---

### T10 — Restructure day.tsx with sticky header + scroll body

**Depends on**: T3, T5, T6, T7, T8, T9

**Files**:
- `src/routes/day.tsx`

**What**: Redesign the screen layout to:
1. Outer shell: `<div className="flex flex-col h-[100dvh] bg-gray-50">`
2. Sticky header sibling (above scroll): `<div className="sticky top-0 z-10 bg-gray-50">` containing `DateNavigator` + `HeaderMacroRow`
3. Scroll container: `<div className="flex-1 overflow-y-auto px-4 pb-20">` containing `CalorieCard` + optional "Día anterior" note + 4× `MealSection`
4. Remove: `CalorieRing` card div, `MacroBar` card div, "daily totals summary" paragraph, and their imports.

**Tests** (create `src/routes/__tests__/DayScreen.test.tsx` or add to existing):
- No `CalorieRing` import or JSX remains
- Sticky header div has `sticky top-0 z-10` classes
- Scroll container has `overflow-y-auto`
- `WeekCalendarHeader` absence produces no crash (slot renders null)

**Done when**:
- Layout matches the design DOM structure
- `CalorieRing` and `MacroBar` are no longer imported in `day.tsx`
- All typecheck + tests pass

---

## Review Workload Forecast

| Metric | Value |
|---|---|
| Estimated changed lines | ~450–550 |
| New files | 4 (CalorieCard.tsx, HeaderMacroRow.tsx, lib/constants.ts, 3–4 test files) |
| Modified files | 6 (mealEntries.ts, schema types/index.ts, useDayStore.ts, MealSection.tsx, MealEntryRow.tsx, day.tsx) |
| Deleted files | 1 (CalorieRing.tsx) |
| 400-line budget risk | **High** |
| Chained PRs recommended | **Yes** |
| Decision needed before apply | **Yes** |

**Reasoning**: Creating two new components (CalorieCard with SVG arc math + tests, HeaderMacroRow + tests) plus modifying 6 existing files easily exceeds 400 lines. The change is naturally splittable into two PRs with a clean seam at the data layer boundary.

### Suggested PR split (if chained)

**PR #1 — Data layer + constants + components** (T1–T8):
- `MealEntryView` type, `getByDate` LEFT JOIN, store widening
- `MEAL_EMOJI`, `CalorieCard`, `HeaderMacroRow`
- `MealSection` + `MealEntryRow` updates

**PR #2 — Screen assembly + CalorieRing removal** (T9–T10):
- Delete `CalorieRing.tsx`
- Restructure `day.tsx`
