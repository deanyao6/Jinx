-- Favourite players on the Passport: how often you have seen each one, and where last.
--
-- One row per favourite per team they appeared for in a game you attended, so the Passport can
-- filter by its team pill (a player traded from the Phillies to the Mets counts once under each)
-- and add the rows up for All teams. A favourite you have never seen still gets one row, with a
-- null team and a count of zero, because "not seen yet" is worth showing too.
--
-- Scoped to auth.uid() rather than taking a user: this is your own Passport, and other people's
-- favourites are not something any screen shows.
create or replace function public.favorite_players_seen()
returns table (
  player_id uuid,
  full_name text,
  sport_id text,
  team_id uuid,
  seen integer,
  last_seen timestamptz,
  last_game_id uuid
)
language sql
stable
security invoker
set search_path = public
as $$
  with sightings as (
    select ga.player_id, ga.team_id, g.id as game_id, g.scheduled_start
    from public.user_players up
    join public.game_appearances ga on ga.player_id = up.player_id
    join public.attendances a
      on a.game_id = ga.game_id and a.user_id = up.user_id and a.status = 'attended'
    join public.games g on g.id = ga.game_id and g.status = 'final'
    where up.user_id = auth.uid()
  )
  select p.id, p.full_name, p.sport_id, s.team_id,
         count(s.game_id)::integer,
         max(s.scheduled_start),
         (array_agg(s.game_id order by s.scheduled_start desc nulls last))[1]
  from public.user_players up
  join public.players p on p.id = up.player_id
  left join sightings s on s.player_id = up.player_id
  where up.user_id = auth.uid()
  group by p.id, p.full_name, p.sport_id, s.team_id;
$$;

revoke all on function public.favorite_players_seen() from public, anon;
grant execute on function public.favorite_players_seen() to authenticated;
