# Reserve Lab — Owner Launch Checklist

Exact steps to take Reserve Lab live. **Legend:** 🧑 = owner does this in an external dashboard (only you can); 🤖 = already done in code / an agent-runnable command.

The code is production-ready and validated (lint, typecheck, build, route-auth all green). What remains is **external configuration** — no code change is required to launch.

---

## A. Supabase 🧑
1. 🧑 Create or select a Supabase project (https://supabase.com/dashboard).
2. 🧑 Project → Settings → API → copy the **Project URL**.
3. 🧑 Copy the **anon public** key.
4. 🧑 Copy the **service_role** key (server-only; needed for Stripe webhooks, anonymous analytics/lead inserts, entitlement admin — not for member data).
5. 🧑 Apply every migration in order. Either:
   - CLI: `supabase link --project-ref <ref>` then `supabase db push`, or
   - Dashboard → SQL Editor → run `supabase/migrations/0001…0006` in order.
6. 🧑 Confirm the `member_state` table exists (Database → Tables).
7. 🧑 Confirm RLS is enabled on `member_state` (Database → Policies → toggle shows enabled).
8. 🧑 Confirm the own-row policies exist: `member_state_select_own`, `member_state_insert_own`, `member_state_update_own` (all `auth.uid() = user_id`). Full reference: `docs/SUPABASE_SECURITY_VERIFICATION.md`.
9. 🧑 Authentication → Providers → enable **Google** (configured in section B).
- 🤖 Verify isolation after B/C with real accounts: `node scripts/verify-rls.mjs` (needs two disposable test accounts; see the security doc).

## B. Google Cloud 🧑
1. 🧑 OAuth consent screen: External; app name, support email; scopes `email`, `profile`, `openid`; publish (or add test users).
2. 🧑 Credentials → Create OAuth client ID → **Web application**.
3. 🧑 Authorized redirect URI — the **Supabase** callback:
   `https://<project-ref>.supabase.co/auth/v1/callback`
4. 🧑 Copy the **Client ID** and **Client Secret** into Supabase → Authentication → Providers → Google.
5. 🧑 Authorized JavaScript origins: `http://localhost:3000`, your preview domain, your production domain.

## C. Supabase Authentication URLs 🧑
Authentication → URL Configuration:
1. 🧑 Site URL: `https://<production-domain>`
2. 🧑 Redirect allowlist (the **app** callbacks):
   - `http://localhost:3000/auth/callback`
   - `https://<preview-domain>/auth/callback`
   - `https://<production-domain>/auth/callback`

## D. Vercel 🧑
1. 🧑 Import `THERESERVELAB/RESERVE-LAB` (https://vercel.com/new).
2. 🧑 Framework preset: **Next.js** (auto-detected).
3. 🧑 Environment Variables (Production **and** Preview scopes):
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (public)
   - `SUPABASE_SERVICE_ROLE_KEY` (server-only — do NOT prefix `NEXT_PUBLIC_`)
   - `NEXT_PUBLIC_APP_URL` (the deployment's own URL, per scope)
   - Leave `NEXT_PUBLIC_ENABLE_DEMO_DATA` **unset**.
   - 🤖 Sanity-check names before deploy: `npm run check:production-env` (with the vars set; fails closed if a required name is missing or a secret is `NEXT_PUBLIC_`-exposed).
4. 🧑 Deploy a Preview (push a branch or `vercel`).
5. 🧑 Add the preview's `/auth/callback` to the Supabase redirect allowlist (section C).
6. 🧑 Test Google login on the preview (full checklist in section E).
7. 🧑 Promote the verified preview to Production.
8. 🧑 Add the final custom domain (Vercel → Settings → Domains) and set DNS.
9. 🧑 Update Supabase **Site URL** + redirect list to the production domain; update `NEXT_PUBLIC_APP_URL` (Production) and redeploy.
- 🤖 Health check any deployment: `GET /api/health` → `{status:"ok", supabaseConfigured:true, authConfigured:true}` (no secrets).

## E. Verification (real member data) 🧑
Run against the preview, then production:
1. 🧑 Log in as **User A** (Google).
2. 🧑 Complete onboarding.
3. 🧑 Modify a program day (Build Studio / Program Command).
4. 🧑 Confirm the status reaches **Saved** (only after cloud confirm).
5. 🧑 Refresh the page.
6. 🧑 Confirm the change is restored from the cloud.
7. 🧑 Log out.
8. 🧑 Log in as **User B** (a different Google account).
9. 🧑 Confirm **none** of User A's data is visible.
10. 🧑 Return to User A.
11. 🧑 Confirm User A's data restores intact.
- 🤖 Optional automated isolation proof: `node scripts/verify-rls.mjs` with two test accounts.

---

## What's already guaranteed by code (no action needed) 🤖
- Auth is PKCE; production without config fails closed (config-required screen, never a local member experience).
- Member cloud reads/writes use the anon key + the member's session + RLS — one row per user, "Saved" only after cloud confirm, backup-before-hydrate, single reconnect flush.
- **No member API route trusts a client-supplied `userId`** — every privileged route derives the user from a verified bearer token (401 without one, 403 on mismatch). Proven by `scripts/verify-route-auth.mjs` (9/9).
- The service-role key is `server-only`, never in the browser bundle, never in `/api/health`, never `NEXT_PUBLIC_`.

## Still true regardless of this checklist
- Whole-document conflict model is newest-wins (fine for launch); normalize high-growth logs before scale (`docs/DATA_STORAGE_EVOLUTION.md`).
- `member_state` has no DELETE policy yet — add one when account deletion ships.
