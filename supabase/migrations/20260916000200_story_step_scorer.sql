-- Who scored on a story step (SPEC.md 6.7, 6.19).
--
-- "Players seen" on game detail used to print both full rosters — fifty-odd names in a run-on
-- line. It should name the players who did something and count the rest, which needs a per-game
-- source of "this person scored".
--
-- `game_events` already covers MLB: a home run carries its batter. It does NOT cover NFL, where
-- an ordinary touchdown is not a moment at all — `game_events` only holds the rare ones (a pick
-- six, a 50-yard field goal). The scoring plays themselves are already stored, as story steps, so
-- the scorer belongs on them.
--
-- Both columns are nullable and stay null wherever the provider does not say:
--   * nflverse gives `td_player_id` / `kicker_player_id` per scoring play, so NFL fills them.
--   * MLB's feed describes a scoring play in prose ("Rafael Devers homers (24) on a fly ball")
--     with no player id on the entry. Rather than parse names out of a sentence, MLB leaves
--     these null and keeps relying on `game_events` for its home runs.

alter table public.game_story_steps
  add column scorer_player_id uuid references public.players (id) on delete set null,
  add column scorer_name text;

comment on column public.game_story_steps.scorer_player_id is
  'The player who put the points on the board, when the provider identifies one. Null for MLB, whose feed carries no id on a scoring play, and for any step that is not a single player''s doing.';

-- Read path only ever filters by game, so the existing primary key covers it; this index is for
-- the reverse question ("which of my games did this player score in"), which the superlatives
-- and the favourite-player work will both ask.
create index game_story_steps_scorer_idx
  on public.game_story_steps (scorer_player_id)
  where scorer_player_id is not null;
