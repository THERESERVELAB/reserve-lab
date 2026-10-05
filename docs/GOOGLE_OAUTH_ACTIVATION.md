# Google OAuth Activation — Reserve Lab

The app already implements the full PKCE round trip (`AuthProvider.signInWithGoogle` → Supabase → `/auth/callback`). This is the **external dashboard configuration** that makes it work. No code changes required. No secret goes in the repo.

## A. Google Cloud Console
1. Create/select a project → **APIs & Services → OAuth consent screen**.
   - User type: External. App name, support email, developer email. Add scopes `email`, `profile`, `openid`. Publish (or add test users while in testing).
2. **APIs & Services → Credentials → Create Credentials → OAuth client ID**.
   - Application type: **Web application**.
   - **Authorized JavaScript origins:**
     - `http://localhost:3000`
     - `https://<preview>.vercel.app`
     - `https://<production-domain>`
   - **Authorized redirect URIs** (the **Supabase** callback, not the app's):
     - `https://<project-ref>.supabase.co/auth/v1/callback`
   - Save → copy the **Client ID** and **Client Secret** (used only in Supabase, step B).

## B. Supabase Dashboard
1. **Authentication → Providers → Google** → enable.
   - Paste the Google **Client ID** and **Client Secret**. Save.
2. **Authentication → URL Configuration**:
   - **Site URL:** `https://<production-domain>`
   - **Redirect URLs** (allowlist — the **app** callbacks):
     - `http://localhost:3000/auth/callback`
     - `https://<preview>.vercel.app/auth/callback`
     - `https://<production-domain>/auth/callback`

## C. App / Vercel
- Ensure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set (Preview + Production). The app derives the redirect from `window.location.origin`, so no OAuth env var is needed app-side.

## D. Verify the real round trip (not just redirect initiation)
A GO requires all of these, in order:
1. Click **Continue with Google** → Google account chooser appears.
2. Choose an account → Google → `https://<project-ref>.supabase.co/auth/v1/callback` → app `/auth/callback`.
3. Session is created; the app returns to `/` authenticated (not the entry screen).
4. Cloud member state restores (or a new row is created for a brand-new account).
5. **Refresh** → still signed in, state intact.
6. **Log out** → returns to entry; private state cleared.
7. **Second login** (different account) → sees only its own data.
8. Error handling: cancel at Google, or a reused/expired code → app `/auth/callback` shows the "Sign-in didn't complete" screen with a Back action (verified in `callback/page.tsx`).

## Status
**EXTERNAL CONFIG REQUIRED — not executed here.** No Supabase project or Google client exists in this environment (all Supabase env values are empty). Once A–C are done, run the D checklist against the preview URL, then production.
