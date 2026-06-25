# Spec: pwa-shell — Installable PWA Host

Slice 1 capability. Vitia runs as a Vite-built React app registered as a Progressive Web App. A service worker caches the app shell so the UI loads fully offline after the first visit. Users on mobile can install it from the browser and launch it in standalone mode without a browser chrome. The same build artifact is shareable via a single URL served from static hosting.

---

## Non-Goals (Slice 1)

These items are explicitly out of scope for this spec. Do NOT implement them.

- Backend calls of any kind (no API, no Anthropic key, no cloud sync).
- AI food logging (deferred to Slice 2).
- Cloud backup or progress photos (deferred to Slice 3).
- Push notifications.
- Multi-user support.
- Native App Store distribution.

---

## Requirements

### R1 — Vite build produces a valid PWA artifact

**MUST** produce a production build via Vite that includes:

- An HTML entry point (`index.html`) that boots the React app.
- A Web App Manifest (linked from `index.html`) that satisfies browser installability criteria (see R3).
- A service worker registration script injected by `vite-plugin-pwa`.
- All static assets fingerprinted and referenced correctly.

### R2 — Service worker caches the app shell

**MUST** register a service worker that precaches the app shell on the first load.

- App shell = the minimum set of assets required to render the main UI without a network request: `index.html`, the compiled JS bundle(s), the compiled CSS, and any inline icon or splash assets.
- The service worker **MUST** serve the precached app shell on subsequent navigations, regardless of network state.
- Cached assets **MUST** be invalidated and refreshed when a new build is deployed (cache-busting via manifest revision hash).

### R3 — Web App Manifest meets installability criteria

The manifest **MUST** include:

| Field | Constraint |
|-------|------------|
| `name` | Non-empty string |
| `short_name` | Non-empty string, ≤ 12 characters |
| `start_url` | Root path (`/` or equivalent) |
| `display` | `"standalone"` |
| `background_color` | Valid CSS color |
| `theme_color` | Valid CSS color |
| `icons` | At least one icon at 192 × 192 px and one at 512 × 512 px, both `image/png` |

The manifest **MUST** be served with `Content-Type: application/manifest+json`.

### R4 — Offline launch after first load

After a user visits the app at least once while online, the app **MUST** launch to a functional state when the device is offline (airplane mode or no network).

- "Functional state" means: the day diary view renders with locally stored data. The app does not display an unrecoverable error or blank screen.
- The food search feature **MAY** show a degraded state (empty results or an offline indicator) when offline, because it depends on the Open Food Facts API (an external network call). This is acceptable — the rest of the UI **MUST** remain interactive.

### R5 — Standalone launch from Home Screen

After the user accepts the "Add to Home Screen" / install prompt:

- Launching from the installed icon **MUST** open the app in standalone mode (no browser address bar, no browser navigation chrome).
- `window.matchMedia('(display-mode: standalone)').matches` **MUST** return `true` at runtime in the installed context.
- The `start_url` **MUST** resolve to the day diary view.

### R6 — Service worker update behavior

When a new version of the app is deployed:

- The service worker **MUST** detect the update in the background.
- The app **SHOULD** prompt the user (or automatically reload after the tab becomes idle) to apply the update.
- Stale content **MUST NOT** persist indefinitely — the previous service worker **MUST** be replaced after the update cycle completes.

### R7 — Shareable URL

The app **MUST** be reachable at a single stable HTTPS URL served from static hosting (Vercel, Netlify, or Cloudflare Pages).

- Deep links (e.g. `/profile`, `/search`) **MUST** resolve correctly when navigated to directly via URL or shared link.
- The hosting configuration **MUST** redirect all 404s to `index.html` (SPA fallback).

### R8 — No backend dependency in Slice 1

The PWA shell, service worker, and manifest **MUST** contain zero references to any backend URL, Anthropic API key, or cloud storage endpoint. Build-time environment variables that reference backend services **MUST NOT** be present in Slice 1.

---

## Scenarios

### Scenario 1.1 — First visit, assets cached

```
Given the user opens the app URL in a mobile browser for the first time
When the page finishes loading
Then the service worker is registered without error
And the app shell assets are added to the service worker's precache
And the browser install prompt becomes available (or is deferred for later trigger)
```

### Scenario 1.2 — Offline launch after prior visit

```
Given the user has visited the app at least once while online
And the service worker has precached the app shell
When the user navigates to the app URL with no network connection
Then the app loads from the service worker cache
And the day diary view renders with previously stored local data
And no unrecoverable error or blank screen is shown
```

### Scenario 1.3 — Food search is degraded offline

```
Given the app is loaded offline (from service worker cache)
When the user navigates to the food search screen and types a query
Then the search returns no results or shows an offline indicator
And the rest of the day diary UI remains functional (add/edit/delete entries still work)
```

### Scenario 1.4 — Install to Home Screen and standalone launch

```
Given the user is on a mobile browser viewing the app
And the Web App Manifest satisfies all installability criteria (R3)
When the user accepts the "Add to Home Screen" prompt
Then an icon is added to the device home screen
When the user taps that icon
Then the app opens in standalone mode with no browser chrome
And window.matchMedia('(display-mode: standalone)').matches returns true
And the day diary view is shown as the initial screen
```

### Scenario 1.5 — Service worker update on new deploy

```
Given the user has the app open or reopens it after a new version is deployed
When the service worker detects a waiting update
Then either a prompt is shown to reload, or the app reloads automatically on next open
And after reload the user sees the new version
And the old cached assets are no longer served
```

### Scenario 1.6 — Deep link resolves correctly

```
Given the app is deployed to static hosting
When a user navigates directly to /profile or /search via URL
Then the app loads and renders the correct screen
And no 404 or blank page is shown
```

### Scenario 1.7 — No backend reference in build output

```
Given the Slice 1 build is produced
When the output directory is inspected for backend URLs, API keys, or cloud endpoint strings
Then none are found
```

---

## Reused Modules (no changes allowed)

None of the following are modified by this capability. They are listed here because other specs in Slice 1 depend on them.

- `lib/` — date, nutrition, OFF client, ID generation
- `stores/` — Zustand stores
- `db/schema.ts` — SQLite schema
- `db/repositories/` — repository layer
- `types/` — shared TypeScript types
