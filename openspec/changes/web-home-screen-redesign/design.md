# Home Screen Redesign — Technical Design (Web)

> Stack: Vite + React 18 + TypeScript (strict) + Tailwind CSS 3.4. Routing via `react-router-dom`.
> This is a UI + read-model change. NO schema migration. Adapted from the native (Expo/React Native) design for the web PWA.

## Technical Approach

This change restyles the home diary screen (`src/routes/day.tsx`) into a Fitia-style layout without any database migration. The redundant `CalorieRing` and `MacroBar` cards plus the textual "daily totals summary" are removed and replaced by: (1) a sticky header region — outside the scroll container — holding `DateNavigator`, a future `WeekCalendarHeader` slot, and a new `HeaderMacroRow` (4 inline progress chips: kcal/P/C/G); and (2) a scrollable content region holding a new `CalorieCard` (an inline SVG 270° open-arc gauge with two range tick marks and three macro rows) followed by the four restyled `MealSection`s. Brand text on each row comes from a query-time `LEFT JOIN foods ON foodId` added to the existing `getByDate` repository method, surfaced as a new read-model type `MealEntryView = MealEntry & { brand: string | null }`. The native `react-native-svg` arc becomes inline `<svg>`/`<path>`/`<line>` SVG elements; the native `PanResponder` swipe-to-delete becomes web pointer events (`onPointerDown`/`onPointerMove`/`onPointerUp`); NativeWind `className` props become plain Tailwind 3.4 classes; `ScrollView` becomes `<div className="overflow-y-auto">`; and the sticky-outside-scroll pattern becomes `<div className="sticky top-0 z-10">`.

## Architecture Decisions

| Decision | Choice | Alternatives rejected | Rationale |
|---|---|---|---|
| Brand source | Query-time `LEFT JOIN foods ON meal_entries.foodId = foods.id` in `getByDate`, selecting `foods.brand` | (a) Denormalize `brand` into `meal_entries` via migration; (b) per-row N+1 lookups in the component | LEFT JOIN keeps it read-only (no migration, satisfies "no schema migration"), single round-trip, and brand stays the single source of truth on `foods`. |
| Brand row type | New `MealEntryView = MealEntry & { brand: string \| null }` exported from `db/repositories/mealEntries.ts` (re-exported via `types/index.ts`) | Mutating the Drizzle-inferred `MealEntry` type | `MealEntry` is the persisted schema type and must stay aligned with the table. A view type cleanly models the read-model projection. |
| Store entries type | `useDayStore.entries` widened from `MealEntry[]` to `MealEntryView[]` | Keep `MealEntry[]` and join in the component | The join already happens in the repo; the store should carry the enriched read model so all consumers (rows) get `brand` for free. `MealEntryView` is a superset of `MealEntry`, so existing readers (totals, filters) stay type-compatible. |
| Emoji mapping | Static `MEAL_EMOJI: Record<MealType, string>` in new file `lib/constants.ts` | Category-based emoji lookup from food data | Category lookup is explicitly out of scope for this slice; a static per-meal-type map is deterministic and trivially testable. |
| Calorie gauge rendering | Inline `<svg>` with two `<path>` arcs (track + progress) built from a polar→cartesian helper using SVG arc command `A` | `react-native-svg` (RN-only); CSS conic-gradient; `<circle>` + `stroke-dasharray` (current `CalorieRing` technique) | Inline SVG `<path>` with an explicit arc command is the portable web equivalent of the native arc, gives exact control over the 270° open sweep and over-target color, and supports the two normal tick `<line>`s. `stroke-dasharray` cannot easily express an open 270° arc with ticks. |
| Arc geometry constants | `size=200`, `strokeWidth=16`, `START_ANGLE=-225°`, `SWEEP=270°` | Full-circle ring | Matches the native spec; the open arc (gap at the bottom) is the Fitia look. |
| Range ticks | Two short `<line>`s normal to the arc at `goal×0.9` and `goal×1.1` positions, capped to the 0..SWEEP range | Text labels; no ticks | Visual range cue matching native; cheap to render and pure-geometry testable. |
| Over-target color | When `consumed > goal`, progress arc fills to 100% of sweep and switches stroke color to a distinct over-target color (amber/red) | Let arc overflow past sweep | Clamping at 100% sweep + color change communicates "over target" without distorting the gauge. |
| Header position | `DateNavigator` + `WeekCalendarHeader` slot + `HeaderMacroRow` wrapped in `<div className="sticky top-0 z-10 bg-gray-50">`, OUTSIDE the scroll container | Sticky inside the scroll div; fixed positioning | `sticky top-0` on a sibling above `overflow-y-auto` content keeps the header pinned during scroll, which is the web equivalent of "sticky outside ScrollView". `z-10` keeps it above scrolled cards. |
| Scroll container | Content (`CalorieCard` + `MealSection×4`) wrapped in `<div className="flex-1 overflow-y-auto">` inside a `flex flex-col h-screen` (or `h-[100dvh]`) page shell | Page-level body scroll | An explicit scroll container is required so the sticky header has a scroll context to pin against and the tab bar/header stay fixed. |
| Swipe-to-delete | Web pointer events on each `MealEntryRow`: track `onPointerDown` start X, `onPointerMove` delta, `onPointerUp`; horizontal displacement `≥ 80px` reveals/triggers delete | `react-native-gesture-handler`/`reanimated` (RN-only); third-party web gesture lib | Native Pointer Events are built-in, cover mouse + touch + pen, and need no dependency. The existing trash button stays as an a11y fallback. |
| Color tokens | Reference Tailwind palette classes directly (e.g. `text-gray-900`, `bg-green-500`); if `lib/tokens.ts` (`Colors`) exists at apply time, import the named constants for SVG stroke colors instead of hard-coded hex | Hard-code hex everywhere | `lib/tokens.ts` is not present in this worktree; the apply phase should prefer the semantic token layer if it lands first, else fall back to Tailwind palette + literal hex for SVG strokes. |

## Data Flow

```
foods (LEFT JOIN on meal_entries.foodId, SELECT foods.brand)
meal_entries → repo.getByDate(date) → MealEntryView[]   // {...MealEntry, brand}
  → useDayStore.entries: MealEntryView[]
    → src/routes/day.tsx (DayScreen)
      → useDailyTotals(entries)            // unchanged; MealEntryView is a MealEntry superset
      → [STICKY]  DateNavigator
                  WeekCalendarHeader slot   // optional; renders nothing if absent
                  HeaderMacroRow(totals + profile goals)
      → [SCROLL]  CalorieCard(totals.calories, profile.calorieGoal, totals macros, profile macro goals)
                  MealSection[mealType]
                    → entries.filter(e => e.mealType === mealType)
                    → MealEntryRow(entry, MEAL_EMOJI[mealType])   // entry.brand, swipe-to-delete
```

## Screen Layout (web DOM structure)

```
<div className="flex flex-col h-[100dvh] bg-gray-50">

  {/* ── STICKY HEADER (sibling above the scroll container) ── */}
  <div className="sticky top-0 z-10 bg-gray-50">
    <DateNavigator selectedDate onPrevious onNext />
    {/* Future WeekCalendarHeader slot — renders null when component absent (no gap) */}
    { /* <WeekCalendarHeader /> */ }
    <HeaderMacroRow
      calories={totals.calories} calorieGoal={profile?.calorieGoal ?? 2000}
      proteinG={totals.proteinG} proteinGoalG={profile?.proteinGoalG ?? 150}
      carbsG={totals.carbsG}     carbsGoalG={profile?.carbsGoalG ?? 250}
      fatG={totals.fatG}         fatGoalG={profile?.fatGoalG ?? 70}
    />
  </div>

  {/* ── SCROLLABLE CONTENT ── */}
  <div className="flex-1 overflow-y-auto px-4 pb-20">
    <CalorieCard
      consumed={totals.calories} goal={profile?.calorieGoal ?? 2000}
      proteinG={totals.proteinG} proteinGoalG={profile?.proteinGoalG ?? 150}
      carbsG={totals.carbsG}     carbsGoalG={profile?.carbsGoalG ?? 250}
      fatG={totals.fatG}         fatGoalG={profile?.fatGoalG ?? 70}
    />
    {!isToday && <p className="...">Día anterior — solo lectura</p>}
    {MEAL_TYPES.map(mealType => (
      <MealSection key={mealType} mealType={mealType} entries={...} ... />
    ))}
  </div>

</div>
```

Notes:
- The header is a **sibling that precedes** the scroll container. With `sticky top-0` it pins to the top of the nearest scrolling ancestor. Because content scrolls in its own `overflow-y-auto` div, the header stays visible. `z-10` keeps it above scrolled cards.
- `h-[100dvh]` (dynamic viewport height) is preferred over `h-screen` for mobile PWA address-bar resize correctness; `h-screen` is an acceptable fallback.
- `WeekCalendarHeader` slot: render the component only if it exists; when absent, render `null` so there is no visible gap (degrades gracefully).
- Removed from current `day.tsx`: the `CalorieRing` card `<div>`, the `MacroBar` card `<div>`, and the "daily totals summary" `<p>`.

## SVG Arc Implementation (CalorieCard)

### Constants
```ts
const SIZE = 200;
const STROKE_WIDTH = 16;
const START_ANGLE = -225;            // degrees; arc opening centered at the bottom
const SWEEP = 270;                   // degrees of total arc
const RADIUS = (SIZE - STROKE_WIDTH) / 2;
const CENTER = SIZE / 2;
const TICK_LEN = 10;                 // length of a range tick line (px)
```

### Polar → Cartesian helper
```ts
// Returns the cartesian point on a circle of the given radius at `angleDeg`,
// measured clockwise where 0° points to the +X axis (3 o'clock). Centered at (cx, cy).
function polarToCartesian(
  cx: number,
  cy: number,
  radius: number,
  angleDeg: number
): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
}
```

### Arc path builder
```ts
// Builds an SVG path `d` for an arc from startAngle to endAngle (degrees) on a circle.
function describeArc(
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number
): string {
  const start = polarToCartesian(cx, cy, radius, startAngle);
  const end = polarToCartesian(cx, cy, radius, endAngle);
  const sweep = endAngle - startAngle;          // always positive here
  const largeArcFlag = sweep <= 180 ? 0 : 1;    // 1 when arc spans > 180°
  // sweep-flag = 1 → draw clockwise (increasing angle)
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;
}
```

### Progress and tick math
```ts
const fraction = goal > 0 ? Math.min(consumed / goal, 1) : 0;   // clamp 0..1
const progressEndAngle = START_ANGLE + SWEEP * fraction;

const overTarget = consumed > goal;
const progressColor = overTarget ? "#f59e0b" /* amber-500 */ : "#22c55e" /* green-500 */;
const trackColor = "#e5e7eb"; // gray-200

// Range ticks at goal × 0.9 and goal × 1.1, expressed as fraction of goal,
// then capped to the [0, 1] fraction-of-sweep range.
const tickFractions = [0.9, 1.1].map((f) => Math.min(f, 1)); // 1.1 caps at sweep end
const tickAngles = tickFractions.map((f) => START_ANGLE + SWEEP * f);
```
> Per the spec's SVG Arc Spec note, ticks are placed at the 90% and (capped) 110% positions of the sweep; the 110% tick caps at the sweep end (`START_ANGLE + SWEEP * 1.0`).

### Tick line geometry (normal to the arc)
```ts
// A tick is a short radial line crossing the stroke band at `angle`.
function describeTick(angle: number) {
  const inner = polarToCartesian(CENTER, CENTER, RADIUS - TICK_LEN / 2, angle);
  const outer = polarToCartesian(CENTER, CENTER, RADIUS + TICK_LEN / 2, angle);
  return { x1: inner.x, y1: inner.y, x2: outer.x, y2: outer.y };
}
```

### Render (inline SVG)
```tsx
<svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
  {/* Track (full 270° sweep) */}
  <path d={describeArc(CENTER, CENTER, RADIUS, START_ANGLE, START_ANGLE + SWEEP)}
        fill="none" stroke={trackColor} strokeWidth={STROKE_WIDTH} strokeLinecap="round" />
  {/* Progress */}
  {fraction > 0 && (
    <path d={describeArc(CENTER, CENTER, RADIUS, START_ANGLE, progressEndAngle)}
          fill="none" stroke={progressColor} strokeWidth={STROKE_WIDTH} strokeLinecap="round" />
  )}
  {/* Range ticks */}
  {tickAngles.map((a, i) => {
    const t = describeTick(a);
    return <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
                 stroke="#9ca3af" strokeWidth={2} />;
  })}
</svg>
```
Centered text (consumed kcal bold + `de {goal} kcal`) is overlaid with an absolutely-positioned `<div className="absolute inset-0 flex flex-col items-center justify-center">`, identical to the current `CalorieRing` overlay technique.

### CalorieCard component props
```ts
interface CalorieCardProps {
  consumed: number;
  goal: number;            // falls back to 2000 upstream when unset/zero
  proteinG: number;
  proteinGoalG: number;
  carbsG: number;
  carbsGoalG: number;
  fatG: number;
  fatGoalG: number;
}
```
Below the gauge, three macro rows (Proteínas / Carbs / Grasas) each render `consumed / goal` and a horizontal progress bar (`<div className="h-1.5 rounded-full bg-gray-200"><div className="h-full rounded-full bg-..." style={{ width: `${pct}%` }} /></div>`). A visual-only `<button type="button">Terminar Día</button>` is rendered with NO `onClick` handler (no-op this slice).

## Interfaces (TypeScript contracts)

```ts
// db/repositories/mealEntries.ts — new read-model type
export type MealEntryView = MealEntry & { brand: string | null };

// getByDate signature changes its return type (LEFT JOIN added):
export async function getByDate(date: string): Promise<MealEntryView[]>;

// types/index.ts — re-export
export type { MealEntryView } from "@/db/repositories/mealEntries";

// lib/constants.ts — static emoji map
export const MEAL_EMOJI: Record<MealType, string> = {
  breakfast: "🍳",
  lunch: "🍽️",
  dinner: "🌙",
  snack: "🍎",
};

// src/components/HeaderMacroRow.tsx
interface HeaderMacroRowProps {
  calories: number; calorieGoal: number;
  proteinG: number; proteinGoalG: number;
  carbsG: number;   carbsGoalG: number;
  fatG: number;     fatGoalG: number;
}

// src/components/CalorieCard.tsx
interface CalorieCardProps { /* see CalorieCard props above */ }

// src/components/MealEntryRow.tsx — widened entry type
interface MealEntryRowProps {
  entry: MealEntryView;          // was MealEntry; now carries brand
  onDelete: (id: string) => void;
  mealType: MealType;            // NEW: used to look up MEAL_EMOJI
}

// src/components/MealSection.tsx — widened entries type
interface MealSectionProps {
  // ...existing props unchanged...
  entries: MealEntryView[];      // was MealEntry[]
}

// stores/useDayStore.ts — widened state
interface DayState {
  selectedDate: string;
  entries: MealEntryView[];      // was MealEntry[]
  isLoading: boolean;
}
```

### Drizzle LEFT JOIN (getByDate) — shape
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
> `foods` is already exported from `db/schema.ts`. Add `foods` to the import and `leftJoin` from `drizzle-orm`. `getByDateAndMeal` may be left unchanged (it returns `MealEntry[]` and feeds the copy-from-yesterday banner which does not need brand); if its callers are typed against the store they remain compatible since they don't read `brand`.

## File Changes

| File | Action | Description |
|---|---|---|
| `src/components/CalorieRing.tsx` | DELETE | Remove component entirely; no references may remain. |
| `src/components/CalorieCard.tsx` | CREATE | Inline-SVG 270° arc gauge + two range ticks + three macro rows + visual-only "Terminar Día" button. |
| `src/components/HeaderMacroRow.tsx` | CREATE | Sticky-header macro chips: kcal/P/C/G, each with inline progress bar; 2000 kcal fallback. |
| `lib/constants.ts` | CREATE | `MEAL_EMOJI: Record<MealType, string>` static map. |
| `src/components/MealEntryRow.tsx` | MODIFY | Switch to `MealEntryView`; add `mealType` prop; layout = emoji square \| name+brand stack (brand `text-xs text-gray-400`, hidden when null) \| qty+kcal stack (right); add pointer-event swipe-to-delete (≥80px) keeping trash button as fallback. |
| `src/components/MealSection.tsx` | MODIFY | `entries: MealEntryView[]`; restyle header summary to `🔥 {kcal} kcal · {P}P \| {C}C \| {G}G`; pass `mealType` to each `MealEntryRow`. |
| `src/routes/day.tsx` | MODIFY | New layout shell (`flex flex-col h-[100dvh]`); sticky header region (DateNavigator + WeekCalendarHeader slot + HeaderMacroRow); scroll container with CalorieCard + MealSections; remove CalorieRing card, MacroBar card, and daily-totals summary; remove CalorieRing/MacroBar imports. |
| `db/repositories/mealEntries.ts` | MODIFY | Add `MealEntryView` type; add LEFT JOIN on `foods` in `getByDate`; import `foods` + `leftJoin`. |
| `stores/useDayStore.ts` | MODIFY | Widen `entries` to `MealEntryView[]`. |
| `types/index.ts` | MODIFY | Re-export `MealEntryView`. |
| `src/components/MacroBar.tsx` | KEEP (unused on home) | No longer used by `day.tsx`; leave file in place unless verify flags it as dead — removing it is out of this slice's scope unless no other consumer exists. |
| `src/components/CalorieCard.test.ts(x)` | CREATE | Arc-geometry + component render tests (see Testing Strategy). |
| `db/repositories/mealEntries.test.ts` | CREATE/MODIFY | `getByDate` LEFT JOIN brand mapping tests. |

## Testing Strategy (Jest 29 + ts-jest)

### Unit — arc geometry (pure functions, no DOM)
Extract `polarToCartesian`, `describeArc`, `describeTick`, and the progress/tick math into pure helpers (export them from `CalorieCard.tsx` or a colocated `calorieArc.ts`) so they are testable in isolation.
- `polarToCartesian` at known angles: `0°→(cx+r, cy)`, `90°→(cx, cy+r)`, `-90°→(cx, cy-r)` (within float tolerance).
- `fraction` clamps: `consumed=0 → 0`; `consumed=goal → 1`; `consumed=2×goal → 1`; `goal=0 → 0`.
- `progressEndAngle`: `fraction=0.7 → START_ANGLE + 0.7×SWEEP = -225 + 189 = -36°`.
- Over-target: `consumed > goal → fraction clamps to 1` and progress color = amber.
- Tick angles: `0.9 → -225 + 0.9×270 = 18°`; `1.1` caps at sweep end `-225 + 270 = 45°`.
- `describeArc` largeArcFlag: sweep `≤180 → 0`, sweep `>180 → 1` (e.g. full 270° → 1).

### Unit — repository join
- `getByDate` returns `MealEntryView[]` with `brand = "Mercadona"` when the joined `foods` row has a brand.
- `getByDate` returns `brand = null` when the joined food has null brand.
- `getByDate` returns `brand = null` when there is no matching food row (LEFT JOIN miss → coalesce to null).
- All denormalized `MealEntry` fields are preserved unchanged after the join/map.

### Component rendering (React Testing Library)
- `MealEntryRow` with brand renders the brand line (small gray text); without brand renders no brand line.
- `MealEntryRow` renders the correct `MEAL_EMOJI` for each `mealType`; qty and kcal are right-aligned.
- `MealEntryRow` swipe: simulate `pointerdown`→`pointermove` (≥80px horizontal)→`pointerup` and assert `onDelete` is invoked; a sub-threshold move does NOT trigger delete.
- `MealSection` header renders `🔥 {kcal} kcal · {P}P | {C}C | {G}G`; empty section shows zeros + "+" add button.
- `CalorieCard` renders consumed/goal text, a progress `<path>`, exactly two tick `<line>`s, and a no-op "Terminar Día" `<button>`; clicking it changes nothing.
- `HeaderMacroRow` falls back to 2000 kcal when `calorieGoal` is 0/undefined; zero consumption → empty bars.
- `day.tsx`: no `CalorieRing` import/usage remains; sticky header div carries `sticky top-0 z-10`; scroll container carries `overflow-y-auto`; absent `WeekCalendarHeader` produces no crash and no gap.
