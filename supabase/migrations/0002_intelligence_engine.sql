-- FINAL BOSS ATHLETE intelligence engine persistence
-- Forward-only extension for generated missions, critiques, projections, and training prescriptions.

create table if not exists public.intelligence_outputs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  output_type text not null,
  model text not null,
  input_hash text,
  output jsonb not null,
  safety_notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.training_prescriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan_id text not null,
  title text not null,
  split_name text not null default 'Batman Split',
  split_day integer check (split_day between 1 and 7),
  focus text,
  plan jsonb not null,
  safety_notes text,
  created_at timestamptz not null default now()
);

create index if not exists intelligence_outputs_user_type_created_idx
  on public.intelligence_outputs(user_id, output_type, created_at desc);

create index if not exists training_prescriptions_user_created_idx
  on public.training_prescriptions(user_id, created_at desc);

create index if not exists training_prescriptions_user_plan_idx
  on public.training_prescriptions(user_id, plan_id);

alter table public.intelligence_outputs enable row level security;
alter table public.training_prescriptions enable row level security;

drop policy if exists "Users can read own intelligence outputs" on public.intelligence_outputs;
create policy "Users can read own intelligence outputs" on public.intelligence_outputs
for select to authenticated using (auth.uid() = user_id);

drop policy if exists "Users can insert own intelligence outputs" on public.intelligence_outputs;
create policy "Users can insert own intelligence outputs" on public.intelligence_outputs
for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "Users can read own training prescriptions" on public.training_prescriptions;
create policy "Users can read own training prescriptions" on public.training_prescriptions
for select to authenticated using (auth.uid() = user_id);

drop policy if exists "Users can insert own training prescriptions" on public.training_prescriptions;
create policy "Users can insert own training prescriptions" on public.training_prescriptions
for insert to authenticated with check (auth.uid() = user_id);
