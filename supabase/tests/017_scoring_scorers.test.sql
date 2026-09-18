-- The scorer columns on the scoring timeline and on story steps, and the rescore worklist
-- (migration 20260917001000). Every count is scoped to this file's own fixture rows.
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id, email, raw_user_meta_data) values
  ('a1000000-0000-4000-8000-0000000000a1', 'alice@example.com', '{}');

insert into public.teams (id, sport_id, name, city, abbreviation, provider, provider_team_id, franchise_id)
values ('00000000-0000-0000-0000-00000000a201', 'nfl', 'Philadelphia Eagles', 'Philadelphia', 'PHI', 'test', 'sc-phi', 'nfl-eagles'),
       ('00000000-0000-0000-0000-00000000a202', 'nfl', 'Chicago Bears', 'Chicago', 'CHI', 'test', 'sc-chi', 'nfl-bears');
insert into public.venues (id, key, name, lat, lng) values ('00000000-0000-0000-0000-00000000b201', 'sc-linc', 'Lincoln Financial Field', 39.9008, -75.1675);
insert into public.players (id, sport_id, full_name, provider, provider_player_id) values
  ('00000000-0000-0000-0000-00000000e201', 'nfl', 'A.J. Brown', 'test', 'sc-ajb');
-- Three final games with detail: one attended and half rescored, one attended and unscored, one nobody logged.
insert into public.games (id, sport_id, season, game_type, scheduled_start, venue_id, home_team_id, away_team_id, status, home_score, away_score, provider, provider_game_id, detail_ingested_at)
values ('00000000-0000-0000-0000-00000000c201', 'nfl', 2025, 'regular', '2025-11-28T20:00:00Z', '00000000-0000-0000-0000-00000000b201',
        '00000000-0000-0000-0000-00000000a201', '00000000-0000-0000-0000-00000000a202', 'final', 15, 24, 'test', 'sc-g1', now()),
       ('00000000-0000-0000-0000-00000000c202', 'nfl', 2025, 'regular', '2025-12-05T20:00:00Z', '00000000-0000-0000-0000-00000000b201',
        '00000000-0000-0000-0000-00000000a201', '00000000-0000-0000-0000-00000000a202', 'final', 10, 3, 'test', 'sc-g2', now()),
       ('00000000-0000-0000-0000-00000000c203', 'nfl', 2025, 'regular', '2025-12-12T20:00:00Z', '00000000-0000-0000-0000-00000000b201',
        '00000000-0000-0000-0000-00000000a201', '00000000-0000-0000-0000-00000000a202', 'final', 7, 0, 'test', 'sc-g3', now());
insert into public.attendances (id, user_id, game_id, source) values
  ('00000000-0000-0000-0000-00000000d201', 'a1000000-0000-4000-8000-0000000000a1', '00000000-0000-0000-0000-00000000c201', 'manual'),
  ('00000000-0000-0000-0000-00000000d202', 'a1000000-0000-4000-8000-0000000000a1', '00000000-0000-0000-0000-00000000c202', 'manual');

-- Game 1: a touchdown with its scorer, an extra point with none, and an old row with nothing.
insert into public.game_scoring_timeline (game_id, seq, period, clock, home_score, away_score, scoring_side, description, kind, scorer_player_id, scorer_name) values
  ('00000000-0000-0000-0000-00000000c201', 1, 3, '08:11', 6, 10, 'home', '1-J.Hurts pass deep left to 11-A.Brown for 33 yards, TOUCHDOWN.', 'touchdown', '00000000-0000-0000-0000-00000000e201', 'A.J. Brown'),
  ('00000000-0000-0000-0000-00000000c201', 2, 3, '08:07', 7, 10, 'home', '4-J.Elliott extra point is GOOD.', 'extra_point', null, null),
  ('00000000-0000-0000-0000-00000000c201', 3, 4, '03:14', 15, 24, 'home', 'written before the columns existed', null, null, null);
-- Game 2 and game 3: rows from before the migration.
insert into public.game_scoring_timeline (game_id, seq, period, clock, home_score, away_score, scoring_side, description) values
  ('00000000-0000-0000-0000-00000000c202', 1, 1, '10:00', 3, 0, 'home', 'field goal'),
  ('00000000-0000-0000-0000-00000000c203', 1, 1, '10:00', 7, 0, 'home', 'touchdown');
insert into public.game_wp_timeline (game_id, seq, period, half, home_wp) values
  ('00000000-0000-0000-0000-00000000c201', 1, 1, 'top', 0.57);
insert into public.game_story_steps (game_id, seq, wp_seq, away_score, home_score, label, text, kind, scorer_player_id, scorer_name) values
  ('00000000-0000-0000-0000-00000000c201', 1, 1, 0, 0, 'Pregame', 'Eagles were 57% to win at kickoff.', null, null, null),
  ('00000000-0000-0000-0000-00000000c201', 2, 1, 10, 6, '3rd quarter', '1-J.Hurts pass deep left to 11-A.Brown for 33 yards, TOUCHDOWN.', 'touchdown', '00000000-0000-0000-0000-00000000e201', 'A.J. Brown');

-- The columns are there and nullable, and the scorer really references players.
select has_column('public', 'game_scoring_timeline', 'kind', 'timeline has kind');
select has_column('public', 'game_scoring_timeline', 'scorer_player_id', 'timeline has scorer_player_id');
select has_column('public', 'game_scoring_timeline', 'scorer_name', 'timeline has scorer_name');
select has_column('public', 'game_story_steps', 'kind', 'story steps have kind');
select fk_ok('public', 'game_scoring_timeline', 'scorer_player_id', 'public', 'players', 'id', 'scorer_player_id references players');
select throws_ok($$insert into public.game_scoring_timeline (game_id, seq, period, home_score, away_score, scoring_side, description, kind, scorer_player_id)
  values ('00000000-0000-0000-0000-00000000c203', 2, 1, 7, 0, 'home', 'x', 'touchdown', '00000000-0000-0000-0000-00000000e999')$$,
  '23503', null, 'a scorer must be a players row');

-- A signed-in user reads the new columns with the rest of the row; nobody but the service role writes them.
set local role authenticated;
set local request.jwt.claims to '{"sub":"a1000000-0000-4000-8000-0000000000a1","role":"authenticated"}';
select is((select scorer_name from public.game_scoring_timeline where game_id = '00000000-0000-0000-0000-00000000c201' and seq = 1), 'A.J. Brown', 'authenticated reads the scorer');
select is((select kind from public.game_story_steps where game_id = '00000000-0000-0000-0000-00000000c201' and seq = 2), 'touchdown', 'authenticated reads a step''s kind');
select throws_ok($$insert into public.game_scoring_timeline (game_id, seq, period, home_score, away_score, scoring_side, description, kind, scorer_name)
  values ('00000000-0000-0000-0000-00000000c201', 9, 4, 15, 24, 'home', 'x', 'touchdown', 'me')$$,
  '42501', null, 'authenticated cannot write a scorer');
select throws_ok($$select * from public.games_needing_scorers('test')$$,
  '42501', null, 'authenticated cannot run the rescore worklist');
reset role;

-- The worklist: attended games with a null-kind row, the unlogged game left out.
select results_eq(
  $$select provider_game_id from public.games_needing_scorers('test') where provider_game_id like 'sc-%' order by 1$$,
  $$values ('sc-g1'), ('sc-g2')$$,
  'games_needing_scorers lists attended games whose timeline still has an unscored row');
update public.game_scoring_timeline set kind = 'touchdown' where game_id = '00000000-0000-0000-0000-00000000c201' and seq = 3;
select results_eq(
  $$select provider_game_id from public.games_needing_scorers('test') where provider_game_id like 'sc-%' order by 1$$,
  $$values ('sc-g2')$$,
  'a fully scored game drops off the worklist');

select * from finish();
rollback;
