-- Storylines: at most one per team, plus one about the game when it is a big one (SPEC.md 6.18).
--
-- SPEC 6.18 asked for "1 to 3 one-sentence storylines per team". Dean narrowed it on 2026-09-17:
-- at most ONE per team, and, only when the game is genuinely significant, one more about why.
-- That second kind is about the game rather than either side, so it has no team.
--
-- The rule is enforced here rather than trusted to the generator. A unique index cannot be argued
-- with by a retry loop, a concurrent run, or a future change to the prompt.

-- 1. A game-level storyline has no team.
alter table public.storylines alter column team_id drop not null;

-- 2. Significance comes from the schedule (a postseason game, a season or home opener), not from
--    results, so it gets its own source and its own label in the UI.
alter table public.storylines drop constraint storylines_source_check;
alter table public.storylines add constraint storylines_source_check
  check (source in ('results', 'injury_report', 'probable_starter', 'schedule'));

-- A team storyline is about a team; a schedule storyline is about the game. Mixing them would put
-- "why this game matters" under one side's name.
alter table public.storylines add constraint storylines_kind_matches_team
  check ((source = 'schedule') = (team_id is null));

-- 3. One per team per game, and one game-level row per game. NULLS NOT DISTINCT is what makes the
--    second half hold: without it every null team_id would count as different, and a game could
--    carry any number of significance rows.
drop index if exists public.storylines_game_idx;
create unique index storylines_one_per_slot
  on public.storylines (game_id, team_id) nulls not distinct;

comment on column public.storylines.team_id is
  'The team this storyline is about, or null for the one storyline about the game itself (source = schedule).';
