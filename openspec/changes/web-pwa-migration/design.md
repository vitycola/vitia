# Design: Vitia PWA Migration — Slice 1 (Core PWA, no backend)

Turn the native Expo/RN tracker into an installable, offline-first PWA by keeping the "brain" (logic + data) untouched and rewriting only the "skin" (screens + components). Storage stays SQLite via the drizzle `sqlite-proxy` driver, so `db/schema.ts` and every `db/repositories/` file keep their EXACT contracts — including the two `db.transaction(...)` call sites. Zero backend, zero Anthropic key, zero cloud calls.

## Technical Approach

A new **Vite + React + TypeScript** app replaces Metro/EAS in-place at the repo root. Reused modules (`lib/`, `stores/`, `db/schema.ts`, `db/repositories/`, `types/`) are shared by the `@/` path alias, not copied. The RN render tree becomes HTML/JSX with plain Tailwind. `vite-plugin-pwa` provides the manifest + service worker. SQLite runs in a dedicated Worker via wa-sqlite, wired to `drizzle-orm/sqlite-proxy`. Because iOS Safari frequently lacks a usable sync-access-handle OPFS VFS, **a Dexie/IndexedDB adapter is a first-class, equally-rigorous backend**, not a rare edge fallback. Satisfies `pwa-shell`, `web-local-storage`, `web-tracker-ui`.

## Verified Repository Contracts (ground truth — adapters target these EXACT names)

Read from source. The Dexie adapter, the proxy executor, and the shared contract test suite MUST target precisely these signatures. No others exist.

| File | Functions (verified) |
|------|----------------------|
| `db/repositories/foods.ts` | `searchByName(query)`, `getById(id)`, `upsert(food)`, `insert(food)`, `getCustomFoods()`, `update(id, patch)` — **no `getByName`** |
| `db/repositories/profile.ts` | `getProfile()`, `upsertProfile(data: Omit<NewUserProfile,"id">)` — **no `get()` / `upsert()`** |
| `db/repositories/mealEntries.ts` | `getByDate(date)`, `getByDateAndMeal(date, mealType)`, `insert(entry)`, `insertBulk(entries)` *(uses `db.transaction`, line 53)*, `remove(id)`, `deleteByDateAndMeal(date, mealType)` *(uses `db.transaction`, line 70)* |

## Architecture Decisions

| # | Decision | Choice | Rejected | Rationale |
|---|----------|--------|----------|-----------|
| 1 | Router | **React Router (`createBrowserRouter`, data router)** | TanStack Router | Re-confirmed: only ~6 flat routes, no nested-layout depth or type-safe-search needs that justify TanStack's heavier API + route codegen. React Router maps 1:1 to existing routes, lowest migration cost, and SPA fallback is the default static-host pattern (R7). Tabs become a shared layout route over `/`, `/search`, `/profile`. |
| 2 | SQLite engine | **wa-sqlite (async ESM) in a dedicated Worker; OPFS VFS when available** | sql.js (no durable OPFS), absurd-sql (unmaintained) | Maintained WASM SQLite with first-class OPFS. Sync-access-handle VFS (`OPFSCoopSyncVFS`) needs `crossOriginIsolated`. |
| 3 | Drizzle binding | **`drizzle-orm/sqlite-proxy`** over an async `(sql, params, method) => {rows}` executor PLUS a batch callback to satisfy `db.transaction` (see Transaction section) | `sqlite-wasm` (sql.js only), forking the expo driver | Official escape hatch: schema + repos see an identical `db` object. The transaction contract forces a precise executor protocol — designed below. |
| 4 | Storage backend selection | **Two first-class adapters behind one `db` boundary: (A) wa-sqlite/OPFS proxy, (B) Dexie/IndexedDB.** iOS Safari is the PRIMARY target and often has NO sync access handle (iOS ≤16.3), so **Dexie is the EXPECTED path on many iPhones**, not an edge case. | wa-sqlite IDBBatchAtomicVFS bridge | The bridge is fragile/slow on iOS Safari. The Dexie adapter re-implements the 3 repos' verified contracts against flat IndexedDB tables (`users_profile`, `foods`, `meal_entries`). Selected at the `db` factory; stores/screens never branch. **Probe:** OPFS path requires `navigator.storage.getDirectory()` to resolve AND a Worker sync-access-handle test-write to succeed AND `crossOriginIsolated === true`; ANY failure → Dexie. |
| 5 | Migrations on web | **From-scratch web migrator** (NOT reuse of the expo bundle): import `0000_*.sql` via Vite `?raw`, split on `--> statement-breakpoint`, order via `_journal.json`, track in an explicit `__drizzle_migrations` table | `drizzle-orm/expo-sqlite/migrator` | The expo migrator consumes `{ journal, migrations:{m0000} }` produced by `babel-plugin-inline-import` and is RN-only — incompatible with sqlite-proxy. Designed from scratch below (R2, Scenario 2.4). |
| 6 | Offline guard placement | **DECIDED: guard at the UI/store-caller layer; `lib/openFoodFacts.ts` stays unchanged.** | Guarding inside `lib/openFoodFacts.ts` | `lib/` is reused 1:1 (R8 forbids touching it). The new search route checks `navigator.onLine === false` before invoking the store's `search()`, short-circuiting to an empty result + offline indicator (Scenario 2.6 / 3.8). No `stores/` or `lib/` edit. |
| 7 | DB init gate | **Promise `dbReady` awaited before first render** (port of `useDatabaseReady`) | render-then-hydrate | Repos must not run before migrations complete (R2). `main.tsx` awaits `dbReady` before mounting `<RouterProvider>`. |

## CRITICAL: Transactions across the Worker boundary

`mealEntries.ts` calls `db.transaction(async (tx) => ...)` at lines 53 and 70. R6 forbids modifying repos. `drizzle-orm/sqlite-proxy`'s plain async-proxy driver **does NOT provide an interactive `tx` callback** — it exposes a separate `batch` channel and otherwise throws on `.transaction()`. So we cannot satisfy the existing repo signature with the stock proxy alone.

**Resolution (zero repo change):** wrap the drizzle proxy `db` in a thin `db` facade exported from `db/client.ts` that adds a real `transaction(fn)` whose `tx` is itself a drizzle-proxy instance bound to the SAME Worker connection, with the Worker serializing statements between an explicit `BEGIN`/`COMMIT`/`ROLLBACK`. The facade preserves the `db.transaction(async (tx) => ...)` shape the repos already use. This lives in the to-be-modified `db/client.ts` (already in scope to swap), so NO repository file changes.

**Worker message protocol (concrete):**

```ts
// main thread → worker
type DbRequest =
  | { id: number; kind: "exec"; sql: string; params: unknown[]; method: "run" | "all" | "get" | "values" }
  | { id: number; kind: "begin" | "commit" | "rollback"; txId: number }
  | { id: number; kind: "tx-exec"; txId: number; sql: string; params: unknown[]; method: "run" | "all" | "get" | "values" };

// worker → main thread
type DbResponse =
  | { id: number; ok: true; rows: unknown[][] }     // resolves the matching request
  | { id: number; ok: false; error: string };       // rejects → repo Promise rejects (R9)
```

**Executor + transaction flow:**

1. `db/client.ts` opens the Worker and creates `proxyDb = drizzle(async (sql, params, method) => { const { rows } = await call({kind:"exec", sql, params, method}); return { rows }; }, { schema })`.
2. `db.transaction(fn)`: allocate `txId`; `await call({kind:"begin", txId})`; build a per-tx proxy `tx = drizzle(async (sql, params, method) => { const {rows} = await call({kind:"tx-exec", txId, sql, params, method}); return {rows}; }, {schema})`; run `result = await fn(tx)`; `await call({kind:"commit", txId})`; on ANY throw → `await call({kind:"rollback", txId})` then rethrow (R9: no partial state).
3. The Worker holds ONE wa-sqlite connection. It runs `BEGIN`/`COMMIT`/`ROLLBACK` literally and queues `tx-exec` statements between them. SQLite's single-connection serialization guarantees correctness; `id` correlates request/response; `error` strings propagate as Promise rejections so `mealEntries.insertBulk` rejects exactly as native does.
4. **Dexie backend** implements the same facade: `transaction(fn)` maps to `dexie.transaction('rw', tables, () => fn(dexieTxAdapter))`, giving the repos the same atomic semantics without SQL.

This is the minimal-impact resolution: a facade in the already-modified `db/client.ts`, no repo edits.

## CRITICAL: From-scratch web migrator (replaces babel-plugin-inline-import)

`db/migrate.ts` + `db/migrations/migrations.js` are RN-only and stay untouched on the native branch. The web build introduces `src/db/migrate.web.ts`:

```ts
import journal from "@/db/migrations/meta/_journal.json";
import sql0000 from "@/db/migrations/0000_thick_eddie_brock.sql?raw"; // Vite ?raw — REPLACES babel-plugin-inline-import

const FILES: Record<string, string> = { "0000_thick_eddie_brock": sql0000 };
```

Tracking table (explicit schema, created if absent before any migration runs):

```sql
CREATE TABLE IF NOT EXISTS __drizzle_migrations (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  tag     TEXT NOT NULL UNIQUE,   -- journal entry tag, e.g. '0000_thick_eddie_brock'
  hash    TEXT NOT NULL,          -- sha-256 of the raw .sql (idempotency / drift guard)
  created_at INTEGER NOT NULL     -- journal `when` epoch ms
);
```

Algorithm: read `journal.entries` ordered by `idx`; for each, look up its `tag` in `__drizzle_migrations`. If present AND `hash` matches → skip (Scenario 2.4: re-run applies nothing). If present with a different hash → throw (drift). If absent → split `FILES[tag]` on the literal `--> statement-breakpoint` delimiter, execute each non-empty statement inside one `BEGIN/COMMIT`, then `INSERT` the tracking row. The `0000_*.sql` contains exactly those breakpoints (3 tables + 4 indexes), so splitting yields the correct ordered statement list. This satisfies R2 (first run creates all tables) and Scenario 2.4 (idempotent re-run). The Dexie backend defines its object stores declaratively (no SQL migrator) but records the same `tag` set so both backends report "migrated".

## Brain / Skin Split

**Move 1:1 (no logic change, shared via `@/`):** `lib/date.ts`, `lib/nutrition.ts`, `lib/openFoodFacts.ts`, `stores/*` (4), `db/schema.ts`, `db/repositories/*` (3), `types/*`. `db/migrations/*.sql` + `meta/` consumed as data by the web migrator.

**Modify (contract preserved):**
- `db/client.ts` → exports the `db` facade (proxy executor + `transaction()` + Dexie factory), same `export const db`.
- `lib/id.ts` → `crypto.randomUUID()` (drop `expo-crypto`); signature `generateId(): string` unchanged (R7).
- `lib/openFoodFacts.ts` — **unchanged**. It already uses plain `fetch` returning `[]` on failure; the offline guard lives in the UI per Decision 6.

**Rewrite (RN → HTML), 8 screens + 9 components:** `app/(tabs)/_layout.tsx`→layout route; `index/search/profile.tsx`, `onboarding/portion/custom-food.tsx`; `app/_layout.tsx`→root provider/db gate. `components/*` (CalorieRing, CopyFromYesterdayBanner, DateNavigator, FoodResultRow, MacroBar, MealEntryRow, MealSection, ui/Button, ui/Input).

**RN→HTML mapping:**

| RN | Web |
|----|-----|
| `View` | `div` |
| `Text` | `span` / `p` |
| `Pressable`/`TouchableOpacity` | `button` (`aria-label`, R13) |
| `TextInput` | `input` / `textarea` |
| NativeWind `className` | plain Tailwind `className` |
| `react-native-svg` `Svg`/`Circle` | inline `<svg>`/`<circle>` |
| `lucide-react-native` | `lucide-react` |
| reanimated / gesture-handler | CSS transitions; swipe-to-delete → delete `button` (R5) |
| `FlatList`/`ScrollView` | `div` + overflow / `.map()` |
| `SafeAreaView` | `env(safe-area-inset-*)` padding |

`react-hook-form` + `zod` carry over (onboarding/custom-food forms).

## Project Structure & Alias Wiring

In-place at repo root (single workspace; reused modules already resolve via `@/`).

```
index.html              # Vite entry, links manifest, mounts #root
vite.config.ts          # react + vite-plugin-pwa + vite-tsconfig-paths
tsconfig.app.json       # NEW — drops expo/tsconfig.base + nativewind types
src/
  main.tsx              # awaits dbReady, renders <RouterProvider>
  router.tsx
  routes/               # day, search, profile, onboarding, portion, custom-food
  components/
  db/worker.ts          # wa-sqlite Worker (msg protocol above)
  db/migrate.web.ts     # from-scratch web migrator
public/                 # manifest + 192/512 icons
db/ lib/ stores/ types/ # REUSED (unchanged), resolved via @/
```

**Alias wiring (warning #6):** the root `tsconfig.json` still `extends: "expo/tsconfig.base"` and is kept ONLY for the native branch. The web build adds **`tsconfig.app.json`** (`"jsx": "react-jsx"`, `lib: ["DOM","WebWorker"]`, `paths: { "@/*": ["./*"] }`, NO expo base, NO nativewind types). **`vite-tsconfig-paths` MUST be pointed at `tsconfig.app.json`** (its `projects: ['tsconfig.app.json']` option), NOT the root `tsconfig.json`, so the `@/` alias resolves without pulling the expo base config into the web typecheck.

## Service Worker / PWA (R2, R3, R5, R6)

`vite-plugin-pwa`, `registerType: 'prompt'`, `workbox.globPatterns: ['**/*.{js,css,html,svg,png}']`. Manifest per `pwa-shell` R3 (`display: standalone`, `start_url: '/'` → day diary, 192+512 PNG icons). Update (R6): `prompt` mode shows a "new version" toast calling `updateServiceWorker(true)`. OFF responses runtime-cached `NetworkFirst` (search degrades, never blocks shell — R4, Scenario 1.3).

## COOP/COEP Headers (per host)

`Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy: require-corp` → `crossOriginIsolated === true` (needed by OPFS sync VFS). Configured per host: Vercel `vercel.json`, Netlify `_headers`/`netlify.toml`, Cloudflare Pages `_headers`. Same files add SPA 404→`index.html` (R7) and `application/manifest+json` MIME. Dev: Vite `server.headers`. If headers are absent OR iOS lacks the VFS, the probe fails → Dexie (graceful, expected on iPhone).

## Data Flow

```
Screen ──action──▶ Zustand store ──▶ db/repositories ──▶ db facade
   ▲                    │                                   │
   └── re-render ◀── store state ◀── repo result ◀──┬─ Worker (wa-sqlite/OPFS)
                                                    └─ Dexie/IndexedDB (iOS primary)
```

## Shared Contract Test Suite (concrete)

Lives at `src/db/__tests__/repository-contract.test.ts`. It is **parameterized over BOTH backends** (`describe.each([opfsDb, dexieDb])`) and asserts the EXACT verified functions:

- foods: `searchByName`, `getById`, `upsert`, `insert`, `getCustomFoods`, `update` — round-trip + return-type shape matches `Food`/`NewFood` (Scenario 2.8).
- profile: `getProfile` (null on empty), `upsertProfile` (singleton id=1 upsert) — second call updates, not duplicates.
- mealEntries: `getByDate`, `getByDateAndMeal`, `insert`, `insertBulk` (atomicity: partial failure rolls back — R9/Scenario 2.7), `remove`, `deleteByDateAndMeal`.

Running the SAME suite against both adapters is what prevents Dexie drift.

## Testing Strategy

| Layer | What | How |
|-------|------|-----|
| Unit | nutrition/date/OFF/id | Jest **jsdom**; polyfill `crypto.randomUUID` if absent |
| Repos | contract suite on BOTH backends | OPFS path: better-sqlite3 in-memory behind the proxy executor; Dexie path: `fake-indexeddb`. Assert identical results (Scenario 2.8) |
| Migrator | from-scratch web migrator | Run twice in-memory; second run applies nothing (Scenario 2.4); statement split count == breakpoints |
| Component | screen render/interactions | RTL + jsdom; mock the `db` facade |
| Manual/E2E | install, offline, deep-link, SW update, **iOS Safari Dexie path** | Lighthouse PWA + airplane-mode + real iPhone smoke (Scenarios 1.2/1.4/1.5/1.6/2.2) |

## Build / Tooling

Remove: Metro, EAS, `babel.config.js` (nativewind + inline-import), expo-router entry. Add: Vite, `@vitejs/plugin-react`, `vite-plugin-pwa`, `vite-tsconfig-paths`, `wa-sqlite`, `dexie`, `react-router-dom`, `lucide-react`, plain `tailwindcss`+`postcss`+`autoprefixer`. Retain: drizzle-orm, drizzle-kit, zustand, react-hook-form, zod, biome. `crypto.randomUUID()` needs a secure context — guaranteed by HTTPS/localhost.

## Risks / Tradeoffs

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| **iOS Safari lacks sync-access-handle OPFS VFS (iOS ≤16.3) — Dexie IS the primary iPhone path** | **High** | Dexie adapter is first-class with equal test rigor; shared contract suite runs against it; real-device smoke test |
| sqlite-proxy has no interactive `tx` — `db.transaction` could break | High | Facade `transaction()` in `db/client.ts` + Worker BEGIN/COMMIT/ROLLBACK protocol; zero repo change |
| Web migrator diverges from expo bundle | Med | From-scratch migrator over the same `.sql`+`_journal.json`; `hash` drift guard; idempotence test |
| OPFS sync VFS needs `crossOriginIsolated`; header misconfig | Med | Probe-and-fallback to Dexie; per-host header files; spike first |
| Dexie adapter drifts from repo contracts | Med | One contract suite, both backends |
| Swipe-to-delete parity loss | Low | Spec permits a delete button (R5) |

## Open Questions

- [ ] Confirm hosting target (Vercel/Netlify/Cloudflare) to finalize the exact header/SPA-fallback file — design covers all three.

## Migration / Rollout

No data migration: the web DB is a fresh OPFS/IndexedDB store, independent of the device's expo-sqlite DB. Native app stays runnable on its branch (rollback intact).
