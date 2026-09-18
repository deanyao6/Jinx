-- Who scored, on every scoring play (SPEC.md 5.1 `game_scoring_timeline`, 6.19).
--
-- Dean, 2026-09-17: "a note on who scored in a game, unless it's a field goal: no one cares
-- that the kicker scored their extra point." The timeline held only the provider's prose, so
-- the game page could not say "Touchdown, A.J. Brown" or "2-run home run, Enrique Hernández"
-- without parsing sentences. Now each row carries what the score was and whose it was.
--
-- `kind` is a closed vocabulary per sport, written by packages/core/src/scoring.ts and read
-- back by the same file, so it is not constrained here: adding a word is a code change, not
-- a migration.
--   nfl: touchdown | field_goal | extra_point | two_point | safety | other
--   mlb: home_run | single | double | triple | sac_fly | sac_bunt | walk | hit_by_pitch |
--        groundout | flyout | fielders_choice | wild_pitch | passed_ball | balk | steal |
--        error | other
--
-- The scorer is the rule, not the provider's column: a touchdown names whoever reached the end
-- zone, a field goal names the kicker, and an extra point, a two-point conversion and a safety
-- name nobody. In baseball it is the batter for a home run or any RBI, the runner on a steal
-- of home, and nobody for a wild pitch, a passed ball or a balk. `scorer_name` is the full
-- name from `players` when the id resolves, else the provider's short form ("A.Brown").
--
-- Rows written before this migration have all three null. `games_needing_scorers` finds the
-- attended games among them so the ingest scripts can re-derive the columns (`--rescore`):
-- MLB by refetching the feed (detail is only ever fetched for logged games, SPEC.md 4.7),
-- NFL from the season play-by-play files the pipeline already downloads.

alter table public.game_scoring_timeline
  add column kind text,
  add column scorer_player_id uuid references public.players (id) on delete set null,
  add column scorer_name text;

comment on column public.game_scoring_timeline.kind is
  'What the score was, from a per-sport vocabulary owned by packages/core/src/scoring.ts. Null on rows written before 2026-09-17 until rescored.';
comment on column public.game_scoring_timeline.scorer_player_id is
  'The player the score belongs to by the scoring rule (touchdown scorer, field goal kicker, batter with the RBI). Null for an extra point, a two-point conversion, a safety, a wild pitch, and for a player we hold no row for.';
comment on column public.game_scoring_timeline.scorer_name is
  'The scorer''s name: the full name from players when scorer_player_id is set, else the provider''s short form.';

-- "Which of my games did this player score in": the superlatives and favourite players ask it.
create index game_scoring_timeline_scorer_idx
  on public.game_scoring_timeline (scorer_player_id)
  where scorer_player_id is not null;

-- Relive steps are built from the same plays and shown with the same note, so they carry the
-- kind too. The scorer columns were added on 2026-09-16; MLB steps now fill them as well.
alter table public.game_story_steps
  add column kind text;

comment on column public.game_story_steps.kind is
  'What the score on this step was, same vocabulary as game_scoring_timeline.kind. Null on the pregame and final steps and on stories built before 2026-09-17.';

-- Attended games with detail whose timeline predates the scorer columns. Service role only:
-- it is the ingest scripts' worklist, and it names games by their provider id.
create or replace function public.games_needing_scorers(p_provider text, p_limit integer default 200)
returns table (game_id uuid, provider_game_id text, season integer)
language sql
stable
security definer
set search_path = public
as $$
  select g.id, g.provider_game_id, g.season
  from public.games g
  where g.provider = p_provider
    and g.detail_ingested_at is not null
    and exists (select 1 from public.attendances a where a.game_id = g.id)
    and exists (select 1 from public.game_scoring_timeline t where t.game_id = g.id and t.kind is null)
  order by g.scheduled_start desc
  limit p_limit;
$$;

revoke all on function public.games_needing_scorers(text, integer) from public, anon, authenticated;
grant execute on function public.games_needing_scorers(text, integer) to service_role;
