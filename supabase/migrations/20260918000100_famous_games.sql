-- Famous games, superstars and personal badges (docs/prompts/famous-games.md, Dean 2026-09-17).
--
-- Three layers, one badge, one count:
--
--   famous_games      a game that is famous on its own. `schedule` rows are the championship and
--                     the two games before it, built from the games table by
--                     rebuild_schedule_famous_games(); `curated` rows come from
--                     seed/famous_games.json through ingest/src/famous/curated.ts.
--   player_honors     awards, one row per (player, season, honor). honor_kinds says what each
--                     honor is called and how long it makes someone a star (Z = 3 seasons).
--   franchise_players the curated tier: one to three names per team per era, and the
--                     transcendent few with no team at all. seed/franchise_players.json.
--   player_moves      when a player joined a team (MLB transactions, NFL weekly rosters).
--   player_firsts     a player's first something, with the game it happened in (NFL first
--                     touchdown today; the kind is text so a new first is a row).
--   players.debut_on, players.rookie_season   from the MLB people endpoint and nflverse players.csv.
--
-- Personal badges are not stored: user_famous_games(user) computes them from the fan's own
-- favourite players, attendances and the appearance rows for those games, so they follow a
-- favourite the moment it is added and vanish the moment it is removed.
--
-- Everything here is keyed by sport_id where a sport matters (honor_kinds, famous_rounds), so a
-- new league is rows and a provider, not a rewrite.

-- ---------------------------------------------------------------------------
-- Players: debut and rookie season
-- ---------------------------------------------------------------------------
alter table public.players add column if not exists debut_on date;
alter table public.players add column if not exists rookie_season integer;

comment on column public.players.debut_on is
  'First game in the league. MLB: mlbDebutDate from GET /api/v1/people. NFL: not known per day; null.';
comment on column public.players.rookie_season is
  'MLB: the year of debut_on. NFL: rookie_season from nflverse players.csv.';

-- ---------------------------------------------------------------------------
-- Honors
-- ---------------------------------------------------------------------------
create table public.honor_kinds (
  sport_id text not null references public.sports (id),
  honor text not null,
  label text not null,
  -- How many seasons after the honor a player is still a star for it. 3 was decided by Dean.
  window_seasons integer not null default 3 check (window_seasons >= 0),
  -- Which honor to name when a player has several in the window: lower first.
  rank integer not null,
  -- "MVP 2023" (label then season) or "2024 All-Star" (season then label).
  season_first boolean not null default false,
  primary key (sport_id, honor)
);

insert into public.honor_kinds (sport_id, honor, label, rank, season_first) values
  ('mlb', 'mvp', 'MVP', 1, false),
  ('mlb', 'cy_young', 'Cy Young', 2, false),
  ('mlb', 'roy', 'Rookie of the Year', 3, false),
  ('mlb', 'all_star', 'All-Star', 4, true),
  ('nfl', 'mvp', 'MVP', 1, false),
  ('nfl', 'mvp_top5', 'MVP finalist', 2, false),
  ('nfl', 'all_pro_1st', 'First-team All-Pro', 3, true),
  ('nfl', 'pro_bowl', 'Pro Bowler', 4, true);

create table public.player_honors (
  player_id uuid not null references public.players (id) on delete cascade,
  season integer not null,
  honor text not null,
  source text not null,
  primary key (player_id, season, honor)
);
create index player_honors_season_idx on public.player_honors (season);

create table public.franchise_players (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  -- Null for the transcendent tier: a star wherever they play.
  team_id uuid references public.teams (id) on delete cascade,
  from_season integer not null,
  to_season integer check (to_season is null or to_season >= from_season),
  source text not null default 'seed/franchise_players.json'
);
create index franchise_players_player_idx on public.franchise_players (player_id);

-- ---------------------------------------------------------------------------
-- Moves and firsts
-- ---------------------------------------------------------------------------
create table public.player_moves (
  player_id uuid not null references public.players (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete cascade,
  joined_on date not null,
  kind text not null,
  source text not null,
  primary key (player_id, team_id, joined_on)
);
create index player_moves_team_idx on public.player_moves (team_id, joined_on);

create table public.player_firsts (
  player_id uuid not null references public.players (id) on delete cascade,
  kind text not null,
  game_id uuid not null references public.games (id) on delete cascade,
  primary key (player_id, kind)
);
create index player_firsts_game_idx on public.player_firsts (game_id);

-- ---------------------------------------------------------------------------
-- Famous games
-- ---------------------------------------------------------------------------
-- Copy for the schedule layer, per sport and round. Placeholders: {winner} {loser} {score}
-- {season} {edition} {n}. {edition} is the season, or a Roman numeral counted from
-- edition_base (Super Bowl LIX = 2024 - 1965). {n} is the game's number in its series.
create table public.famous_rounds (
  sport_id text not null references public.sports (id),
  round text not null check (round in ('final', 'semifinal')),
  title text not null,
  story text not null,
  edition_style text not null default 'season' check (edition_style in ('season', 'roman')),
  edition_base integer,
  primary key (sport_id, round)
);

insert into public.famous_rounds (sport_id, round, title, story, edition_style, edition_base) values
  ('mlb', 'final', 'World Series Game {n}', 'The {winner} beat the {loser} {score} to win the {season} World Series.', 'season', null),
  ('mlb', 'semifinal', 'LCS Game {n}', 'The {winner} beat the {loser} {score} to win the {season} pennant.', 'season', null),
  ('nfl', 'final', 'Super Bowl {edition}', 'The {winner} beat the {loser} {score} to win Super Bowl {edition}.', 'roman', 1965),
  ('nfl', 'semifinal', 'Conference championship', 'The {winner} beat the {loser} {score} to reach Super Bowl {edition}.', 'roman', 1965);

create table public.famous_games (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  source text not null check (source in ('schedule', 'curated')),
  category text not null check (category in ('championship', 'playoff', 'record', 'debut', 'farewell')),
  title text not null check (char_length(title) between 1 and 120),
  story text not null default '',
  -- The team the entry is about, for its colours and grouping; null when it is about the league.
  about_team_id uuid references public.teams (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (game_id, source)
);
create index famous_games_game_idx on public.famous_games (game_id);

-- ---------------------------------------------------------------------------
-- Reference data: readable by any authenticated user, written by the service role only.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['honor_kinds', 'player_honors', 'franchise_players', 'player_moves',
                           'player_firsts', 'famous_rounds', 'famous_games']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using (true)', t || '_read_authenticated', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- The calendar date a game was played on, where it was played. games.scheduled_start is UTC,
-- so an 8 pm ET game is already tomorrow there. A venue without a timezone (most NFL parks)
-- is read in Eastern time: every game in these leagues starts between 9 am and 11 pm ET, so
-- that gives the right day for any venue in the Americas and for London.
create or replace function public.game_local_date(p_start timestamptz, p_tz text)
returns date
language sql
immutable
as $$
  select (p_start at time zone coalesce(nullif(p_tz, ''), 'America/New_York'))::date
$$;

-- 59 -> LIX. Super Bowl 50 was styled with digits, and so is anything to_char cannot spell.
create or replace function public.roman_numeral(p_n integer)
returns text
language sql
immutable
as $$
  select case
    when p_n = 50 then '50'
    when p_n between 1 and 3999 then ltrim(to_char(p_n, 'RN'))
    else p_n::text
  end
$$;

-- ---------------------------------------------------------------------------
-- Superstars
-- ---------------------------------------------------------------------------

-- The honor that makes a player a star for a season, or nothing. Any honor in honor_kinds
-- within its window, the highest-ranked first and the most recent of those; failing that a
-- curated franchise-player row that covers the season.
create or replace function public.superstar_honor(p_player uuid, p_season integer)
returns table (honor text, label text, season integer, season_first boolean)
language sql
stable
security invoker
set search_path = public
as $$
  (
    select h.honor, k.label, h.season, k.season_first
    from public.player_honors h
    join public.players p on p.id = h.player_id
    join public.honor_kinds k on k.sport_id = p.sport_id and k.honor = h.honor
    where h.player_id = p_player
      and h.season <= p_season
      and h.season >= p_season - k.window_seasons
    order by k.rank, h.season desc
    limit 1
  )
  union all
  (
    select 'franchise', 'Franchise player', p_season, false
    from public.franchise_players f
    where f.player_id = p_player
      and f.from_season <= p_season
      and (f.to_season is null or f.to_season >= p_season)
      and not exists (
        select 1 from public.player_honors h
        join public.players p on p.id = h.player_id
        join public.honor_kinds k on k.sport_id = p.sport_id and k.honor = h.honor
        where h.player_id = p_player and h.season <= p_season and h.season >= p_season - k.window_seasons)
    limit 1
  )
  limit 1
$$;

create or replace function public.is_superstar(p_player uuid, p_season integer)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (select 1 from public.superstar_honor(p_player, p_season))
$$;

-- The stars who appeared in a game, with the honor to caption them by. Feeds "Players seen".
create or replace function public.game_stars(p_game_id uuid)
returns table (player_id uuid, full_name text, team_id uuid, honor text, label text, season integer, season_first boolean)
language sql
stable
security invoker
set search_path = public
as $$
  select ga.player_id, p.full_name, ga.team_id, s.honor, s.label, s.season, s.season_first
  from public.game_appearances ga
  join public.games g on g.id = ga.game_id
  join public.players p on p.id = ga.player_id
  cross join lateral public.superstar_honor(ga.player_id, g.season) s
  where ga.game_id = p_game_id
  order by p.full_name
$$;

-- ---------------------------------------------------------------------------
-- The schedule layer: the championship and the two games before it, every complete postseason.
--
-- One rule for every sport: the season's last postseason game is the final; each finalist's
-- last postseason game before it, against anyone but the other finalist, is its semifinal.
-- For MLB that is the World Series clincher and both LCS clinchers (checked on local data:
-- exactly two per season, 2016 to 2025); for the NFL the Super Bowl and both conference
-- championships. A postseason is complete when no game in it is still to be played and the
-- last one is three days old, so a series in progress never produces a false final.
--
-- Idempotent: rows are upserted by (game_id, 'schedule') and rows no longer earned are removed.
-- Returns the number of schedule rows now present.
-- ---------------------------------------------------------------------------
create or replace function public.rebuild_schedule_famous_games()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  create temp table _famous_sched on commit drop as
  with complete as (
    select sport_id, season
    from public.games
    where game_type = 'postseason'
    group by sport_id, season
    having bool_and(status in ('final', 'cancelled'))
       and count(*) filter (where status = 'final') > 0
       and max(scheduled_start) < now() - interval '3 days'
  ),
  finals as (
    select distinct on (g.sport_id, g.season) g.*
    from public.games g
    join complete c on c.sport_id = g.sport_id and c.season = g.season
    where g.game_type = 'postseason' and g.status = 'final'
    order by g.sport_id, g.season, g.scheduled_start desc
  ),
  finalists as (
    select f.sport_id, f.season, f.scheduled_start as final_start, t.team_id
    from finals f
    cross join lateral (values (f.home_team_id), (f.away_team_id)) as t (team_id)
  ),
  semis as (
    select distinct on (p.sport_id, p.season, p.team_id) g.*
    from finalists p
    join public.games g
      on g.sport_id = p.sport_id and g.season = p.season and g.game_type = 'postseason' and g.status = 'final'
     and (g.home_team_id = p.team_id or g.away_team_id = p.team_id)
     and g.scheduled_start < p.final_start
     and not exists (
       select 1 from finalists q
       where q.sport_id = p.sport_id and q.season = p.season and q.team_id <> p.team_id
         and q.team_id in (g.home_team_id, g.away_team_id))
    order by p.sport_id, p.season, p.team_id, g.scheduled_start desc
  ),
  picked as (
    select id, 'final'::text as round from finals
    union all
    select id, 'semifinal' from semis
  )
  select
    g.id as game_id,
    case r.round when 'final' then 'championship' else 'playoff' end as category,
    replace(replace(replace(replace(replace(replace(r.title,
      '{winner}', w.nickname), '{loser}', l.nickname), '{score}', sc.score),
      '{season}', g.season::text), '{edition}', ed.edition), '{n}', n.n::text) as title,
    replace(replace(replace(replace(replace(replace(r.story,
      '{winner}', w.nickname), '{loser}', l.nickname), '{score}', sc.score),
      '{season}', g.season::text), '{edition}', ed.edition), '{n}', n.n::text) as story
  from picked pk
  join public.games g on g.id = pk.id
  join public.famous_rounds r on r.sport_id = g.sport_id and r.round = pk.round
  join public.teams w on w.id = case when g.home_score >= g.away_score then g.home_team_id else g.away_team_id end
  join public.teams l on l.id = case when g.home_score >= g.away_score then g.away_team_id else g.home_team_id end
  cross join lateral (
    select greatest(g.home_score, g.away_score)::text || chr(8211) || least(g.home_score, g.away_score)::text as score
  ) sc
  cross join lateral (
    select case r.edition_style
      when 'roman' then public.roman_numeral(g.season - coalesce(r.edition_base, 0))
      else g.season::text end as edition
  ) ed
  cross join lateral (
    select count(*) as n
    from public.games x
    where x.sport_id = g.sport_id and x.season = g.season and x.game_type = 'postseason'
      and x.status = 'final' and x.scheduled_start <= g.scheduled_start
      and ((x.home_team_id = g.home_team_id and x.away_team_id = g.away_team_id)
        or (x.home_team_id = g.away_team_id and x.away_team_id = g.home_team_id))
  ) n
  where g.home_score is not null and g.away_score is not null and coalesce(w.nickname, '') <> '' and coalesce(l.nickname, '') <> '';

  delete from public.famous_games f
  where f.source = 'schedule' and not exists (select 1 from _famous_sched s where s.game_id = f.game_id);

  insert into public.famous_games (game_id, source, category, title, story)
  select game_id, 'schedule', category, title, story from _famous_sched
  on conflict (game_id, source) do update
    set category = excluded.category, title = excluded.title, story = excluded.story
    where famous_games.category is distinct from excluded.category
       or famous_games.title is distinct from excluded.title
       or famous_games.story is distinct from excluded.story;

  select count(*) into v_count from public.famous_games where source = 'schedule';
  drop table _famous_sched;
  return v_count;
end;
$$;

revoke all on function public.rebuild_schedule_famous_games() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- A fan's famous games: famous rows for the games they attended, plus their personal badges.
--
-- One row per game for the famous layer (curated wins over schedule when both exist); one
-- row per badge for the personal layer. `kind` says which rule made a personal row, and the
-- app builds its title from kind, player_name and team_nickname:
--   first_days  attended a game of the player's new team within 14 days of joining it, and the
--               player appeared for that team. Fourteen days after the join is what the data
--               can prove: appearances exist only for logged games, so "first home game" would
--               be a guess.
--   debut       attended the game on the player's debut date, and the player appeared.
--   rookie      attended a game in the player's rookie season, and the player appeared.
--   first_td    attended the game of the player's first touchdown (player_firsts).
-- A badge is earned once: rookie and first_days attach to the earliest qualifying game.
-- ---------------------------------------------------------------------------
create or replace function public.user_famous_games(p_user uuid)
returns table (
  game_id uuid, source text, category text, kind text, title text, story text,
  about_team_id uuid, personal boolean, player_id uuid, player_name text, team_id uuid, joined_on date
)
language sql
stable
security definer
set search_path = public
as $$
  with attended as (
    select a.game_id, a.rooting_team_id, g.home_team_id, g.away_team_id, g.season,
           public.game_local_date(g.scheduled_start, v.tz) as local_date
    from public.attendances a
    join public.games g on g.id = a.game_id
    left join public.venues v on v.id = g.venue_id
    where a.user_id = p_user and a.status = 'attended'
  ),
  famous as (
    select distinct on (f.game_id)
      f.game_id, f.source, f.category, f.source as kind, f.title, f.story, f.about_team_id,
      false as personal, null::uuid as player_id, null::text as player_name,
      coalesce(f.about_team_id, a.rooting_team_id, a.home_team_id) as team_id, null::date as joined_on
    from public.famous_games f
    join attended a on a.game_id = f.game_id
    order by f.game_id, (f.source = 'curated') desc
  ),
  seen as (
    -- Every (favourite, attended game) where the favourite appeared, with whom they played for.
    select up.player_id, a.game_id, a.season, a.local_date, ga.team_id, p.full_name, p.debut_on, p.rookie_season
    from public.user_players up
    join public.players p on p.id = up.player_id
    join public.game_appearances ga on ga.player_id = up.player_id
    join attended a on a.game_id = ga.game_id
    where up.user_id = p_user
  ),
  first_days as (
    select distinct on (s.player_id, m.team_id, m.joined_on)
      s.game_id, 'personal'::text as source, 'debut'::text as category, 'first_days'::text as kind,
      s.full_name as player_name, s.player_id, m.team_id, m.joined_on, s.local_date
    from seen s
    join public.player_moves m on m.player_id = s.player_id and m.team_id = s.team_id
    where s.local_date between m.joined_on and m.joined_on + 14
    order by s.player_id, m.team_id, m.joined_on, s.local_date
  ),
  debut as (
    select s.game_id, 'personal'::text, 'debut'::text, 'debut'::text, s.full_name, s.player_id, s.team_id, s.debut_on, s.local_date
    from seen s
    where s.debut_on is not null and s.local_date = s.debut_on
  ),
  rookie as (
    select distinct on (s.player_id)
      s.game_id, 'personal'::text, 'debut'::text, 'rookie'::text, s.full_name, s.player_id, s.team_id, null::date, s.local_date
    from seen s
    where s.rookie_season is not null and s.season = s.rookie_season
    order by s.player_id, s.local_date
  ),
  firsts as (
    select s.game_id, 'personal'::text, 'record'::text, pf.kind, s.full_name, s.player_id, s.team_id, null::date, s.local_date
    from seen s
    join public.player_firsts pf on pf.player_id = s.player_id and pf.game_id = s.game_id
  ),
  personal as (
    select * from first_days
    union all select * from debut
    union all select * from rookie
    union all select * from firsts
  )
  select game_id, source, category, kind, title, story, about_team_id, personal, player_id, player_name, team_id, joined_on
  from famous
  union all
  select p.game_id, p.source, p.category, p.kind, '', '', null, true, p.player_id, p.player_name, p.team_id, p.joined_on
  from personal p
$$;

revoke all on function public.user_famous_games(uuid) from public, anon, authenticated;

-- Client-callable: my famous games with what the list needs about each game. Aggregated on the
-- server so PostgREST's 1,000-row cap never trims it.
create or replace function public.my_famous_games()
returns table (
  game_id uuid, source text, category text, kind text, title text, story text,
  personal boolean, player_id uuid, player_name text, team_id uuid, joined_on date,
  sport_id text, scheduled_start timestamptz, home_team_id uuid, away_team_id uuid,
  home text, away text, home_nickname text, away_nickname text, team_nickname text,
  home_score integer, away_score integer
)
language sql
stable
security definer
set search_path = public
as $$
  select f.game_id, f.source, f.category, f.kind, f.title, f.story, f.personal, f.player_id, f.player_name,
         f.team_id, f.joined_on,
         g.sport_id, g.scheduled_start, g.home_team_id, g.away_team_id,
         ht.abbreviation, at.abbreviation, ht.nickname, at.nickname, tt.nickname,
         g.home_score, g.away_score
  from public.user_famous_games(auth.uid()) f
  join public.games g on g.id = f.game_id
  join public.teams ht on ht.id = g.home_team_id
  join public.teams at on at.id = g.away_team_id
  left join public.teams tt on tt.id = f.team_id
  where auth.uid() is not null
  order by g.sport_id, g.scheduled_start desc
$$;

-- What a game page shows: the game's famous rows, and the caller's personal badges for it.
create or replace function public.game_famous(p_game_id uuid)
returns table (
  source text, category text, kind text, title text, story text, about_team_id uuid,
  personal boolean, player_id uuid, player_name text, team_id uuid, team_nickname text, joined_on date
)
language sql
stable
security definer
set search_path = public
as $$
  select f.source, f.category, f.source, f.title, f.story, f.about_team_id, false, null::uuid, null::text, f.about_team_id, t.nickname, null::date
  from public.famous_games f
  left join public.teams t on t.id = f.about_team_id
  where f.game_id = p_game_id and auth.uid() is not null
  union all
  select u.source, u.category, u.kind, u.title, u.story, u.about_team_id, true, u.player_id, u.player_name, u.team_id, t.nickname, u.joined_on
  from public.user_famous_games(auth.uid()) u
  left join public.teams t on t.id = u.team_id
  where u.game_id = p_game_id and u.personal
  order by 7, 1
$$;

-- ---------------------------------------------------------------------------
-- The stats payload gains superlatives.famous_games = { count, personal_count }.
-- compute_user_stats is replaced from its latest definition (20260917000600_superlatives_v2.sql)
-- with only that block added, just before the return.
-- ---------------------------------------------------------------------------
create or replace function public.compute_user_stats(p_user uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_home_lat double precision;
  v_home_lng double precision;
  v_totals jsonb;
  v_overall jsonb;
  v_teams jsonb;
  v_pledge jsonb;
  v_stamps jsonb;
  v_super jsonb := '{}'::jsonb;
  v_moments jsonb;
  v_players_seen integer;
  v_streaks jsonb;
  r record;
  run integer := 0;
  longest_win integer := 0;
  longest_loss integer := 0;
begin
  select home_lat, home_lng into v_home_lat, v_home_lng from public.profiles where id = p_user;

  create temp table if not exists _ugr on commit drop as select * from public.user_game_results(p_user);
  truncate _ugr;
  insert into _ugr select * from public.user_game_results(p_user);

  select jsonb_build_object(
    'games', count(*) filter (where counted),
    'venues', count(distinct venue_id) filter (where counted),
    'states', count(distinct v.state) filter (where counted and v.state is not null),
    'countries', count(distinct coalesce(v.country, 'USA')) filter (where counted)
  ) into v_totals
  from _ugr u left join public.venues v on v.id = u.venue_id;

  select public.record_json(count(*) filter (where result = 'win'), count(*) filter (where result = 'loss'), count(*) filter (where result = 'tie'))
    into v_overall from _ugr;

  -- Team records: one tile per followed franchise (current team row carries the name).
  select coalesce(jsonb_agg(t order by t -> 'record' desc), '[]'::jsonb) into v_teams
  from (
    select jsonb_build_object(
      'franchise_id', f.franchise_id,
      'team_id', f.team_id,
      'name', f.name,
      'abbreviation', f.abbreviation,
      'sport_id', f.sport_id,
      'record', public.record_json(
        (select count(*) from _ugr u join public.teams rt on rt.id = u.rooting_team_id where rt.franchise_id = f.franchise_id and u.result = 'win'),
        (select count(*) from _ugr u join public.teams rt on rt.id = u.rooting_team_id where rt.franchise_id = f.franchise_id and u.result = 'loss'),
        (select count(*) from _ugr u join public.teams rt on rt.id = u.rooting_team_id where rt.franchise_id = f.franchise_id and u.result = 'tie'))
    ) as t
    from (
      select distinct on (t.franchise_id) t.franchise_id, t.id as team_id, t.name, t.abbreviation, t.sport_id
      from public.user_teams ut join public.teams t on t.id = ut.team_id
      where ut.user_id = p_user
      order by t.franchise_id, t.active desc
    ) f
  ) s;

  select jsonb_build_object(
    'record', public.record_json(count(*) filter (where u.result = 'win'), count(*) filter (where u.result = 'loss'), count(*) filter (where u.result = 'tie')),
    'vs_expected', round(coalesce(sum(case u.result when 'win' then 1 when 'tie' then 0.5 else 0 end - p.win_prob_at_pledge), 0)::numeric, 2)
  ) into v_pledge
  from _ugr u
  join public.pledges p on p.game_id = u.game_id and p.user_id = p_user and p.status = 'valid'
  where u.rooting_basis = 'pledge' and u.result is not null;

  select coalesce(jsonb_agg(s order by s -> 'visits' desc, s ->> 'first_visit'), '[]'::jsonb) into v_stamps
  from (
    select jsonb_build_object(
      'venue_id', v.id, 'name', v.name, 'city', v.city, 'state', v.state, 'country', v.country,
      'visits', count(*), 'first_visit', min(u.scheduled_start),
      'sports', (select jsonb_agg(distinct x.sport_id) from _ugr x where x.venue_id = v.id),
      'closed', v.closed_year is not null and v.closed_year <= extract(year from now())::integer,
      'lat', v.lat, 'lng', v.lng
    ) as s
    from _ugr u join public.venues v on v.id = u.venue_id
    where u.counted
    group by v.id
  ) q;

  -- Superlatives (each skips games missing the needed data). Every piece is wrapped in coalesce so a
  -- missing superlative never nulls the accumulator.
  v_super := v_super || coalesce((select jsonb_build_object('coldest', jsonb_build_object('game_id', game_id, 'value', temperature_f))
    from _ugr where counted and temperature_f is not null order by temperature_f asc, scheduled_start limit 1), '{}'::jsonb);
  v_super := v_super || coalesce((select jsonb_build_object('hottest', jsonb_build_object('game_id', game_id, 'value', temperature_f))
    from _ugr where counted and temperature_f is not null order by temperature_f desc, scheduled_start limit 1), '{}'::jsonb);
  v_super := v_super || coalesce((select jsonb_build_object('longest', jsonb_build_object('game_id', game_id, 'minutes', duration_minutes, 'periods', innings_or_periods))
    from _ugr where counted and (duration_minutes is not null or innings_or_periods is not null)
    order by coalesce(duration_minutes, 0) desc, coalesce(innings_or_periods, 0) desc limit 1), '{}'::jsonb);
  v_super := v_super || coalesce((select jsonb_build_object('highest_scoring', jsonb_build_object('game_id', game_id, 'total', home_score + away_score))
    from _ugr where counted and home_score is not null order by home_score + away_score desc, scheduled_start limit 1), '{}'::jsonb);
  v_super := v_super || coalesce((select jsonb_build_object('lowest_scoring', jsonb_build_object('game_id', game_id, 'total', home_score + away_score))
    from _ugr where counted and home_score is not null order by home_score + away_score asc, scheduled_start limit 1), '{}'::jsonb);

  -- Biggest comeback by the user's side, in a game they won.
  --
  -- "Down 4" means one thing in baseball and another in football, so the measure is win probability:
  -- the lowest chance the user's side had (from game_wp_timeline) in a game it went on to win, and
  -- only when that low point was below an even chance. The run or point deficit is still reported,
  -- and still decides the game when no won game has a timeline, which is every game without a
  -- Relive story. `deficit` is always a number because builds before this one print it as is.
  v_super := v_super || coalesce((
    select jsonb_build_object('biggest_comeback', jsonb_strip_nulls(jsonb_build_object(
      'game_id', c.game_id, 'sport_id', c.sport_id, 'deficit', greatest(coalesce(c.deficit, 0), 0),
      'low_win_prob', case when c.low_wp < 0.5 then c.low_wp end)))
    from (
      select u.game_id, u.sport_id, u.scheduled_start,
        (select round(min(case when u.rooting_team_id = u.home_team_id then w.home_wp else 1 - w.home_wp end), 4)
           from public.game_wp_timeline w where w.game_id = u.game_id) as low_wp,
        (select max(case when u.rooting_team_id = u.home_team_id then t.away_score - t.home_score else t.home_score - t.away_score end)
           from public.game_scoring_timeline t where t.game_id = u.game_id) as deficit
      from _ugr u
      where u.result = 'win'
    ) c
    where c.low_wp < 0.5 or c.deficit > 0
    -- A game whose low point is known outranks every game where it is not; among those, the lowest
    -- low point wins. With none, it is the largest deficit, as before.
    order by case when c.low_wp < 0.5 then 0 else 1 end,
             case when c.low_wp < 0.5 then c.low_wp end asc nulls last,
             c.deficit desc nulls last, c.scheduled_start
    limit 1), '{}'::jsonb);

  -- Largest crowd, from the box score's paid attendance.
  v_super := v_super || coalesce((select jsonb_build_object('largest_crowd', jsonb_build_object('game_id', game_id, 'attendance', attendance))
    from _ugr where counted and attendance is not null and attendance > 0 order by attendance desc, scheduled_start limit 1), '{}'::jsonb);

  -- Highest stadium. Only from 1,000 ft up, so it is a fun fact and never "you were at 20 feet".
  v_super := v_super || coalesce((
    select jsonb_build_object('highest_altitude', jsonb_build_object('venue_id', v.id, 'name', v.name, 'elevation_ft', v.elevation_ft, 'game_id', m.game_id))
    from (
      select venue_id, (array_agg(game_id order by scheduled_start desc))[1] as game_id
      from _ugr where counted and venue_id is not null group by venue_id
    ) m
    join public.venues v on v.id = m.venue_id
    where v.elevation_ft >= 1000
    order by v.elevation_ft desc, v.name limit 1), '{}'::jsonb);

  -- The favourite player you have seen most. Ties go to the one you favourited first, then by name.
  -- A favourite you have never seen is not a superlative, so no favourites seen means no key.
  v_super := v_super || coalesce((
    select jsonb_build_object('most_seen_favorite_player', jsonb_build_object('player_id', p.id, 'name', p.full_name, 'count', m.cnt))
    from (
      select up.player_id, up.created_at, count(*) as cnt
      from public.user_players up
      join public.game_appearances ga on ga.player_id = up.player_id
      join _ugr u on u.game_id = ga.game_id and u.counted
      where up.user_id = p_user
      group by up.player_id, up.created_at
    ) m join public.players p on p.id = m.player_id
    order by m.cnt desc, m.created_at asc, p.full_name asc limit 1), '{}'::jsonb);

  -- Kept for builds already installed, which read this key. The app no longer shows it: the most
  -- seen player overall is usually a stranger ("Carl Jones"), which is why the row above exists.
  v_super := v_super || coalesce((
    select jsonb_build_object('most_seen_player', jsonb_build_object('player_id', p.id, 'name', p.full_name, 'count', cnt))
    from (
      select ga.player_id, count(*) as cnt
      from _ugr u join public.game_appearances ga on ga.game_id = u.game_id
      where u.counted group by ga.player_id order by cnt desc, ga.player_id limit 1
    ) m join public.players p on p.id = m.player_id), '{}'::jsonb);

  v_super := v_super || jsonb_build_object('most_seen_by_team', coalesce((
    select jsonb_agg(x) from (
      select distinct on (f.franchise_id) jsonb_build_object('franchise_id', f.franchise_id, 'team_name', f.name, 'player_id', p.id, 'name', p.full_name, 'count', cnt) as x
      from (
        select distinct on (t.franchise_id) t.franchise_id, t.name from public.user_teams ut join public.teams t on t.id = ut.team_id where ut.user_id = p_user order by t.franchise_id, t.active desc
      ) f
      join lateral (
        select ga.player_id, count(*) as cnt
        from _ugr u join public.game_appearances ga on ga.game_id = u.game_id join public.teams gt on gt.id = ga.team_id
        where u.counted and gt.franchise_id = f.franchise_id group by ga.player_id order by cnt desc limit 1
      ) m on true
      join public.players p on p.id = m.player_id
    ) q), '[]'::jsonb));

  v_super := v_super || coalesce((
    select jsonb_build_object('most_visited_venue', jsonb_build_object('venue_id', v.id, 'name', v.name, 'visits', cnt, 'game_id', m.game_id))
    from (
      select venue_id, count(*) cnt, max(scheduled_start) last_at, (array_agg(game_id order by scheduled_start desc))[1] as game_id
      from _ugr where counted and venue_id is not null group by venue_id order by cnt desc, last_at desc limit 1
    ) m
    join public.venues v on v.id = m.venue_id), '{}'::jsonb);

  if v_home_lat is not null then
    v_super := v_super || coalesce((
      select jsonb_build_object('farthest_venue', jsonb_build_object('venue_id', v.id, 'name', v.name, 'km', round(d::numeric), 'game_id', m.game_id))
      from (
        select u.venue_id, public.distance_km(v_home_lat, v_home_lng, v.lat, v.lng) d, (array_agg(u.game_id order by u.scheduled_start desc))[1] as game_id
        from _ugr u join public.venues v on v.id = u.venue_id where u.counted and v.lat is not null
        group by u.venue_id, v.lat, v.lng
      ) m
      join public.venues v on v.id = m.venue_id
      order by d desc limit 1), '{}'::jsonb);

    v_super := v_super || coalesce((
      select jsonb_build_object('most_miles_team', jsonb_build_object('franchise_id', m.franchise_id, 'team_name', m.name, 'km', round(m.km::numeric)))
      from (
        select rt.franchise_id, min(rt.name) as name, sum(public.distance_km(v_home_lat, v_home_lng, v.lat, v.lng)) as km
        from _ugr u join public.teams rt on rt.id = u.rooting_team_id join public.venues v on v.id = u.venue_id
        where u.counted and v.lat is not null and u.rooting_team_id <> u.home_team_id
        group by rt.franchise_id
      ) m order by m.km desc limit 1), '{}'::jsonb);
  end if;

  v_super := v_super || coalesce((select jsonb_build_object('first_game', jsonb_build_object('game_id', game_id, 'date', scheduled_start))
    from _ugr where counted order by scheduled_start asc limit 1), '{}'::jsonb);

  -- Streaks.
  for r in select result from _ugr where result is not null order by scheduled_start loop
    if r.result = 'win' then run := case when run > 0 then run + 1 else 1 end;
    elsif r.result = 'loss' then run := case when run < 0 then run - 1 else -1 end;
    else run := 0;
    end if;
    longest_win := greatest(longest_win, run);
    longest_loss := greatest(longest_loss, -run);
  end loop;
  v_streaks := jsonb_build_object('longest_win', longest_win, 'longest_loss', longest_loss, 'current', run);

  select coalesce(jsonb_agg(jsonb_build_object('type', type, 'count', cnt) order by cnt desc), '[]'::jsonb) into v_moments
  from (
    select e.type, count(*) cnt
    from _ugr u join public.game_events e on e.game_id = u.game_id
    where u.counted and e.type <> 'home_run'
    group by e.type
  ) m;

  select count(distinct ga.player_id) into v_players_seen
  from _ugr u join public.game_appearances ga on ga.game_id = u.game_id where u.counted;

  -- Famous games (20260918000100_famous_games.sql): the count the Passport row and another
  -- person's profile show, so neither needs a query of its own. A game counts once however
  -- many reasons it is famous; personal badges are the fan's own (favourite players only).
  v_super := v_super || jsonb_build_object('famous_games', (
    select jsonb_build_object(
      'count', count(distinct f.game_id),
      'personal_count', count(*) filter (where f.personal))
    from public.user_famous_games(p_user) f));

  return jsonb_build_object(
    'totals', v_totals,
    'overall', v_overall,
    'teams', v_teams,
    'pledge', coalesce(v_pledge, jsonb_build_object('record', public.record_json(0, 0, 0), 'vs_expected', 0)),
    'stamps', v_stamps,
    'superlatives', v_super,
    'streaks', v_streaks,
    'moments', v_moments,
    'players_seen', coalesce(v_players_seen, 0),
    'computed_at', now()
  );
end;
$$;

revoke all on function public.compute_user_stats(uuid) from public, anon, authenticated;

-- Every cached payload, for after an ingest that changes who is a star or when someone joined.
-- Service role only; the ingest scripts call it last.
create or replace function public.refresh_all_user_stats()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  u uuid;
  n integer := 0;
begin
  for u in select user_id from public.user_stats_cache loop
    perform public.refresh_user_stats(u);
    n := n + 1;
  end loop;
  return n;
end;
$$;

revoke all on function public.refresh_all_user_stats() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Feed: "Dean was at Super Bowl LIX."
-- ---------------------------------------------------------------------------
alter table public.feed_events drop constraint feed_events_type_check;
alter table public.feed_events add constraint feed_events_type_check
  check (type in ('logged_game', 'pledge_won', 'pledge_lost', 'new_stamp', 'goal_completed', 'milestone', 'wrapped_published', 'famous_game'));

-- The famous row a feed event should quote: curated over schedule.
create or replace function public.famous_game_headline(p_game_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('title', f.title, 'category', f.category, 'source', f.source)
  from public.famous_games f
  where f.game_id = p_game_id
  order by (f.source = 'curated') desc
  limit 1
$$;

revoke all on function public.famous_game_headline(uuid) from public, anon, authenticated;

-- Logging a famous game: the same trigger that writes logged_game, new_stamp and milestone,
-- replaced from 20260915000500_stats.sql with the famous block added.
create or replace function public.attendances_after_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := coalesce(new.user_id, old.user_id);
  v_count integer;
  v_first_at_venue boolean;
  v_venue record;
  v_famous jsonb;
begin
  if tg_op = 'INSERT' and new.status = 'attended' then
    select count(*) into v_count from public.attendances where user_id = v_user and status = 'attended';
    insert into public.feed_events (actor_user_id, type, game_id, payload)
    values (v_user, 'logged_game', new.game_id, jsonb_build_object('source', new.source));
    select v.id, v.name into v_venue from public.games g join public.venues v on v.id = g.venue_id where g.id = new.game_id;
    if v_venue.id is not null then
      -- First visit = no other attended game at this venue that is earlier by date (ties broken by id),
      -- so bulk inserts in one statement still award exactly one stamp per venue.
      select not exists (
        select 1 from public.attendances a
        join public.games g on g.id = a.game_id
        join public.games ng on ng.id = new.game_id
        where a.user_id = v_user and a.id <> new.id and g.venue_id = v_venue.id and a.status = 'attended'
          and (g.scheduled_start < ng.scheduled_start or (g.scheduled_start = ng.scheduled_start and a.id < new.id))
      ) into v_first_at_venue;
      if v_first_at_venue then
        insert into public.feed_events (actor_user_id, type, game_id, payload)
        values (v_user, 'new_stamp', new.game_id, jsonb_build_object('venue_id', v_venue.id, 'venue_name', v_venue.name));
        insert into public.notifications (user_id, kind, title, body, data)
        values (v_user, 'new_stamp', 'New stamp', v_venue.name || ' added to your passport.', jsonb_build_object('venue_id', v_venue.id));
      end if;
    end if;
    if v_count in (10, 25, 50, 100, 250, 500) then
      insert into public.feed_events (actor_user_id, type, game_id, payload)
      values (v_user, 'milestone', new.game_id, jsonb_build_object('games', v_count));
      insert into public.notifications (user_id, kind, title, body, data)
      values (v_user, 'milestone', 'Milestone', 'That was your ' || v_count || 'th game.', jsonb_build_object('games', v_count));
    end if;
    -- A famous game: one event per (fan, game), however many times it is logged and unlogged.
    v_famous := public.famous_game_headline(new.game_id);
    if v_famous is not null and not exists (
      select 1 from public.feed_events e where e.actor_user_id = v_user and e.game_id = new.game_id and e.type = 'famous_game'
    ) then
      insert into public.feed_events (actor_user_id, type, game_id, payload)
      values (v_user, 'famous_game', new.game_id, v_famous);
    end if;
  end if;
  perform public.refresh_user_stats(v_user);
  return null;
end;
$$;

-- A famous row appearing for a game people already logged (the rebuild after a postseason, or
-- a curated entry Dean adds later): the event they would have had, and fresh counts.
create or replace function public.famous_games_after_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game uuid := coalesce(new.game_id, old.game_id);
  v_famous jsonb;
  r record;
begin
  v_famous := public.famous_game_headline(v_game);
  for r in select a.user_id from public.attendances a where a.game_id = v_game and a.status = 'attended' loop
    if v_famous is not null then
      insert into public.feed_events (actor_user_id, type, game_id, payload)
      select r.user_id, 'famous_game', v_game, v_famous
      where not exists (
        select 1 from public.feed_events e where e.actor_user_id = r.user_id and e.game_id = v_game and e.type = 'famous_game');
    else
      delete from public.feed_events e where e.actor_user_id = r.user_id and e.game_id = v_game and e.type = 'famous_game';
    end if;
    perform public.refresh_user_stats(r.user_id);
  end loop;
  return null;
end;
$$;

create trigger famous_games_after_change
  after insert or update or delete on public.famous_games
  for each row execute function public.famous_games_after_change();

-- ---------------------------------------------------------------------------
-- Build the schedule layer now, and recompute every cached payload so the row appears.
-- ---------------------------------------------------------------------------
select public.rebuild_schedule_famous_games();
select public.refresh_all_user_stats();
