-- Tables the Jinx spec revision 7 adds (SPEC.md 5.1, 5.2, 4.7, 6.18, 6.19):
--   team_colors        per-team light and dark palettes, mirroring the reference .t-* classes
--   venue_shapes       stadium outline SVG paths used by seals and thumbnails
--   detail_queue       on-demand game detail, replacing bulk ingestion (4.7)
--   game_wp_timeline   in-game win probability series, drawn by Relive (6.19)
--   game_story_steps   the Relive story player's steps (6.19)
--   storylines         pregame, fact-grounded sentences shown on Pick a side (6.18)
--   attendance_photos  a user's photos and videos for one attended game (6.19)
--
-- The first six are reference data: readable by any authenticated user, written only by the
-- service role. attendance_photos is user data and carries the Section 9 privacy rules.

-- ---------------------------------------------------------------------------
-- Team colors. Dark variants are hand-tuned, never computed from the light ones
-- (SPEC.md 5.1, 8.2). --tf and --on are shared across themes, matching the CSS.
-- ---------------------------------------------------------------------------
create table public.team_colors (
  team_id uuid primary key references public.teams (id) on delete cascade,
  fill_hex text not null,                -- --tf: badge/button/pill fill, same in both themes
  on_fill_hex text not null,             -- --on: text drawn on top of fill_hex
  primary_light_hex text not null,       -- --t  (light)
  secondary_light_hex text not null,     -- --t2 (light)
  primary_dark_hex text not null,        -- --t  (dark)
  secondary_dark_hex text not null,      -- --t2 (dark)
  source text not null default 'hand_tuned' check (source in ('reference', 'hand_tuned')),
  updated_at timestamptz not null default now(),
  check (fill_hex ~* '^#[0-9a-f]{6}$'),
  check (on_fill_hex ~* '^#[0-9a-f]{6}$'),
  check (primary_light_hex ~* '^#[0-9a-f]{6}$'),
  check (secondary_light_hex ~* '^#[0-9a-f]{6}$'),
  check (primary_dark_hex ~* '^#[0-9a-f]{6}$'),
  check (secondary_dark_hex ~* '^#[0-9a-f]{6}$')
);

create trigger team_colors_set_updated_at
  before update on public.team_colors
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Venue shapes. v1 ships the reference's stylized placeholders keyed by shape name;
-- a later pass traces real OSM footprints into svg_path (SPEC.md 8.5).
-- ---------------------------------------------------------------------------
create table public.venue_shapes (
  venue_id uuid primary key references public.venues (id) on delete cascade,
  shape_key text not null,               -- 'ballparkA' | 'dodger' | 'wrigley' | 'oracle' | 'bowl' | 'canopy' | 'colonnade'
  svg_path text,                         -- null while the placeholder shape_key is authoritative
  source text not null default 'placeholder' check (source in ('placeholder', 'osm_traced')),
  simplified_at timestamptz,
  -- An OSM-traced shape must actually carry a path; a placeholder must not.
  check ((source = 'placeholder' and svg_path is null) or (source = 'osm_traced' and svg_path is not null))
);
create index venue_shapes_shape_key_idx on public.venue_shapes (shape_key);

-- ---------------------------------------------------------------------------
-- On-demand detail queue (SPEC.md 4.7). Supersedes games_needing_detail(), which
-- only ever noticed games that already had an attendance row.
-- ---------------------------------------------------------------------------
create table public.detail_queue (
  game_id uuid primary key references public.games (id) on delete cascade,
  reason text not null check (reason in ('attendance', 'checkin', 'going', 'ticket_match', 'refresh')),
  requested_at timestamptz not null default now(),
  attempts integer not null default 0,
  last_error text,
  done_at timestamptz
);
-- The worker drains oldest-first; this index keeps that scan to the open rows only.
create index detail_queue_pending_idx on public.detail_queue (requested_at) where done_at is null;

-- Queue a game for detail, keeping the earliest request. A game already ingested is
-- only re-queued for an explicit 'refresh' (the ~12h post-final correction pass, 4.7).
create or replace function public.enqueue_game_detail(p_game_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_reason <> 'refresh' and exists (
    select 1 from public.games g where g.id = p_game_id and g.detail_ingested_at is not null
  ) then
    return;
  end if;

  insert into public.detail_queue (game_id, reason)
  values (p_game_id, p_reason)
  on conflict (game_id) do update
    set done_at = null,
        attempts = 0,
        last_error = null,
        reason = case when public.detail_queue.done_at is not null then excluded.reason
                 else public.detail_queue.reason end;
end;
$$;

-- Creating an attendance or a check-in queues that game's detail.
create or replace function public.enqueue_detail_from_attendance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.enqueue_game_detail(new.game_id, 'attendance');
  return new;
end;
$$;

create or replace function public.enqueue_detail_from_checkin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.enqueue_game_detail(new.game_id, 'checkin');
  return new;
end;
$$;

create trigger attendances_enqueue_detail
  after insert on public.attendances
  for each row execute function public.enqueue_detail_from_attendance();

create trigger checkins_enqueue_detail
  after insert on public.checkins
  for each row execute function public.enqueue_detail_from_checkin();

-- Games the detail worker should process now: queued, not done, and already final.
-- Future games stay queued until they finish (4.7).
create or replace function public.detail_queue_pending(p_provider text, p_limit integer default 50)
returns table (game_id uuid, provider_game_id text, reason text, attempts integer)
language sql
stable
security definer
set search_path = public
as $$
  select q.game_id, g.provider_game_id, q.reason, q.attempts
  from public.detail_queue q
  join public.games g on g.id = q.game_id
  where q.done_at is null
    and g.provider = p_provider
    and g.status = 'final'
  order by q.requested_at
  limit p_limit;
$$;

-- ---------------------------------------------------------------------------
-- Win probability timeline and Relive story steps (SPEC.md 6.19).
-- ---------------------------------------------------------------------------
create table public.game_wp_timeline (
  game_id uuid not null references public.games (id) on delete cascade,
  seq integer not null,
  period integer not null,
  half text check (half in ('top', 'bottom')),
  home_wp numeric(6, 5) not null check (home_wp between 0 and 1),
  occurred_at timestamptz,
  primary key (game_id, seq)
);

create table public.game_story_steps (
  game_id uuid not null references public.games (id) on delete cascade,
  seq integer not null,
  wp_seq integer not null,               -- which game_wp_timeline point this step sits on
  away_score integer not null,
  home_score integer not null,
  label text not null,                   -- period label shown in the scorebug, e.g. "Top 9th"
  text text not null,                    -- templated from play-by-play; never model-written
  primary key (game_id, seq),
  foreign key (game_id, wp_seq) references public.game_wp_timeline (game_id, seq) on delete cascade
);

-- ---------------------------------------------------------------------------
-- Storylines (SPEC.md 6.18). `facts` is the JSON the sentence was grounded in and
-- is kept so a sentence can be re-validated against it.
-- ---------------------------------------------------------------------------
create table public.storylines (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete cascade,
  text text not null,
  source text not null check (source in ('results', 'injury_report', 'probable_starter')),
  facts jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default now()
);
create index storylines_game_idx on public.storylines (game_id, team_id);

-- ---------------------------------------------------------------------------
-- Attendance photos (SPEC.md 5.2, 6.19). Storage objects live in the private
-- `attendance-photos` bucket under <user_id>/...; this table holds the metadata
-- and is what the "From fans at this game" query reads.
-- ---------------------------------------------------------------------------
create table public.attendance_photos (
  id uuid primary key default gen_random_uuid(),
  attendance_id uuid not null references public.attendances (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  storage_path text not null unique,
  kind text not null check (kind in ('photo', 'video')),
  visibility text not null default 'private' check (visibility in ('private', 'followers', 'public')),
  created_at timestamptz not null default now()
);
create index attendance_photos_attendance_idx on public.attendance_photos (attendance_id);
create index attendance_photos_user_idx on public.attendance_photos (user_id);

-- "From fans at this game": public items, from public accounts, excluding blocked
-- users and the viewer's own photos (those render in "Your photos"). SPEC.md 6.19.
create or replace function public.game_fan_photos(p_game_id uuid, p_limit integer default 30)
returns table (id uuid, user_id uuid, storage_path text, kind text, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select ph.id, ph.user_id, ph.storage_path, ph.kind, ph.created_at
  from public.attendance_photos ph
  join public.attendances a on a.id = ph.attendance_id
  join public.profiles p on p.id = ph.user_id
  where a.game_id = p_game_id
    and ph.visibility = 'public'
    and not p.is_private
    and ph.user_id <> auth.uid()
    and not public.is_blocked_between(auth.uid(), ph.user_id)
  order by ph.created_at desc
  limit p_limit;
$$;

-- One visibility rule, used by both the metadata policy and the storage policy, so
-- the object and its row can never disagree about who may read them.
create or replace function public.can_view_attendance_photo(p_photo_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.attendance_photos ph
    where ph.id = p_photo_id
      and (
        ph.user_id = auth.uid()
        or (
          public.attendance_visible(ph.attendance_id)
          and not public.is_blocked_between(auth.uid(), ph.user_id)
          and (
            ph.visibility = 'public'
            or (ph.visibility = 'followers' and public.follows_active(auth.uid(), ph.user_id))
          )
        )
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

-- Reference data: readable by any authenticated user, service role writes only.
do $$
declare t text;
begin
  foreach t in array array['team_colors', 'venue_shapes', 'game_wp_timeline', 'game_story_steps', 'storylines']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using (true)', t || '_read_authenticated', t);
  end loop;
end $$;

-- The queue is operational bookkeeping: service role only, no policies.
alter table public.detail_queue enable row level security;

-- Photos follow Section 9. A viewer sees a photo when they own it, or when the
-- attendance is visible to them AND the item's own visibility allows it.
alter table public.attendance_photos enable row level security;

create policy attendance_photos_select on public.attendance_photos for select to authenticated
  using (public.can_view_attendance_photo(id));

-- Insert only against your own attendance, and only tagged as yourself.
create policy attendance_photos_insert on public.attendance_photos for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.attendances a where a.id = attendance_id and a.user_id = auth.uid())
  );

create policy attendance_photos_update on public.attendance_photos for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy attendance_photos_delete on public.attendance_photos for delete to authenticated
  using (user_id = auth.uid());

-- Storage bucket. Private: even public items are served through signed URLs, so a
-- leaked path cannot be replayed indefinitely.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('attendance-photos', 'attendance-photos', false, 52428800,
        array['image/jpeg', 'image/png', 'image/heic', 'image/webp', 'video/mp4', 'video/quicktime'])
on conflict (id) do nothing;

create policy attendance_photos_owner_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'attendance-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy attendance_photos_owner_update on storage.objects for update to authenticated
  using (bucket_id = 'attendance-photos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'attendance-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy attendance_photos_owner_delete on storage.objects for delete to authenticated
  using (bucket_id = 'attendance-photos' and (storage.foldername(name))[1] = auth.uid()::text);
-- Reads mirror the metadata policy, so revoking visibility revokes the object too.
-- The check is a security-definer function rather than a subquery on
-- attendance_photos: a subquery here would be filtered by that table's own RLS,
-- which makes the effective rule hard to reason about and easy to widen by accident.
create policy attendance_photos_object_select on storage.objects for select to authenticated
  using (
    bucket_id = 'attendance-photos'
    and exists (
      select 1 from public.attendance_photos ph
      where ph.storage_path = storage.objects.name
        and public.can_view_attendance_photo(ph.id)
    )
  );

-- ---------------------------------------------------------------------------
-- Rename fallout: the app is Jinx, not APPNAME. The string lives inside a function
-- body, so the original migration was corrected in place for a fresh `db reset` and
-- redefined here so an already-migrated database picks it up without one.
-- ---------------------------------------------------------------------------
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
