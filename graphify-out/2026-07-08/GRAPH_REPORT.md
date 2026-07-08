# Graph Report - .  (2026-07-02)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 541 nodes · 905 edges · 34 communities (25 shown, 9 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 4 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `408081f0`
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

## God Nodes (most connected - your core abstractions)
1. `MealType` - 21 edges
2. `Vitia web PWA` - 19 edges
3. `isSyncEnabled()` - 17 edges
4. `compilerOptions` - 17 edges
5. `useAuthStore` - 14 edges
6. `MealEntry` - 13 edges
7. `Skill Registry (intelligent-newton-fdb402)` - 13 edges
8. `Food` - 11 edges
9. `compilerOptions` - 10 edges
10. `MealEntryView` - 10 edges

## Surprising Connections (you probably didn't know these)
- `startDexiePath()` --calls--> `createDexieAdapter()`  [EXTRACTED]
  db/client.ts → src/db/dexie-adapter.ts
- `DayState` --references--> `MealEntryView`  [EXTRACTED]
  stores/useDayStore.ts → db/repositories/mealEntries.ts
- `UserProfileRow` --inherits--> `UserProfile`  [EXTRACTED]
  src/db/dexie-adapter.ts → db/schema.ts
- `ProfileState` --references--> `UserProfile`  [EXTRACTED]
  stores/useProfileStore.ts → db/schema.ts
- `FoodRow` --inherits--> `Food`  [EXTRACTED]
  src/db/dexie-adapter.ts → db/schema.ts

## Import Cycles
- None detected.

## Communities (34 total, 9 thin omitted)

### Community 0 - "Meal UI Components"
Cohesion: 0.07
Nodes (37): AuthGuard(), AuthGuardProps, UpdateToast(), db, mealEntries, TabLayout(), getSupabaseClient(), isSyncEnabled() (+29 more)

### Community 1 - "Dexie IndexedDB Adapter"
Cohesion: 0.08
Nodes (37): CopyFromYesterdayBanner(), CopyFromYesterdayBannerProps, ChipProps, HeaderMacroRow(), HeaderMacroRowProps, MealEntryRow(), MealEntryRowProps, MEAL_LABELS (+29 more)

### Community 2 - "OPFS Worker & DB Client"
Cohesion: 0.06
Nodes (36): startDexiePath(), createDexieAdapter(), DexieAdapter, FavoritesRepo, FoodRow, FoodsRepo, MealEntriesRepo, MIGRATION_TAGS (+28 more)

### Community 3 - "Build & Dev Dependencies"
Cohesion: 0.06
Nodes (41): src/App.tsx, Biome, Cross-Origin-Embedder-Policy: credentialless, Cross-Origin-Opener-Policy: same-origin, E2E Smoke Test — User Session Persistence, Engram (local memory store), gentle-ai skill-registry refresh, src/main.tsx (+33 more)

### Community 4 - "Architecture & Data Flow"
Cohesion: 0.05
Nodes (39): dependencies, dexie, drizzle-orm, @hookform/resolvers, lucide-react, react, react-dom, react-hook-form (+31 more)

### Community 5 - "Day Diary Components"
Cohesion: 0.07
Nodes (20): CollapsibleSection(), CollapsibleSectionProps, FavoriteToggle(), FavoriteToggleProps, MacroDistributionBar(), MacroDistributionBarProps, SEGMENT_COLORS, userFavoriteFoods (+12 more)

### Community 6 - "Biome Config & Linting"
Cohesion: 0.08
Nodes (26): AnyCall, BackendType, buildOpfsDb(), createMutex(), ExecCall, _init, ProxyDb, runWorkerMigrations() (+18 more)

### Community 7 - "SDD Planning & Migration Strategy"
Cohesion: 0.13
Nodes (22): ACTIVITY_MULTIPLIERS, computeBMR(), computeTDEE(), deriveCalorieGoal(), deriveMacros(), GOAL_MULTIPLIERS, MacroCalorieShares, MacroTargets (+14 more)

### Community 8 - "Nutrition Domain & Profile"
Cohesion: 0.08
Nodes (24): files, ignore, formatter, enabled, indentStyle, indentWidth, lineWidth, quoteStyle (+16 more)

### Community 9 - "TypeScript Config"
Cohesion: 0.14
Nodes (18): FoodResultRow(), FoodResultRowProps, SearchRoute(), FoodDatabaseTab(), FoodDatabaseTabProps, PlaceholderTab(), PlaceholderTabProps, SearchTabId (+10 more)

### Community 10 - "CI Pipeline & PWA Build"
Cohesion: 0.08
Nodes (23): devDependencies, autoprefixer, better-sqlite3, @biomejs/biome, drizzle-kit, fake-indexeddb, husky, jest (+15 more)

### Community 11 - "Runtime Dependencies"
Cohesion: 0.13
Nodes (15): fetchProducts(), fetchWithTimeout(), getByBarcode(), normalizeOffProduct(), OffCgiResponse, OffNutriments, OffProduct, OffSearchResponse (+7 more)

### Community 12 - "Node TS Config"
Cohesion: 0.10
Nodes (19): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleDetection, moduleResolution (+11 more)

### Community 13 - "Jest Test Config"
Cohesion: 0.17
Nodes (11): compilerOptions, allowImportingTsExtensions, isolatedModules, lib, module, moduleDetection, moduleResolution, noEmit (+3 more)

### Community 14 - "UI Button Component"
Cohesion: 0.33
Nodes (5): CalorieCard(), CalorieCardProps, describeArc(), describeTick(), polarToCartesian()

### Community 15 - "Jest SQL Transform"
Cohesion: 0.36
Nodes (5): DateNavigator(), DateNavigatorProps, addDays(), formatDayLabel(), todayISO()

### Community 18 - "App Entry Point"
Cohesion: 0.67
Nodes (3): Biome Lint Step, CI Pipeline (GitHub Actions), Vite PWA Build Step

## Knowledge Gaps
- **204 isolated node(s):** `ExecCall`, `TxExecCall`, `TxControlCall`, `AnyCall`, `ProxyDb` (+199 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `devDependencies` connect `CI Pipeline & PWA Build` to `Architecture & Data Flow`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._
- **Why does `Vitia web PWA` connect `Build & Dev Dependencies` to `CI Pipeline & PWA Build`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **Why does `MealType` connect `Dexie IndexedDB Adapter` to `TypeScript Config`, `Day Diary Components`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **What connects `ExecCall`, `TxExecCall`, `TxControlCall` to the rest of the system?**
  _204 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Meal UI Components` be split into smaller, more focused modules?**
  _Cohesion score 0.06775956284153005 - nodes in this community are weakly interconnected._
- **Should `Dexie IndexedDB Adapter` be split into smaller, more focused modules?**
  _Cohesion score 0.0792156862745098 - nodes in this community are weakly interconnected._
- **Should `OPFS Worker & DB Client` be split into smaller, more focused modules?**
  _Cohesion score 0.06448979591836734 - nodes in this community are weakly interconnected._