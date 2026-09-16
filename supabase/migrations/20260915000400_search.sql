-- Game search for manual logging (SPEC.md 7.1) and bulk mode.

create index team_aliases_pattern_idx on public.team_aliases (lower(alias) text_pattern_ops);
create index venue_aliases_pattern_idx on public.venue_aliases (lower(alias) text_pattern_ops);

-- Free-text search: each token must match a team alias prefix, a venue alias substring, or a season.
-- Structured filters narrow further. Returns newest games first.
create or replace function public.search_games(
  p_query text default null,
  p_sport text default null,
  p_season integer default null,
  p_from date default null,
  p_to date default null,
  p_team_id uuid default null,
  p_venue_id uuid default null,
  p_limit integer default 50
)
returns table (
  id uuid, sport_id text, season integer, game_type text, scheduled_start timestamptz, status text,
  home_team_id uuid, home_team_name text, home_abbr text,
  away_team_id uuid, away_team_name text, away_abbr text,
  home_score integer, away_score integer, is_tie boolean, doubleheader_number integer,
  venue_id uuid, venue_name text, venue_city text
)
language sql
stable
security invoker
set search_path = public
as $$
  with tokens as (
    select tok from unnest(regexp_split_to_array(lower(coalesce(trim(p_query), '')), '\s+')) as tok
    where tok <> '' and tok not in ('at', 'vs', 'vs.', 'v', '@', 'the', 'game', 'games', 'and', '-')
  )
  select g.id, g.sport_id, g.season, g.game_type, g.scheduled_start, g.status,
         g.home_team_id, ht.name, ht.abbreviation,
         g.away_team_id, at.name, at.abbreviation,
         g.home_score, g.away_score, g.is_tie, g.doubleheader_number,
         g.venue_id, v.name, v.city
  from public.games g
  join public.teams ht on ht.id = g.home_team_id
  join public.teams at on at.id = g.away_team_id
  left join public.venues v on v.id = g.venue_id
  where (p_sport is null or g.sport_id = p_sport)
    and (p_season is null or g.season = p_season)
    and (p_from is null or g.scheduled_start >= p_from::timestamptz)
    and (p_to is null or g.scheduled_start < (p_to + 1)::timestamptz)
    and (p_team_id is null or g.home_team_id = p_team_id or g.away_team_id = p_team_id)
    and (p_venue_id is null or g.venue_id = p_venue_id)
    and not exists (
      select 1 from tokens t
      where not (
        (t.tok ~ '^\d{4}$' and g.season = t.tok::integer)
        or exists (select 1 from public.team_aliases ta where ta.team_id in (g.home_team_id, g.away_team_id) and lower(ta.alias) like t.tok || '%')
        or exists (select 1 from public.venue_aliases va where va.venue_id = g.venue_id and lower(va.alias) like '%' || t.tok || '%')
      )
    )
  order by g.scheduled_start desc
  limit least(greatest(coalesce(p_limit, 50), 1), 200);
$$;

-- Bulk mode: every game of a team in a season, optionally home only.
create or replace function public.team_season_games(p_team_id uuid, p_season integer, p_home_only boolean default false)
returns setof public.games
language sql
stable
security invoker
set search_path = public
as $$
  select * from public.games g
  where g.season = p_season
    and (g.home_team_id = p_team_id or (not p_home_only and g.away_team_id = p_team_id))
  order by g.scheduled_start;
$$;

-- Typeahead for teams and venues.
create or replace function public.search_teams(p_query text, p_sport text default null, p_limit integer default 10)
returns table (id uuid, sport_id text, name text, city text, abbreviation text, active boolean)
language sql
stable
security invoker
set search_path = public
as $$
  select distinct on (t.id) t.id, t.sport_id, t.name, t.city, t.abbreviation, t.active
  from public.teams t
  join public.team_aliases ta on ta.team_id = t.id
  where (p_sport is null or t.sport_id = p_sport)
    and lower(ta.alias) like lower(trim(p_query)) || '%'
  order by t.id
  limit least(greatest(coalesce(p_limit, 10), 1), 50);
$$;

create or replace function public.search_venues(p_query text, p_limit integer default 10)
returns table (id uuid, name text, city text, state text, closed_year integer)
language sql
stable
security invoker
set search_path = public
as $$
  select distinct on (v.id) v.id, v.name, v.city, v.state, v.closed_year
  from public.venues v
  join public.venue_aliases va on va.venue_id = v.id
  where lower(va.alias) like '%' || lower(trim(p_query)) || '%'
  order by v.id
  limit least(greatest(coalesce(p_limit, 10), 1), 50);
$$;
