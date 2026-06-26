# Graph Report - /Users/victor/Documents/CodeProjects/vitia-web  (2026-06-26)

## Corpus Check
- Corpus is ~27,374 words - fits in a single context window. You may not need a graph.

## Summary
- 379 nodes · 553 edges · 25 communities (20 shown, 5 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 9 edges (avg confidence: 0.86)
- Token cost: 79,449 input · 0 output

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
- [[_COMMUNITY_Tailwind Config|Tailwind Config]]
- [[_COMMUNITY_PR Chain Strategy|PR Chain Strategy]]

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 17 edges
2. `MealEntry` - 16 edges
3. `PWA Migration Design (Slice 1)` - 13 edges
4. `MealType` - 11 edges
5. `Spec: web-tracker-ui` - 11 edges
6. `compilerOptions` - 10 edges
7. `UserProfile` - 9 edges
8. `Food` - 9 edges
9. `normalizeForSearch()` - 9 edges
10. `scripts` - 9 edges

## Surprising Connections (you probably didn't know these)
- `Local-First Architecture` --semantically_similar_to--> `Brain / Skin Codebase Split`  [INFERRED] [semantically similar]
  README.md → openspec/changes/web-pwa-migration/proposal.md
- `startDexiePath()` --calls--> `createDexieAdapter()`  [EXTRACTED]
  db/client.ts → src/db/dexie-adapter.ts
- `searchByName()` --calls--> `normalizeForSearch()`  [EXTRACTED]
  db/repositories/foods.ts → lib/search.ts
- `update()` --calls--> `normalizeForSearch()`  [EXTRACTED]
  db/repositories/foods.ts → lib/search.ts
- `UserProfileRow` --inherits--> `UserProfile`  [EXTRACTED]
  src/db/dexie-adapter.ts → db/schema.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Storage Backend Selection: OPFS Probe → wa-sqlite or Dexie Fallback** — design_wasqlite_opfs, design_dexie_indexeddb_fallback, tasks_t24_client_web [EXTRACTED 0.95]
- **Transaction Integrity: Worker BEGIN/COMMIT + Dexie.transaction → R9 No Corruption** — design_db_transaction_facade, tasks_t27_dexie_adapter, web_local_storage_r9_no_corruption [EXTRACTED 0.95]
- **Offline-First Guarantee: SW Precache + dbReady Gate + local-first arch** — pwa_shell_r2_service_worker_precache, design_db_ready_gate, readme_local_first_arch [INFERRED 0.85]

## Communities (25 total, 5 thin omitted)

### Community 0 - "Meal UI Components"
Cohesion: 0.08
Nodes (31): CopyFromYesterdayBanner(), CopyFromYesterdayBannerProps, MealEntryRow(), MealEntryRowProps, MEAL_LABELS, MealSection(), MealSectionProps, db (+23 more)

### Community 1 - "Dexie IndexedDB Adapter"
Cohesion: 0.07
Nodes (36): startDexiePath(), createDexieAdapter(), DexieAdapter, FoodRow, FoodsRepo, MealEntriesRepo, MIGRATION_TAGS, MigrationRow (+28 more)

### Community 2 - "OPFS Worker & DB Client"
Cohesion: 0.08
Nodes (26): AnyCall, BackendType, buildOpfsDb(), createMutex(), ExecCall, _init, ProxyDb, runWorkerMigrations() (+18 more)

### Community 3 - "Build & Dev Dependencies"
Cohesion: 0.06
Nodes (31): devDependencies, autoprefixer, better-sqlite3, @biomejs/biome, drizzle-kit, fake-indexeddb, jest, postcss (+23 more)

### Community 4 - "Architecture & Data Flow"
Cohesion: 0.09
Nodes (29): Repository Contract Test Suite (describe.each both backends), Data Flow: Screen → Zustand → Repos → db facade, dbReady Promise Gate (main.tsx), db.transaction() Facade (Worker BEGIN/COMMIT), Dexie/IndexedDB Primary iOS Fallback, drizzle-orm/sqlite-proxy Binding, Offline Guard at UI/Store-Caller Layer, React Router v7 (createBrowserRouter) (+21 more)

### Community 5 - "Day Diary Components"
Cohesion: 0.12
Nodes (18): CalorieRing(), CalorieRingProps, DateNavigator(), DateNavigatorProps, MacroBar(), MacroBarProps, MacroChipProps, useDailyTotals() (+10 more)

### Community 6 - "Biome Config & Linting"
Cohesion: 0.08
Nodes (24): files, ignore, formatter, enabled, indentStyle, indentWidth, lineWidth, quoteStyle (+16 more)

### Community 7 - "SDD Planning & Migration Strategy"
Cohesion: 0.09
Nodes (23): Expo RN Native Stack (Origin), SDD OpenSpec Config (Vitia), Strict TDD Mode (Jest), Brain / Skin Codebase Split, Capability: web-tracker-ui, Slice 2: AI Proxy (Deferred), Slice 3: Backup/Restore (Deferred), Local-First Architecture (+15 more)

### Community 8 - "Nutrition Domain & Profile"
Cohesion: 0.16
Nodes (17): UserProfileRow, UserProfile, ACTIVITY_MULTIPLIERS, computeBMR(), computeTDEE(), deriveCalorieGoal(), deriveMacros(), GOAL_MULTIPLIERS (+9 more)

### Community 9 - "TypeScript Config"
Cohesion: 0.10
Nodes (19): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleDetection, moduleResolution (+11 more)

### Community 10 - "CI Pipeline & PWA Build"
Cohesion: 0.11
Nodes (19): Biome Lint Step, CI Pipeline (GitHub Actions), Vite PWA Build Step, COOP/COEP Headers (crossOriginIsolated), vite-plugin-pwa + Workbox, index.html PWA Entry Point, Theme Color (#22c55e), Web App Manifest Link (+11 more)

### Community 11 - "Runtime Dependencies"
Cohesion: 0.15
Nodes (13): dependencies, dexie, drizzle-orm, @hookform/resolvers, lucide-react, react, react-dom, react-hook-form (+5 more)

### Community 12 - "Node TS Config"
Cohesion: 0.17
Nodes (11): compilerOptions, allowImportingTsExtensions, isolatedModules, lib, module, moduleDetection, moduleResolution, noEmit (+3 more)

### Community 13 - "Jest Test Config"
Cohesion: 0.20
Nodes (10): jest, moduleNameMapper, setupFilesAfterEnv, testEnvironment, testMatch, transform, ^@/(.*)$, ^@/(.+\\.sql)\\?raw$ (+2 more)

## Knowledge Gaps
- **158 isolated node(s):** `$schema`, `enabled`, `enabled`, `recommended`, `noExplicitAny` (+153 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `PWA Migration Design (Slice 1)` connect `Architecture & Data Flow` to `CI Pipeline & PWA Build`, `SDD Planning & Migration Strategy`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **Why does `MealEntry` connect `Meal UI Components` to `Nutrition Domain & Profile`, `Dexie IndexedDB Adapter`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **Why does `PWA Migration Proposal (Slice 1)` connect `SDD Planning & Migration Strategy` to `CI Pipeline & PWA Build`, `Architecture & Data Flow`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **What connects `$schema`, `enabled`, `enabled` to the rest of the system?**
  _161 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Meal UI Components` be split into smaller, more focused modules?**
  _Cohesion score 0.08233117483811286 - nodes in this community are weakly interconnected._
- **Should `Dexie IndexedDB Adapter` be split into smaller, more focused modules?**
  _Cohesion score 0.07439613526570048 - nodes in this community are weakly interconnected._
- **Should `OPFS Worker & DB Client` be split into smaller, more focused modules?**
  _Cohesion score 0.08021390374331551 - nodes in this community are weakly interconnected._