# RESERVE LAB — Production Deployment Guide

Target stack: **Vercel** (Next.js 16) + **Supabase** (Auth with Google OAuth, Postgres with RLS).

Everything code-side is already in the repository. This guide is the exact
dashboard/CLI sequence to take it live. Estimated owner time: ~30–45 minutes.

---

## 1. Supabase project

1. Go to <https://supabase.com/dashboard> → **New project**.
   - Name: `reserve-lab-prod` (any region close to your members).
   - Save the database password in a password manager.
2. Once provisioned, open **Project Settings → API** and copy:
   - **Project URL** → will become `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY` (server-only; never
     goes in any `NEXT_PUBLIC_*` variable, never in the browser)

## 2. Run the database migrations

Option A — SQL editor (fastest): open **SQL Editor** in the dashboard and run
the contents of each file in order:

```
supabase/migrations/0001_foundation.sql
supabase/migrations/0002_intelligence_engine.sql
supabase/migrations/0003_value_engine.sql
supabase/migrations/0004_product_completion.sql
supabase/migrations/0005_member_state.sql   ← required for launch (cloud member state + RLS)
supabase/migrations/0006_real_data_foundations.sql ← required for identity, relationships, deletion, and private Storage
```

Option B — Supabase CLI:

```powershell
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push
```

Verify: **Table Editor → member_state** exists and shows RLS **enabled** with
four policies (select/insert/update/delete, all `authenticated`, all `auth.uid() = user_id`).

## 3. Google Cloud OAuth credentials

1. <https://console.cloud.google.com> → create (or pick) a project → **APIs &
   Services → OAuth consent screen**:
   - User type: External. App name: `Reserve Lab`. Add your support email.
   - Scopes: the default `openid`, `email`, `profile` are sufficient.
   - Publish the app (or add your Google account as a test user while testing).
2. **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type: **Web application**, name `Reserve Lab Web`.
   - **Authorized JavaScript origins**:
     - `http://localhost:3000`
     - `https://<your-project>.vercel.app` (and your custom domain later)
   - **Authorized redirect URIs** (this is the Supabase callback, NOT the app):
     - `https://<project-ref>.supabase.co/auth/v1/callback`
3. Copy the **Client ID** and **Client secret**.

## 4. Enable Google in Supabase Auth

1. Supabase dashboard → **Authentication → Providers → Google**:
   - Enable, paste Client ID + Client secret. Save.
2. **Authentication → URL Configuration**:
   - **Site URL**: `https://<your-project>.vercel.app` (or custom domain).
   - **Redirect URLs** — add both app callbacks:
     - `http://localhost:3000/auth/callback`
     - `https://<your-project>.vercel.app/auth/callback`

Flow recap: app → Google → `https://<project-ref>.supabase.co/auth/v1/callback`
→ back to `<origin>/auth/callback` (the app's restoration page) → `/`.

## 5. Vercel project

1. <https://vercel.com/new> → import the GitHub repo `THERESERVELAB/RESERVE-LAB`.
   - Framework preset: Next.js (auto). Build command `next build` (default).
2. **Environment Variables** (Production + Preview):

   | Variable | Value | Notes |
   |---|---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | from step 1 | browser-safe |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | from step 1 | browser-safe (RLS enforces access) |
   | `SUPABASE_SERVICE_ROLE_KEY` | from step 1 | **server-only secret** |
   | `NEXT_PUBLIC_APP_URL` | the deployment URL | |
   | `NEXT_PUBLIC_ENABLE_DEMO_DATA` | *(leave unset)* | `true` only on demo deployments |
   | `NEXT_PUBLIC_ENABLE_SAFETY_TOOLS` | *(leave unset until clinician and counsel sign-off)* | Launch switch. Unset or `false` hides Cycle & Safety, the Bloodwork safety panel and "What this measures" in production builds. Set `true` (Preview first) and **redeploy** to turn them on — the value is read at build time. |
   | `RESERVE_OWNER_USER_IDS` | the founder's Supabase user id (Authentication → Users) | **Server-only.** Comma-separated user ids that get Owner Mode. Email addresses are ignored. Read per request, so no rebuild is needed after changing it. |
   | `RESERVE_DEV_OWNER` | *(never set on Vercel)* | Local development only. Ignored in production builds and whenever Supabase is configured. |

   Stripe/OpenAI variables are optional — every dependent route degrades
   gracefully until they're configured.
3. Deploy. Note the production URL and back-fill it into: Google **Authorized
   JavaScript origins**, Supabase **Site URL** + **Redirect URLs**, and
   `NEXT_PUBLIC_APP_URL`. Redeploy after env changes.

## 6. Local development against the real project

```powershell
# .env.local (never committed — .gitignore covers .env*)
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

`npm run dev` → `http://localhost:3000` now shows the Reserve entry gate.
Without these variables, development runs in **Local Mode** (full app,
device-local persistence, "Local Copy" sync chip) — and a **production** build
without them refuses to serve the app (configuration-required screen).

## 7. Smoke test (after first deploy)

1. Open the production URL logged out → Reserve entry screen renders; no
   member data is reachable.
2. **Continue with Google** → Google consent → lands on `/auth/callback`
   ("Securing your session") → onboarding (new account).
3. Complete onboarding → Apex Command; sync chip cycles Saving… → **Saved**.
4. Log a sleep entry, complete a session, save a custom plan → each flushes
   (watch the chip; confirm the `member_state` row's `updated_at` advances in
   the Table Editor).
5. Refresh → session restores directly into Apex Command.
6. Open a private window, sign in with the same account → "Restoring your
   Reserve profile" → identical state (cloud → fresh device hydration).
7. Sign out → final save, local data cleared, back to entry screen.
8. DevTools → Network offline → make a change → chip shows **Offline · Local
   Copy**; go online → auto-flush → **Saved**.
9. Verify a brand-new account sees EMPTY recovery/physique history (no demo
   records).
10. Console: no errors. Application → Local Storage: no tokens beyond the
    Supabase session (`sb-<ref>-auth-token`), which is expected for this flow.

## 8. Rollback

- **App**: Vercel → Deployments → previous deployment → **Promote to
  Production** (instant).
- **Env vars**: restore the previous value and redeploy.
- **Database**: migration 0005 is additive (one new table). Emergency
  reversal: `drop table public.member_state;` — member data remains in each
  device's localStorage (local-first design), so a re-created table repopulates
  on next login. Never drop the 0001–0004 tables.
- **Auth**: disabling the Google provider in Supabase instantly locks the
  entry gate (members keep local copies; nothing is lost).

## 9. Known post-launch hardening (tracked, not blocking)

- Move `/api/logging/*` + `/api/session/*` onto authenticated user identity
  (they currently no-op to `local_only` and must stay that way until then).
- `@supabase/ssr` middleware for server-verified sessions (today the private
  surface is 100% client-rendered; RLS is the data boundary).
- Real Terms of Service / Privacy Policy documents to replace entry-screen
  placeholders.
- Stripe live billing wiring.
