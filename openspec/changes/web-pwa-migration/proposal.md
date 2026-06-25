# Proposal: Migrate Vitia from Native (Expo/RN) to PWA + Minimal Serverless Backend

## Intent

Vitia is a local-first, offline CRUD nutrition tracker with a single external REST call (Open Food Facts). The native toolchain (Metro, EAS, simulators, signing) is heavy for that nature. Migrate to an installable PWA to cut toolchain cost and unlock a shareable URL, while a tiny serverless backend adds AI-from-photo/audio entry and a cloud safety-net backup. Success: the core tracker runs as an installable mobile PWA at parity with native, with the business logic ("brain") reused 1:1.

## Scope

### In Scope (this change defines the FIRST SLICE only)
- **Slice 1 (this proposal's authoritative slice): Core tracker as PWA, no backend.** Vite + React + vite-plugin-pwa shell (installable, service worker, offline). Reuse `lib/`, `stores/`, `db/schema.ts`, `db/repositories/`, `types/` unchanged. Rewrite `app/` screens + `components/` from RN primitives to HTML/JSX + plain Tailwind + lucide-react. Local SQLite via wa-sqlite/OPFS + drizzle web driver (Dexie/IndexedDB fallback). Native swaps: `expo-crypto`→`crypto.randomUUID()`, `expo-network`→`navigator.onLine`.

### Out of Scope (deferred to follow-up changes, NOT this slice)
- **Slice 2 (later): AI proxy** — backend endpoint that takes photo/audio, calls Claude, returns a structured food entry (Anthropic key backend-only).
- **Slice 3 (later): Backup/Restore + progress photos** — snapshot upload/restore, private buckets, signed URLs.
- **Hard non-goals:** multi-user, multi-device sync, conflict resolution, push notifications, native app-store presence, Apple Health as first-class (Shortcuts→endpoint workaround only, if trivially free), barcode scanner (nice-to-have).

## Capabilities

### New Capabilities
- `pwa-shell`: Installable PWA host — Vite build, manifest, service worker, offline caching, "Add to Home Screen".
- `web-local-storage`: Local SQLite on web via wa-sqlite/OPFS + drizzle web driver, preserving schema + repositories (Dexie fallback).
- `web-tracker-ui`: Web rewrite of `app/` screens and `components/` (HTML/JSX + Tailwind + lucide-react), reusing `stores/` and `lib/` unchanged.

### Modified Capabilities
- None (no existing `openspec/specs/`; this is a greenfield spec set for the web target).

## Approach

Split the codebase into **brain** (reuse 1:1) and **skin** (rewrite). Zustand, nutrition/date/OFF logic, drizzle schema, and repositories move unchanged because storage and presentation are already separated from logic. Only RN `View/Text/Pressable` → HTML/JSX and NativeWind → plain Tailwind. Storage stays SQLite via the drizzle web driver so repositories need no rewrite. Backend slices are deferred but the local-first architecture preserves the future path (auth + Postgres/RLS as evolution, not rewrite).

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `lib/`, `stores/`, `db/schema.ts`, `db/repositories/`, `types/` | Reused | Move 1:1; no logic change |
| `app/`, `components/` | Rewritten | RN primitives → HTML/JSX + Tailwind |
| `db/client.ts` | Modified | expo-sqlite → wa-sqlite/OPFS web driver |
| `lib/id.ts`, network checks | Modified | expo-crypto/expo-network → web APIs |
| Build tooling (Metro/EAS) | Removed | Replaced by Vite + vite-plugin-pwa |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| wa-sqlite/OPFS setup friction (workers, COOP/COEP headers) | High | Spike early; Dexie/IndexedDB fallback keeps repositories thin |
| iOS Safari storage eviction (OPFS/IndexedDB) | Med | Mitigated by Slice 3 cloud backup; warn user until then |
| RN→HTML rewrite parity gaps (gestures, reanimated) | Med | Match per-screen behavior; defer non-essential animation |
| Scope creep into backend within Slice 1 | Med | Backend explicitly deferred; this slice ships offline-only |

## Rollback Plan

The Expo/RN app remains intact and runnable on a separate branch; the PWA is built in a new workspace. If Slice 1 underdelivers, keep using the native app — no destructive change to existing native code or local DB schema. Web DB is separate from device DB, so no data migration risk.

## Dependencies

- Vite, vite-plugin-pwa, React Router/TanStack Router, Tailwind, lucide-react, wa-sqlite + drizzle web driver (Dexie as fallback).
- Static hosting (Vercel/Netlify/Cloudflare Pages). Backend vendor (Supabase vs R2) decided in Slice 2/3, not now.

## Success Criteria

- [ ] PWA installs from mobile browser ("Add to Home Screen") and launches standalone.
- [ ] Core tracker (day view, search, add/edit entries, profile) works offline at native parity.
- [ ] `lib/`, `stores/`, `db/schema.ts`, `db/repositories/`, `types/` reused with no logic changes.
- [ ] Local SQLite reads/writes succeed via the web driver; data persists across reloads.
- [ ] No Anthropic key, secret, or backend dependency present in Slice 1.
