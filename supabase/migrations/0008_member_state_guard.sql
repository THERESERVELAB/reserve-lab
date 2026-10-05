-- ════════════════════════════════════════════════════════════════════════
-- MEMBER STATE — the record cannot lose entries silently.
--
-- Until now the whole envelope was written straight from the browser and the
-- database took it as given. The per-entity merge lives in the client, so a
-- device writing a whole-slice replacement — no entity clocks, no tombstones
-- — simply won, and everything it did not carry was gone. That is how a
-- member lost logged compounds on 2026-09-18 and again on 2026-09-22: no
-- delete was ever recorded for them.
--
-- Two guarantees are added here, in Postgres, where no client can skip them:
--
--   1. HISTORY — every previous version of a member's state is kept for 30
--      days before it is replaced. Recovery stops depending on someone
--      having happened to take a backup.
--
--   2. RESURRECTION — the app's own rule ("an entry only stays gone if a
--      tombstone says it was deleted") is enforced on write. An incoming
--      state missing an entry it does not claim to have deleted gets that
--      entry put back, rather than the member losing it. A real delete still
--      works, because a real delete writes the tombstone.
--
-- The guard covers the health record: compounds, their adherence, injection
-- sites, cycles and bloodwork. It never edits anything else.
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.member_state_history (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  state jsonb not null,
  schema_version integer,
  replaced_at timestamptz not null default now()
);

create index if not exists member_state_history_user_idx
  on public.member_state_history (user_id, replaced_at desc);

alter table public.member_state_history enable row level security;

-- A member may read their own history. Nothing may write it but the trigger,
-- which runs as the table owner.
drop policy if exists "member reads own state history" on public.member_state_history;
create policy "member reads own state history"
  on public.member_state_history for select
  using (auth.uid() = user_id);

-- ─── The guard ──────────────────────────────────────────────────────────

create or replace function public.member_state_keep_entries()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  guarded text[] := array[
    'trainingSession.enhancementLog',
    'trainingSession.injectionLogs',
    'cyclePeriods',
    'bloodworkLogs'
  ];
  path_key text;
  segments text[];
  old_list jsonb;
  new_list jsonb;
  restored jsonb;
  entry jsonb;
  entry_id text;
  tombstone text;
begin
  -- 1. Keep the version being replaced.
  insert into public.member_state_history (user_id, state, schema_version)
  values (old.user_id, old.state, old.schema_version);

  delete from public.member_state_history
   where user_id = old.user_id
     and replaced_at < now() - interval '30 days';

  -- 2. Put back anything dropped without a tombstone.
  foreach path_key in array guarded loop
    segments := string_to_array(path_key, '.');
    old_list := old.state #> (array['slices'] || segments);
    new_list := new.state #> (array['slices'] || segments);

    if jsonb_typeof(old_list) <> 'array' or jsonb_typeof(new_list) <> 'array' then
      continue;
    end if;

    restored := new_list;

    for entry in select * from jsonb_array_elements(old_list) loop
      entry_id := entry ->> 'id';
      continue when entry_id is null;

      -- Still present in the incoming state? Nothing to do.
      continue when exists (
        select 1 from jsonb_array_elements(new_list) n where n ->> 'id' = entry_id
      );

      -- Gone. Only stays gone if the incoming state says it was deleted.
      tombstone := new.state #>> array['slices', 'syncLedger', 'deletions', path_key || '|' || entry_id];
      if tombstone is null then
        restored := restored || jsonb_build_array(entry);
      end if;
    end loop;

    if restored <> new_list then
      new.state := jsonb_set(new.state, array['slices'] || segments, restored, true);
    end if;
  end loop;

  return new;
end;
$$;

revoke execute on function public.member_state_keep_entries() from public, anon, authenticated;

drop trigger if exists member_state_keep_entries_trg on public.member_state;
create trigger member_state_keep_entries_trg
  before update on public.member_state
  for each row
  execute function public.member_state_keep_entries();
