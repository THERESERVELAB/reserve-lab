# Supabase Security Verification — Reserve Lab

Exact policies protecting member data, how to apply them, and how to prove isolation.

## Tables that hold member data

| Table | Migration | RLS | Own-row policies |
|---|---|---|---|
| `public.member_state` (the live cloud state) | `0005` + `0006` | enabled | select / insert / update / delete, `to authenticated`, `auth.uid() = user_id` |
| `public.athlete_profiles` | `0006_real_data_foundations.sql` | enabled | own-row select/update; creation is trigger/admin-owned |
| `public.coach_client_relationships` | `0006_real_data_foundations.sql` | enabled | relationship parties may read; writes remain service-owned pending consent RPCs |
| `public.profiles` | `0001_foundation.sql` | enabled | insert / select / update, `auth.uid() = id` |
| `public.physique_checkins` | `0003_value_engine.sql` | enabled | `for all to authenticated`, `auth.uid() = user_id` |
| domain tables (body_metrics, training_sessions, nutrition_logs, bloodwork_logs, …) | `0001` | enabled (29 tables) | own-row, `to authenticated` |

## The authoritative table: `public.member_state`

```sql
create table if not exists public.member_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  state jsonb not null,
  schema_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.member_state enable row level security;

create policy member_state_select_own on public.member_state
  for select to authenticated using (auth.uid() = user_id);
create policy member_state_insert_own on public.member_state
  for insert to authenticated with check (auth.uid() = user_id);
create policy member_state_update_own on public.member_state
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy member_state_delete_own on public.member_state
  for delete to authenticated using (auth.uid() = user_id);
```

Why this is safe:
- **Default deny.** RLS enabled with no anon policy → anonymous requests get nothing.
- **`auth.uid() = user_id`** on every verb → a session can only touch its own row.
- **`WITH CHECK`** on insert *and* update → a member cannot write a row (or move a row) to another `user_id`.
- **`on delete cascade`** from `auth.users` → deleting the auth user removes their state.
- **Server-authoritative `updated_at`** via `security definer` trigger (`set_member_state_updated_at`) → clients cannot spoof the merge-comparison timestamp the sync engine relies on.

Migration `0006` adds the own-row DELETE policy used by the authenticated account-deletion flow.

## Private Storage

Migration `0006_real_data_foundations.sql` creates four non-public buckets and
owner-folder policies for select, insert, update, and delete. The required path
shape is `<auth.uid()>/<object>`. No public object URL is part of the contract;
account export creates short-lived signed links after request authentication.

## Anonymous policies (reviewed — all correctly scoped)

```sql
-- 0001_foundation.sql
"Anonymous analytics insert"    on engagement_events  for insert to anon, authenticated
    with check (user_id is null or auth.uid() = user_id);
"Anonymous upgrade intent insert" on upgrade_intents  for insert to anon, authenticated
    with check (user_id is null or auth.uid() = user_id);
"Anonymous lead capture insert" on lead_captures      for insert to anon, authenticated
    with check (true);   -- insert-only marketing capture; no read, no update
"community_channels_read_allowed" on community_channels for select to authenticated
    using (reserve_can_access_community_channel(id));
```
No anon **read** of member data. No `using (true)` on any member-owned table.
Private community channels and their messages require membership; tier channels
use the server-owned profile tier.

## Service-role API routes — hardened (B2 resolved)

RLS protects the **anon-key** path (the app's real member path). Routes that use the **service-role** admin client bypass RLS by design, so they must derive the user server-side. Previously several trusted a client-supplied `userId` (IDOR). **Fixed on this branch:**

- `src/lib/supabase/route-auth.ts` (`server-only`) verifies the caller's `Authorization: Bearer <access_token>` via `supabase.auth.getUser(token)` and returns the authenticated id — `requireRequestUserId` → 401, `rejectUserIdMismatch` → 403.
- Member CRUD, profile bootstrap, community, export, and deletion routes use the verified id, never a request-body/query owner. AI routes may compute anonymously but never persist without a verified session.
- **Executable proof:** `node scripts/verify-route-auth.mjs` against a running server rejects unauthenticated access to every protected route, checks spoofed message ownership, confirms anonymous AI compute cannot persist, and checks the health response for secret leakage. No live credentials required.

Recommended future cleanup (defense-in-depth, not a blocker): migrate the `lib/ai/*` persist writes from the admin client to an anon-key client scoped by the verified session so RLS is a second backstop.

## Applying migrations to a live project

Option A — Supabase CLI (recommended):
```bash
supabase link --project-ref <project-ref>
supabase db push          # applies supabase/migrations/*.sql in order
```
Option B — Dashboard: SQL Editor → paste each `supabase/migrations/000N_*.sql` in order → Run.

Verify after applying (Dashboard → Database → Policies, or SQL):
```sql
select tablename, policyname, cmd, roles
from pg_policies where schemaname = 'public' and tablename = 'member_state';
-- expect 4 rows: select/insert/update/delete, {authenticated}
select relrowsecurity from pg_class where relname = 'member_state';  -- expect: t
```

## Proving isolation (executable)

`scripts/verify-rls.mjs` signs in two real accounts with the **anon key** and asserts:
- A upserts/reads own row · B upserts own row
- A **cannot** read or update B's row (RLS filters → empty)
- A **cannot** insert under B's `user_id` (WITH CHECK rejects)
- Anonymous **cannot** read or write
- A second client for A restores A's cloud row
- members cannot update the billing-owned profile tier
- private Storage allows owner upload/delete and denies cross-user/anonymous access

Run:
```bash
NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
RLS_TEST_A_EMAIL=... RLS_TEST_A_PASSWORD=... \
RLS_TEST_B_EMAIL=... RLS_TEST_B_PASSWORD=... \
node scripts/verify-rls.mjs
```
It prints redacted emails/ids only, creates disposable rows, and deletes them.

**Status in this repo: UNEXECUTED** — no live project or test accounts were available in the production worktree. The script exits 1 with a clear "missing configuration" report until credentials are supplied.
