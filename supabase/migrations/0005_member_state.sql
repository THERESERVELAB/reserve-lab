-- 0005_member_state.sql
-- Authoritative per-member application state for cloud sync (launch MVP).
--
-- The client keeps its Zustand/localStorage store as the offline cache and
-- mirrors the cloud-safe member slices into this single jsonb row. The
-- normalized domain tables from 0001-0004 remain the long-term target; this
-- row is the fastest safe path to real cross-device persistence.

create table if not exists public.member_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  state jsonb not null,
  schema_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.member_state enable row level security;

-- Authenticated members may read/write only their own row. No anonymous
-- access: RLS denies by default and every policy below targets `authenticated`.
drop policy if exists member_state_select_own on public.member_state;
create policy member_state_select_own
  on public.member_state for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists member_state_insert_own on public.member_state;
create policy member_state_insert_own
  on public.member_state for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists member_state_update_own on public.member_state;
create policy member_state_update_own
  on public.member_state for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- updated_at is authoritative server-side; the sync engine's merge policy
-- compares against it, so clients must not be able to spoof it.
create or replace function public.set_member_state_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists member_state_touch_updated_at on public.member_state;
create trigger member_state_touch_updated_at
  before update on public.member_state
  for each row
  execute function public.set_member_state_updated_at();
