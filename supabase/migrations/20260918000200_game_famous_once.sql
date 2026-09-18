-- game_famous showed a game twice when it is famous two ways: Super Bowl LIX is both a curated
-- entry and the schedule's championship, and the game page drew two cards. One famous row per
-- game, curated over schedule, exactly as user_famous_games already does; personal badges are
-- unchanged. Found on the simulator, 2026-09-18.
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
  (
    select f.source, f.category, f.source, f.title, f.story, f.about_team_id, false, null::uuid, null::text,
           f.about_team_id, t.nickname, null::date
    from public.famous_games f
    left join public.teams t on t.id = f.about_team_id
    where f.game_id = p_game_id and auth.uid() is not null
    order by (f.source = 'curated') desc
    limit 1
  )
  union all
  select u.source, u.category, u.kind, u.title, u.story, u.about_team_id, true, u.player_id, u.player_name,
         u.team_id, t.nickname, u.joined_on
  from public.user_famous_games(auth.uid()) u
  left join public.teams t on t.id = u.team_id
  where u.game_id = p_game_id and u.personal
$$;
