# Tasks: Vitia PWA Migration — Slice 1

> Zero backend. Zero Anthropic key. Zero cloud calls.
> Reused unchanged: `lib/`, `stores/`, `db/schema.ts`, `db/repositories/`, `types/`.
> Modified (only these two): `db/client.ts`, `lib/id.ts`.

---

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~2 100 – 2 600 (new project scaffold + storage layer + 8 screens + 9 components + PWA shell + deploy config) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → scaffold + storage layer · PR 2 → screens/components · PR 3 → PWA shell + deploy |
| Delivery strategy | ask-on-risk |
| Chain strategy | stacked-to-main |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Est. lines | Notes |
|------|------|-----------|------------|-------|
| 1 | Vite scaffold + tsconfig.app.json + Tailwind + Biome | PR 1 | ~200 | Base for all subsequent units; empty app boots |
| 2 | `lib/id.ts` swap + Worker + storage layer (OPFS + Dexie) + migrator + contract tests | PR 1 | ~700 | Storage validated by shared test suite before UI; PR 1 base = main |
| 3 | 9 components (HTML/Tailwind/lucide-react) + component tests | PR 2 | ~500 | PR 2 base = PR 1 |
| 4 | 8 screens (routes + router + offline guard + onboarding gate) + screen tests | PR 2 | ~600 | Same PR 2 batch; screens depend on components |
| 5 | PWA shell (manifest + vite-plugin-pwa + SW update toast) | PR 3 | ~150 | PR 3 base = PR 2 |
| 6 | Build/deploy config (COOP/COEP headers + SPA fallback, all 3 hosts) | PR 3 | ~100 | Finalizes offline + deep-link (R7) |

---

## Phase 1 — Vite + TypeScript + Tooling Scaffold

> **Creates**: `index.html`, `vite.config.ts`, `tsconfig.app.json`, `src/main.tsx`, `src/router.tsx`, `tailwind.config.ts`, `postcss.config.ts`, `biome.json`.
> All files are NEW. No existing files modified in this phase.

- [x] 1.1 **CREATE** `tsconfig.app.json` — `"jsx": "react-jsx"`, `lib: ["DOM","WebWorker"]`, `paths: { "@/*": ["./*"] }`, no expo base, no nativewind types. **DO NOT** touch the root `tsconfig.json` (kept for native branch). Satisfies pwa-shell R1, web-tracker-ui R11.

- [x] 1.2 **CREATE** `vite.config.ts` — `@vitejs/plugin-react`, `vite-tsconfig-paths` pointed at `tsconfig.app.json` (`projects: ['tsconfig.app.json']`), `vite-plugin-pwa` stub (placeholder; configured fully in Phase 5). Satisfies pwa-shell R1.

- [x] 1.3 **CREATE** `index.html` — Vite entry point; mounts `<div id="root">`; links `manifest.webmanifest`; no backend URLs. Satisfies pwa-shell R1, R8.

- [x] 1.4 **CREATE** `tailwind.config.ts` + `postcss.config.ts` with content globs covering `src/**` and reused `components/`, `app/`. Satisfies web-tracker-ui R11.

- [x] 1.5 **CREATE** `src/main.tsx` — placeholder render (`<p>Loading…</p>`); confirms Vite + React + `@/` alias wiring is functional (`npm run build` produces a valid artifact). Satisfies pwa-shell R1.

- [x] 1.6 **Install** packages (devDependencies + dependencies): `vite`, `@vitejs/plugin-react`, `vite-tsconfig-paths`, `vite-plugin-pwa`, `workbox-window`, `react-router-dom`, `lucide-react`, `tailwindcss`, `postcss`, `autoprefixer`, `react-dom`. Retain: `drizzle-orm`, `zustand`, `react-hook-form`, `zod`, `biome`. NOTE: `wa-sqlite` and `dexie` deferred to WU2 (storage layer batch). Satisfies pwa-shell R1.

---

## Phase 2 — Local Storage Layer

> **Creates**: `src/db/worker.ts`, `src/db/migrate.web.ts`, `src/db/__tests__/repository-contract.test.ts`, `src/db/__tests__/migrator.test.ts`, `src/db/__tests__/offline-guard.test.ts`.
> **Modifies**: `db/client.ts` (ONLY allowed file from existing tree besides `lib/id.ts`), `lib/id.ts`.

### 2a — `lib/id.ts` swap

- [x] 2.1 **MODIFY** `lib/id.ts` — replace `expo-crypto` import with `crypto.randomUUID()`; keep `generateId(): string` signature unchanged. Add Jest polyfill `global.crypto = { randomUUID: () => require('node:crypto').randomUUID() }` in Jest config. Satisfies web-local-storage R7, Scenario 2.5. **DONE** commit 86d5599

- [x] 2.2 **TEST** `src/db/__tests__/id.test.ts` — UUID v4 shape + uniqueness (4 tests). Satisfies Scenario 2.5. **DONE** (created in WU1 prep)

### 2b — Worker + OPFS executor

- [x] 2.3 **CREATE** `src/db/worker.ts` — Dedicated Worker owning the wa-sqlite connection. Implements DbRequest/DbResponse message protocol: exec/begin/commit/rollback/tx-exec kinds, id-correlated responses, OPFSCoopSyncVFS registration. Satisfies web-local-storage R1, R4. **DONE** commit 3a5ae07

- [x] 2.4 **CREATE** `src/db/client.web.ts` (aliased as @/db/client in Vite build) — drizzle sqlite-proxy facade; OPFS probe with OPFS_PROBE_TIMEOUT_MS=3000 (W4); Worker teardown on probe failure (W4); transaction() facade with BEGIN/COMMIT/ROLLBACK; dbReady promise; Dexie fallback path with dexieAdapter export. vite.config.ts alias added. Satisfies web-local-storage R1, R3, R4, R9. **DONE** commit 3a5ae07

- [x] 2.5 **CREATE** `src/db/migrate.web.ts` — from-scratch web migrator. Imports `_journal.json` and `0000_*.sql?raw` via Vite `?raw`. Creates `__drizzle_migrations` if absent. Splits on `--> statement-breakpoint`, executes in BEGIN/COMMIT, records tracking row. Idempotent on re-run; drift detection. Satisfies web-local-storage R2, Scenario 2.4. **DONE** commit af43fe8

- [x] 2.6 **TEST** `src/db/__tests__/migrator.test.ts` — 7 tests: tracking table, 3 app tables, tag recording, idempotence, statement count, drift detection, data preservation. All pass. **DONE** commit af43fe8

### 2c — Dexie adapter

- [x] 2.7 **CREATE** `src/db/dexie-adapter.ts` — Dexie v4 adapter. All repo contracts (foods/profile/mealEntries). Compound index [date+mealType]. insertBulk/deleteByDateAndMeal use dexie.transaction('rw') for atomicity (W2). __drizzle_migrations idempotent tag recording (W2/S1, Scenario 2.4). Satisfies web-local-storage R5, Scenarios 2.2, 2.4. **DONE** commit 3a5ae07

- [x] 2.8 **CREATE** `src/db/client.web.ts` — OPFS probe with OPFS_PROBE_TIMEOUT_MS=3000 constant; Worker teardown on fallback (W4); factory selects OPFS or Dexie path. Satisfies web-local-storage R4, R5, Scenarios 2.1, 2.2. **DONE** commit 3a5ae07

### 2d — Shared repository-contract test suite

- [x] 2.9 **CREATE** `src/db/__tests__/repository-contract.test.ts` — describe.each over both backends (SQLite-proxy + Dexie). 46 tests total. Covers all repo functions, S2 INSERT...RETURNING, W2 insertBulk rollback atomicity, Dexie migration idempotence. Both backends pass identical assertions. Satisfies web-local-storage R6, Scenarios 2.1–2.8. **DONE** commit 3a5ae07

- [ ] 2.10 **TEST** `src/db/__tests__/offline-guard.test.ts` — unit test: when `navigator.onLine = false`, the guard function short-circuits and `openFoodFacts.search` is **not called** (jest mock asserts zero calls). When `navigator.onLine = true`, `openFoodFacts.search` IS called. Guard lives in the search route (verified in Phase 3). Satisfies web-local-storage R8, Scenario 2.6. **DEFERRED** to WU3 (guard implementation lives in SearchRoute).

---

## Phase 3 — Screen / Component Rewrite (RN → HTML/Tailwind)

> **Creates**: all files under `src/components/` and `src/routes/`.
> No existing `components/` or `app/` files modified — new web equivalents created in `src/`.
> Reuses stores/lib via `@/` alias, unchanged.

### 3a — Shared UI primitives

- [ ] 3.1 **CREATE** `src/components/ui/Button.tsx` — HTML `<button>`, Tailwind, `aria-label` support. Satisfies web-tracker-ui R13.

- [ ] 3.2 **CREATE** `src/components/ui/Input.tsx` — `<input>` with label + optional error message, `aria-label`. Satisfies web-tracker-ui R13.

### 3b — Presentational components (no route dependency)

- [ ] 3.3 **CREATE** `src/components/CalorieRing.tsx` — inline `<svg>`/`<circle>` (replaces `react-native-svg`); props: `consumed`, `goal`. Satisfies web-tracker-ui R1.

- [ ] 3.4 **CREATE** `src/components/MacroBar.tsx` — horizontal `<div>` progress bars; props: `consumed`, `goal`, `label`. Satisfies web-tracker-ui R1.

- [ ] 3.5 **CREATE** `src/components/DateNavigator.tsx` — previous/next `<button>` + date display; "next" is `disabled` when `selectedDate >= todayISO()`. Satisfies web-tracker-ui R2, Scenario 3.6.

- [ ] 3.6 **CREATE** `src/components/FoodResultRow.tsx` — single result row with food name + calories; `<button>` for selection; `aria-label`. Satisfies web-tracker-ui R3.

- [ ] 3.7 **CREATE** `src/components/MealEntryRow.tsx` — entry row with delete `<button>` (replaces swipe gesture). `aria-label`. Satisfies web-tracker-ui R5.

- [ ] 3.8 **CREATE** `src/components/MealSection.tsx` — meal slot container; renders `MealEntryRow` list + "Add food" `<button>` + optional `CopyFromYesterdayBanner`. Satisfies web-tracker-ui R1.

- [ ] 3.9 **CREATE** `src/components/CopyFromYesterdayBanner.tsx` — banner with entry count, accept + dismiss buttons; purely presentational (no internal state). Satisfies web-tracker-ui R7, Scenarios 3.11–3.13.

- [ ] 3.10 **TEST** `src/components/__tests__/` — RTL + jsdom for each component: CalorieRing renders `<circle>` with correct `strokeDashoffset`; DateNavigator "next" button is `disabled` at today; MealEntryRow delete triggers callback; CopyFromYesterdayBanner accept/dismiss callbacks fire correctly. Satisfies web-tracker-ui Scenarios 3.6, 3.10–3.13.

### 3c — Routes / screens

- [ ] 3.11 **CREATE** `src/router.tsx` — `createBrowserRouter` with routes: `/` (day diary), `/search` (food search), `/profile`, `/onboarding`, `/portion`, `/custom-food`. Root layout with shared navigation. Satisfies web-tracker-ui screens table, pwa-shell R7, Scenario 1.6.

- [ ] 3.12 **CREATE** `src/routes/OnboardingRoute.tsx` — redirect guard: if profile exists → redirect `/`; else render onboarding form with age/height/weight/sex/activity/goal fields; live TDEE preview via `lib/nutrition.ts`; validates (age 10–120, height 50–280, weight 10–600); on submit calls `useProfileStore.saveProfile()` and redirects `/`. `react-hook-form` + `zod`. Satisfies web-tracker-ui R9, Scenarios 3.1–3.3.

- [ ] 3.13 **CREATE** `src/routes/DayDiaryRoute.tsx` — reads `useProfileStore`; if no profile → redirect `/onboarding`. Renders `DateNavigator`, `CalorieRing`, `MacroBar` × 3, `MealSection` × 4 (breakfast/lunch/dinner/snack). Each `MealSection` receives entries filtered from `useDayStore` for `selectedDate`. Satisfies web-tracker-ui R1, R2, R10, Scenarios 3.1, 3.4–3.6.

- [ ] 3.14 **CREATE** `src/routes/SearchRoute.tsx` — text `<input>` with debounce (300 ms); **OFFLINE GUARD**: checks `navigator.onLine === false` before calling `useFoodSearchStore.search()`; if offline → set empty results + render offline indicator (no call to store); clears input on unmount. Renders `FoodResultRow` list; selecting a result navigates to `/portion`. Satisfies web-local-storage R8, web-tracker-ui R3, Scenarios 2.6, 3.7–3.8.

- [ ] 3.15 **CREATE** `src/routes/PortionRoute.tsx` — receives food via router state/params; displays name, kcal/100g, macros; numeric input defaulting to `servingSizeG ?? 100`; live macro preview; on confirm calls `useDayStore.addEntry()` then navigates `/`. Satisfies web-tracker-ui R4, Scenario 3.9.

- [ ] 3.16 **CREATE** `src/routes/CustomFoodRoute.tsx` — form: name (required), kcal/100g (required), protein/carbs/fat/serving (optional); on save calls `foods.upsert({ ...data, source: 'custom', id: generateId() })`; navigates `/search` after save. Satisfies web-tracker-ui R6, Scenario 3.14.

- [ ] 3.17 **CREATE** `src/routes/ProfileRoute.tsx` — displays current profile fields + computed targets; inline edit form; on save calls `useProfileStore.saveProfile()`; reactive update to calorie/macro targets. Satisfies web-tracker-ui R8, Scenario 3.15.

- [ ] 3.18 **UPDATE** `src/main.tsx` — `await dbReady` before mounting `<RouterProvider router={router} />`; no render until storage is ready. Satisfies web-local-storage R2 (db gate), pwa-shell R4 (offline launch renders stored data).

- [ ] 3.19 **TEST** `src/routes/__tests__/` — RTL tests: (a) `OnboardingRoute` live TDEE preview updates on field change (Scenario 3.3); (b) `DayDiaryRoute` redirects to `/onboarding` when no profile (Scenario 3.1); (c) `SearchRoute` offline guard — mock `navigator.onLine = false`, assert `useFoodSearchStore.search` not called (Scenario 2.6/3.8); (d) `PortionRoute` calls `useDayStore.addEntry` and navigates `/` on confirm (Scenario 3.9). Satisfies web-tracker-ui Scenarios 3.1–3.15, web-local-storage Scenario 2.6.

---

## Phase 4 — PWA Shell

> **Creates**: `public/manifest.webmanifest`, `public/icons/icon-192.png`, `public/icons/icon-512.png`, SW update toast component.
> **Modifies**: `vite.config.ts` (expands `vite-plugin-pwa` config).

- [ ] 4.1 **CREATE** `public/manifest.webmanifest` — `name: "Vitia"`, `short_name: "Vitia"` (≤12 chars), `start_url: "/"`, `display: "standalone"`, `background_color`, `theme_color`, icons: 192px + 512px PNG. Served with `Content-Type: application/manifest+json` (configured in deploy phase). Satisfies pwa-shell R3, Scenario 1.4.

- [ ] 4.2 **CREATE** icon assets — `public/icons/icon-192.png` and `public/icons/icon-512.png` (PNG). Satisfies pwa-shell R3.

- [ ] 4.3 **MODIFY** `vite.config.ts` — expand `vite-plugin-pwa` config: `registerType: 'prompt'`, `workbox.globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}']`, runtime caching `NetworkFirst` for OFF API origin (degrades search offline, never blocks shell). Satisfies pwa-shell R2, Scenario 1.2.

- [ ] 4.4 **CREATE** `src/components/UpdateToast.tsx` — uses `useRegisterSW` from `virtual:pwa-register/react`; when `needRefresh` is true, shows a toast with "Update available" + "Reload" button that calls `updateServiceWorker(true)`. Satisfies pwa-shell R6, Scenario 1.5.

- [ ] 4.5 **Wire** `<UpdateToast />` into the root layout in `src/router.tsx`. Satisfies pwa-shell R6.

---

## Phase 5 — Build / Deploy Configuration

> **Creates**: `vercel.json` + `netlify.toml` + `public/_headers` (Cloudflare Pages).
> No existing files modified.

- [ ] 5.1 **CREATE** `vercel.json` — COOP/COEP headers (`Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Embedder-Policy: require-corp`) on all routes; SPA fallback (rewrites `/**` → `/index.html`); `Content-Type: application/manifest+json` for `*.webmanifest`. Satisfies pwa-shell R7, web-local-storage R4 (`crossOriginIsolated`), Scenario 1.6.

- [ ] 5.2 **CREATE** `netlify.toml` + `public/_headers` — same COOP/COEP + SPA redirect (`/* → /index.html 200`) + manifest MIME. Satisfies pwa-shell R7, Scenario 1.6.

- [ ] 5.3 **VERIFY** build output is clean: `npm run build` succeeds; grep output for backend URLs, Anthropic keys, cloud endpoints — none found. Satisfies pwa-shell R8, Scenario 1.7, web-local-storage R10.

- [ ] 5.4 **Vite dev server** — add `server.headers` to `vite.config.ts` with COOP/COEP for local development so OPFS probe succeeds on `localhost`. Satisfies web-local-storage R4.

---

## Completion Gate

Before marking `sdd-apply` complete, confirm all of the following pass:

- [ ] `npm test` — all contract tests pass on BOTH backends (OPFS + Dexie) via `describe.each`
- [ ] `npm test` — migrator idempotence test (second run applies nothing)
- [ ] `npm test` — offline guard test asserts `openFoodFacts.search` not called when offline
- [ ] `npm run build` — zero TypeScript errors, zero expo/RN imports in bundle
- [ ] Manual smoke — Lighthouse PWA audit passes installability criteria (R3)
- [ ] Manual smoke — airplane mode test: app loads from SW cache, day diary renders (Scenario 1.2)
