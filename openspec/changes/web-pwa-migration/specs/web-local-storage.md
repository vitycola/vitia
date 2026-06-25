# Spec: web-local-storage — Local SQLite on Web

Slice 1 capability. The same `db/schema.ts` tables and `db/repositories/` repository contracts used in the native Expo app are made available in the browser via a SQLite engine backed by the Origin Private File System (OPFS). The drizzle-orm web driver is wired to a wa-sqlite instance running in a worker. When OPFS is unavailable, a documented fallback (Dexie/IndexedDB) preserves the repository contracts. Data written in one session persists through page reloads and app restarts. IDs are generated via `crypto.randomUUID()`. Connectivity is detected via `navigator.onLine`.

---

## Non-Goals (Slice 1)

- Backend calls, cloud sync, or remote backup.
- AI food logging.
- Progress photos.
- Multi-device or multi-user data.
- Data migration from the native Expo SQLite database (different device, different storage system).

---

## Reused Contracts (MUST NOT change)

The following files are reused 1:1. This spec asserts that their public API remains unchanged after the web driver is wired in.

| Path | Contract |
|------|----------|
| `db/schema.ts` | Table definitions: `usersProfile`, `foods`, `mealEntries`; exported TypeScript types `UserProfile`, `NewUserProfile`, `Food`, `NewFood`, `MealEntry`, `NewMealEntry` |
| `db/repositories/foods.ts` | `searchByName(query: string)`, `getById(id: string)`, `upsert(food: NewFood)`, `insert(food: NewFood)`, `getCustomFoods()`, `update(...)` |
| `db/repositories/mealEntries.ts` | `getByDate(date: string)`, `getByDateAndMeal(date: string, mealType: MealType)`, `insert(entry: NewMealEntry)`, `insertBulk(entries: NewMealEntry[])`, `remove(id: string)`, `deleteByDateAndMeal(date: string, mealType: MealType)` — note: `insertBulk` and `deleteByDateAndMeal` use `db.transaction(...)` |
| `db/repositories/profile.ts` | `getProfile()`, `upsertProfile(data: Omit<NewUserProfile, "id">)` |
| `types/` | `MealType`, `Sex`, `ActivityLevel`, `Goal` |

---

## Requirements

### R1 — Web database driver wires to the existing schema

**MUST** replace `db/client.ts` with a web-compatible implementation that:

- Creates a drizzle-orm instance backed by a wa-sqlite engine over OPFS.
- Exports the same `db` object consumed by all repositories.
- Requires no changes to `db/schema.ts` or any repository file to function.

### R2 — Database initializes on first run

On the very first load (empty OPFS or fallback storage), the database **MUST**:

- Create all tables defined in `db/schema.ts` (`users_profile`, `foods`, `meal_entries`).
- Apply all pending drizzle migrations in order via `db/migrate.ts` (or equivalent migration runner compatible with the web driver).
- Complete initialization before any repository call is allowed to proceed.

Subsequent loads **MUST** detect the existing database, apply only pending migrations, and skip already-applied ones.

### R3 — Data persists across reloads

Any data written to the database in one page session **MUST** be readable in a subsequent page session without explicit user action (no "export and reimport" required).

- This applies to all three tables: `users_profile`, `foods`, `meal_entries`.
- Persistence **MUST** survive a hard page reload (`Ctrl+R` / browser refresh).
- Persistence **MUST** survive closing and reopening the browser tab.

### R4 — OPFS is the primary storage backend

**MUST** use OPFS as the underlying file system for wa-sqlite when the browser supports it.

OPFS is considered available when `navigator.storage.getDirectory()` resolves without error.

### R5 — Dexie/IndexedDB fallback when OPFS is unavailable

When OPFS is not available (e.g. older browsers, privacy modes that block OPFS):

- **MUST** transparently fall back to a Dexie/IndexedDB-backed storage layer.
- The fallback **MUST** satisfy the same repository contracts listed in the "Reused Contracts" section above.
- The rest of the app (stores, screens) **MUST** function identically regardless of which storage backend is active.
- The app **MAY** log a warning to the console indicating that the fallback is in use; it **MUST NOT** display an error to the user unless all storage options fail.

### R6 — Repository contracts are preserved

All repository functions **MUST** behave identically on web as on native (same argument types, same return types, same error behavior). No repository file **MAY** be modified to add web-specific branching.

If the web driver requires an adapter, the adapter **MUST** implement the same interface that `db/client.ts` exposes today, so repositories remain agnostic.

### R7 — UUID generation via `crypto.randomUUID()`

**MUST** replace `lib/id.ts`'s use of `expo-crypto` with `crypto.randomUUID()` (Web Crypto API, available in all modern browsers and in secure contexts).

- The exported function signature **MUST** remain `generateId(): string`.
- The returned string **MUST** conform to the UUID v4 format.
- No other module may be changed as a result of this swap.

### R8 — Connectivity detection via `navigator.onLine`

**MUST** add `navigator.onLine`-based online/offline detection. Note: there is no `expo-network` import in the codebase today — `lib/openFoodFacts.ts` already uses a plain `fetch` that returns `[]` on any failure — so this is a NET-NEW guard, not a 1:1 import swap.

- When `navigator.onLine` is `false`, the food search feature **MUST** skip the Open Food Facts network call and return an empty result set.
- The guard **MUST** be placed without modifying `lib/openFoodFacts.ts` (the WHERE — UI layer vs. store caller — is resolved in design; `lib/` and `stores/` stay unchanged except for the `lib/id.ts` swap in R7).
- The app **SHOULD** listen for the browser's `online` and `offline` events to reactively update UI state.

### R9 — No data loss on unhandled storage error

If a write operation fails (e.g. storage quota exceeded, I/O error), the repository **MUST** propagate the error to the caller (reject the Promise). The caller (Zustand store) is responsible for surfacing the failure to the user. The database **MUST NOT** be left in a corrupted or partially-written state.

### R10 — Zero backend dependency

The web storage layer **MUST** operate entirely client-side. No network call **MAY** be made during database initialization, migration, or any repository operation.

---

## Scenarios

### Scenario 2.1 — First-run database initialization (OPFS path)

```
Given the user opens the app for the first time in a browser that supports OPFS
When the app initializes
Then the wa-sqlite engine opens or creates the database file in OPFS
And all tables from db/schema.ts are created
And all migrations from db/migrate.ts are applied
And no error is thrown
And subsequent repository calls succeed immediately
```

### Scenario 2.2 — First-run database initialization (Dexie fallback)

```
Given the user opens the app for the first time in a browser where OPFS is unavailable
When the app initializes
Then the fallback Dexie/IndexedDB adapter is used
And all repository contracts are satisfied identically
And no error is displayed to the user
```

### Scenario 2.3 — Data persists across page reload

```
Given the user has added a meal entry via the day diary
When the user reloads the page (hard refresh)
Then the same meal entry is returned by mealEntriesRepo.getByDate(date)
And the day diary view renders it without any additional user action
```

### Scenario 2.4 — Subsequent load applies only pending migrations

```
Given the database was initialized in a previous session (all migrations applied)
When the user opens the app again
Then no migration is re-applied
And no error is thrown
And all existing data remains intact
```

### Scenario 2.5 — UUID uniqueness

```
Given the user creates multiple meal entries or custom foods in a session
When generateId() is called for each one
Then each returned string is a valid UUID v4
And no two IDs are identical within the same session
```

### Scenario 2.6 — Offline detection blocks OFF call

```
Given navigator.onLine is false
When the user types a query in the food search
Then no fetch request to the OFF API is issued (the guard short-circuits before calling openFoodFacts)
And the search returns an empty array or an offline indicator
And no network error is thrown to the user
```

### Scenario 2.7 — Write failure propagates without corruption

```
Given a write operation to the database fails (e.g. storage quota exceeded)
When mealEntriesRepo.insert() is called
Then the returned Promise rejects with an error
And the database is not left in a partially-written or corrupted state
And previously committed data is still readable
```

### Scenario 2.8 — Repository contracts unchanged

```
Given the web driver is active
When any function from db/repositories/ is called with valid inputs
Then the return type matches the TypeScript type exported from db/schema.ts
And the behavior is identical to the native expo-sqlite implementation
```
