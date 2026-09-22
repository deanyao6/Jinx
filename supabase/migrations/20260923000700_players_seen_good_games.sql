-- "Players seen" shows superstars, for good games (Dean, 2026-09-22, decision 7).
--
-- Before, any appearance counted, so a role player who took one snap was "seen". Now every
-- appearance of a detailed game carries its box-score line (`line`, the handful of numbers the
-- rule reads) and whether it was a good game by the sport's rule (`good_game`, decided in
-- packages/core/src/goodGame.ts at write time), and the readers below apply the rule: a
-- player is seen in a game when it was a good game and either the player is a superstar
-- (player_honors, franchise_players, through is_superstar) or this fan has seen them have ten
-- or more good games (the niche exception, "you have seen him homer ten times"). Storing the
-- line for everyone is the cheaper choice: detail is fetched only for logged games (SPEC 4.7),
-- so the rows are few, and the niche count needs no second pass over provider data.
alter table public.game_appearances
  add column if not exists line jsonb,
  add column if not exists good_game boolean not null default false;
create index if not exists game_appearances_good_game_idx
  on public.game_appearances (player_id) where good_game;

-- The niche threshold, one place.
create or replace function public.niche_good_games()
returns integer language sql immutable as $$ select 10 $$;

-- How many good games this fan has seen from each player.
create or replace function public.good_games_seen(p_user uuid)
returns table (player_id uuid, good_games integer)
language sql
stable
security definer
set search_path = public
as $$
  select ga.player_id, count(distinct ga.game_id)::integer
  from public.attendances a
  join public.games g on g.id = a.game_id and g.status = 'final'
  join public.game_appearances ga on ga.game_id = g.id and ga.good_game
  where a.user_id = p_user and a.status = 'attended'
  group by ga.player_id;
$$;
revoke all on function public.good_games_seen(uuid) from public, anon, authenticated;

-- Players seen, paginated and searchable, for the passport list: the rule above.
create or replace function public.players_seen(p_user uuid, p_query text default null, p_limit integer default 50, p_offset integer default 0)
returns table (player_id uuid, full_name text, sport_id text, seen integer, last_seen timestamptz)
language sql
stable
security invoker
set search_path = public
as $$
  with seen as (
    select ga.player_id, g.id as game_id, g.season, g.scheduled_start
    from public.attendances a
    join public.games g on g.id = a.game_id and g.status = 'final'
    join public.game_appearances ga on ga.game_id = g.id and ga.good_game
    where a.user_id = p_user and a.status = 'attended' and public.can_view_user(p_user)
  ),
  counted as (
    select s.player_id, count(*)::integer as seen, max(s.scheduled_start) as last_seen,
           bool_or(public.is_superstar(s.player_id, s.season)) as star
    from seen s group by s.player_id
  )
  select p.id, p.full_name, p.sport_id, c.seen, c.last_seen
  from counted c
  join public.players p on p.id = c.player_id
  where (c.star or c.seen >= public.niche_good_games())
    and (p_query is null or lower(p.full_name) like '%' || lower(trim(p_query)) || '%')
  order by c.seen desc, c.last_seen desc
  limit least(greatest(coalesce(p_limit, 50), 1), 200) offset greatest(coalesce(p_offset, 0), 0);
$$;

-- The count for the list's header, by the same rule.
create or replace function public.players_seen_count(p_user uuid)
returns integer
language sql
stable
security invoker
set search_path = public
as $$
  select count(*)::integer from public.players_seen(p_user, null, 200, 0);
$$;
grant execute on function public.players_seen_count(uuid) to authenticated;

-- One game's players seen, for the caller: superstars with a good game (with the honor that
-- makes them one, as game_stars gave it) and the caller's ten-timers.
create or replace function public.game_players_seen(p_game_id uuid)
returns table (
  player_id uuid, full_name text, team_id uuid, line jsonb,
  honor text, label text, season integer, season_first boolean, niche boolean
)
language sql
stable
security definer
set search_path = public
as $$
  -- Definer only to read good_games_seen(auth.uid()); everything else is readable anyway.
  select ga.player_id, p.full_name, ga.team_id, ga.line,
         s.honor, s.label, s.season, s.season_first,
         (s.honor is null) as niche
  from public.game_appearances ga
  join public.games g on g.id = ga.game_id
  join public.players p on p.id = ga.player_id
  left join lateral public.superstar_honor(ga.player_id, g.season) s on true
  left join public.good_games_seen(auth.uid()) gg on gg.player_id = ga.player_id
  where ga.game_id = p_game_id
    and ga.good_game
    and (s.honor is not null or coalesce(gg.good_games, 0) >= public.niche_good_games())
  order by p.full_name;
$$;
grant execute on function public.game_players_seen(uuid) to authenticated;
