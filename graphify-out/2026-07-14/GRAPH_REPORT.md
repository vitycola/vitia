# Graph Report - loving-banzai-bdfc59  (2026-07-14)

## Corpus Check
- 273 files · ~119,181 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1407 nodes · 2795 edges · 99 communities (84 shown, 15 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 4 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `3004d62c`
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
- [[_COMMUNITY_Community 86|Community 86]]
- [[_COMMUNITY_Community 87|Community 87]]
- [[_COMMUNITY_Community 88|Community 88]]
- [[_COMMUNITY_Community 89|Community 89]]
- [[_COMMUNITY_Community 90|Community 90]]
- [[_COMMUNITY_Community 91|Community 91]]
- [[_COMMUNITY_Community 92|Community 92]]
- [[_COMMUNITY_Community 93|Community 93]]
- [[_COMMUNITY_Community 94|Community 94]]
- [[_COMMUNITY_Community 95|Community 95]]
- [[_COMMUNITY_Community 96|Community 96]]
- [[_COMMUNITY_Community 97|Community 97]]
- [[_COMMUNITY_Community 98|Community 98]]

## God Nodes (most connected - your core abstractions)
1. `MealType` - 41 edges
2. `Food` - 35 edges
3. `todayISO()` - 25 edges
4. `isSyncEnabled()` - 22 edges
5. `useProfileStore` - 20 edges
6. `useAiAddFlowStore` - 19 edges
7. `addDays()` - 19 edges
8. `Vitia web PWA` - 19 edges
9. `generateId()` - 18 edges
10. `useAuthStore` - 18 edges

## Surprising Connections (you probably didn't know these)
- `UseCreatedFoodsListResult` --references--> `Food`  [EXTRACTED]
  hooks/useCreatedFoodsList.ts → db/schema.ts
- `IngredientInput` --references--> `Food`  [EXTRACTED]
  lib/nutrition.ts → db/schema.ts
- `CreatedFoodsTabProps` --references--> `Food`  [EXTRACTED]
  src/components/search/CreatedFoodsTab.tsx → db/schema.ts
- `DayMealPlan` --references--> `NewMealEntry`  [EXTRACTED]
  src/seed/seedDemoProfile.ts → db/schema.ts
- `UseFavoriteResult` --references--> `MealType`  [EXTRACTED]
  hooks/useFavorite.ts → types/index.ts

## Import Cycles
- 4-file cycle: `db/client.ts -> src/db/dexie-adapter.ts -> types/index.ts -> db/repositories/mealEntries.ts -> db/client.ts`

## Communities (99 total, 15 thin omitted)

### Community 0 - "Meal UI Components"
Cohesion: 0.31
Nodes (7): GenericFoodRow, normalizeGenericRow(), search(), getSupabasePublicClient(), mockedGetClient, mockedUpsertMany, sampleRow

### Community 1 - "Dexie IndexedDB Adapter"
Cohesion: 0.16
Nodes (18): CopyFromYesterdayBanner(), CopyFromYesterdayBannerProps, MealEntryRow(), MealEntryRowProps, MEAL_LABELS, MealSection(), MealSectionProps, MealEntryRow (+10 more)

### Community 2 - "OPFS Worker & DB Client"
Cohesion: 0.08
Nodes (27): DayTotals, FavoritesRepo, FoodIngredientRow, FoodsRepo, MealEntriesRepo, MIGRATION_TAGS, MigrationRow, NewIngredientInput (+19 more)

### Community 3 - "Build & Dev Dependencies"
Cohesion: 0.14
Nodes (16): src/App.tsx, Biome, Engram (local memory store), src/main.tsx, manifest.webmanifest, Mechanical fix, React 19 + React Router 7, review-loop SKILL.md (+8 more)

### Community 4 - "Architecture & Data Flow"
Cohesion: 0.09
Nodes (32): BedcaComponent, BedcaFood, BedcaFoodSummary, BedcaGroup, CACHE_DIR, getFood(), getFoodGroups(), getFoodsInGroup() (+24 more)

### Community 5 - "Day Diary Components"
Cohesion: 0.05
Nodes (40): dependencies, dexie, drizzle-orm, @hookform/resolvers, lucide-react, react, react-dom, react-hook-form (+32 more)

### Community 6 - "Biome Config & Linting"
Cohesion: 0.06
Nodes (39): AnyCall, BackendType, buildOpfsDb(), createMutex(), ExecCall, _init, ProxyDb, runWorkerMigrations() (+31 more)

### Community 7 - "SDD Planning & Migration Strategy"
Cohesion: 0.15
Nodes (10): profileFieldsSchema, ProfileFieldsValues, ACTIVITY_LABELS, ConfigurationRoute(), fieldClass(), FormValues, MEASUREMENT_PLACEHOLDER_LABELS, SEX_LABELS (+2 more)

### Community 8 - "Nutrition Domain & Profile"
Cohesion: 0.08
Nodes (32): getDemoSeedEnv(), getHostname(), getLocationSearch(), buildDemoMealEntries(), buildDemoProgressEntries(), clearPreviouslySeededRows(), clearSeedMarker(), DAY_PLANS (+24 more)

### Community 9 - "TypeScript Config"
Cohesion: 0.13
Nodes (19): FoodResultRowProps, IngredientPickerRoute(), getCompositeFoodIds(), SearchRoute(), FoodDatabaseTab(), FoodDatabaseTabProps, PlaceholderTab(), PlaceholderTabProps (+11 more)

### Community 10 - "CI Pipeline & PWA Build"
Cohesion: 0.08
Nodes (25): devDependencies, autoprefixer, better-sqlite3, @biomejs/biome, drizzle-kit, fake-indexeddb, fast-xml-parser, husky (+17 more)

### Community 11 - "Runtime Dependencies"
Cohesion: 0.17
Nodes (20): backoffDelayMs(), buildSuccessResponse(), config, fetchAttempt(), fetchFromCgi(), fetchFromFallback(), fetchWithRetry(), handler() (+12 more)

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
Cohesion: 0.14
Nodes (14): AiAddFlow(), AiAddFlowProps, ConfirmationScreen(), InputScreen(), ResultsScreen(), SelectionScreen(), useAiAddFlowStore, mockBack (+6 more)

### Community 18 - "App Entry Point"
Cohesion: 0.67
Nodes (3): Biome Lint Step, CI Pipeline (GitHub Actions), Vite PWA Build Step

### Community 34 - "Community 34"
Cohesion: 0.11
Nodes (28): WeightCard(), WeightCardProps, OverlayRow, WeightHistoryOverlay(), WeightHistoryOverlayProps, WeightLineChart(), WeightLineChartProps, useWeightDashboard() (+20 more)

### Community 35 - "Community 35"
Cohesion: 0.13
Nodes (19): addDays(), BUCKET_LABELS, DashboardRangeWindow, formatMonthLabel(), MONTHS_ES_FULL, relativeBucketLabel(), resolveDashboardWindow(), rollingWindow() (+11 more)

### Community 36 - "Community 36"
Cohesion: 0.13
Nodes (19): MealPicker(), MealPickerProps, MEAL_LABELS, MEAL_TYPES, MealTypeSelect(), MealTypeSelectProps, FavoriteMealRow, FavoriteListItem (+11 more)

### Community 37 - "Community 37"
Cohesion: 0.08
Nodes (24): files, ignore, formatter, enabled, indentStyle, indentWidth, lineWidth, quoteStyle (+16 more)

### Community 38 - "Community 38"
Cohesion: 0.21
Nodes (7): DanglingIngredient, createComposite(), getById(), getByIds(), getIngredients(), NewIngredientInput, upsertIngredients()

### Community 39 - "Community 39"
Cohesion: 0.11
Nodes (18): userFavoriteFoods, generateId(), addMeal(), FavoriteMealRow, getMealsForFood(), isFavorite(), listFoodIds(), listWithMeals() (+10 more)

### Community 40 - "Community 40"
Cohesion: 0.07
Nodes (27): foodIngredients, useCreatedFoodsList(), UseCreatedFoodsListResult, useSwipeReveal(), UseSwipeRevealOptions, UseSwipeRevealResult, categoryIcon(), normalizeForSearch() (+19 more)

### Community 41 - "Community 41"
Cohesion: 0.19
Nodes (15): AuthGuard(), AuthGuardProps, db, getSupabaseClient(), isSyncEnabled(), _enqueueProfileOp(), upsertProfile(), drain() (+7 more)

### Community 42 - "Community 42"
Cohesion: 0.10
Nodes (19): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleDetection, moduleResolution (+11 more)

### Community 43 - "Community 43"
Cohesion: 0.15
Nodes (14): CalorieBarChartProps, CalorieDashboardCard(), CalorieDashboardCardProps, CAPTION_BY_RANGE, CalorieHistoryOverlay(), CalorieHistoryOverlayProps, OverlayRow, CalorieDashboardVM (+6 more)

### Community 44 - "Community 44"
Cohesion: 0.21
Nodes (9): UpdateToast(), LoginRoute(), Tab, rootEl, router, AuthActions, AuthState, AuthStatus (+1 more)

### Community 45 - "Community 45"
Cohesion: 0.21
Nodes (7): PROFILE_TABS, ProfileLayout(), mockUseProfileStore, items, RouteTabItem, RouteTabs(), RouteTabsProps

### Community 46 - "Community 46"
Cohesion: 0.31
Nodes (9): effectiveWeight(), canConvert(), ConversionDirection, ConversionResult, convertWeight(), directionFor(), hasCookingFactor(), FoodCategory (+1 more)

### Community 47 - "Community 47"
Cohesion: 0.19
Nodes (10): ProgressEntryInitial, ProgressEntrySheet(), ProgressEntrySheetProps, ProgressExistingPhoto, ProgressSavePayload, optionalCoercedNumber, progressEntrySchema, ProgressFormInput (+2 more)

### Community 48 - "Community 48"
Cohesion: 0.12
Nodes (12): FormValues, GoalEditorGoals, GoalEditorSheet(), GoalEditorSheetProps, goalEditorSchema, GoalEditorValues, GOAL_LABELS, GOAL_PRESETS (+4 more)

### Community 49 - "Community 49"
Cohesion: 0.20
Nodes (11): E2E Smoke Test — User Session Persistence, Expected Results, Failure Modes to Watch, Prerequisites, Open Food Facts API, Supabase, Supabase redirect-based OAuth, supabase-setup.sql (+3 more)

### Community 50 - "Community 50"
Cohesion: 0.15
Nodes (11): DexieAdapter, UserProfileRow, NewFoodIngredient, NewUserProfile, UserProfile, usersProfile, ProfileState, makeEntry() (+3 more)

### Community 51 - "Community 51"
Cohesion: 0.29
Nodes (6): PhotoLightbox(), PhotoLightboxProps, GalleryItem, GalleryMonth, ProgressPhotoGalleryVM, ProgressPhotoView

### Community 52 - "Community 52"
Cohesion: 0.25
Nodes (8): Action Items, Conclusion: Compatible, Context, CSP Update Required, Spike: COOP same-origin + Supabase Redirect OAuth, Cross-Origin-Embedder-Policy: credentialless, Cross-Origin-Opener-Policy: same-origin, OPFS (Origin Private File System)

### Community 53 - "Community 53"
Cohesion: 0.18
Nodes (14): DAY_LETTERS, DayCellProps, DotIndicatorProps, WeekCalendarHeader(), WeekCalendarHeaderProps, resolveWindow(), useDailyTotals(), DayStatus (+6 more)

### Community 54 - "Community 54"
Cohesion: 0.11
Nodes (8): foods, mealEntries, NewOffCategoryCorrection, NewSyncQueueRow, NewUserFavoriteFood, offCategoryCorrections, ProgressPhoto, syncQueue

### Community 55 - "Community 55"
Cohesion: 0.17
Nodes (5): NewProgressPhoto, progressEntries, progressPhotos, getByDate(), getPhotos()

### Community 56 - "Community 56"
Cohesion: 0.15
Nodes (13): gentle-ai skill-registry refresh, branch-pr skill, chained-pr skill, cognitive-doc-design skill, comment-writer skill, go-testing skill, graphify skill, issue-creation skill (+5 more)

### Community 57 - "Community 57"
Cohesion: 0.47
Nodes (5): ProgressEntryWithPhotos, ProgressInput, DashboardRange, ProgressActions, ProgressState

### Community 58 - "Community 58"
Cohesion: 0.15
Nodes (9): analyzePhoto(), getBaseUrl(), parseText(), request(), VALID_CONFIDENCE, NORMALIZED, RAW_FOOD, ConfigurationError (+1 more)

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
Cohesion: 0.20
Nodes (9): Generic Foods Supabase Setup Checklist, Rollback, Step 1 — Apply the DDL, Step 2 — Verify RLS is active, Step 3 — Verify anon SELECT works, Step 4 — Generate seed data, Step 5 — Apply seed data, Step 6 — Verify category coverage (+1 more)

### Community 63 - "Community 63"
Cohesion: 0.18
Nodes (13): mapToNewMealEntry(), MEAL_OPTIONS, scaleAiMacros(), ScaledMacros, AiAddFlowActions, AiAddFlowState, INITIAL_STATE, InputMode (+5 more)

### Community 64 - "Community 64"
Cohesion: 0.32
Nodes (7): ConfidenceBadge(), ConfidenceBadgeProps, CONFIDENCE_MAP, ConfidenceMeta, getConfidenceMeta(), AiConfidence, ConfidenceLabel

### Community 65 - "Community 65"
Cohesion: 0.18
Nodes (10): FavoriteToggle(), FavoriteToggleProps, VARIANT_STYLES, FoodResultRow(), useFavorite(), UseFavoriteResult, mockUseFavorite, mockGetMealsForFood (+2 more)

### Community 66 - "Community 66"
Cohesion: 0.24
Nodes (4): CalorieBarChart(), WEEKDAY_INITIALS_BY_GET_DAY, startOfWeek(), WEEKDAY_INITIALS_BY_GET_DAY

### Community 67 - "Community 67"
Cohesion: 0.13
Nodes (12): fieldClass(), FormValues, ManualFormRoute(), schema, update(), incrementOffCategoryCorrection(), mockCreateComposite, mockGetById (+4 more)

### Community 68 - "Community 68"
Cohesion: 0.28
Nodes (4): ALL_PHOTOS_RANGE, useProgressPhotoGallery(), ProgressPhotosRoute(), mockGetPhotosInRange

### Community 70 - "Community 70"
Cohesion: 0.18
Nodes (9): HIGH_ITEM, LOW_ITEM, mockAddEntry, mockCheckedMacroTotals, mockPerItemScaledMacros, mockReset, mockSetMeal, mockSetQuantity (+1 more)

### Community 71 - "Community 71"
Cohesion: 0.38
Nodes (8): buildBars(), buildBuckets(), buildOverlayRows(), DayTotals, imputedAverage(), enumerateDays(), splitBuckets(), DayTotals

### Community 72 - "Community 72"
Cohesion: 0.17
Nodes (17): computeBMR(), computeTDEE(), deriveCalorieGoal(), deriveMacros(), computePreview(), fieldClass(), FormValues, OnboardingRoute() (+9 more)

### Community 73 - "Community 73"
Cohesion: 0.38
Nodes (5): basisFromOffTags(), OFF_BASIS_RULES, categoryFromOffTags(), OFF_CATEGORY_RULES, resolveCategoryAndBasis()

### Community 74 - "Community 74"
Cohesion: 0.14
Nodes (15): deleteByDateAndMeal(), _enqueueMealOp(), insert(), insertBulk(), remove(), update(), deleteByDate(), _enqueueProgressDelete() (+7 more)

### Community 76 - "Community 76"
Cohesion: 0.20
Nodes (8): baseDayState, baseProfile, mockDeleteEntry, mockLoadByDate, mockProgressState, mockSaveEntry, mockUseDayStore, mockUseProfileStore

### Community 79 - "Community 79"
Cohesion: 0.25
Nodes (6): mockAddIngredient, mockClear, mockGetCompositeFoodIds, mockNavigate, mockResults, mockSearch

### Community 80 - "Community 80"
Cohesion: 0.11
Nodes (20): IngredientsBuilderRoute(), RecipeDetailRoute(), FoodRow, Food, CookingBasis, sumIngredientMacros(), RecipeBuilderActions, RecipeBuilderState (+12 more)

### Community 81 - "Community 81"
Cohesion: 0.09
Nodes (17): CollapsibleSection(), CollapsibleSectionProps, MacroDistributionBar(), MacroDistributionBarProps, SEGMENT_COLORS, ACTIVITY_MULTIPLIERS, GOAL_MULTIPLIERS, IngredientInput (+9 more)

### Community 82 - "Community 82"
Cohesion: 0.33
Nodes (6): 1. Sign in on Device A, 2. Add a meal entry on Device A, 3. Verify in Supabase dashboard (optional), 4. Sign in on Device B, 5. Sign out, Test Steps

### Community 83 - "Community 83"
Cohesion: 0.20
Nodes (8): genericFood1, genericFood2, genericFood3, localFood, mockedGenericSearch, mockedOffSearch, mockedSearchByName, offFood

### Community 84 - "Community 84"
Cohesion: 0.42
Nodes (8): NewFood, fetchWithTimeout(), getByBarcode(), normalizeOffProduct(), search(), SearchResult, upsert(), upsertMany()

### Community 85 - "Community 85"
Cohesion: 0.20
Nodes (10): formatFullDayLabel(), ProgressRoute(), RANGE_OPTIONS, useProgressStore, mockLoadByDate, mockNavigate, mockProgressState, mockSetRange (+2 more)

### Community 86 - "Community 86"
Cohesion: 0.22
Nodes (6): HIGH_ITEM, LOW_ITEM, MEDIUM_ITEM, mockAnalyzePhoto, mockParseText, AiServiceError

### Community 87 - "Community 87"
Cohesion: 0.43
Nodes (3): ModeSelectRoute(), TabLayout(), mockNavigate

### Community 88 - "Community 88"
Cohesion: 0.29
Nodes (5): mockAddEntry, mockGetById, mockGetIngredients, mockNavigate, mockUpdateEntry

### Community 89 - "Community 89"
Cohesion: 0.47
Nodes (5): DailyTotals, emptyTotals(), MEAL_TYPES, MealTotals, sumEntries()

### Community 90 - "Community 90"
Cohesion: 0.53
Nodes (4): clampAndRound(), computeNavyBodyFat(), isPositive(), NavyInput

### Community 91 - "Community 91"
Cohesion: 0.33
Nodes (5): OffProxyErrorResponse, OffProxyNutriments, OffProxyResponse, OffProxySource, OffProxySuccessResponse

### Community 92 - "Community 92"
Cohesion: 0.33
Nodes (5): mockGetRange, monthWindow, threeMonthWindow, today, weekWindow

### Community 93 - "Community 93"
Cohesion: 0.70
Nodes (4): DateNavigator(), DateNavigatorProps, formatDayLabel(), todayISO()

### Community 94 - "Community 94"
Cohesion: 0.40
Nodes (4): FOOD_ITEM, mockAddEntry, mockAnalyzePhoto, mockNavigate

### Community 95 - "Community 95"
Cohesion: 0.40
Nodes (4): FOOD_ITEM, mockAddEntry, mockNavigate, mockParseText

### Community 96 - "Community 96"
Cohesion: 0.40
Nodes (4): mockedDeleteByDate, mockedGetByDate, mockedUpsertByDate, sampleEntry

## Knowledge Gaps
- **503 isolated node(s):** `baseItem`, `CONFIDENCE_MAP`, `ScaledMacros`, `RAW_FOOD`, `NORMALIZED` (+498 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **15 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `MealType` connect `Community 36` to `Community 65`, `Dexie IndexedDB Adapter`, `OPFS Worker & DB Client`, `Community 39`, `TypeScript Config`, `Jest SQL Transform`, `Community 81`, `Community 53`, `Community 89`, `Community 63`?**
  _High betweenness centrality (0.055) - this node is a cross-community bridge._
- **Why does `todayISO()` connect `Community 93` to `Dexie IndexedDB Adapter`, `Community 66`, `Community 34`, `Community 35`, `Community 43`, `Node TS Config`, `Jest Test Config`, `Community 81`, `Community 53`, `Community 85`, `Community 92`, `Community 63`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._
- **Why does `generateId()` connect `Community 39` to `Dexie IndexedDB Adapter`, `Community 67`, `Community 40`, `Nutrition Domain & Profile`, `Community 41`, `Community 74`, `Community 46`, `Community 81`, `Community 55`, `Community 63`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **What connects `baseItem`, `CONFIDENCE_MAP`, `ScaledMacros` to the rest of the system?**
  _503 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `OPFS Worker & DB Client` be split into smaller, more focused modules?**
  _Cohesion score 0.08374384236453201 - nodes in this community are weakly interconnected._
- **Should `Build & Dev Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.14035087719298245 - nodes in this community are weakly interconnected._
- **Should `Architecture & Data Flow` be split into smaller, more focused modules?**
  _Cohesion score 0.08826945412311266 - nodes in this community are weakly interconnected._