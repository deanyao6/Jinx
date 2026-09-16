-- Bulk mode: allow excluding preseason (spring training) games, which dominate "team season" lists.
drop function if exists public.team_season_games(uuid, integer, boolean);
create or replace function public.team_season_games(
  p_team_id uuid,
  p_season integer,
  p_home_only boolean default false,
  p_include_preseason boolean default false
)
returns setof public.games
language sql
stable
security invoker
set search_path = public
as $$
  select * from public.games g
  where g.season = p_season
    and (g.home_team_id = p_team_id or (not p_home_only and g.away_team_id = p_team_id))
    and (p_include_preseason or g.game_type <> 'preseason')
  order by g.scheduled_start;
$$;
