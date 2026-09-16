-- User data (SPEC.md 5.2) with row level security (SPEC.md 9).

-- ---------------------------------------------------------------------------
-- Profiles and settings
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  handle text not null unique check (handle ~ '^[a-z0-9_]{3,20}$'),
  display_name text not null default '' check (char_length(display_name) <= 40),
  avatar_path text,
  home_city text,
  home_lat double precision,
  home_lng double precision,
  is_private boolean not null default false,
  share_seats boolean not null default false,
  show_on_overlap boolean not null default true,
  birth_date date,
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_handle_lower_idx on public.profiles (lower(handle));

create table public.notification_prefs (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  prefs jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.device_tokens (
  user_id uuid not null references public.profiles (id) on delete cascade,
  token text not null,
  platform text not null default 'ios',
  created_at timestamptz not null default now(),
  primary key (user_id, token)
);

create table public.user_teams (
  user_id uuid not null references public.profiles (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, team_id)
);

-- ---------------------------------------------------------------------------
-- Attendances, companions, pledges, check-ins
-- ---------------------------------------------------------------------------

create table public.attendances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  game_id uuid not null references public.games (id) on delete cascade,
  source text not null check (source in ('manual', 'screenshot', 'email', 'checkin', 'import')),
  status text not null default 'attended' check (status in ('going', 'attended')),
  verified boolean not null default false,
  verified_via text check (verified_via in ('checkin', 'screenshot', 'email')),
  note text check (char_length(note) <= 1000),
  rooting_team_id uuid references public.teams (id),
  rooting_basis text check (rooting_basis in ('favorite', 'pledge', 'chosen')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, game_id)
);
create index attendances_user_idx on public.attendances (user_id);
create index attendances_game_idx on public.attendances (game_id);

-- Seat details are split out so their visibility can be controlled separately (SPEC 9: opt-in).
create table public.attendance_seats (
  attendance_id uuid primary key references public.attendances (id) on delete cascade,
  section text,
  row text,
  seat text,
  price_cents integer check (price_cents is null or price_cents >= 0)
);

create table public.people (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  linked_user_id uuid references public.profiles (id) on delete set null,
  invite_token text unique,
  created_at timestamptz not null default now(),
  unique (owner_user_id, linked_user_id)
);
create index people_owner_idx on public.people (owner_user_id);
create index people_linked_idx on public.people (linked_user_id) where linked_user_id is not null;

create table public.attendance_companions (
  attendance_id uuid not null references public.attendances (id) on delete cascade,
  person_id uuid not null references public.people (id) on delete cascade,
  primary key (attendance_id, person_id)
);
create index attendance_companions_person_idx on public.attendance_companions (person_id);

create table public.pledges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  game_id uuid not null references public.games (id) on delete cascade,
  team_id uuid not null references public.teams (id),
  pledged_at timestamptz not null default now(),
  win_prob_at_pledge numeric(6, 5) not null check (win_prob_at_pledge between 0 and 1),
  estimated_lock_at timestamptz,
  status text not null default 'provisional' check (status in ('provisional', 'valid', 'void')),
  void_reason text,
  result text check (result in ('win', 'loss', 'tie')),
  validated_at timestamptz,
  unique (user_id, game_id)
);
create index pledges_game_idx on public.pledges (game_id);

create table public.checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  game_id uuid not null references public.games (id) on delete cascade,
  checked_in_at timestamptz not null default now(),
  distance_m integer not null,
  accuracy_m integer not null,
  unique (user_id, game_id)
);
create index checkins_game_idx on public.checkins (game_id);

-- ---------------------------------------------------------------------------
-- Social
-- ---------------------------------------------------------------------------

create table public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  followee_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'requested')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);
create index follows_followee_idx on public.follows (followee_id);

create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index blocks_blocked_idx on public.blocks (blocked_id);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  target_type text not null check (target_type in ('user', 'attendance', 'feed_event', 'person')),
  target_id uuid not null,
  reason text not null check (char_length(reason) between 1 and 500),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolution text
);

-- ---------------------------------------------------------------------------
-- Imports
-- ---------------------------------------------------------------------------

create table public.ticket_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  source text not null check (source in ('screenshot', 'email')),
  storage_path text,
  raw_text text,
  parsed jsonb,
  status text not null default 'pending' check (status in ('pending', 'parsed', 'needs_review', 'matched', 'failed', 'discarded')),
  candidate_game_ids uuid[] not null default '{}',
  matched_attendance_id uuid references public.attendances (id) on delete set null,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  image_deleted_at timestamptz
);
create index ticket_imports_user_idx on public.ticket_imports (user_id, created_at desc);

create table public.inbound_addresses (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  token text not null unique,
  created_at timestamptz not null default now(),
  rotated_at timestamptz
);

create table public.user_emails (
  user_id uuid not null references public.profiles (id) on delete cascade,
  email text not null,
  verified boolean not null default false,
  otp_hash text,
  otp_expires_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (user_id, email)
);
create index user_emails_lower_idx on public.user_emails (lower(email)) where verified;

create table public.inbound_rejections (
  user_id uuid not null references public.profiles (id) on delete cascade,
  notified_on date not null,
  primary key (user_id, notified_on)
);

-- ---------------------------------------------------------------------------
-- Goals, bucket lists, feed, wrapped, stats cache
-- ---------------------------------------------------------------------------

create table public.bucket_lists (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  description text,
  is_curated boolean not null default false,
  definition jsonb not null,
  created_at timestamptz not null default now(),
  check (is_curated = (owner_user_id is null))
);

create table public.user_bucket_lists (
  user_id uuid not null references public.profiles (id) on delete cascade,
  bucket_list_id uuid not null references public.bucket_lists (id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (user_id, bucket_list_id)
);

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  year integer not null check (year between 2000 and 2100),
  title text not null check (char_length(title) between 1 and 80),
  definition jsonb not null,
  source text not null check (source in ('template', 'custom', 'suggested')),
  progress jsonb not null default '{}'::jsonb,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index goals_user_year_idx on public.goals (user_id, year);

create table public.feed_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in ('logged_game', 'pledge_won', 'pledge_lost', 'new_stamp', 'goal_completed', 'milestone', 'wrapped_published')),
  game_id uuid references public.games (id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  visibility text not null default 'followers' check (visibility in ('followers', 'public', 'private')),
  created_at timestamptz not null default now()
);
create index feed_events_actor_idx on public.feed_events (actor_user_id, created_at desc);
create index feed_events_created_idx on public.feed_events (created_at desc);

create table public.reactions (
  feed_event_id uuid not null references public.feed_events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  emoji text not null check (emoji in ('🔥', '👏', '😭', '🤝', '🏟️', '🍀')),
  created_at timestamptz not null default now(),
  primary key (feed_event_id, user_id)
);

create table public.wrapped_snapshots (
  user_id uuid not null references public.profiles (id) on delete cascade,
  sport_id text not null references public.sports (id),
  season integer not null,
  payload jsonb not null,
  generated_at timestamptz not null default now(),
  primary key (user_id, sport_id, season)
);

create table public.user_stats_cache (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  computed_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  sent_at timestamptz
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

-- Reference-schema additions used by ingestion scheduling.
alter table public.games add column detail_rechecked_at timestamptz;

-- ---------------------------------------------------------------------------
-- Helper functions (security definer so they can see rows the caller cannot)
-- ---------------------------------------------------------------------------

create or replace function public.is_blocked_between(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  );
$$;

create or replace function public.follows_active(p_follower uuid, p_followee uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.follows
    where follower_id = p_follower and followee_id = p_followee and status = 'active'
  );
$$;

create or replace function public.is_mutual(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.follows_active(a, b) and public.follows_active(b, a) and not public.is_blocked_between(a, b);
$$;

-- Can the current user see `target`'s passport data (attendances, records, feed events)?
create or replace function public.can_view_user(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when auth.uid() is null then false
    when auth.uid() = target then true
    when public.is_blocked_between(auth.uid(), target) then false
    when exists (select 1 from public.profiles p where p.id = target and not p.is_private) then true
    else public.follows_active(auth.uid(), target)
  end;
$$;

-- Can the current user see the basic profile card of `target` (handle, name, avatar)?
create or replace function public.can_view_profile(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and (auth.uid() = target or not public.is_blocked_between(auth.uid(), target));
$$;

create or replace function public.attendance_visible(p_attendance_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.attendances a where a.id = p_attendance_id and public.can_view_user(a.user_id)
  );
$$;

create or replace function public.can_view_seats(p_attendance_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.attendances a
    join public.profiles p on p.id = a.user_id
    where a.id = p_attendance_id
      and (a.user_id = auth.uid() or (p.share_seats and public.is_mutual(auth.uid(), a.user_id)))
  );
$$;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  base text;
  candidate text;
  attempt integer := 0;
begin
  base := 'fan_' || substr(replace(new.id::text, '-', ''), 1, 8);
  candidate := base;
  while exists (select 1 from public.profiles where handle = candidate) and attempt < 10 loop
    attempt := attempt + 1;
    candidate := base || encode(gen_random_bytes(2), 'hex');
  end loop;
  insert into public.profiles (id, handle, display_name)
  values (new.id, candidate, left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 40))
  on conflict (id) do nothing;
  insert into public.inbound_addresses (user_id, token)
  values (new.id, encode(gen_random_bytes(9), 'hex'))
  on conflict (user_id) do nothing;
  insert into public.notification_prefs (user_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.enforce_min_age()
returns trigger
language plpgsql
as $$
begin
  if new.birth_date is not null and new.birth_date > (current_date - interval '13 years') then
    raise exception 'You must be at least 13 to use Jinx' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger profiles_min_age
  before insert or update of birth_date on public.profiles
  for each row execute function public.enforce_min_age();

create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger attendances_set_updated_at before update on public.attendances for each row execute function public.set_updated_at();
create trigger ticket_imports_set_updated_at before update on public.ticket_imports for each row execute function public.set_updated_at();

-- Follow requests: private targets start as 'requested'; blocked pairs cannot follow.
create or replace function public.before_follow_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_blocked_between(new.follower_id, new.followee_id) then
    raise exception 'cannot follow this user' using errcode = 'insufficient_privilege';
  end if;
  if exists (select 1 from public.profiles where id = new.followee_id and is_private) then
    new.status := 'requested';
    new.accepted_at := null;
  else
    new.status := 'active';
    new.accepted_at := now();
  end if;
  return new;
end;
$$;

create trigger follows_before_insert before insert on public.follows for each row execute function public.before_follow_insert();

-- Blocking removes follows in both directions.
create or replace function public.after_block_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.follows
  where (follower_id = new.blocker_id and followee_id = new.blocked_id)
     or (follower_id = new.blocked_id and followee_id = new.blocker_id);
  return new;
end;
$$;

create trigger blocks_after_insert after insert on public.blocks for each row execute function public.after_block_insert();

-- Tagging a followed user reuses or creates a linked person row for the owner.
create or replace function public.person_for_user(p_owner uuid, p_linked uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  pid uuid;
begin
  if p_owner <> auth.uid() then
    raise exception 'not allowed' using errcode = 'insufficient_privilege';
  end if;
  if not public.follows_active(p_owner, p_linked) or public.is_blocked_between(p_owner, p_linked) then
    raise exception 'you can only tag people you follow' using errcode = 'insufficient_privilege';
  end if;
  select id into pid from public.people where owner_user_id = p_owner and linked_user_id = p_linked;
  if pid is null then
    insert into public.people (owner_user_id, display_name, linked_user_id)
    select p_owner, coalesce(nullif(p.display_name, ''), p.handle), p_linked from public.profiles p where p.id = p_linked
    returning id into pid;
  end if;
  return pid;
end;
$$;

-- ---------------------------------------------------------------------------
-- Ingestion support
-- ---------------------------------------------------------------------------

create or replace function public.games_needing_detail(p_provider text, p_limit integer default 200)
returns table (provider_game_id text)
language sql
stable
security definer
set search_path = public
as $$
  select distinct g.provider_game_id
  from public.games g
  join public.attendances a on a.game_id = g.id
  where g.provider = p_provider
    and g.status = 'final'
    and g.detail_ingested_at is null
  limit p_limit;
$$;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['profiles','notification_prefs','device_tokens','user_teams','attendances','attendance_seats','people',
    'attendance_companions','pledges','checkins','follows','blocks','reports','ticket_imports','inbound_addresses','user_emails',
    'inbound_rejections','bucket_lists','user_bucket_lists','goals','feed_events','reactions','wrapped_snapshots','user_stats_cache','notifications']
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- profiles: basic card visible unless blocked; only the owner writes. Inserts come from the auth trigger.
create policy profiles_select on public.profiles for select to authenticated using (public.can_view_profile(id));
create policy profiles_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy notification_prefs_own on public.notification_prefs for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy device_tokens_own on public.device_tokens for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notifications_own_select on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notifications_own_update on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy user_teams_select on public.user_teams for select to authenticated using (public.can_view_user(user_id));
create policy user_teams_write on public.user_teams for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy attendances_select on public.attendances for select to authenticated using (public.can_view_user(user_id));
create policy attendances_insert on public.attendances for insert to authenticated with check (user_id = auth.uid());
create policy attendances_update on public.attendances for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy attendances_delete on public.attendances for delete to authenticated using (user_id = auth.uid());

create policy attendance_seats_select on public.attendance_seats for select to authenticated using (public.can_view_seats(attendance_id));
create policy attendance_seats_write on public.attendance_seats for all to authenticated
  using (exists (select 1 from public.attendances a where a.id = attendance_id and a.user_id = auth.uid()))
  with check (exists (select 1 from public.attendances a where a.id = attendance_id and a.user_id = auth.uid()));

create policy people_select on public.people for select to authenticated using (owner_user_id = auth.uid() or linked_user_id = auth.uid());
create policy people_insert on public.people for insert to authenticated with check (owner_user_id = auth.uid() and linked_user_id is null);
create policy people_update on public.people for update to authenticated using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
create policy people_delete on public.people for delete to authenticated using (owner_user_id = auth.uid());

create policy attendance_companions_select on public.attendance_companions for select to authenticated
  using (public.attendance_visible(attendance_id) or exists (select 1 from public.people p where p.id = person_id and p.linked_user_id = auth.uid()));
create policy attendance_companions_insert on public.attendance_companions for insert to authenticated
  with check (exists (select 1 from public.attendances a where a.id = attendance_id and a.user_id = auth.uid())
              and exists (select 1 from public.people p where p.id = person_id and p.owner_user_id = auth.uid()));
create policy attendance_companions_delete on public.attendance_companions for delete to authenticated
  using (exists (select 1 from public.attendances a where a.id = attendance_id and a.user_id = auth.uid())
         or exists (select 1 from public.people p where p.id = person_id and p.linked_user_id = auth.uid()));

create policy pledges_select on public.pledges for select to authenticated using (public.can_view_user(user_id));
create policy pledges_insert on public.pledges for insert to authenticated with check (user_id = auth.uid());
create policy pledges_update on public.pledges for update to authenticated using (user_id = auth.uid() and status = 'provisional') with check (user_id = auth.uid());

create policy checkins_select on public.checkins for select to authenticated using (user_id = auth.uid() or public.is_mutual(auth.uid(), user_id));
create policy checkins_insert on public.checkins for insert to authenticated with check (user_id = auth.uid());

create policy follows_select on public.follows for select to authenticated using (follower_id = auth.uid() or followee_id = auth.uid());
create policy follows_insert on public.follows for insert to authenticated with check (follower_id = auth.uid());
create policy follows_update on public.follows for update to authenticated using (followee_id = auth.uid()) with check (followee_id = auth.uid() and status = 'active');
create policy follows_delete on public.follows for delete to authenticated using (follower_id = auth.uid() or followee_id = auth.uid());

create policy blocks_own on public.blocks for all to authenticated using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());
create policy reports_insert on public.reports for insert to authenticated with check (reporter_id = auth.uid());
create policy reports_select on public.reports for select to authenticated using (reporter_id = auth.uid());

create policy ticket_imports_own on public.ticket_imports for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy inbound_addresses_own_select on public.inbound_addresses for select to authenticated using (user_id = auth.uid());
create policy user_emails_own on public.user_emails for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy bucket_lists_select on public.bucket_lists for select to authenticated using (is_curated or owner_user_id = auth.uid());
create policy bucket_lists_write on public.bucket_lists for all to authenticated using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid() and not is_curated);
create policy user_bucket_lists_select on public.user_bucket_lists for select to authenticated using (public.can_view_user(user_id));
create policy user_bucket_lists_write on public.user_bucket_lists for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy goals_select on public.goals for select to authenticated using (public.can_view_user(user_id));
create policy goals_write on public.goals for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy feed_events_select on public.feed_events for select to authenticated
  using (actor_user_id = auth.uid()
         or (visibility <> 'private' and public.can_view_user(actor_user_id) and public.follows_active(auth.uid(), actor_user_id)));
create policy reactions_select on public.reactions for select to authenticated
  using (exists (select 1 from public.feed_events f where f.id = feed_event_id
                 and (f.actor_user_id = auth.uid() or (public.can_view_user(f.actor_user_id) and public.follows_active(auth.uid(), f.actor_user_id)))));
create policy reactions_write on public.reactions for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy wrapped_select on public.wrapped_snapshots for select to authenticated using (public.can_view_user(user_id));
create policy stats_cache_select on public.user_stats_cache for select to authenticated using (public.can_view_user(user_id));

-- ---------------------------------------------------------------------------
-- Storage: private ticket images under ticket-imports/{user_id}/...
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ticket-imports', 'ticket-imports', false, 15728640, array['image/png', 'image/jpeg', 'image/heic', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

create policy ticket_images_owner_select on storage.objects for select to authenticated
  using (bucket_id = 'ticket-imports' and (storage.foldername(name))[1] = auth.uid()::text);
create policy ticket_images_owner_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'ticket-imports' and (storage.foldername(name))[1] = auth.uid()::text);
create policy ticket_images_owner_delete on storage.objects for delete to authenticated
  using (bucket_id = 'ticket-imports' and (storage.foldername(name))[1] = auth.uid()::text);
