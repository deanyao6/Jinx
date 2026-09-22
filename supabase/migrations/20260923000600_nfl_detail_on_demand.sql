-- NFL detail only for the games someone cares about (next-wave B.5, Dean's decision 17; SPEC
-- 4.7). The NFL pipeline stored appearances, scoring plays, moments and Relive lines for every
-- game since 2000 (7,033 games, 550,194 appearance rows, 91 MB on local) where MLB and the NBA
-- fetch detail only for logged games. This brings the NFL to the same rule.
--
-- A game "wants" detail when it is in the detail queue (a fan logged it, checked in, is going,
-- or a ticket matched it), when someone attended it, or when it is a famous game (whose stars
-- come from its appearances). `games_wanting_detail` is what the nightly job asks; everything
-- else loses its detail rows here and gets them back the night after anyone logs it, exactly
-- as an MLB game does. Nothing a fan can see changes: every attended game keeps its detail,
-- and records, stamps and superlatives read final scores and context columns, which stay.
-- Players rows stay too: rosters, honors, moves and firsts reference them.
create or replace function public.games_wanting_detail(p_provider text)
returns table (game_id uuid, provider_game_id text, season integer, reason text)
language sql
stable
security definer
set search_path = public
as $$
  select g.id, g.provider_game_id, g.season,
         case
           when exists (select 1 from public.detail_queue q where q.game_id = g.id and q.done_at is null) then 'queue'
           when exists (select 1 from public.attendances a where a.game_id = g.id) then 'attended'
           else 'famous'
         end
  from public.games g
  where g.provider = p_provider
    and g.status = 'final'
    and (
      exists (select 1 from public.detail_queue q where q.game_id = g.id and q.done_at is null)
      or (g.detail_ingested_at is null and (
        exists (select 1 from public.attendances a where a.game_id = g.id)
        or exists (select 1 from public.famous_games f where f.game_id = g.id)
      ))
    )
  order by g.season, g.scheduled_start;
$$;
revoke all on function public.games_wanting_detail(text) from public, anon, authenticated;
grant execute on function public.games_wanting_detail(text) to service_role;

-- The cleanup. Kept: every game anyone attended, is going to, queued or that is famous.
create temporary table _nfl_unwanted on commit drop as
  select g.id
  from public.games g
  where g.provider = 'nflverse'
    and g.detail_ingested_at is not null
    and not exists (select 1 from public.attendances a where a.game_id = g.id)
    and not exists (select 1 from public.famous_games f where f.game_id = g.id)
    and not exists (select 1 from public.detail_queue q where q.game_id = g.id);

delete from public.game_appearances where game_id in (select id from _nfl_unwanted);
delete from public.game_scoring_timeline where game_id in (select id from _nfl_unwanted);
delete from public.game_events where game_id in (select id from _nfl_unwanted);
delete from public.game_wp_timeline where game_id in (select id from _nfl_unwanted);
delete from public.game_story_steps where game_id in (select id from _nfl_unwanted);
update public.games set detail_ingested_at = null, relive_checked_at = null
  where id in (select id from _nfl_unwanted);
