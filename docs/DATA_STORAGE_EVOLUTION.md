# Data Storage Evolution — Reserve Lab

How member data is stored today, whether it is safe for launch, and what to normalize before scale. This is an assessment, not a redesign — it does not alter the current feature architecture.

## Current model

One JSONB document per member: `public.member_state.state` holds the whole cloud-safe slice set (`MEMBER_STATE_KEYS`, ~35+ slices) plus the standalone training, nutrition, and recovery log maps in the v2 envelope. The client mirrors both local sources into this single row; hydration restores both. Writes are full-document upserts.

**Strengths:** dead simple, atomic per member, trivial RLS (one row, one owner), no join surface, offline cache is a 1:1 mirror. Ideal for launch.

**Structural limits:**
- Every save re-serializes and re-uploads the **entire** document (debounced) — cost grows with total member history, not with the size of the change.
- Conflict resolution is **whole-document newest-wins** (`sync-engine.ts:317-340`); two devices editing between syncs means the older device's unsynced delta is backed up locally, not field-merged.
- A single row's `state` is loaded in full on every hydrate — hydration latency grows with the largest sub-collection.

## Growth analysis by domain

| Domain (slice) | Bounded? | Growth driver | Risk |
|---|---|---|---|
| `trainingSession.sessionHistory` | ✅ capped at 24 cards | per session | low |
| `actualWeeks` | ✅ capped at 26 weeks | per week | low |
| `movementSelections` | ✅ capped at 200 | per movement pick | low |
| `bloodworkLogs` | ⚠️ unbounded | per lab panel | med (panels are small; slow accumulation) |
| `lifestyleSchedules` / `customWorkoutTemplates` | ⚠️ unbounded (versions accumulate) | per save/version | med |
| `programs` / `programDayVersions` / `importedProgramDrafts` (Codex) | ⚠️ version histories | per program edit/import | med–high at scale |
| `recoveryCommand` (sleep/hydration/mobility logs) | ⚠️ likely unbounded | daily logging | high over months/years |
| `physiqueCommand` entries / photo check-in metadata | ⚠️ unbounded | per check-in | med (metadata only; binaries are NOT in state) |
| `enhancementLog` / `injectionLogs` | ⚠️ unbounded | per log | med |

Rough envelope size: a new member is a few KB; a heavy daily-logger after a year of sleep/hydration/nutrition/biomarker logs and many program versions is plausibly **hundreds of KB to low MB**. Postgres jsonb tolerates that, but full-document upload-on-every-change and full-load-on-hydrate degrade the "Saved" latency and first-paint restore well before any hard limit.

## Classification

**SAFE FOR CURRENT LAUNCH** — ship the JSONB envelope as-is. Bounded collections (session history, actual weeks, movement selections) already cap the hottest churn. For an early user base this is the right call.

**SHOULD NORMALIZE SOON** (first scale pass, post-launch) — move the append-heavy, chronologically-queried logs out of the envelope into their own RLS-owned tables so a daily log is a small insert, not a full-document rewrite:
- `recovery_logs` (sleep / hydration / mobility / stress)
- `nutrition_logs`
- `training_sessions` + `set_logs` (a `training_sessions`/`exercise_logs` schema already exists in `0001`; wire the client to it)
- `physique_checkins` (table + RLS already exist in `0003`; wire the client to the anon-key path, not the service-role route)

**MUST NORMALIZE BEFORE SCALE** — before large numbers of long-tenured members:
- `bloodwork_panels` + `bloodwork_markers` (biomarker history; also the natural home for clinician-review exports) — table exists (`bloodwork_logs`, `0001`)
- `program_versions` / `program_day_versions` (unbounded version lineage)
- uploaded files (progress photos) → Supabase Storage with owner-scoped buckets (already metadata-only in state — keep binaries out of the row)

## Recommended target shape (when normalizing)

Each normalized table should mirror the `member_state` security pattern:
```sql
create table public.<domain> (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ...domain columns...,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index <domain>_user_created_idx on public.<domain>(user_id, created_at desc);
alter table public.<domain> enable row level security;
create policy <domain>_own on public.<domain> for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
```
Migration strategy: keep the envelope as the source of truth, dual-write to the new table, backfill from the envelope, then read from the table and drop the slice from `MEMBER_STATE_KEYS` in a versioned store migration. Idempotent writes keyed on a stable client id per record. Backward compatible: older clients keep reading the envelope until they update.

## Not added this pass
No normalized tables are introduced here — current launch is safe without them, and adding them would overlap the member contract Codex is actively extending. This document is the decision record; execute the SHOULD/MUST items in a dedicated future pass coordinated with the feature owner.
