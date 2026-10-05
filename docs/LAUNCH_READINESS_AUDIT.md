# RESERVE LAB — Launch Readiness Audit

**Date:** 2026-07-13
**Audited at commit:** `6d2133d` (main, pushed)
**Method:** every claim below was verified against the actual code and configuration — not inferred from docs or file presence.

---

## 1. Current Authentication State

**There is no working authentication.** What exists:

- `src/app/api/auth/session/route.ts` — returns **static metadata** (provider list + lifecycle stage names). It does not create, read, or validate any session.
- `src/app/api/auth/bootstrap/route.ts` — POST endpoint that upserts a `profiles` row via the **admin (service-role) client**, falling back to a `local_fallback` in-memory response when Supabase is unconfigured. Nothing calls it from the UI.
- `src/lib/auth/lifecycle.ts` — `ensureUserProfile` / `assignSubscriptionTier` helpers plus an `AUTH_PROVIDERS` map (email/google/apple flagged "enabled" — aspirational, none are wired).
- **No login UI, no OAuth flow, no callback route, no session persistence, no logout, no middleware.** `middleware.ts` does not exist.
- The app shell (`src/components/AppShell.tsx`) gates only on `onboarding.status !== "complete"` read from localStorage. Anyone loading the page gets the full app.
- `@supabase/supabase-js` v2.106 is installed. `@supabase/ssr` is **not** installed.

## 2. Current Supabase Usage

- `src/lib/supabase/client.ts` — browser client factory; **returns `null`** when `NEXT_PUBLIC_SUPABASE_URL` / `ANON_KEY` are missing.
- `src/lib/supabase/server.ts` — server (anon) + admin (service-role) factories, same null-fallback pattern, `server-only` guarded.
- ~28 files import these helpers: API routes for logging (training/nutrition/recovery/backfill), session lifecycle (start/set/swap/complete), physique check-ins, community, analytics, leads, entitlements, Stripe subscriptions, retention, AI routes.
- **Every route degrades to `local_only` / `local_fallback` mode today** because the env vars are empty (verified: all three values in `.env.local` have length 0). The Supabase scaffold is real but completely dormant.
- Route auth gap: logging routes accept an **optional** `userId` in the request body and perform no caller verification (`userId: z.string().uuid().optional()` in `src/lib/logging/schemas.ts`). Comments in the routes acknowledge this: "Auth integration: Phase 4 (Supabase auth not yet wired)." With RLS on and no user JWT these writes would fail anyway — but these routes must not be pointed at real data without attaching the caller's identity server-side.

## 3. Database Tables and Migrations

`supabase/migrations/` contains 4 migrations that have **never been applied to any project** (no project is configured):

- `0001_foundation.sql` — 29 tables: profiles, onboarding_profiles, user_preferences, subscriptions, user_entitlements, digital_twin_snapshots, body_metrics, muscle_scores, weak_points, progress_photos, transformation_snapshots, mesocycles, training_sessions, exercise_logs, nutrition_logs, bloodwork_logs, supplement_logs, retention_snapshots, engagement_events, upgrade_intents, community_* (5), ai_analysis_outputs, lead_captures, referrals, affiliate_attributions. RLS policies included.
- `0002_intelligence_engine.sql` — intelligence_outputs, training_prescriptions.
- `0003_value_engine.sql` — todays_commands, active_sessions, session_sets, progression_snapshots, digital_athlete_snapshots, physique_checkins, nutrition_commands, recovery_commands.
- `0004_product_completion.sql` — recovery_logs.

All have RLS enabled with per-user policies. Typed as `Database` in `src/lib/database/types.ts`.

**Assessment:** this is a wide normalized schema designed for a server-written architecture the app does not use. The app's real state lives in one Zustand store. Launch does **not** require wiring 40 tables — it requires one authoritative `member_state` row per user (Phase 4 of the launch plan), with the normalized tables remaining a later evolution.

## 4. Environment Variables

- `.env.local` exists with exactly three keys, **all empty**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- `.env.example` exists on disk with the full expected set (Supabase ×3, Stripe ×6, OpenAI ×2, `NEXT_PUBLIC_APP_URL`) but is **not tracked** — the `.env*` gitignore pattern swallows it. It should be force-added as the template.
- Env access is centralized and zod-validated (`src/lib/env/client.ts`, `src/lib/env/server.ts`) with empty-string → undefined preprocessing and `getIntegrationStatus()` reporting. Good foundation; nothing hardcoded.

## 5. Zustand / localStorage Inventory

**Primary store:** `src/lib/athlete-store.ts` (3,171 lines) — single `persist` store, key `final-boss-athlete-settings`, **version 14**, with `migrate` + custom `merge`. The `partialize` list persists 28 slices: profile, subscriptionTier, onboarding, settings, engagement, trainingSession, nutritionPrefs, setupProfile, womens, modulePreferences, recoveryCommand, scheduleProfile, physiqueCommand, userTrainingProfile, activeProtocol, splitSystem, activityStack, activitySport, reserveAthleteFacilities, trainingExperience, coreTiming, movementPreferences, movementFeedback, bloodworkLogs, trainingOverrides, customPlans, activeCustomPlanId, customMeals, hydrationFavorites, hydrationDrinkLogs, completedChallengeKeys.

**Other localStorage users:**
- `src/lib/logging/store.ts` — offline log mirror.
- `src/lib/analytics/offline-queue.ts` — analytics event queue.
- `src/components/apex/WeeklyChallengeCard.tsx`, `src/components/views/TrainingView.tsx` — small UI keys (incl. dev-only `fba-preview-view`).

## 6. What Already Survives Refresh Locally

Everything in the partialize list above (the entire member experience: onboarding, protocol, splits, training overrides, custom plans/meals, hydration/sleep logs via recoveryCommand, bloodwork logs, preferences, challenge completions). Zustand versioned migration (v14) is battle-tested in this codebase.

## 7. What Must Sync to the Authenticated User

The persisted slice set **is** the cloud-safe contract, minus transient members nested inside slices (active drawer state lives outside persist already). Explicitly cloud-synced: onboarding/profile, protocol + progress, training history/overrides, active-session recovery data, custom plans, custom meals, nutrition prefs, hydration logs, sleep/recovery logs, Reserve Athlete facilities, module/menu preferences, challenge completions, measurements + photo **metadata**, bloodwork logs. Stays local: analytics queue, UI keys, dev/preview keys, binary image content (photos are metadata-only in state today).

## 8. Routing and App-Shell Gates

- Single route `/` (`src/app/page.tsx` → `AppShell` → `ViewRouter`); all "pages" are client-side views switched by `activeView` in the store.
- Gates today: onboarding-incomplete → `OnboardingWizard`; tier gating via `LockedPremiumModule` per view. **No auth gate of any kind.**
- Consequence for auth design: there is no server-rendered private data — the entire private surface is client state. A client-side auth gate in the shell + RLS on the database is a sound and honest MVP; middleware/SSR session hardening can come later.

## 9. Deployment Blockers

1. **No Supabase project configured** — all three env values empty. (Dashboard action — owner.)
2. **No Google OAuth credentials** — Google Cloud console setup required. (Owner.)
3. **No auth implementation in code.** (This session — Phase 3.)
4. **No cloud persistence for the real state model.** (This session — Phases 4–6.)
5. **No `typecheck` script** in package.json despite the validation matrix requiring it. (This session.)
6. `.env.example` untracked → Vercel setup has no committed variable template. (This session.)
7. Migrations never executed against any database. (Owner, guided by DEPLOYMENT_GUIDE.)

## 10. Security Risks

1. **Logging/session API routes trust client-supplied `userId`** with no caller verification. Must not go live against real data until they derive identity from the session. (Mitigated at DB level by RLS + anon key, but the contract is wrong.)
2. **Service-role key usage:** `createSupabaseAdminClient` is `server-only` and never bundled client-side (verified imports) — correct. Keep it that way; `/api/auth/bootstrap` bypasses RLS by design and must validate the caller's JWT before launch or be removed from the live path.
3. **Fabricated seed data:** `seedSampleRecovery()` in `src/lib/recovery/types.ts` bakes 7 days of fake sleep/hydration/mobility/stress logs into every new member's default state. Dishonest for production and contaminates the recovery engine. (Phase 7.)
4. `.claude/settings.local.json` is tracked in git — contains only tool permission allowlists (no secrets, verified) but is developer-local by convention.
5. No secrets in git: `.env*` ignored, secret-pattern scan of the new commits clean.

## 11. Fastest Credible Path to Production

1. **Auth (code, now):** Supabase Auth + Google OAuth via the existing browser client (PKCE, `detectSessionInUrl`), a Reserve login screen in the app shell, `/auth/callback` restoration page, logout, error + unconfigured states. No custom auth, no new deps required.
2. **Persistence (code, now):** one `public.member_state` row per user (`user_id` PK → `auth.users`, `state jsonb`, `schema_version`), strict RLS, new migration `0005_member_state.sql`. The Zustand persist contract (v14 partialize) is serialized as-is with version + timestamp metadata.
3. **Sync (code, now):** hydrate-once-after-auth → safe local/cloud merge (never clobber populated local with empty cloud; local backup before migration) → debounced writes + explicit flush points → subtle sync indicator.
4. **Dashboards (owner, ~30 min):** create Supabase project → run migrations → enable Google provider (Google Cloud OAuth client) → set 3 env vars in Vercel + locally → deploy.
5. **Later (not launch-blocking):** middleware session hardening, moving API logging routes onto authenticated identity, decomposing `member_state` into the normalized tables, Stripe live wiring.
