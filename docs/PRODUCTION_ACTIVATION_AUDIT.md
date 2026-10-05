# Reserve Lab — Production Activation Audit

**Agent:** Claude production-activation agent (parallel to Codex feature work)
**Branch:** `claude/production-online` · **Worktree:** `C:\Users\antho\reserve-lab-production-agent`
**Base commit:** `a2ff611` (origin/main at audit start)
**Method:** live code-path tracing, not file-existence. Findings are evidence-based with file:line references.

## Classification legend

| Tag | Meaning |
|---|---|
| ✅ VERIFIED | Traced in code and correct |
| 🟡 NON-BLOCKING | Works; improvement optional |
| 🟠 HIGH RISK | Should fix before public launch; not on the core member-data path |
| 🔴 BLOCKING | Must fix before a production GO |
| 🔑 EXTERNAL CONFIG REQUIRED | Blocked on a credential/dashboard step only the owner can do |

---

## Executive summary

The **core member-data path is production-grade**: authenticated members read/write a single `public.member_state` row through the **anon key + their session + Row Level Security** (`src/lib/sync/sync-engine.ts`), never the service role. Secret hygiene is clean — no secret in git history, no `NEXT_PUBLIC_` secret, service role is `server-only`. Auth gating fails closed in production.

The one code-level security blocker (B2 — service-role API routes trusting a client-supplied `userId`) is now **RESOLVED** on this branch (§6): every member route derives the user from a verified bearer token, proven by `scripts/verify-route-auth.mjs` (9/9). **A production GO is now blocked only by external configuration** (no Supabase credentials / OAuth / Vercel project exist yet — the 🔑 items).

Verdict: **NO-GO — pending external activation only.** Every locally actionable task, including the B2 fix, is complete and validated (lint, typecheck, build, route-auth all green).

---

## 1. Authentication — ✅ VERIFIED (live round-trip 🔑 EXTERNAL)

Traced: `src/components/AppShell.tsx` → `src/components/auth/AuthProvider.tsx` → `src/app/auth/callback/page.tsx` → `src/lib/supabase/client.ts`.

| Item | Result | Evidence |
|---|---|---|
| OAuth uses PKCE | ✅ | `flowType: "pkce"` — client.ts:23 |
| Single shared browser client | ✅ | memoized singleton `getBrowserSupabaseClient()` — client.ts:36-42 (code exchange, session, and RLS queries all agree) |
| Redirect target | ✅ | `${window.location.origin}/auth/callback` — AuthProvider.tsx:128 (origin-derived, no open redirect) |
| Callback error handling | ✅ | reads `?error`/`?error_description`, 12s timeout, unconfigured guard — callback/page.tsx:24-67 |
| No private-content flash | ✅ | `AuthenticatedShell` renders restore screens for `resolving`/`restoring`/`signing-out` before `MemberShell` — AppShell.tsx:34-44 |
| Logout flushes pending writes | ✅ | `await stopMemberSync({ flush: true })` before signOut — AuthProvider.tsx:145 |
| Logout clears private state | ✅ | `backupLocalState("sign-out")` + `resetMemberStateToDefaults()` + removes `fba-sync-meta` — AuthProvider.tsx:151-157 |
| Account switch isolation | ✅ | sync engine cross-user guard backs up + resets when `meta.userId !== e.userId` — sync-engine.ts:268-278 |
| Listener cleanup | ✅ | `subscription.unsubscribe()` + `cancelled` flag on unmount — AuthProvider.tsx:112-115 |
| No duplicate providers/listeners | ✅ | single `AuthProvider` at `AppShell`; `syncStartedFor` ref guards double-start — AuthProvider.tsx:59,77 |
| Production fail-closed | ✅ | unconfigured + production → `ReserveConfigRequired`, NOT a local member experience — AppShell.tsx:34-38 |

🔑 **EXTERNAL** — a real Google → Supabase → app login cannot be executed here: no Supabase project credentials are configured (all three keys empty in `.env.local`). Exact dashboard steps: `docs/GOOGLE_OAUTH_ACTIVATION.md`.

## 2. Environment & secret safety — ✅ VERIFIED

| Check | Result | Evidence |
|---|---|---|
| Secrets in git history | ✅ none | history scan surfaced only variable *names*, never values |
| `.env*` ignored (except template) | ✅ | `.gitignore` `.env*` + `!.env.example`; `git ls-files` → only `.env.example` |
| `.next`, `.vercel` ignored | ✅ | `.gitignore` |
| Service role never `NEXT_PUBLIC_` | ✅ | only `SUPABASE_SERVICE_ROLE_KEY` (server) — env/server.ts:16 |
| Service role is `server-only` | ✅ | `import "server-only"` — supabase/server.ts:1 |
| Client never imports admin client | ✅ | `createSupabaseAdminClient` appears only under `src/lib/**` + `src/app/api/**` (server) |
| Member reads/writes use anon+RLS | ✅ | `member_state` upsert/select via `getBrowserSupabaseClient()` — sync-engine.ts:154,172,247 |
| `.env.example` = names only | ✅ | no values |

Tooling added this pass: `scripts/check-production-env.mjs` (`npm run check:production-env`) — validates required public names, flags any `NEXT_PUBLIC_`-exposed secret, **fails closed (exit 1) only for a production target**.

## 3. Supabase migrations & RLS — ✅ VERIFIED (apply 🔑 EXTERNAL)

Migrations `0001`–`0005` (see `docs/SUPABASE_SECURITY_VERIFICATION.md` for full policy list).

| Check | Result |
|---|---|
| `member_state` shape matches spec (user_id PK → auth.users on delete cascade, state jsonb, schema_version, created/updated_at) | ✅ 0005:9-15 |
| RLS enabled on member_state | ✅ 0005:17 |
| select/insert/update own-row policies, `to authenticated`, `auth.uid() = user_id` | ✅ 0005:21-38 |
| insert + update carry `WITH CHECK` | ✅ 0005:31,38 |
| `updated_at` server-authoritative via `security definer` trigger | ✅ 0005:42-58 |
| Domain tables (profiles, physique_checkins, …) have own-row RLS | ✅ 0001:480-485, 0003:126-127 |
| Anon policies are scoped, not blanket | ✅ analytics/upgrade-intent inserts guard `user_id is null or auth.uid() = user_id`; lead-capture is insert-only |
| No `DELETE` policy on member_state | 🟡 by design — see note |

🟡 **member_state has no DELETE policy.** Members can't delete their cloud row (account-deletion/GDPR erasure). Non-blocking for launch; add a `for delete to authenticated using (auth.uid() = user_id)` policy when account deletion ships. Documented in the security doc.

🔑 **EXTERNAL** — migrations are not applied to a live project here (no credentials). Apply steps in `docs/SUPABASE_SECURITY_VERIFICATION.md` + `docs/VERCEL_PRODUCTION_DEPLOYMENT.md`.

## 4. Cloud save path — ✅ VERIFIED (live write 🔑 EXTERNAL)

Traced `src/lib/sync/sync-engine.ts` end to end.

| Property | Result | Evidence |
|---|---|---|
| One row per user | ✅ | `upsert(..., { onConflict: "user_id" })` — :174-181 |
| "Saved" only after cloud confirm | ✅ | `markSaved` only in the upsert success branch — :205 |
| Debounced, non-looping writes | ✅ | 2.5s debounce; hash-equality short-circuits no-op churn — :162-166 |
| Hydration echo guard | ✅ | `applyingCloud` suppresses store→push during cloud apply — :119,286-291 |
| Local backup before destructive hydrate | ✅ | `backupLocalState("pre-hydrate")` — :285 |
| Never overwrites populated local with empty cloud | ✅ | `hasMeaningfulProgress` gates all four merge branches — :308-317 |
| Bounded retry backoff | ✅ | `[5s,15s,45s,90s]` capped — :37,129-137 |
| Stale-after-logout writes discarded | ✅ | generation token invalidates in-flight completions — :185,419 |
| Offline keeps edits local, single reconnect flush | ✅ | `navigator.onLine` guard + `online` listener → `flushNow` — :149,388 |
| Restore failure never destroys local | ✅ | error path sets status only, touches nothing local — :255-260,341-346 |

🔑 **EXTERNAL** — a real authenticated upsert + refresh-restore cannot be executed without credentials. The code path is fully verified; the network leg is credential-blocked.

## 5. Local↔cloud migration — ✅ VERIFIED (logic) / 🔑 (live)

Four documented branches, each with a backup of the losing side (sync-engine.ts:307-340):
- local-only progress → upload; cloud-only → hydrate; both empty → create row; both populated → **newest-wins by `updated_at` vs local change marker**, backing up the loser.
- Different account detected locally → back up, reset, hydrate only the new user's row (:268-278).

🟡 **Conflict model is whole-document newest-wins**, not per-field merge. Correct and safe for single-active-device use; two devices editing between syncs means the older device's unsynced delta is backed up locally but not merged. Called out honestly in `docs/DATA_STORAGE_EVOLUTION.md`.

## 6. Service-role API routes — ✅ RESOLVED (was 🔴 BLOCKING B2)

**Original defect:** 18 member routes persisted/read data under a **client-supplied `userId`** through a service-role or admin path that bypasses RLS — a classic IDOR (`GET /api/checkins/physique?userId=<any-uuid>` returned that user's data; the AI/session routes wrote under any supplied id when `persist:true`).

**Fix (this branch, commit set below):** a centralized server auth guard now derives the acting user from a **verified Supabase bearer token** — never from the request body/query.
- New `src/lib/supabase/route-auth.ts` (`server-only`): `resolveRequestUserId` verifies the `Authorization: Bearer <jwt>` via `supabase.auth.getUser(token)`; `requireRequestUserId` → 401; `rejectUserIdMismatch` → 403.
- New `resolvePersistUserId` in `src/lib/ai/route-helpers.ts`: AI routes persist **only** under the verified user, else compute-only (`persisted:false`). Anonymous/local requests still work; cross-user writes are impossible.
- Hardened routes (18): 12 `/api/ai/*`, 4 `/api/session/*`, `/api/checkins/physique` (GET+POST), `/api/auth/bootstrap`. The 7 direct-CRUD routes **authenticate before parsing** → 401 for any tokenless caller; `/api/auth/bootstrap` and check-in writes force the verified id.

**Evidence (live, no credentials needed):** `scripts/verify-route-auth.mjs` against a built server → **9/9 PASS**: all 7 protected routes return 401 without a token (even with a spoofed `userId`); the AI route computes for anonymous callers but never persists to Supabase; `/api/health` leaks no secret. `grep` confirms zero remaining `persist(parsed.data.userId)` / `.eq("user_id", parsed.data.userId)` patterns. Service-role key absent from `.next/static` (browser bundle).

**Note:** the persist helpers in `lib/ai/*` still use the admin client, but now only ever receive a **verified** id, so the IDOR is closed at the boundary. Migrating those writes to anon-key + RLS is a recommended future cleanup (defense-in-depth), not a launch blocker. The `logging/*` routes were already safe (they derive `user.id` from `getUser()`, never a body id).

## 7. Deployment config — 🟡 / 🔑

| Item | Result |
|---|---|
| `next.config.ts` | 🟡 default/empty — fine for Vercel; no `output` needed |
| `middleware.*` | 🟡 none — auth gating is client-side in `AppShell`. Acceptable for this SPA-style app; documented tradeoff (no server redirect, brief restore screen instead) |
| `vercel.json` | 🟡 absent — not required; Next preset on Vercel is sufficient. Runbook covers env + redirects |
| `/api/health` | ✅ added this pass — booleans only, no secrets |
| Health for uptime | ✅ `GET /api/health` → `{status, environment, supabaseConfigured, authConfigured, build}` |

🔑 Vercel import + env + OAuth redirect URLs are dashboard steps — `docs/VERCEL_PRODUCTION_DEPLOYMENT.md`.

---

## Blocker ledger

| # | Severity | Blocker | Owner | Status |
|---|---|---|---|---|
| B1 | 🔑 EXTERNAL | No Supabase project/credentials → no live auth, cloud write, or RLS proof | Owner (dashboard) | open |
| B2 | ~~🔴 BLOCKING~~ | Service-role API routes trust client `userId` (IDOR) | this branch | ✅ **RESOLVED** (§6; verify-route-auth 9/9) |
| B3 | 🔑 EXTERNAL | Google OAuth provider not configured in Supabase/Google | Owner (dashboard) | open |
| B4 | 🔑 EXTERNAL | No Vercel project/deploy | Owner (dashboard/CLI) | open |
| B5 | 🟡 | member_state has no DELETE policy (account erasure) | future migration | open (non-blocking) |

B2 (the only code-level blocker) is resolved. The remaining blockers are all external configuration only. Everything else is ✅ VERIFIED or produced/verified locally this pass.
