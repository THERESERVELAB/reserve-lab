-- FINAL BOSS ATHLETE product completion persistence
-- Forward-only additions for launch-grade logging, recovery, and live session contracts.

alter table public.training_sessions
  add column if not exists split_day integer check (split_day between 0 and 7),
  add column if not exists cardio_minutes integer check (cardio_minutes between 0 and 180),
  add column if not exists sauna_minutes integer check (sauna_minutes between 0 and 90),
  add column if not exists total_volume_lbs numeric,
  add column if not exists total_sets_completed integer,
  add column if not exists status text not null default 'completed',
  add column if not exists source text not null default 'manual',
  add column if not exists exercise_logs jsonb not null default '[]'::jsonb;

alter table public.nutrition_logs
  add column if not exists day_type text not null default 'training',
  add column if not exists meals jsonb not null default '[]'::jsonb,
  add column if not exists water_liters numeric,
  add column if not exists notes text,
  add column if not exists source text not null default 'manual';

alter table public.training_prescriptions
  alter column split_name set default 'Reserve Method';

create table if not exists public.recovery_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  logged_at date not null default current_date,
  hrv numeric,
  resting_hr integer,
  sleep_hours numeric,
  sleep_quality text,
  readiness_score integer check (readiness_score between 0 and 100),
  mood_score integer check (mood_score between 1 and 10),
  joint_feedback text,
  cns_feeling text,
  notes text,
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, logged_at)
);

create table if not exists public.session_swaps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  session_id text not null,
  exercise_id text not null,
  original_exercise text not null,
  replacement_exercise text not null,
  reason text,
  preserves_stimulus text,
  swapped_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists training_sessions_user_performed_at_unique
  on public.training_sessions(user_id, performed_at);

create unique index if not exists nutrition_logs_user_logged_at_unique
  on public.nutrition_logs(user_id, logged_at);

create unique index if not exists nutrition_commands_user_command_date_unique
  on public.nutrition_commands(user_id, command_date);

create unique index if not exists recovery_commands_user_command_date_unique
  on public.recovery_commands(user_id, command_date);

create index if not exists recovery_logs_user_logged_idx
  on public.recovery_logs(user_id, logged_at desc);

create index if not exists session_swaps_user_session_idx
  on public.session_swaps(user_id, session_id, swapped_at desc);

drop trigger if exists recovery_logs_set_updated_at on public.recovery_logs;
create trigger recovery_logs_set_updated_at before update on public.recovery_logs
for each row execute function public.set_updated_at();

alter table public.recovery_logs enable row level security;
alter table public.session_swaps enable row level security;

drop policy if exists "Users can manage own recovery logs" on public.recovery_logs;
create policy "Users can manage own recovery logs" on public.recovery_logs
for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can manage own session swaps" on public.session_swaps;
create policy "Users can manage own session swaps" on public.session_swaps
for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
