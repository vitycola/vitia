# E2E Smoke Test — User Session Persistence

Manual protocol for cross-device sync verification.

## Prerequisites

- Supabase project created and `supabase-setup.sql` executed
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SYNC_ENABLED=true` set in Vercel
- Two browsers or devices (e.g., Chrome desktop + Chrome mobile, or two Chrome profiles)

## Test Steps

### 1. Sign in on Device A

1. Open the app on Device A
2. Tap "Continue with Google" or use email/password
3. Complete onboarding if this is the first login
4. Confirm you see the main diary screen

### 2. Add a meal entry on Device A

1. Search for a food (e.g., "banana")
2. Log it under any meal type
3. Confirm the entry appears in the diary
4. Wait 5 seconds for sync (or go offline and back online to trigger flush)

### 3. Verify in Supabase dashboard (optional)

1. Open Supabase dashboard > Table Editor > meal_entries
2. Confirm the row is present with your user_id

### 4. Sign in on Device B

1. Open the app on Device B (different browser or incognito)
2. Sign in with the SAME account (Google or email)
3. Confirm the onboarding step is skipped (profile from Device A is loaded)
4. Confirm the meal entry from step 2 appears in the diary

### 5. Sign out

1. Go to Profile tab on Device A
2. Tap "Sign out"
3. Confirm redirection to the login screen
4. Confirm the diary is cleared (no cached entries from previous user)

## Expected Results

| Step | Expected |
|------|----------|
| 1    | Authenticated, onboarding shown on first login |
| 2    | Entry visible immediately (local write) |
| 3    | Row in Supabase meal_entries table |
| 4    | Entry visible on Device B within 5 s of reconnect |
| 5    | Diary empty on Device A after sign-out |

## Failure Modes to Watch

- COOP header blocks OAuth redirect → check vercel.json `Cross-Origin-Opener-Policy`
- Supabase CORS error → check `connect-src` in vercel.json CSP
- Entry not synced → check syncQueue table in IndexedDB (DevTools > Application > IndexedDB)
- Duplicate entries → check `onConflict: "id"` in syncService flush()
