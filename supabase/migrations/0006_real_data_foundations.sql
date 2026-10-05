-- RESERVE LAB — authenticated identity, relationship ownership, and private storage.
-- This migration intentionally does not add chat/media product behavior. It
-- establishes the ownership boundary those capabilities must use later.

-- ── Canonical member identities ──────────────────────────────────────────

create table if not exists public.athlete_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'paused', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.coach_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  display_name text,
  business_name text,
  verification_status text not null default 'pending'
    check (verification_status in ('pending', 'active', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.coach_client_relationships (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coach_profiles(user_id) on delete cascade,
  athlete_id uuid not null references public.athlete_profiles(user_id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'active', 'revoked', 'declined')),
  permissions jsonb not null default '{}'::jsonb,
  requested_by uuid not null references public.profiles(id) on delete cascade,
  approved_by_athlete_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (coach_id, athlete_id),
  check (coach_id <> athlete_id),
  check (requested_by = coach_id or requested_by = athlete_id),
  check (status <> 'active' or approved_by_athlete_at is not null)
);

create index if not exists coach_client_relationships_coach_idx
  on public.coach_client_relationships(coach_id, status);
create index if not exists coach_client_relationships_athlete_idx
  on public.coach_client_relationships(athlete_id, status);

drop trigger if exists athlete_profiles_set_updated_at on public.athlete_profiles;
create trigger athlete_profiles_set_updated_at
before update on public.athlete_profiles
for each row execute function public.set_updated_at();

drop trigger if exists coach_profiles_set_updated_at on public.coach_profiles;
create trigger coach_profiles_set_updated_at
before update on public.coach_profiles
for each row execute function public.set_updated_at();

drop trigger if exists coach_client_relationships_set_updated_at on public.coach_client_relationships;
create trigger coach_client_relationships_set_updated_at
before update on public.coach_client_relationships
for each row execute function public.set_updated_at();

alter table public.athlete_profiles enable row level security;
alter table public.coach_profiles enable row level security;
alter table public.coach_client_relationships enable row level security;

drop policy if exists athlete_profiles_select_own on public.athlete_profiles;
create policy athlete_profiles_select_own on public.athlete_profiles
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists athlete_profiles_update_own on public.athlete_profiles;
create policy athlete_profiles_update_own on public.athlete_profiles
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists coach_profiles_select_relationship on public.coach_profiles;
create policy coach_profiles_select_relationship on public.coach_profiles
  for select to authenticated using (
    auth.uid() = user_id
    or exists (
      select 1
      from public.coach_client_relationships relationship
      where relationship.coach_id = coach_profiles.user_id
        and relationship.athlete_id = auth.uid()
        and relationship.status in ('pending', 'active')
    )
  );

drop policy if exists coach_client_relationships_select_party on public.coach_client_relationships;
create policy coach_client_relationships_select_party on public.coach_client_relationships
  for select to authenticated using (
    auth.uid() = coach_id or auth.uid() = athlete_id
  );

-- Relationship writes are deliberately service-only until the invitation and
-- athlete-consent RPCs ship. RLS therefore has no authenticated write policy.

-- Profiles are created by the auth trigger or verified server bootstrap. A
-- member may update personal fields, never tier/referral/entitlement columns.
revoke insert, update on public.profiles from authenticated;
grant select on public.profiles to authenticated;
grant update (email, display_name, persona, onboarding_status, onboarding_state, preferences)
  on public.profiles to authenticated;

create or replace function public.reserve_handle_auth_user_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')
  )
  on conflict (id) do update
    set email = excluded.email,
        display_name = coalesce(public.profiles.display_name, excluded.display_name);

  insert into public.athlete_profiles (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

revoke all on function public.reserve_handle_auth_user_identity() from public;

drop trigger if exists reserve_auth_user_identity on auth.users;
create trigger reserve_auth_user_identity
after insert or update of email, raw_user_meta_data on auth.users
for each row execute function public.reserve_handle_auth_user_identity();

-- Idempotent backfill for accounts created before this migration.
insert into public.profiles (id, email, display_name)
select
  user_record.id,
  user_record.email,
  coalesce(user_record.raw_user_meta_data ->> 'full_name', user_record.raw_user_meta_data ->> 'name')
from auth.users user_record
on conflict (id) do update
  set email = excluded.email,
      display_name = coalesce(public.profiles.display_name, excluded.display_name);

insert into public.athlete_profiles (user_id)
select profile.id from public.profiles profile
on conflict (user_id) do nothing;

-- ── Membership-scoped community RLS ────────────────────────────────────

create or replace function public.reserve_tier_rank(tier public.subscription_tier)
returns integer
language sql
immutable
strict
as $$
  select case tier when 'core' then 1 when 'pro' then 2 when 'elite' then 3 end;
$$;

create or replace function public.reserve_can_access_community_channel(target_channel_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.community_channels channel
    join public.profiles profile on profile.id = auth.uid()
    where channel.id = target_channel_id
      and (
        (
          channel.visibility <> 'private'
          and public.reserve_tier_rank(profile.current_tier)
            >= public.reserve_tier_rank(channel.required_tier)
        )
        or exists (
          select 1
          from public.community_memberships membership
          where membership.channel_id = channel.id
            and membership.user_id = auth.uid()
        )
      )
  );
$$;

revoke all on function public.reserve_can_access_community_channel(uuid) from public;
grant execute on function public.reserve_can_access_community_channel(uuid) to authenticated;

drop policy if exists "Authenticated users can read channels" on public.community_channels;
create policy community_channels_read_allowed on public.community_channels
  for select to authenticated
  using (public.reserve_can_access_community_channel(id));

drop policy if exists "Users can manage own channel memberships" on public.community_memberships;
create policy community_memberships_read_own on public.community_memberships
  for select to authenticated using (auth.uid() = user_id);
create policy community_memberships_join_open_channel on public.community_memberships
  for insert to authenticated with check (
    auth.uid() = user_id
    and role = 'member'
    and member_rank = 'member'
    and exists (
      select 1 from public.community_channels channel
      where channel.id = channel_id
        and channel.visibility <> 'private'
        and public.reserve_can_access_community_channel(channel.id)
    )
  );
create policy community_memberships_update_last_seen on public.community_memberships
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and role = 'member' and member_rank = 'member');

revoke update on public.community_memberships from authenticated;
grant update (last_seen_at) on public.community_memberships to authenticated;

drop policy if exists "Authenticated users can read messages" on public.community_messages;
drop policy if exists "Authenticated users can post own messages" on public.community_messages;
drop policy if exists "Users can update own messages" on public.community_messages;
create policy community_messages_read_allowed on public.community_messages
  for select to authenticated
  using (deleted_at is null and public.reserve_can_access_community_channel(channel_id));
create policy community_messages_insert_allowed on public.community_messages
  for insert to authenticated
  with check (auth.uid() = user_id and public.reserve_can_access_community_channel(channel_id));
create policy community_messages_update_own on public.community_messages
  for update to authenticated
  using (auth.uid() = user_id and public.reserve_can_access_community_channel(channel_id))
  with check (auth.uid() = user_id and public.reserve_can_access_community_channel(channel_id));

revoke insert, update on public.community_messages from authenticated;
grant insert (channel_id, user_id, parent_id, body, check_in_type, metadata)
  on public.community_messages to authenticated;
grant update (body, deleted_at) on public.community_messages to authenticated;

drop policy if exists "Authenticated users can react" on public.community_reactions;
create policy community_reactions_read_allowed on public.community_reactions
  for select to authenticated using (
    exists (
      select 1 from public.community_messages message
      where message.id = message_id
        and public.reserve_can_access_community_channel(message.channel_id)
    )
  );
create policy community_reactions_insert_own on public.community_reactions
  for insert to authenticated with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.community_messages message
      where message.id = message_id
        and public.reserve_can_access_community_channel(message.channel_id)
    )
  );
create policy community_reactions_delete_own on public.community_reactions
  for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "Authenticated users can manage own presence" on public.community_presence;
create policy community_presence_read_allowed on public.community_presence
  for select to authenticated using (
    channel_id is not null and public.reserve_can_access_community_channel(channel_id)
  );
create policy community_presence_insert_own on public.community_presence
  for insert to authenticated with check (
    auth.uid() = user_id
    and channel_id is not null
    and public.reserve_can_access_community_channel(channel_id)
  );
create policy community_presence_update_own on public.community_presence
  for update to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and channel_id is not null
    and public.reserve_can_access_community_channel(channel_id)
  );
create policy community_presence_delete_own on public.community_presence
  for delete to authenticated using (auth.uid() = user_id);

-- Members may erase their own cloud envelope before an account is deleted.
drop policy if exists member_state_delete_own on public.member_state;
create policy member_state_delete_own on public.member_state
  for delete to authenticated using (auth.uid() = user_id);

-- ── Private Storage ownership ───────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('progress-photos', 'progress-photos', false, 15728640, array['image/jpeg', 'image/png', 'image/webp']),
  ('body-scans', 'body-scans', false, 26214400, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  ('bloodwork-uploads', 'bloodwork-uploads', false, 26214400, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  ('avatars', 'avatars', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists reserve_private_files_select_own on storage.objects;
create policy reserve_private_files_select_own on storage.objects
  for select to authenticated using (
    bucket_id in ('progress-photos', 'body-scans', 'bloodwork-uploads', 'avatars')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists reserve_private_files_insert_own on storage.objects;
create policy reserve_private_files_insert_own on storage.objects
  for insert to authenticated with check (
    bucket_id in ('progress-photos', 'body-scans', 'bloodwork-uploads', 'avatars')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists reserve_private_files_update_own on storage.objects;
create policy reserve_private_files_update_own on storage.objects
  for update to authenticated
  using (
    bucket_id in ('progress-photos', 'body-scans', 'bloodwork-uploads', 'avatars')
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id in ('progress-photos', 'body-scans', 'bloodwork-uploads', 'avatars')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists reserve_private_files_delete_own on storage.objects;
create policy reserve_private_files_delete_own on storage.objects
  for delete to authenticated using (
    bucket_id in ('progress-photos', 'body-scans', 'bloodwork-uploads', 'avatars')
    and (storage.foldername(name))[1] = auth.uid()::text
  );
