# Vitia — web PWA

Personal nutrition tracker. Runs entirely in the browser as a Progressive Web App — no server required for day-to-day use. Single user, local-first.

## Quick start

Node 22+ required.

```bash
npm install
npm run dev        # http://localhost:5173
```

```bash
npm run build      # production bundle → dist/
npm run preview    # serve the dist/ bundle locally
npm run typecheck  # tsc --noEmit
npm run lint       # biome check
```

## Stack

| Layer | Choice |
|-------|--------|
| Bundler | Vite 8 |
| UI | React 19 + React Router 7 |
| Styling | Tailwind CSS 3 |
| PWA | vite-plugin-pwa + Workbox |
| Linting | Biome |
| Language | TypeScript 5.9 (strict) |
| Storage (planned) | wa-sqlite / OPFS with Dexie fallback |
| Food data (planned) | Open Food Facts API |
| AI features (planned) | future slice |
| Cloud backup (planned) | future slice |

Path alias `@/*` resolves to the project root (wired via `vite-tsconfig-paths`).

## Architecture

Local-first: all user data lives in the browser (OPFS → IndexedDB fallback). The app works offline after the first load. Cloud features are opt-in and arrive in a later slice.

## Development workflow

Changes follow a spec-driven cycle — explore → propose → spec → design → tasks → apply → verify — before code lands. Planning artifacts (proposals, specs, design decisions) aren't committed as files; they're persisted in a local memory store (Engram) and queried on demand, so the repo stays focused on shipped code rather than process scaffolding. Each PR corresponds to one slice of that cycle, verified against the running app before merge.

Manual review after an automated verify pass follows its own triage loop, documented in [`.claude/skills/review-loop`](.claude/skills/review-loop/SKILL.md).

## Project structure

```
src/
  main.tsx        — entry point, mounts <App>
  App.tsx         — placeholder shell
  index.css       — Tailwind directives
  vite-env.d.ts   — Vite type shims
vite.config.ts
tailwind.config.ts
tsconfig.json
biome.json
```

Screens, routing, data layer, and components arrive in subsequent PRs.
