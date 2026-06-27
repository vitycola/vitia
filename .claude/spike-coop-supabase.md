# Spike: COOP same-origin + Supabase Redirect OAuth

## Context

The app is served with:
- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Embedder-Policy: credentialless`

These headers are required for OPFS / `crossOriginIsolated`.

## Conclusion: Compatible

Supabase redirect-based OAuth (full-page redirect, not popup) is fully compatible
with `COOP: same-origin`. The flow is:

1. `supabase.auth.signInWithOAuth({ provider: 'google', options: { skipBrowserRedirect: false } })`
   navigates the top-level window to Google.
2. Google completes auth and redirects back to `<origin>/` with a fragment or query
   containing the access token (or an auth code).
3. On return, `supabase.auth.detectSessionInUrl()` (or auto-detection on client init)
   reads the URL and establishes the session.

COOP `same-origin` only restricts **cross-origin window references** (e.g. popups
communicating via `window.opener`). A full-page redirect never establishes a
cross-origin window reference — the redirecting window is replaced, not shared.

**Do NOT use `signInWithOAuth({ ... })` with popup mode** — that would require
`COOP: same-origin-allow-popups`, which would break `crossOriginIsolated` and
therefore OPFS.

## CSP Update Required

The current `connect-src` in `vercel.json` only allows:
```
connect-src 'self' https://world.openfoodfacts.org
```

Supabase client makes XHR/fetch calls to the Supabase project URL. The CSP must
be updated to include the Supabase project URL once the project is created:

```
connect-src 'self' https://world.openfoodfacts.org https://<project-ref>.supabase.co
```

Also add `wss://<project-ref>.supabase.co` if real-time subscriptions are used
(not required for this feature).

## Action Items

- [x] COOP compatibility confirmed — no change to headers needed
- [ ] Update `connect-src` in `vercel.json` with the Supabase project URL
      (can only be done once the Supabase project is provisioned by the user)
- [ ] User runs `supabase-setup.sql` in the Supabase dashboard
- [ ] User sets `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SYNC_ENABLED=true`
      in Vercel project settings
