# Graph Report - priceless-villani-11f37a  (2026-07-10)

## Corpus Check
- 236 files · ~106,355 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1229 nodes · 2455 edges · 86 communities (73 shown, 13 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 4 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `7c2711ca`
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
- [[_COMMUNITY_Community 79|Community 79]]
- [[_COMMUNITY_Community 80|Community 80]]
- [[_COMMUNITY_Community 81|Community 81]]
- [[_COMMUNITY_Community 82|Community 82]]
- [[_COMMUNITY_Community 83|Community 83]]
- [[_COMMUNITY_Community 84|Community 84]]
- [[_COMMUNITY_Community 85|Community 85]]

## God Nodes (most connected - your core abstractions)
1. `MealType` - 38 edges
2. `Food` - 35 edges
3. `todayISO()` - 24 edges
4. `isSyncEnabled()` - 22 edges
5. `useProfileStore` - 20 edges
6. `addDays()` - 19 edges
7. `Vitia web PWA` - 19 edges
8. `useAuthStore` - 18 edges
9. `generateId()` - 17 edges
10. `compilerOptions` - 17 edges

## Surprising Connections (you probably didn't know these)
- `FoodRow` --inherits--> `Food`  [EXTRACTED]
  src/db/dexie-adapter.ts → db/schema.ts
- `UseCreatedFoodsListResult` --references--> `Food`  [EXTRACTED]
  hooks/useCreatedFoodsList.ts → db/schema.ts
- `IngredientInput` --references--> `Food`  [EXTRACTED]
  lib/nutrition.ts → db/schema.ts
- `CreatedFoodsTabProps` --references--> `Food`  [EXTRACTED]
  src/components/search/CreatedFoodsTab.tsx → db/schema.ts
- `UseFavoriteResult` --references--> `MealType`  [EXTRACTED]
  hooks/useFavorite.ts → types/index.ts

## Import Cycles
- 4-file cycle: `db/client.ts -> src/db/dexie-adapter.ts -> types/index.ts -> db/repositories/mealEntries.ts -> db/client.ts`

## Communities (86 total, 13 thin omitted)

### Community 0 - "Meal UI Components"
Cohesion: 0.21
Nodes (9): AuthGuard(), AuthGuardProps, isSyncEnabled(), deleteByDateAndMeal(), _enqueueProfileOp(), upsertProfile(), AuthActions, AuthState (+1 more)

### Community 1 - "Dexie IndexedDB Adapter"
Cohesion: 0.19
Nodes (11): CopyFromYesterdayBanner(), CopyFromYesterdayBannerProps, MealEntryRow(), MealEntryRowProps, MEAL_LABELS, MealSection(), MealSectionProps, getByDateAndMeal() (+3 more)

### Community 2 - "OPFS Worker & DB Client"
Cohesion: 0.08
Nodes (29): DayTotals, FavoriteMealRow, FavoritesRepo, FoodIngredientRow, FoodRow, FoodsRepo, MealEntriesRepo, MIGRATION_TAGS (+21 more)

### Community 3 - "Build & Dev Dependencies"
Cohesion: 0.17
Nodes (12): src/App.tsx, Biome, typescript, Engram (local memory store), src/main.tsx, manifest.webmanifest, React 19 + React Router 7, Tailwind CSS 3 (+4 more)

### Community 4 - "Architecture & Data Flow"
Cohesion: 0.05
Nodes (39): dependencies, dexie, drizzle-orm, @hookform/resolvers, lucide-react, react, react-dom, react-hook-form (+31 more)

### Community 5 - "Day Diary Components"
Cohesion: 0.40
Nodes (3): mockGetById, mockGetIngredients, mockNavigate

### Community 6 - "Biome Config & Linting"
Cohesion: 0.11
Nodes (17): AnyCall, BackendType, buildOpfsDb(), createMutex(), ExecCall, _init, ProxyDb, TxControlCall (+9 more)

### Community 7 - "SDD Planning & Migration Strategy"
Cohesion: 0.15
Nodes (10): profileFieldsSchema, ProfileFieldsValues, ACTIVITY_LABELS, ConfigurationRoute(), fieldClass(), FormValues, MEASUREMENT_PLACEHOLDER_LABELS, SEX_LABELS (+2 more)

### Community 8 - "Nutrition Domain & Profile"
Cohesion: 0.07
Nodes (34): UpdateToast(), getDemoSeedEnv(), getHostname(), getLocationSearch(), buildDemoMealEntries(), buildDemoProgressEntries(), clearPreviouslySeededRows(), clearSeedMarker() (+26 more)

### Community 9 - "TypeScript Config"
Cohesion: 0.11
Nodes (23): FavoriteToggle(), FavoriteToggleProps, VARIANT_STYLES, FoodResultRow(), FoodResultRowProps, IngredientPickerRoute(), SearchRoute(), FoodDatabaseTab() (+15 more)

### Community 10 - "CI Pipeline & PWA Build"
Cohesion: 0.09
Nodes (22): devDependencies, autoprefixer, better-sqlite3, @biomejs/biome, drizzle-kit, fake-indexeddb, husky, jest (+14 more)

### Community 11 - "Runtime Dependencies"
Cohesion: 0.07
Nodes (39): backoffDelayMs(), buildSuccessResponse(), config, fetchAttempt(), fetchFromCgi(), fetchFromFallback(), fetchWithRetry(), handler() (+31 more)

### Community 12 - "Node TS Config"
Cohesion: 0.10
Nodes (28): MeasurementsCard(), MeasurementsCardProps, MeasurementsHistoryOverlay(), MeasurementsHistoryOverlayProps, OverlayRow, MeasurementsLineChart(), MeasurementsLineChartProps, MeasurementsDashboardVM (+20 more)

### Community 13 - "Jest Test Config"
Cohesion: 0.11
Nodes (28): BodyFatCard(), BodyFatCardProps, BodyFatHistoryOverlay(), BodyFatHistoryOverlayProps, OverlayRow, BodyFatLineChart(), BodyFatLineChartProps, BodyFatDashboardVM (+20 more)

### Community 14 - "UI Button Component"
Cohesion: 0.13
Nodes (17): ANGLE_LEFT, ANGLE_RIGHT, arcPoint(), CalorieCard(), CalorieCardProps, D, describeArc(), describeTick() (+9 more)

### Community 15 - "Jest SQL Transform"
Cohesion: 0.19
Nodes (15): DateNavigator(), DateNavigatorProps, useDailyTotals(), BUCKET_LABELS, DashboardRangeWindow, formatDayLabel(), formatFullDayLabel(), formatMonthLabel() (+7 more)

### Community 18 - "App Entry Point"
Cohesion: 0.67
Nodes (3): Biome Lint Step, CI Pipeline (GitHub Actions), Vite PWA Build Step

### Community 34 - "Community 34"
Cohesion: 0.11
Nodes (28): WeightCard(), WeightCardProps, OverlayRow, WeightHistoryOverlay(), WeightHistoryOverlayProps, WeightLineChart(), WeightLineChartProps, useWeightDashboard() (+20 more)

### Community 35 - "Community 35"
Cohesion: 0.12
Nodes (18): CalorieBarChart(), WEEKDAY_INITIALS_BY_GET_DAY, resolveWindow(), addDays(), rollingWindow(), startOfWeek(), makeDatedBars(), WEEKDAY_INITIALS_BY_GET_DAY (+10 more)

### Community 36 - "Community 36"
Cohesion: 0.14
Nodes (13): CollapsibleSection(), CollapsibleSectionProps, MealPicker(), MealPickerProps, MEAL_LABELS, MEAL_TYPES, MealTypeSelect(), MealTypeSelectProps (+5 more)

### Community 37 - "Community 37"
Cohesion: 0.08
Nodes (24): files, ignore, formatter, enabled, indentStyle, indentWidth, lineWidth, quoteStyle (+16 more)

### Community 38 - "Community 38"
Cohesion: 0.21
Nodes (7): DanglingIngredient, getById(), getByIds(), getCompositeFoodIds(), getIngredients(), NewIngredientInput, upsertIngredients()

### Community 39 - "Community 39"
Cohesion: 0.26
Nodes (13): userFavoriteFoods, generateId(), addMeal(), getMealsForFood(), isFavorite(), listFoodIds(), listWithMeals(), mealClause() (+5 more)

### Community 40 - "Community 40"
Cohesion: 0.07
Nodes (27): foodIngredients, useCreatedFoodsList(), UseCreatedFoodsListResult, useSwipeReveal(), UseSwipeRevealOptions, UseSwipeRevealResult, categoryIcon(), normalizeForSearch() (+19 more)

### Community 41 - "Community 41"
Cohesion: 0.13
Nodes (16): runWorkerMigrations(), ProgressProfileInput, hashContent(), MigrationJournal, MigrationRow, MigratorExecutor, runWebMigrations(), splitStatements() (+8 more)

### Community 42 - "Community 42"
Cohesion: 0.10
Nodes (19): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleDetection, moduleResolution (+11 more)

### Community 43 - "Community 43"
Cohesion: 0.12
Nodes (23): CalorieBarChartProps, CalorieDashboardCard(), CalorieDashboardCardProps, CAPTION_BY_RANGE, CalorieHistoryOverlay(), CalorieHistoryOverlayProps, OverlayRow, CalorieDashboardVM (+15 more)

### Community 44 - "Community 44"
Cohesion: 0.19
Nodes (9): ModeSelectRoute(), TabLayout(), CustomFoodRoute(), fieldClass(), FormValues, schema, LoginRoute(), Tab (+1 more)

### Community 45 - "Community 45"
Cohesion: 0.17
Nodes (10): PROFILE_TABS, ProfileLayout(), useProfileStore, mockUseProfileStore, items, manualProfile, mockedUpsertProfile, RouteTabItem (+2 more)

### Community 46 - "Community 46"
Cohesion: 0.31
Nodes (9): effectiveWeight(), canConvert(), ConversionDirection, ConversionResult, convertWeight(), directionFor(), hasCookingFactor(), FoodCategory (+1 more)

### Community 47 - "Community 47"
Cohesion: 0.19
Nodes (10): ProgressEntryInitial, ProgressEntrySheet(), ProgressEntrySheetProps, ProgressExistingPhoto, ProgressSavePayload, optionalCoercedNumber, progressEntrySchema, ProgressFormInput (+2 more)

### Community 48 - "Community 48"
Cohesion: 0.15
Nodes (4): foods, NewMealEntry, DayMealPlan, DayActions

### Community 49 - "Community 49"
Cohesion: 0.20
Nodes (11): E2E Smoke Test — User Session Persistence, Expected Results, Failure Modes to Watch, Prerequisites, Open Food Facts API, Supabase, Supabase redirect-based OAuth, supabase-setup.sql (+3 more)

### Community 50 - "Community 50"
Cohesion: 0.16
Nodes (13): startDexiePath(), createDexieAdapter(), DexieAdapter, NewFood, NewFoodIngredient, SearchResult, makeAdapter(), makeDexieBackend() (+5 more)

### Community 51 - "Community 51"
Cohesion: 0.10
Nodes (19): PhotoLightbox(), PhotoLightboxProps, ALL_PHOTOS_RANGE, GalleryItem, GalleryMonth, ProgressPhotoGalleryVM, useProgressPhotoGallery(), ProgressPhotosRoute() (+11 more)

### Community 52 - "Community 52"
Cohesion: 0.25
Nodes (8): Action Items, Conclusion: Compatible, Context, CSP Update Required, Spike: COOP same-origin + Supabase Redirect OAuth, Cross-Origin-Embedder-Policy: credentialless, Cross-Origin-Opener-Policy: same-origin, OPFS (Origin Private File System)

### Community 53 - "Community 53"
Cohesion: 0.21
Nodes (10): DAY_LETTERS, DayCellProps, DotIndicatorProps, WeekCalendarHeader(), WeekCalendarHeaderProps, DayStatus, useWeekProgress(), weekDays() (+2 more)

### Community 54 - "Community 54"
Cohesion: 0.15
Nodes (10): UserProfileRow, NewOffCategoryCorrection, NewSyncQueueRow, NewUserFavoriteFood, NewUserProfile, offCategoryCorrections, ProgressPhoto, UserProfile (+2 more)

### Community 55 - "Community 55"
Cohesion: 0.13
Nodes (9): NewProgressPhoto, progressEntries, progressPhotos, clampAndRound(), computeNavyBodyFat(), isPositive(), NavyInput, getByDate() (+1 more)

### Community 56 - "Community 56"
Cohesion: 0.15
Nodes (13): gentle-ai skill-registry refresh, branch-pr skill, chained-pr skill, cognitive-doc-design skill, comment-writer skill, go-testing skill, graphify skill, issue-creation skill (+5 more)

### Community 57 - "Community 57"
Cohesion: 0.21
Nodes (7): FormValues, GoalEditorGoals, GoalEditorSheet(), GoalEditorSheetProps, goalEditorSchema, GoalEditorValues, initial

### Community 58 - "Community 58"
Cohesion: 0.16
Nodes (10): MacroDistributionBar(), MacroDistributionBarProps, SEGMENT_COLORS, ACTIVITY_MULTIPLIERS, GOAL_MULTIPLIERS, IngredientInput, macroCalorieShares, MacroTargets (+2 more)

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
Cohesion: 0.21
Nodes (11): IngredientsBuilderRoute(), RecipeDetailRoute(), scalePortion(), sumIngredientMacros(), useRecipeBuilderStore, makeConvertibleFood(), makeFood(), mockCreateComposite (+3 more)

### Community 63 - "Community 63"
Cohesion: 0.25
Nodes (5): mockGetById, mockGetByIds, mockGetIngredients, mockNavigate, mockUpsertIngredients

### Community 64 - "Community 64"
Cohesion: 0.25
Nodes (12): db, mealEntries, syncQueue, getSupabaseClient(), drain(), remove(), _cleanupFns, flush() (+4 more)

### Community 65 - "Community 65"
Cohesion: 0.13
Nodes (7): useFavorite(), UseFavoriteResult, FavoriteMealRow, useAuthStore, mockGetMealsForFood, mockRemoveAllMeals, mockSetMeals

### Community 66 - "Community 66"
Cohesion: 0.20
Nodes (8): baseDayState, baseProfile, mockDeleteEntry, mockLoadByDate, mockProgressState, mockSaveEntry, mockUseDayStore, mockUseProfileStore

### Community 67 - "Community 67"
Cohesion: 0.12
Nodes (13): fieldClass(), FormValues, ManualFormRoute(), schema, createComposite(), update(), incrementOffCategoryCorrection(), mockCreateComposite (+5 more)

### Community 68 - "Community 68"
Cohesion: 0.27
Nodes (8): Food, FavoriteListItem, FavoriteSection, useFavoritesList(), UseFavoritesListResult, FavoritesTab(), FavoritesTabProps, mockUseFavoritesList

### Community 69 - "Community 69"
Cohesion: 0.28
Nodes (7): computeBMR(), computeTDEE(), deriveCalorieGoal(), deriveMacros(), computePreview(), buildDemoProfileUpsert(), computePreview()

### Community 70 - "Community 70"
Cohesion: 0.26
Nodes (11): MealEntryRow, MealEntry, DailyTotals, emptyTotals(), MEAL_TYPES, MealTotals, sumEntries(), ClipboardMeal (+3 more)

### Community 71 - "Community 71"
Cohesion: 0.24
Nodes (9): _enqueueMealOp(), insert(), insertBulk(), remove(), update(), DayTotals, DayStatus, deriveStatus() (+1 more)

### Community 72 - "Community 72"
Cohesion: 0.27
Nodes (10): fieldClass(), FormValues, OnboardingRoute(), schema, ManualGoals, ProfileActions, ProfileInput, ActivityLevel (+2 more)

### Community 73 - "Community 73"
Cohesion: 0.25
Nodes (5): GOAL_LABELS, GOAL_PRESETS, PlanRoute(), baseProfile, mockUseProfileStore

### Community 74 - "Community 74"
Cohesion: 0.33
Nodes (5): deleteByDate(), _enqueueProgressDelete(), _enqueueProgressOp(), upsertByDate(), enqueue()

### Community 79 - "Community 79"
Cohesion: 0.25
Nodes (6): mockAddIngredient, mockClear, mockGetCompositeFoodIds, mockNavigate, mockResults, mockSearch

### Community 80 - "Community 80"
Cohesion: 0.38
Nodes (4): CookingBasis, RecipeBuilderActions, RecipeBuilderState, RecipeIngredient

### Community 81 - "Community 81"
Cohesion: 0.29
Nodes (5): mockAddEntry, mockGetById, mockGetIngredients, mockNavigate, mockUpdateEntry

### Community 82 - "Community 82"
Cohesion: 0.33
Nodes (6): 1. Sign in on Device A, 2. Add a meal entry on Device A, 3. Verify in Supabase dashboard (optional), 4. Sign in on Device B, 5. Sign out, Test Steps

### Community 83 - "Community 83"
Cohesion: 0.33
Nodes (6): Mechanical fix, review-loop SKILL.md, sdd-verify (automated verify), Spec-driven development cycle, review-loop skill, Spec gap

### Community 84 - "Community 84"
Cohesion: 0.33
Nodes (5): mockGetRange, monthWindow, threeMonthWindow, today, weekStart

### Community 85 - "Community 85"
Cohesion: 0.40
Nodes (4): mockLoadByDate, mockNavigate, mockProgressState, mockSetRange

## Knowledge Gaps
- **429 isolated node(s):** `dev.sh script`, `PATH`, `MockResponse`, `config`, `RETRYABLE_STATUSES` (+424 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **13 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `MealType` connect `Community 70` to `Community 65`, `OPFS Worker & DB Client`, `Dexie IndexedDB Adapter`, `Community 36`, `Community 68`, `Community 39`, `TypeScript Config`, `Community 48`, `Community 53`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._
- **Why does `Food` connect `Community 68` to `OPFS Worker & DB Client`, `Community 67`, `Community 36`, `Day Diary Components`, `Community 38`, `Community 40`, `TypeScript Config`, `Community 79`, `Community 80`, `Community 81`, `Community 50`, `Community 54`, `Community 58`, `Community 62`, `Community 63`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **Why does `todayISO()` connect `Jest SQL Transform` to `Community 34`, `Community 35`, `Community 36`, `Community 43`, `Node TS Config`, `Jest Test Config`, `Community 84`, `Community 53`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **What connects `dev.sh script`, `PATH`, `MockResponse` to the rest of the system?**
  _429 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `OPFS Worker & DB Client` be split into smaller, more focused modules?**
  _Cohesion score 0.07741935483870968 - nodes in this community are weakly interconnected._
- **Should `Architecture & Data Flow` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._
- **Should `Biome Config & Linting` be split into smaller, more focused modules?**
  _Cohesion score 0.10822510822510822 - nodes in this community are weakly interconnected._