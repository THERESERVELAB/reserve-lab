# Vercel Production Deployment — Reserve Lab Runbook

Framework: **Next.js 16** (App Router). No `vercel.json` needed — the Next preset is sufficient. No custom build settings required.

## 0. Prerequisites (owner, one-time)
- A Supabase project (URL, anon key, service-role key) with migrations applied — see `SUPABASE_SECURITY_VERIFICATION.md`.
- A Google Cloud OAuth web client — see `GOOGLE_OAUTH_ACTIVATION.md`.
- GitHub repo `THERESERVELAB/RESERVE-LAB` connected to Vercel.

## 1. Import the repository
Vercel → Add New → Project → import `THERESERVELAB/RESERVE-LAB`.
- Framework preset: **Next.js** (auto-detected).
- Build command: `next build` (default). Output: `.next` (default). Install: `npm install`.
- Root directory: repo root.

## 2. Environment variables

Set these in **Project → Settings → Environment Variables**. Never paste secrets into code, git, or this file.

| Variable | Scope | Environments | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | public | Production, Preview | project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | Production, Preview | anon key (RLS-safe) |
| `SUPABASE_SERVICE_ROLE_KEY` | **server-only** | Production, Preview | **do NOT** prefix `NEXT_PUBLIC_` |
| `NEXT_PUBLIC_APP_URL` | public | per-env | e.g. `https://www.thereservelab.com` (prod), preview URL for Preview |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, price ids | server | when billing goes live | optional |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | public | when billing goes live | optional |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | server | optional | AI routes degrade gracefully without |
| `NEXT_PUBLIC_ENABLE_DEMO_DATA` | — | **leave unset in production** | real members start with honest empty state |

After setting, locally sanity-check names (never values):
```bash
TARGET_ENV=production \
NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
npm run check:production-env      # exits 1 if a required name is missing or a secret is NEXT_PUBLIC_-exposed
```

## 3. Preview vs Production variables
- Configure **both** Preview and Production scopes. Preview deployments get their own URL — add its `/auth/callback` to Supabase redirect allowlist (step 5) or logins on previews will fail.
- Keep the service-role key identical across scopes only if they share one Supabase project; use separate projects for true prod isolation if desired.

## 4. Deploy a Preview
- Push `claude/production-online` (or open a PR) → Vercel builds a Preview automatically, or: `vercel` (CLI, from repo root) for an ad-hoc preview.
- Note the preview URL, e.g. `https://reserve-lab-<hash>.vercel.app`.

## 5. OAuth redirect URLs (Supabase → Authentication → URL Configuration)
Add every origin that will complete a login:
- Site URL: `https://<production-domain>`
- Redirect allowlist:
  - `http://localhost:3000/auth/callback`
  - `https://<preview>.vercel.app/auth/callback`
  - `https://<production-domain>/auth/callback`

Google Cloud → Credentials → your web client → **Authorized redirect URIs** must include the Supabase callback (NOT the app callback):
- `https://<project-ref>.supabase.co/auth/v1/callback`

## 6. Verify the Preview
1. `GET https://<preview>/api/health` → `{ "status":"ok", "supabaseConfigured":true, "authConfigured":true }` (no secrets in the body).
2. Sign in with Google → lands on `/auth/callback` → returns to `/` authenticated.
3. Make a change (e.g. onboarding, a schedule) → status reaches **Saved** only after cloud confirm.
4. Refresh → state restores from cloud.
5. Log out → private state cleared; a second Google account sees only its own data.
6. Console + Network: no errors, no failed member_state requests, no secret in any response.

## 7. Promote to Production
- Vercel → Deployments → the verified preview → **Promote to Production** (or merge to `main` once Codex work is integrated and the branch is rebased/validated).
- Re-run the step-6 checks against the production domain.

## 8. Custom domain
- Vercel → Settings → Domains → add `www.thereservelab.com` → set DNS as instructed.
- Update Supabase **Site URL** and redirect allowlist to the production domain.
- Update `NEXT_PUBLIC_APP_URL` (Production scope) to the production domain; redeploy.

## 9. Health & monitoring
- Uptime check: `GET /api/health` (200 + `status:"ok"`). It is `no-store` and reveals no secrets.
- `supabaseConfigured:false` in production ⇒ env vars missing ⇒ the app shows the configuration-required gate (fails closed).

## 10. Rollback
- Vercel → Deployments → pick the last-good production deployment → **Promote to Production** (instant rollback).
- If a bad migration shipped: restore via Supabase point-in-time recovery / re-run a corrective migration. Never edit already-applied migration files in place.

## Notes
- Auth is **client-gated** (`AppShell`), not middleware. Unauthenticated users briefly see the restore/entry screen, never member content. Adding `middleware.ts` for edge redirects is optional and out of scope for this pass.
- This branch is isolated from Codex's feature tree; rebase onto the latest `origin/main` before promoting (see the audit's delivery section).
