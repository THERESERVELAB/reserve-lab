-- FINAL BOSS ATHLETE value engine persistence
-- Supports daily command, live session mode, progression, digital athlete, check-ins, nutrition commands, and recovery commands.

create table if not exists public.todays_commands (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  command_date date not null default current_date,
  command jsonb not null,
  safety_notes text,
  created_at timestamptz not null default now(),
  unique(user_id, command_date)
);

create table if not exists public.active_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  session_id text not null,
  plan_id text not null,
  title text not null,
  status text not null default 'active',
  session jsonb not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, session_id)
);

create table if not exists public.session_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  session_id text not null,
  exercise_id text not null,
  set_number integer not null check (set_number between 1 and 20),
  load numeric,
  reps integer not null check (reps between 0 and 200),
  rir integer check (rir between 0 and 10),
  metadata jsonb not null default '{}'::jsonb,
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.progression_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  snapshot_date date not null default current_date,
  snapshot jsonb not null,
  safety_notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.digital_athlete_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  snapshot_date date not null default current_date,
  snapshot jsonb not null,
  safety_notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.physique_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  check_in_date date not null default current_date,
  photos jsonb not null default '[]'::jsonb,
  critique jsonb not null default '{}'::jsonb,
  safety_notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.nutrition_commands (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  command_date date not null default current_date,
  command jsonb not null,
  safety_notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.recovery_commands (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  command_date date not null default current_date,
  command jsonb not null,
  safety_notes text,
  created_at timestamptz not null default now()
);

create index if not exists todays_commands_user_date_idx on public.todays_commands(user_id, command_date desc);
create index if not exists active_sessions_user_status_idx on public.active_sessions(user_id, status, started_at desc);
create index if not exists session_sets_user_session_idx on public.session_sets(user_id, session_id, completed_at desc);
create index if not exists progression_snapshots_user_date_idx on public.progression_snapshots(user_id, snapshot_date desc);
create index if not exists digital_athlete_snapshots_user_date_idx on public.digital_athlete_snapshots(user_id, snapshot_date desc);
create index if not exists physique_checkins_user_date_idx on public.physique_checkins(user_id, check_in_date desc);
create index if not exists nutrition_commands_user_date_idx on public.nutrition_commands(user_id, command_date desc);
create index if not exists recovery_commands_user_date_idx on public.recovery_commands(user_id, command_date desc);

drop trigger if exists active_sessions_set_updated_at on public.active_sessions;
create trigger active_sessions_set_updated_at before update on public.active_sessions
for each row execute function public.set_updated_at();

alter table public.todays_commands enable row level security;
alter table public.active_sessions enable row level security;
alter table public.session_sets enable row level security;
alter table public.progression_snapshots enable row level security;
alter table public.digital_athlete_snapshots enable row level security;
alter table public.physique_checkins enable row level security;
alter table public.nutrition_commands enable row level security;
alter table public.recovery_commands enable row level security;

drop policy if exists "Users can manage own todays commands" on public.todays_commands;
create policy "Users can manage own todays commands" on public.todays_commands for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can manage own active sessions" on public.active_sessions;
create policy "Users can manage own active sessions" on public.active_sessions for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can manage own session sets" on public.session_sets;
create policy "Users can manage own session sets" on public.session_sets for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can manage own progression snapshots" on public.progression_snapshots;
create policy "Users can manage own progression snapshots" on public.progression_snapshots for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can manage own digital athlete snapshots" on public.digital_athlete_snapshots;
create policy "Users can manage own digital athlete snapshots" on public.digital_athlete_snapshots for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can manage own physique checkins" on public.physique_checkins;
create policy "Users can manage own physique checkins" on public.physique_checkins for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can manage own nutrition commands" on public.nutrition_commands;
create policy "Users can manage own nutrition commands" on public.nutrition_commands for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can manage own recovery commands" on public.recovery_commands;
create policy "Users can manage own recovery commands" on public.recovery_commands for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
