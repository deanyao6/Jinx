-- Social v2, prompt 1: season streaks, badges, per-season counts and four favorites
-- (docs/prompts/social/01, section 3). Prompt 4 computes and shows them.
--
-- Streaks, earned badges and counts are passport data: read by whoever can see the fan's
-- passport (`can_view_user`), written by the server alone (section 4: nobody writes another
-- user's counters, badges or streaks, and nobody writes their own either). Four favorites are
-- the fan's own to set.
--
-- Badges reuse the goals predicate format (SPEC 6.13) in `criteria`, and the eight easter eggs
-- in features/eggs/flags.ts become `is_secret` badges (00, R6); prompt 4 seeds both.

create table public.season_streaks (
  user_id uuid not null references public.profiles (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete cascade,
  sport_id text not null references public.sports (id),
  start_season integer not null,
  end_season integer not null,
  seasons integer not null check (seasons >= 1),
  -- The "never fewer than N" floor: the fewest games in any season of the run.
  min_games integer not null check (min_games >= 1),
  is_active boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (user_id, team_id),
  check (end_season >= start_season)
);
alter table public.season_streaks enable row level security;

create table public.badges (
  key text primary key check (key ~ '^[a-z0-9_]+$'),
  name text not null check (char_length(name) between 1 and 60),
  description text not null check (char_length(description) between 1 and 280),
  -- A goals predicate (SPEC 6.13), evaluated by the same typed evaluator. Never SQL.
  criteria jsonb not null,
  tier text not null default 'standard' check (tier in ('standard', 'rare', 'legendary')),
  -- Null for every sport; a sport id for a badge only one league can earn.
  sport_id text references public.sports (id),
  is_secret boolean not null default false
);
alter table public.badges enable row level security;

create table public.user_badges (
  user_id uuid not null references public.profiles (id) on delete cascade,
  badge_key text not null references public.badges (key) on delete cascade,
  earned_at timestamptz not null default now(),
  context jsonb not null default '{}'::jsonb,
  primary key (user_id, badge_key)
);
create index user_badges_badge_idx on public.user_badges (badge_key);
alter table public.user_badges enable row level security;

-- `season` is part of the key, so it is 0 for the lifetime count rather than null.
create table public.user_counts (
  user_id uuid not null references public.profiles (id) on delete cascade,
  sport_id text not null references public.sports (id),
  season integer not null default 0,
  games integer not null default 0 check (games >= 0),
  verified_games integer not null default 0 check (verified_games >= 0 and verified_games <= games),
  primary key (user_id, sport_id, season)
);
alter table public.user_counts enable row level security;

create table public.favorite_games (
  user_id uuid not null references public.profiles (id) on delete cascade,
  ordinal integer not null check (ordinal between 1 and 4),
  game_id uuid not null references public.games (id) on delete cascade,
  note text check (note is null or char_length(note) between 1 and 140),
  primary key (user_id, ordinal),
  unique (user_id, game_id)
);
alter table public.favorite_games enable row level security;

-- Server-computed passport data: readable with the passport, and no write policy at all.
create policy season_streaks_select on public.season_streaks for select to authenticated
  using (public.can_view_user(user_id));
create policy user_badges_select on public.user_badges for select to authenticated
  using (public.can_view_user(user_id));
create policy user_counts_select on public.user_counts for select to authenticated
  using (public.can_view_user(user_id));

-- A secret badge's definition stays secret until you have it; one someone else earned shows
-- on their passport through user_badges.
create policy badges_select on public.badges for select to authenticated
  using (
    not is_secret
    or exists (select 1 from public.user_badges ub where ub.badge_key = badges.key and ub.user_id = auth.uid())
  );

create policy favorite_games_select on public.favorite_games for select to authenticated
  using (public.can_view_user(user_id));
create policy favorite_games_write on public.favorite_games for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- The data export holds everything Jinx keeps about a fan (STATE.md), so every new table a fan
-- has rows in joins it. A second object keeps the call under Postgres's 100-argument limit.
do $$
declare
  v_def text;
  v_anchor text := $f$'stats', (select payload from public.user_stats_cache where user_id = auth.uid())
  );$f$;
begin
  select pg_get_functiondef('public.export_my_data'::regproc) into v_def;
  if position(v_anchor in v_def) = 0 then
    raise exception 'export_my_data(): the closing stats entry is not where it was expected';
  end if;
  execute replace(v_def, v_anchor, $f$'stats', (select payload from public.user_stats_cache where user_id = auth.uid())
  ) || jsonb_build_object(
    'posts', (select coalesce(jsonb_agg(to_jsonb(p) order by p.created_at), '[]'::jsonb) from public.posts p where p.author_id = auth.uid()),
    'post_photos', (select coalesce(jsonb_agg(to_jsonb(ph)), '[]'::jsonb) from public.post_photos ph join public.posts p on p.id = ph.post_id where p.author_id = auth.uid()),
    'comments', (select coalesce(jsonb_agg(to_jsonb(c) order by c.created_at), '[]'::jsonb) from public.comments c where c.author_id = auth.uid()),
    'kudos', (select coalesce(jsonb_agg(to_jsonb(k)), '[]'::jsonb) from public.kudos k where k.user_id = auth.uid()),
    'mutes', (select coalesce(jsonb_agg(jsonb_build_object('handle', pr.handle, 'since', m.created_at)), '[]'::jsonb) from public.mutes m join public.profiles pr on pr.id = m.muted_id where m.user_id = auth.uid()),
    'communities', (select coalesce(jsonb_agg(jsonb_build_object('slug', c.slug, 'role', cm.role, 'joined_at', cm.joined_at)), '[]'::jsonb) from public.community_members cm join public.communities c on c.id = cm.community_id where cm.user_id = auth.uid()),
    'badges', (select coalesce(jsonb_agg(to_jsonb(ub)), '[]'::jsonb) from public.user_badges ub where ub.user_id = auth.uid()),
    'season_streaks', (select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb) from public.season_streaks s where s.user_id = auth.uid()),
    'counts', (select coalesce(jsonb_agg(to_jsonb(u)), '[]'::jsonb) from public.user_counts u where u.user_id = auth.uid()),
    'favorite_games', (select coalesce(jsonb_agg(to_jsonb(f) order by f.ordinal), '[]'::jsonb) from public.favorite_games f where f.user_id = auth.uid())
  );$f$);
end;
$$;
