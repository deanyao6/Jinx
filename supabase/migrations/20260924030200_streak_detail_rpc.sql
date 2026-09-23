-- The streak detail screen (docs/prompts/social/04, section 3: "tapping a patch opens a streak
-- screen listing each season and its game count") needs a per-season breakdown for one team,
-- read as the signed-in fan for themselves. season_game_counts(uuid) is server-only (it takes an
-- arbitrary user id for the Edge Function); this is the client-safe, self-only equivalent.
create or replace function public.my_season_game_counts(p_team_id uuid)
returns table (season integer, games integer)
language sql
stable
security definer
set search_path = public
as $$
  select season, games from public.season_game_counts(auth.uid()) where team_id = p_team_id;
$$;
