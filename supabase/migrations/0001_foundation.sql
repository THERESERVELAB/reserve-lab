-- FINAL BOSS ATHLETE production foundation
-- Designed for a fresh Supabase project and safe to paste into the SQL Editor.

create extension if not exists "pgcrypto";

do $$ begin
  create type public.subscription_tier as enum ('core', 'pro', 'elite');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.subscription_status as enum ('trial', 'active', 'past_due', 'canceled', 'grace_period');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.user_persona as enum ('beginner', 'intermediate', 'advanced');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.channel_visibility as enum ('public', 'core', 'pro', 'elite', 'private');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.community_role as enum ('owner', 'coach', 'moderator', 'member');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.acquisition_source as enum (
    'free-ai-body-assessment',
    'free-training-split-generator',
    'free-bloodwork-upload-preview',
    'free-12-week-physique-projection',
    'free-physique-scan',
    'free-bloodwork-review',
    'training-split-generator',
    'waitlist',
    'referral',
    'affiliate'
  );
exception when duplicate_object then null;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  persona public.user_persona not null default 'beginner',
  current_tier public.subscription_tier not null default 'core',
  onboarding_status text not null default 'not-started',
  onboarding_state jsonb not null default '{}'::jsonb,
  preferences jsonb not null default '{}'::jsonb,
  referral_code text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.onboarding_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  goal text,
  training_age text,
  primary_focus text,
  enhanced_tracking_enabled boolean not null default false,
  state jsonb not null default '{}'::jsonb,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id)
);

create table if not exists public.user_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  units text not null default 'imperial',
  theme text not null default 'dark',
  date_format text not null default 'us',
  notifications_enabled boolean not null default true,
  dashboard_density text not null default 'operator',
  data_retention text not null default 'local-only',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  tier public.subscription_tier not null,
  status public.subscription_status not null,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  feature_key text not null,
  source text not null default 'subscription',
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  unique(user_id, feature_key)
);

create table if not exists public.digital_twin_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  physique_archetype text,
  goal_state text,
  weak_points text[] not null default '{}',
  muscle_scores jsonb not null default '{}'::jsonb,
  body_metrics jsonb not null default '{}'::jsonb,
  symmetry_score integer check (symmetry_score between 0 and 100),
  projection jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.body_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  metric_key text not null,
  value numeric not null,
  unit text not null default 'in',
  measured_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.muscle_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  muscle_group text not null,
  score integer not null check (score between 0 and 100),
  previous_score integer check (previous_score between 0 and 100),
  trend text not null default 'unknown',
  observed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.weak_points (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  muscle_group text not null,
  severity text not null default 'moderate',
  notes text,
  detected_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.progress_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null,
  angle text not null,
  lighting_notes text,
  captured_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.transformation_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  summary text,
  snapshot_date date not null default current_date,
  metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.mesocycles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  style text not null,
  goal text not null,
  starts_on date not null,
  ends_on date not null,
  emphasis_muscles text[] not null default '{}',
  deload_planned boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.training_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  mesocycle_id uuid references public.mesocycles(id) on delete set null,
  training_style text not null,
  focus text,
  readiness_score integer check (readiness_score between 0 and 100),
  perceived_effort integer check (perceived_effort between 1 and 10),
  notes text,
  performed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.exercise_logs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.training_sessions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  exercise_name text not null,
  muscle_groups text[] not null default '{}',
  sets jsonb not null default '[]'::jsonb,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.nutrition_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  calories integer,
  protein_g integer,
  carbs_g integer,
  fat_g integer,
  adherence_score integer check (adherence_score between 0 and 100),
  logged_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.bloodwork_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  marker text not null,
  value numeric,
  unit text,
  category text not null,
  observed_at timestamptz not null default now(),
  source text,
  file_path text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.supplement_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  category text,
  logged_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.retention_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  current_streak integer not null default 0,
  best_streak integer not null default 0,
  weekly_readiness_score integer not null default 0 check (weekly_readiness_score between 0 and 100),
  adherence_score integer not null default 0 check (adherence_score between 0 and 100),
  activation_score integer not null default 0 check (activation_score between 0 and 100),
  churn_risk_score integer not null default 0 check (churn_risk_score between 0 and 100),
  completed_milestones text[] not null default '{}',
  last_check_in_at timestamptz,
  updated_at timestamptz not null default now(),
  unique(user_id)
);

create table if not exists public.engagement_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  event_name text not null,
  feature_key text,
  session_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.upgrade_intents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  feature_key text not null,
  required_tier public.subscription_tier not null,
  source text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.community_channels (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null default '',
  visibility public.channel_visibility not null default 'core',
  required_tier public.subscription_tier not null default 'core',
  kind text not null default 'discussion',
  pinned_message_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.community_memberships (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid references public.community_channels(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.community_role not null default 'member',
  member_rank text not null default 'member',
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz,
  unique(channel_id, user_id)
);

create table if not exists public.community_messages (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.community_channels(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  parent_id uuid references public.community_messages(id) on delete cascade,
  body text not null,
  is_pinned boolean not null default false,
  check_in_type text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.community_channels
  drop constraint if exists community_channels_pinned_message_id_fkey;

alter table public.community_channels
  add constraint community_channels_pinned_message_id_fkey
  foreign key (pinned_message_id) references public.community_messages(id) on delete set null;

create table if not exists public.community_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.community_messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  unique(message_id, user_id, emoji)
);

create table if not exists public.community_presence (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid references public.community_channels(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'offline',
  last_seen_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  unique(channel_id, user_id)
);

create table if not exists public.ai_analysis_outputs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  analysis_type text not null,
  model text not null,
  input_hash text,
  output jsonb not null,
  safety_notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.lead_captures (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  source public.acquisition_source not null,
  referral_code text,
  affiliate_code text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_user_id uuid references public.profiles(id) on delete set null,
  referred_email text not null,
  code text not null,
  converted_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.affiliate_attributions (
  id uuid primary key default gen_random_uuid(),
  affiliate_code text not null,
  lead_id uuid references public.lead_captures(id) on delete set null,
  user_id uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists subscriptions_user_id_idx on public.subscriptions(user_id);
create index if not exists subscriptions_stripe_subscription_id_idx on public.subscriptions(stripe_subscription_id);
create index if not exists engagement_events_user_created_idx on public.engagement_events(user_id, created_at desc);
create index if not exists engagement_events_name_created_idx on public.engagement_events(event_name, created_at desc);
create index if not exists body_metrics_user_measured_idx on public.body_metrics(user_id, measured_at desc);
create index if not exists muscle_scores_user_observed_idx on public.muscle_scores(user_id, observed_at desc);
create index if not exists weak_points_user_detected_idx on public.weak_points(user_id, detected_at desc);
create index if not exists progress_photos_user_captured_idx on public.progress_photos(user_id, captured_at desc);
create index if not exists digital_twin_user_created_idx on public.digital_twin_snapshots(user_id, created_at desc);
create index if not exists training_sessions_user_performed_idx on public.training_sessions(user_id, performed_at desc);
create index if not exists exercise_logs_session_idx on public.exercise_logs(session_id);
create index if not exists mesocycles_user_dates_idx on public.mesocycles(user_id, starts_on, ends_on);
create index if not exists nutrition_logs_user_logged_idx on public.nutrition_logs(user_id, logged_at desc);
create index if not exists bloodwork_logs_user_observed_idx on public.bloodwork_logs(user_id, observed_at desc);
create index if not exists supplement_logs_user_logged_idx on public.supplement_logs(user_id, logged_at desc);
create index if not exists upgrade_intents_user_created_idx on public.upgrade_intents(user_id, created_at desc);
create index if not exists community_messages_channel_created_idx on public.community_messages(channel_id, created_at desc);
create index if not exists community_memberships_user_idx on public.community_memberships(user_id);
create index if not exists community_presence_channel_seen_idx on public.community_presence(channel_id, last_seen_at desc);
create index if not exists ai_outputs_user_created_idx on public.ai_analysis_outputs(user_id, created_at desc);
create index if not exists lead_captures_email_idx on public.lead_captures(email);
create index if not exists referrals_code_idx on public.referrals(code);
create index if not exists affiliate_attributions_code_idx on public.affiliate_attributions(affiliate_code);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists onboarding_profiles_set_updated_at on public.onboarding_profiles;
create trigger onboarding_profiles_set_updated_at before update on public.onboarding_profiles
for each row execute function public.set_updated_at();

drop trigger if exists user_preferences_set_updated_at on public.user_preferences;
create trigger user_preferences_set_updated_at before update on public.user_preferences
for each row execute function public.set_updated_at();

drop trigger if exists subscriptions_set_updated_at on public.subscriptions;
create trigger subscriptions_set_updated_at before update on public.subscriptions
for each row execute function public.set_updated_at();

drop trigger if exists mesocycles_set_updated_at on public.mesocycles;
create trigger mesocycles_set_updated_at before update on public.mesocycles
for each row execute function public.set_updated_at();

drop trigger if exists community_channels_set_updated_at on public.community_channels;
create trigger community_channels_set_updated_at before update on public.community_channels
for each row execute function public.set_updated_at();

drop trigger if exists community_messages_set_updated_at on public.community_messages;
create trigger community_messages_set_updated_at before update on public.community_messages
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.onboarding_profiles enable row level security;
alter table public.user_preferences enable row level security;
alter table public.subscriptions enable row level security;
alter table public.user_entitlements enable row level security;
alter table public.digital_twin_snapshots enable row level security;
alter table public.body_metrics enable row level security;
alter table public.muscle_scores enable row level security;
alter table public.weak_points enable row level security;
alter table public.progress_photos enable row level security;
alter table public.transformation_snapshots enable row level security;
alter table public.mesocycles enable row level security;
alter table public.training_sessions enable row level security;
alter table public.exercise_logs enable row level security;
alter table public.nutrition_logs enable row level security;
alter table public.bloodwork_logs enable row level security;
alter table public.supplement_logs enable row level security;
alter table public.retention_snapshots enable row level security;
alter table public.engagement_events enable row level security;
alter table public.upgrade_intents enable row level security;
alter table public.community_channels enable row level security;
alter table public.community_memberships enable row level security;
alter table public.community_messages enable row level security;
alter table public.community_reactions enable row level security;
alter table public.community_presence enable row level security;
alter table public.ai_analysis_outputs enable row level security;
alter table public.lead_captures enable row level security;
alter table public.referrals enable row level security;
alter table public.affiliate_attributions enable row level security;

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile" on public.profiles for insert to authenticated with check (auth.uid() = id);
drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile" on public.profiles for select to authenticated using (auth.uid() = id);
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "Users can manage own onboarding profile" on public.onboarding_profiles;
create policy "Users can manage own onboarding profile" on public.onboarding_profiles for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can manage own preferences" on public.user_preferences;
create policy "Users can manage own preferences" on public.user_preferences for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can read own subscriptions" on public.subscriptions;
create policy "Users can read own subscriptions" on public.subscriptions for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users can read own entitlements" on public.user_entitlements;
create policy "Users can read own entitlements" on public.user_entitlements for select to authenticated using (auth.uid() = user_id);

drop policy if exists "Users can manage own digital twin" on public.digital_twin_snapshots;
create policy "Users can manage own digital twin" on public.digital_twin_snapshots for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can manage own body metrics" on public.body_metrics;
create policy "Users can manage own body metrics" on public.body_metrics for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can manage own muscle scores" on public.muscle_scores;
create policy "Users can manage own muscle scores" on public.muscle_scores for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can manage own weak points" on public.weak_points;
create policy "Users can manage own weak points" on public.weak_points for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can manage own progress photos" on public.progress_photos;
create policy "Users can manage own progress photos" on public.progress_photos for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can manage own transformation snapshots" on public.transformation_snapshots;
create policy "Users can manage own transformation snapshots" on public.transformation_snapshots for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can manage own mesocycles" on public.mesocycles;
create policy "Users can manage own mesocycles" on public.mesocycles for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can manage own training sessions" on public.training_sessions;
create policy "Users can manage own training sessions" on public.training_sessions for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can manage own exercise logs" on public.exercise_logs;
create policy "Users can manage own exercise logs" on public.exercise_logs for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can manage own nutrition logs" on public.nutrition_logs;
create policy "Users can manage own nutrition logs" on public.nutrition_logs for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can manage own bloodwork logs" on public.bloodwork_logs;
create policy "Users can manage own bloodwork logs" on public.bloodwork_logs for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can manage own supplement logs" on public.supplement_logs;
create policy "Users can manage own supplement logs" on public.supplement_logs for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can manage own retention snapshots" on public.retention_snapshots;
create policy "Users can manage own retention snapshots" on public.retention_snapshots for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can read own ai outputs" on public.ai_analysis_outputs;
create policy "Users can read own ai outputs" on public.ai_analysis_outputs for select to authenticated using (auth.uid() = user_id);

drop policy if exists "Anonymous analytics insert" on public.engagement_events;
create policy "Anonymous analytics insert" on public.engagement_events for insert to anon, authenticated with check (user_id is null or auth.uid() = user_id);
drop policy if exists "Users can read own engagement events" on public.engagement_events;
create policy "Users can read own engagement events" on public.engagement_events for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Anonymous upgrade intent insert" on public.upgrade_intents;
create policy "Anonymous upgrade intent insert" on public.upgrade_intents for insert to anon, authenticated with check (user_id is null or auth.uid() = user_id);
drop policy if exists "Users can read own upgrade intents" on public.upgrade_intents;
create policy "Users can read own upgrade intents" on public.upgrade_intents for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Anonymous lead capture insert" on public.lead_captures;
create policy "Anonymous lead capture insert" on public.lead_captures for insert to anon, authenticated with check (true);

drop policy if exists "Authenticated users can read channels" on public.community_channels;
create policy "Authenticated users can read channels" on public.community_channels for select to authenticated using (true);
drop policy if exists "Users can manage own channel memberships" on public.community_memberships;
create policy "Users can manage own channel memberships" on public.community_memberships for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Authenticated users can read messages" on public.community_messages;
create policy "Authenticated users can read messages" on public.community_messages for select to authenticated using (deleted_at is null);
drop policy if exists "Authenticated users can post own messages" on public.community_messages;
create policy "Authenticated users can post own messages" on public.community_messages for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users can update own messages" on public.community_messages;
create policy "Users can update own messages" on public.community_messages for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Authenticated users can react" on public.community_reactions;
create policy "Authenticated users can react" on public.community_reactions for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Authenticated users can manage own presence" on public.community_presence;
create policy "Authenticated users can manage own presence" on public.community_presence for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can manage own referrals" on public.referrals;
create policy "Users can manage own referrals" on public.referrals for all to authenticated using (auth.uid() = referrer_user_id or auth.uid() = converted_user_id) with check (auth.uid() = referrer_user_id or auth.uid() = converted_user_id);
drop policy if exists "Users can read own affiliate attribution" on public.affiliate_attributions;
create policy "Users can read own affiliate attribution" on public.affiliate_attributions for select to authenticated using (auth.uid() = user_id);

insert into public.community_channels (slug, name, description, visibility, required_tier, kind) values
  ('bodybuilding', 'Bodybuilding', 'Physique training discussion and progress logs.', 'core', 'core', 'discussion'),
  ('fat-loss', 'Fat Loss', 'Cutting phases, adherence, and behavior support.', 'core', 'core', 'discussion'),
  ('women-performance', 'Women Performance', 'Training, recovery, and performance discussion for women.', 'core', 'core', 'discussion'),
  ('hybrid-athletes', 'Hybrid Athletes', 'Strength, conditioning, endurance, and recovery coordination.', 'pro', 'pro', 'discussion'),
  ('progress-check-ins', 'Progress Check-ins', 'Weekly transformations, wins, and accountability.', 'core', 'core', 'check-in'),
  ('bloodwork-discussion', 'Bloodwork Discussion', 'Lab result organization and clinician-review preparation.', 'pro', 'pro', 'discussion'),
  ('supplement-discussion', 'Supplement Discussion', 'Support stack tracking and experience notes without dosage guidance.', 'pro', 'pro', 'discussion'),
  ('challenges', 'Challenges', 'Community milestones and adherence competitions.', 'core', 'core', 'challenge'),
  ('elite-war-room', 'Elite War Room', 'Private Elite accountability and advanced trend observation.', 'elite', 'elite', 'discussion')
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  visibility = excluded.visibility,
  required_tier = excluded.required_tier,
  kind = excluded.kind;
