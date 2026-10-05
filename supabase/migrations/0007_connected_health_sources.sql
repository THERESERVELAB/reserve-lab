-- RESERVE LAB — connected health sources, their credentials, and what they observed.
--
-- Three tables, deliberately separated by how dangerous they are:
--
--   connected_health_sources      the connection itself. The member reads it;
--                                 it is what the Settings row is drawn from.
--   connected_health_credentials  the sealed OAuth tokens. NO ONE reads this
--                                 through the API. No policy grants access to
--                                 `authenticated`, so RLS denies every request
--                                 made with a member's own key. Only the
--                                 service role, inside a route that has already
--                                 verified the caller, can open it.
--   connected_health_observations the readings. Provenance is not optional:
--                                 every row carries the provider, the
--                                 measurement type, and the permission scope it
--                                 arrived under.
--
-- Vendor scores (WHOOP Recovery, WHOOP Strain, WHOOP Sleep Performance) land
-- here as measurement_type = 'vendor-score' with their vendor key in metadata.
-- They are never written as a Reserve number.

-- ── The connection ───────────────────────────────────────────────────────

create table if not exists public.connected_health_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null check (
    provider in ('apple-health', 'health-connect', 'whoop', 'oura', 'garmin', 'manual')
  ),
  status text not null default 'not-connected' check (
    status in ('not-connected', 'connecting', 'connected', 'paused',
               'permission-limited', 'expired', 'error')
  ),
  -- The scopes the member actually granted, as the vendor reported them back.
  granted_scopes text[] not null default '{}',
  -- The vendor's own id for this member, so a reconnect is recognised as the
  -- same account rather than silently becoming a second one.
  vendor_user_id text,
  vendor_display_name text,
  last_successful_sync_at timestamptz,
  last_sync_error text,
  last_cursor text,
  source_priority jsonb not null default '{}'::jsonb,
  synthetic boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

create index if not exists connected_health_sources_user_idx
  on public.connected_health_sources(user_id, provider);

-- ── The credentials ──────────────────────────────────────────────────────

create table if not exists public.connected_health_credentials (
  source_id uuid primary key
    references public.connected_health_sources(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  -- Ciphertext produced by src/lib/devices/token-vault (AES-256-GCM).
  -- A plaintext token must never reach this column.
  access_token_sealed text not null,
  refresh_token_sealed text,
  access_token_expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── The readings ─────────────────────────────────────────────────────────

create table if not exists public.connected_health_observations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  -- Disconnecting WHOOP removes the connection, not the member's history.
  -- The readings already gathered stay, orphaned from the source row.
  source_id uuid references public.connected_health_sources(id) on delete set null,
  provider text not null,
  source_device text,
  original_record_id text,
  -- Stable per underlying reading, so a record the vendor revises UPDATES its
  -- row instead of adding a second, contradictory one.
  dedupe_key text not null,
  category text not null check (
    category in ('workout', 'steps', 'active-energy', 'heart-rate',
                 'resting-heart-rate', 'hrv', 'sleep', 'respiratory-rate',
                 'blood-oxygen', 'body-weight', 'body-composition',
                 'distance', 'duration', 'custom')
  ),
  measurement_type text not null check (
    measurement_type in ('measured', 'device-estimated', 'vendor-score',
                         'athlete-reported', 'reserve-derived')
  ),
  value_numeric double precision,
  value_text text,
  unit text,
  observed_at timestamptz not null,
  imported_at timestamptz not null default now(),
  revised_at timestamptz,
  permission_scope text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A reading is a number or it is a label. Never neither, never both.
  check (num_nonnulls(value_numeric, value_text) = 1),
  unique (user_id, provider, dedupe_key)
);

create index if not exists connected_health_observations_user_category_idx
  on public.connected_health_observations(user_id, category, observed_at desc);

create index if not exists connected_health_observations_user_observed_idx
  on public.connected_health_observations(user_id, observed_at desc);

-- ── updated_at ───────────────────────────────────────────────────────────

drop trigger if exists connected_health_sources_set_updated_at on public.connected_health_sources;
create trigger connected_health_sources_set_updated_at
before update on public.connected_health_sources
for each row execute function public.set_updated_at();

drop trigger if exists connected_health_credentials_set_updated_at on public.connected_health_credentials;
create trigger connected_health_credentials_set_updated_at
before update on public.connected_health_credentials
for each row execute function public.set_updated_at();

drop trigger if exists connected_health_observations_set_updated_at on public.connected_health_observations;
create trigger connected_health_observations_set_updated_at
before update on public.connected_health_observations
for each row execute function public.set_updated_at();

-- ── Row level security ───────────────────────────────────────────────────

alter table public.connected_health_sources enable row level security;
alter table public.connected_health_credentials enable row level security;
alter table public.connected_health_observations enable row level security;

-- The member may look at their own connections and may disconnect them.
-- They may not hand themselves a connection: only a server route that has
-- completed a real OAuth exchange writes one, using the service role.
drop policy if exists connected_health_sources_select_own on public.connected_health_sources;
create policy connected_health_sources_select_own on public.connected_health_sources
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists connected_health_sources_delete_own on public.connected_health_sources;
create policy connected_health_sources_delete_own on public.connected_health_sources
  for delete to authenticated using (auth.uid() = user_id);

-- The member may read and delete their own readings. Writes come from the
-- sync route, which has verified the caller and holds the service role.
drop policy if exists connected_health_observations_select_own on public.connected_health_observations;
create policy connected_health_observations_select_own on public.connected_health_observations
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists connected_health_observations_delete_own on public.connected_health_observations;
create policy connected_health_observations_delete_own on public.connected_health_observations
  for delete to authenticated using (auth.uid() = user_id);

-- connected_health_credentials has NO policy on purpose. With RLS enabled and
-- no policy, every request carrying a member's key reads nothing at all. The
-- sealed tokens are reachable only by the service role, which bypasses RLS.
-- Adding a policy here would undo the entire point of this table.

revoke all on public.connected_health_credentials from anon, authenticated;
