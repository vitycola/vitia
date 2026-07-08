# Graph Report - brave-kilby-8df8a8  (2026-07-08)

## Corpus Check
- 217 files · ~96,517 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1163 nodes · 2285 edges · 79 communities (65 shown, 14 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 4 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `39f01f71`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Meal UI Components|Meal UI Components]]
- [[_COMMUNITY_Dexie IndexedDB Adapter|Dexie IndexedDB Adapter]]
- [[_COMMUNITY_OPFS Worker & DB Client|OPFS Worker & DB Client]]
- [[_COMMUNITY_Build & Dev Dependencies|Build & Dev Dependencies]]
- [[_COMMUNITY_Architecture & Data Flow|Architecture & Data Flow]]
- [[_COMMUNITY_Day Diary Components|Day Diary Components]]
- [[_COMMUNITY_Biome Config & Linting|Biome Config & Linting]]
- [[_COMMUNITY_SDD Planning & Migration Strategy|SDD Planning & Migration Strategy]]
- [[_COMMUNITY_Nutrition Domain & Profile|Nutrition Domain & Profile]]
- [[_COMMUNITY_TypeScript Config|TypeScript Config]]
- [[_COMMUNITY_CI Pipeline & PWA Build|CI Pipeline & PWA Build]]
- [[_COMMUNITY_Runtime Dependencies|Runtime Dependencies]]
- [[_COMMUNITY_Node TS Config|Node TS Config]]
- [[_COMMUNITY_Jest Test Config|Jest Test Config]]
- [[_COMMUNITY_UI Button Component|UI Button Component]]
- [[_COMMUNITY_Jest SQL Transform|Jest SQL Transform]]
- [[_COMMUNITY_UI Input Component|UI Input Component]]
- [[_COMMUNITY_Debounce Hook|Debounce Hook]]
- [[_COMMUNITY_App Entry Point|App Entry Point]]
- [[_COMMUNITY_Tailwind Config|Tailwind Config]]
- [[_COMMUNITY_Jest Setup|Jest Setup]]
- [[_COMMUNITY_PostCSS Config|PostCSS Config]]
- [[_COMMUNITY_PR Chain Strategy|PR Chain Strategy]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 59|Community 59]]
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Community 61|Community 61]]
- [[_COMMUNITY_Community 62|Community 62]]
- [[_COMMUNITY_Community 63|Community 63]]
- [[_COMMUNITY_Community 64|Community 64]]
- [[_COMMUNITY_Community 65|Community 65]]
- [[_COMMUNITY_Community 66|Community 66]]
- [[_COMMUNITY_Community 67|Community 67]]
- [[_COMMUNITY_Community 68|Community 68]]
- [[_COMMUNITY_Community 69|Community 69]]
- [[_COMMUNITY_Community 70|Community 70]]
- [[_COMMUNITY_Community 71|Community 71]]
- [[_COMMUNITY_Community 72|Community 72]]
- [[_COMMUNITY_Community 73|Community 73]]
- [[_COMMUNITY_Community 74|Community 74]]
- [[_COMMUNITY_Community 75|Community 75]]
- [[_COMMUNITY_Community 76|Community 76]]
- [[_COMMUNITY_Community 77|Community 77]]
- [[_COMMUNITY_Community 78|Community 78]]

## God Nodes (most connected - your core abstractions)
1. `MealType` - 38 edges
2. `Food` - 32 edges
3. `todayISO()` - 27 edges
4. `isSyncEnabled()` - 22 edges
5. `useProfileStore` - 20 edges
6. `Vitia web PWA` - 19 edges
7. `startOfWeek()` - 18 edges
8. `weekDays()` - 18 edges
9. `useAuthStore` - 18 edges
10. `addDays()` - 17 edges

## Surprising Connections (you probably didn't know these)
- `UseCreatedFoodsListResult` --references--> `Food`  [EXTRACTED]
  hooks/useCreatedFoodsList.ts → db/schema.ts
- `IngredientInput` --references--> `Food`  [EXTRACTED]
  lib/nutrition.ts → db/schema.ts
- `CreatedFoodsTabProps` --references--> `Food`  [EXTRACTED]
  src/components/search/CreatedFoodsTab.tsx → db/schema.ts
- `makeFood()` --calls--> `normalizeForSearch()`  [EXTRACTED]
  hooks/__tests__/useCreatedFoodsList.test.ts → lib/search.ts
- `UseFavoriteResult` --references--> `MealType`  [EXTRACTED]
  hooks/useFavorite.ts → types/index.ts

## Import Cycles
- 4-file cycle: `db/client.ts -> src/db/dexie-adapter.ts -> types/index.ts -> db/repositories/mealEntries.ts -> db/client.ts`

## Communities (79 total, 14 thin omitted)

### Community 0 - "Meal UI Components"
Cohesion: 0.09
Nodes (36): AuthGuard(), AuthGuardProps, getSupabaseClient(), isSyncEnabled(), deleteByDateAndMeal(), _enqueueMealOp(), insert(), insertBulk() (+28 more)

### Community 1 - "Dexie IndexedDB Adapter"
Cohesion: 0.21
Nodes (11): CopyFromYesterdayBanner(), CopyFromYesterdayBannerProps, MealEntryRow(), MealEntryRowProps, MEAL_LABELS, MealSection(), MealSectionProps, getByDateAndMeal() (+3 more)

### Community 2 - "OPFS Worker & DB Client"
Cohesion: 0.09
Nodes (24): DayTotals, FavoritesRepo, FoodIngredientRow, FoodsRepo, MealEntriesRepo, MIGRATION_TAGS, MigrationRow, NewIngredientInput (+16 more)

### Community 3 - "Build & Dev Dependencies"
Cohesion: 0.14
Nodes (16): src/App.tsx, Biome, Engram (local memory store), src/main.tsx, manifest.webmanifest, Mechanical fix, React 19 + React Router 7, review-loop SKILL.md (+8 more)

### Community 4 - "Architecture & Data Flow"
Cohesion: 0.05
Nodes (39): dependencies, dexie, drizzle-orm, @hookform/resolvers, lucide-react, react, react-dom, react-hook-form (+31 more)

### Community 5 - "Day Diary Components"
Cohesion: 0.12
Nodes (12): CollapsibleSection(), CollapsibleSectionProps, MacroDistributionBar(), MacroDistributionBarProps, SEGMENT_COLORS, scalePortion(), DisplayUnit, DisplayWeightType (+4 more)

### Community 6 - "Biome Config & Linting"
Cohesion: 0.10
Nodes (19): AnyCall, BackendType, buildOpfsDb(), createMutex(), ExecCall, _init, ProxyDb, runWorkerMigrations() (+11 more)

### Community 7 - "SDD Planning & Migration Strategy"
Cohesion: 0.05
Nodes (42): computeBMR(), computeTDEE(), deriveCalorieGoal(), deriveMacros(), profileFieldsSchema, ProfileFieldsValues, ACTIVITY_LABELS, ConfigurationRoute() (+34 more)

### Community 8 - "Nutrition Domain & Profile"
Cohesion: 0.07
Nodes (34): UpdateToast(), getDemoSeedEnv(), getHostname(), getLocationSearch(), buildDemoMealEntries(), buildDemoProgressEntries(), clearPreviouslySeededRows(), clearSeedMarker() (+26 more)

### Community 9 - "TypeScript Config"
Cohesion: 0.11
Nodes (18): FoodResultRowProps, IngredientPickerRoute(), FoodDatabaseTab(), FoodDatabaseTabProps, FoodSearchActions, FoodSearchState, INITIAL_STATE, SearchResult (+10 more)

### Community 10 - "CI Pipeline & PWA Build"
Cohesion: 0.08
Nodes (24): devDependencies, autoprefixer, better-sqlite3, @biomejs/biome, drizzle-kit, fake-indexeddb, husky, jest (+16 more)

### Community 11 - "Runtime Dependencies"
Cohesion: 0.09
Nodes (32): backoffDelayMs(), buildSuccessResponse(), config, fetchAttempt(), fetchFromCgi(), fetchFromFallback(), fetchWithRetry(), handler() (+24 more)

### Community 12 - "Node TS Config"
Cohesion: 0.10
Nodes (28): MeasurementsCard(), MeasurementsCardProps, MeasurementsHistoryOverlay(), MeasurementsHistoryOverlayProps, OverlayRow, MeasurementsLineChart(), MeasurementsLineChartProps, MeasurementsDashboardVM (+20 more)

### Community 13 - "Jest Test Config"
Cohesion: 0.11
Nodes (28): BodyFatCard(), BodyFatCardProps, BodyFatHistoryOverlay(), BodyFatHistoryOverlayProps, OverlayRow, BodyFatLineChart(), BodyFatLineChartProps, BodyFatDashboardVM (+20 more)

### Community 14 - "UI Button Component"
Cohesion: 0.18
Nodes (11): ANGLE_LEFT, ANGLE_RIGHT, arcPoint(), CalorieCard(), CalorieCardProps, D, describeArc(), describeTick() (+3 more)

### Community 15 - "Jest SQL Transform"
Cohesion: 0.21
Nodes (12): DateNavigator(), DateNavigatorProps, ChipProps, HeaderMacroRow(), HeaderMacroRowProps, useDailyTotals(), formatDayLabel(), formatFullDayLabel() (+4 more)

### Community 18 - "App Entry Point"
Cohesion: 0.67
Nodes (3): Biome Lint Step, CI Pipeline (GitHub Actions), Vite PWA Build Step

### Community 34 - "Community 34"
Cohesion: 0.11
Nodes (28): WeightCard(), WeightCardProps, OverlayRow, WeightHistoryOverlay(), WeightHistoryOverlayProps, WeightLineChart(), WeightLineChartProps, useWeightDashboard() (+20 more)

### Community 35 - "Community 35"
Cohesion: 0.12
Nodes (25): resolveWindow(), resolveWindow(), resolveWindow(), resolveWindow(), addDays(), BUCKET_LABELS, relativeBucketLabel(), rollingWindow() (+17 more)

### Community 36 - "Community 36"
Cohesion: 0.13
Nodes (19): MealPicker(), MealPickerProps, MEAL_LABELS, MEAL_TYPES, MealTypeSelect(), MealTypeSelectProps, FavoriteMealRow, FavoriteListItem (+11 more)

### Community 37 - "Community 37"
Cohesion: 0.08
Nodes (24): files, ignore, formatter, enabled, indentStyle, indentWidth, lineWidth, quoteStyle (+16 more)

### Community 38 - "Community 38"
Cohesion: 0.14
Nodes (13): fieldClass(), FormValues, ManualFormRoute(), schema, DanglingIngredient, createComposite(), getById(), getByIds() (+5 more)

### Community 39 - "Community 39"
Cohesion: 0.18
Nodes (17): userFavoriteFoods, generateId(), addMeal(), getMealsForFood(), isFavorite(), listFoodIds(), listWithMeals(), mealClause() (+9 more)

### Community 40 - "Community 40"
Cohesion: 0.15
Nodes (12): useCreatedFoodsList(), useSwipeReveal(), UseSwipeRevealOptions, UseSwipeRevealResult, categoryIcon(), FoodCategory, CreatedFoodRow(), CreatedFoodsTab() (+4 more)

### Community 41 - "Community 41"
Cohesion: 0.13
Nodes (15): ProgressProfileInput, MigrationJournal, MigrationRow, MigratorExecutor, runWebMigrations(), splitStatements(), SQL_FILES, NewProgressEntry (+7 more)

### Community 42 - "Community 42"
Cohesion: 0.10
Nodes (19): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleDetection, moduleResolution (+11 more)

### Community 43 - "Community 43"
Cohesion: 0.19
Nodes (12): CalorieBarChart(), CalorieBarChartProps, WEEKDAY_INITIALS, CalorieDashboardCard(), CalorieDashboardCardProps, CAPTION_BY_RANGE, CalorieDashboardVM, useCalorieDashboard() (+4 more)

### Community 44 - "Community 44"
Cohesion: 0.16
Nodes (11): ModeSelectRoute(), TabLayout(), SearchRoute(), PlaceholderTab(), PlaceholderTabProps, SearchTabId, SearchTabs(), SearchTabsProps (+3 more)

### Community 45 - "Community 45"
Cohesion: 0.17
Nodes (12): foodIngredients, normalizeForSearch(), assertNoNestedComposites(), createComposite(), getCompositeFoodIds(), insert(), NewIngredientInput, searchByName() (+4 more)

### Community 46 - "Community 46"
Cohesion: 0.18
Nodes (10): FavoriteToggle(), FavoriteToggleProps, VARIANT_STYLES, FoodResultRow(), useFavorite(), UseFavoriteResult, mockUseFavorite, mockGetMealsForFood (+2 more)

### Community 47 - "Community 47"
Cohesion: 0.19
Nodes (10): ProgressEntryInitial, ProgressEntrySheet(), ProgressEntrySheetProps, ProgressExistingPhoto, ProgressSavePayload, optionalCoercedNumber, progressEntrySchema, ProgressFormInput (+2 more)

### Community 48 - "Community 48"
Cohesion: 0.13
Nodes (6): db, foods, mealEntries, NewMealEntry, DayMealPlan, DayActions

### Community 49 - "Community 49"
Cohesion: 0.14
Nodes (13): 1. Sign in on Device A, 2. Add a meal entry on Device A, 3. Verify in Supabase dashboard (optional), 4. Sign in on Device B, 5. Sign out, E2E Smoke Test — User Session Persistence, Expected Results, Failure Modes to Watch (+5 more)

### Community 50 - "Community 50"
Cohesion: 0.18
Nodes (12): startDexiePath(), createDexieAdapter(), DexieAdapter, NewFood, NewFoodIngredient, SearchResult, makeDexieBackend(), makeDexieBackend() (+4 more)

### Community 51 - "Community 51"
Cohesion: 0.21
Nodes (11): ProgressRoute(), RANGE_OPTIONS, ProgressEntryWithPhotos, ProgressInput, DashboardRange, ProgressActions, ProgressState, useProgressStore (+3 more)

### Community 52 - "Community 52"
Cohesion: 0.18
Nodes (12): Action Items, Conclusion: Compatible, Context, CSP Update Required, Spike: COOP same-origin + Supabase Redirect OAuth, Cross-Origin-Embedder-Policy: credentialless, Cross-Origin-Opener-Policy: same-origin, Open Food Facts API (+4 more)

### Community 53 - "Community 53"
Cohesion: 0.22
Nodes (8): DAY_LETTERS, DayCellProps, DotIndicatorProps, WeekCalendarHeader(), WeekCalendarHeaderProps, DayStatus, useWeekProgress(), getLoggedTotalsByDateRange()

### Community 54 - "Community 54"
Cohesion: 0.19
Nodes (9): UserProfileRow, NewSyncQueueRow, NewUserFavoriteFood, NewUserProfile, ProgressPhoto, syncQueue, UserProfile, usersProfile (+1 more)

### Community 55 - "Community 55"
Cohesion: 0.17
Nodes (6): NewProgressPhoto, progressEntries, progressPhotos, getByDate(), getPhotos(), ProgressPhotoView

### Community 56 - "Community 56"
Cohesion: 0.15
Nodes (13): gentle-ai skill-registry refresh, branch-pr skill, chained-pr skill, cognitive-doc-design skill, comment-writer skill, go-testing skill, graphify skill, issue-creation skill (+5 more)

### Community 57 - "Community 57"
Cohesion: 0.21
Nodes (7): FormValues, GoalEditorGoals, GoalEditorSheet(), GoalEditorSheetProps, goalEditorSchema, GoalEditorValues, initial

### Community 58 - "Community 58"
Cohesion: 0.20
Nodes (9): IngredientsBuilderRoute(), ACTIVITY_MULTIPLIERS, GOAL_MULTIPLIERS, IngredientInput, macroCalorieShares, MacroTargets, PortionMacros, sumIngredientMacros() (+1 more)

### Community 59 - "Community 59"
Cohesion: 0.17
Nodes (10): authState, mockDexieProgress, mockedImplDelete, mockedImplGetByDate, mockedImplGetRange, mockedImplUpsert, mockEnqueue, mockGetProfile (+2 more)

### Community 60 - "Community 60"
Cohesion: 0.17
Nodes (10): Architecture, Development workflow, Project structure, Quick start, Stack, Vitia — web PWA, Classify before touching code, Hard rules (+2 more)

### Community 61 - "Community 61"
Cohesion: 0.17
Nodes (11): compilerOptions, allowImportingTsExtensions, isolatedModules, lib, module, moduleDetection, moduleResolution, noEmit (+3 more)

### Community 62 - "Community 62"
Cohesion: 0.24
Nodes (8): FoodRow, Food, RecipeBuilderActions, RecipeBuilderState, RecipeIngredient, mockCreateComposite, mockNavigate, mockUpsertIngredients

### Community 63 - "Community 63"
Cohesion: 0.22
Nodes (7): RecipeDetailRoute(), useRecipeBuilderStore, mockGetById, mockGetByIds, mockGetIngredients, mockNavigate, mockUpsertIngredients

### Community 64 - "Community 64"
Cohesion: 0.38
Nodes (8): buildBars(), buildBuckets(), buildOverlayRows(), DayTotals, imputedAverage(), enumerateDays(), splitBuckets(), DayTotals

### Community 66 - "Community 66"
Cohesion: 0.20
Nodes (8): baseDayState, baseProfile, mockDeleteEntry, mockLoadByDate, mockProgressState, mockSaveEntry, mockUseDayStore, mockUseProfileStore

### Community 67 - "Community 67"
Cohesion: 0.25
Nodes (5): mockCreateComposite, mockGetById, mockNavigate, mockUpdate, mockUseParams

### Community 68 - "Community 68"
Cohesion: 0.33
Nodes (4): UseCreatedFoodsListResult, makeFood(), mockDeleteFood, mockGetCustomFoods

### Community 69 - "Community 69"
Cohesion: 0.33
Nodes (5): Contract, Loading protocol, Skill Registry — brave-kilby-8df8a8, Skills, Sources scanned

### Community 70 - "Community 70"
Cohesion: 0.47
Nodes (5): MealEntryRow, MealEntry, ClipboardMeal, MealClipboardActions, MealClipboardState

### Community 71 - "Community 71"
Cohesion: 0.47
Nodes (5): DailyTotals, emptyTotals(), MEAL_TYPES, MealTotals, sumEntries()

### Community 72 - "Community 72"
Cohesion: 0.53
Nodes (4): clampAndRound(), computeNavyBodyFat(), isPositive(), NavyInput

### Community 73 - "Community 73"
Cohesion: 0.50
Nodes (3): CalorieHistoryOverlay(), CalorieHistoryOverlayProps, OverlayRow

### Community 74 - "Community 74"
Cohesion: 0.40
Nodes (4): mockedDeleteByDate, mockedGetByDate, mockedUpsertByDate, sampleEntry

## Knowledge Gaps
- **419 isolated node(s):** `dev.sh script`, `PATH`, `MockResponse`, `config`, `RETRYABLE_STATUSES` (+414 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **14 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Food` connect `Community 62` to `OPFS Worker & DB Client`, `Community 67`, `Community 68`, `Community 36`, `Community 38`, `Day Diary Components`, `Community 40`, `TypeScript Config`, `SDD Planning & Migration Strategy`, `Community 44`, `Community 45`, `Community 50`, `Community 54`, `Community 58`, `Community 63`?**
  _High betweenness centrality (0.034) - this node is a cross-community bridge._
- **Why does `MealType` connect `Community 36` to `Dexie IndexedDB Adapter`, `OPFS Worker & DB Client`, `Community 65`, `Day Diary Components`, `Community 70`, `Community 71`, `Community 39`, `TypeScript Config`, `SDD Planning & Migration Strategy`, `Community 44`, `Community 46`, `Jest SQL Transform`, `Community 48`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **Why does `todayISO()` connect `Jest SQL Transform` to `Community 34`, `Community 35`, `Day Diary Components`, `Community 43`, `Node TS Config`, `Jest Test Config`, `Community 51`, `Community 53`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **What connects `dev.sh script`, `PATH`, `MockResponse` to the rest of the system?**
  _419 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Meal UI Components` be split into smaller, more focused modules?**
  _Cohesion score 0.08705882352941176 - nodes in this community are weakly interconnected._
- **Should `OPFS Worker & DB Client` be split into smaller, more focused modules?**
  _Cohesion score 0.09230769230769231 - nodes in this community are weakly interconnected._
- **Should `Build & Dev Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.14035087719298245 - nodes in this community are weakly interconnected._