-- Famous games, superstars and personal badges (20260918000100_famous_games.sql).
--
-- Fixtures are this file's own (the database is not empty; see 006). A made-up sport-agnostic
-- postseason: two finalists, each with a semifinal against a third team, and a final; plus a
-- regular-season game for the personal badges. Every rule in the migration gets one assertion
-- against real rows rather than an assumption.
begin;
create extension if not exists pgtap with schema extensions;
select plan(36);

insert into auth.users (id, email, aud, role)
values ('a1000000-0000-4000-8000-0000000000f1', 'famous-fan@test', 'authenticated', 'authenticated'),
       ('a1000000-0000-4000-8000-0000000000f2', 'famous-other@test', 'authenticated', 'authenticated')
on conflict (id) do nothing;

insert into public.profiles (id, handle, display_name, is_private)
values ('a1000000-0000-4000-8000-0000000000f1', 'famousfan', 'Famous Fan', false),
       ('a1000000-0000-4000-8000-0000000000f2', 'famousother', 'Famous Other', false)
on conflict (id) do nothing;

insert into public.venues (id, key, name, tz) values
  ('00000000-0000-0000-0000-0000000000fb', 'famous-park', 'Famous Park', 'America/Los_Angeles'),
  ('00000000-0000-0000-0000-0000000000fc', 'famous-field', 'Famous Field', null)
on conflict (key) do nothing;

insert into public.teams (id, sport_id, name, city, abbreviation, nickname, provider, provider_team_id, franchise_id)
values ('00000000-0000-0000-0000-0000000000fa', 'mlb', 'Famous Nine', 'Testville', 'FAM', 'Nines', 'test', 'fam-t1', 'fam-f1'),
       ('00000000-0000-0000-0000-0000000000fd', 'mlb', 'Rival Nine', 'Nowhere', 'RIV', 'Rivals', 'test', 'fam-t2', 'fam-f2'),
       ('00000000-0000-0000-0000-0000000000fe', 'mlb', 'Third Nine', 'Elsewhere', 'THR', 'Thirds', 'test', 'fam-t3', 'fam-f3')
on conflict (provider, provider_team_id) do nothing;

insert into public.players (id, sport_id, full_name, provider, provider_player_id, debut_on, rookie_season)
values ('00000000-0000-0000-0000-0000000000f1', 'mlb', 'Star Newcomer', 'test', 'fam-p1', '1991-06-01', 1991),
       ('00000000-0000-0000-0000-0000000000f2', 'mlb', 'Quiet Regular', 'test', 'fam-p2', null, null),
       ('00000000-0000-0000-0000-0000000000f3', 'mlb', 'Old Legend', 'test', 'fam-p3', null, null)
on conflict (provider, provider_player_id) do nothing;

-- A 1991 postseason, long complete. Semifinals: FAM beats THR, RIV beats THR. Final: FAM beats RIV
-- in "game 2" (two games between them). An 8 pm Pacific start on 1991-10-05 is 1991-10-06 UTC.
insert into public.games (id, sport_id, season, game_type, scheduled_start, venue_id, home_team_id, away_team_id, status, home_score, away_score, provider, provider_game_id)
values ('00000000-0000-0000-0000-0000000000e1', 'mlb', 1991, 'postseason', '1991-10-01T20:00:00Z', '00000000-0000-0000-0000-0000000000fb',
        '00000000-0000-0000-0000-0000000000fa', '00000000-0000-0000-0000-0000000000fe', 'final', 4, 1, 'test', 'fam-g1'),
       ('00000000-0000-0000-0000-0000000000e2', 'mlb', 1991, 'postseason', '1991-10-02T20:00:00Z', '00000000-0000-0000-0000-0000000000fc',
        '00000000-0000-0000-0000-0000000000fd', '00000000-0000-0000-0000-0000000000fe', 'final', 2, 0, 'test', 'fam-g2'),
       ('00000000-0000-0000-0000-0000000000e3', 'mlb', 1991, 'postseason', '1991-10-04T20:00:00Z', '00000000-0000-0000-0000-0000000000fb',
        '00000000-0000-0000-0000-0000000000fa', '00000000-0000-0000-0000-0000000000fd', 'final', 1, 5, 'test', 'fam-g3'),
       ('00000000-0000-0000-0000-0000000000e4', 'mlb', 1991, 'postseason', '1991-10-06T03:00:00Z', '00000000-0000-0000-0000-0000000000fb',
        '00000000-0000-0000-0000-0000000000fa', '00000000-0000-0000-0000-0000000000fd', 'final', 7, 6, 'test', 'fam-g4'),
       -- The regular-season game the personal badges hang on: Star Newcomer's debut day, 14 days
       -- after joining, in his rookie season.
       ('00000000-0000-0000-0000-0000000000e5', 'mlb', 1991, 'regular', '1991-06-02T02:00:00Z', '00000000-0000-0000-0000-0000000000fb',
        '00000000-0000-0000-0000-0000000000fa', '00000000-0000-0000-0000-0000000000fd', 'final', 3, 2, 'test', 'fam-g5'),
       -- A game nobody attended, for the "other fan" checks.
       ('00000000-0000-0000-0000-0000000000e6', 'mlb', 1991, 'regular', '1991-07-02T02:00:00Z', '00000000-0000-0000-0000-0000000000fb',
        '00000000-0000-0000-0000-0000000000fa', '00000000-0000-0000-0000-0000000000fd', 'final', 3, 2, 'test', 'fam-g6')
on conflict (provider, provider_game_id) do nothing;

insert into public.game_appearances (game_id, player_id, team_id) values
  ('00000000-0000-0000-0000-0000000000e5', '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000fa'),
  ('00000000-0000-0000-0000-0000000000e5', '00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000fa'),
  ('00000000-0000-0000-0000-0000000000e5', '00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000fd'),
  ('00000000-0000-0000-0000-0000000000e6', '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000fa')
on conflict do nothing;

-- Honors: Quiet Regular was an All-Star in 1988 and again in 1990. Since 2026-09-23 one
-- selection is not enough (migration 20260923110000, `honor_kinds.min_count`), so he is a star
-- only while both sit inside the three-season window: 1990 and 1991, not 1988 and not 1992.
-- Old Legend is a curated franchise player through 1990 only.
insert into public.player_honors (player_id, season, honor, source) values
  ('00000000-0000-0000-0000-0000000000f2', 1988, 'all_star', 'test'),
  ('00000000-0000-0000-0000-0000000000f2', 1990, 'all_star', 'test');
insert into public.franchise_players (player_id, team_id, from_season, to_season, source) values
  ('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000fd', 1980, 1990, 'test');

insert into public.player_moves (player_id, team_id, joined_on, kind, source) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000fa', '1991-05-18', 'trade', 'test');
insert into public.player_firsts (player_id, kind, game_id) values
  ('00000000-0000-0000-0000-0000000000f1', 'first_td', '00000000-0000-0000-0000-0000000000e5');

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
select is(public.roman_numeral(59), 'LIX', 'roman_numeral spells Super Bowl LIX');
select is(public.roman_numeral(50), '50', 'and keeps Super Bowl 50 in digits');
select is(public.game_local_date('1991-10-06T03:00:00Z', 'America/Los_Angeles'), '1991-10-05'::date,
  'game_local_date reads the venue timezone');
select is(public.game_local_date('2023-01-17T01:15:00Z', null), '2023-01-16'::date,
  'and falls back to Eastern time for a venue without one');

-- ---------------------------------------------------------------------------
-- Superstars
-- ---------------------------------------------------------------------------
select ok(not public.is_superstar('00000000-0000-0000-0000-0000000000f2', 1988), 'one All-Star selection is not a star');
select ok(public.is_superstar('00000000-0000-0000-0000-0000000000f2', 1991), 'two inside the window are, for as long as both are in it');
select ok(not public.is_superstar('00000000-0000-0000-0000-0000000000f2', 1992), 'but not once only one remains');
select ok(not public.is_superstar('00000000-0000-0000-0000-0000000000f2', 1987), 'and not before either');
select ok(public.is_superstar('00000000-0000-0000-0000-0000000000f3', 1985), 'a curated franchise player is a star in his era');
select ok(not public.is_superstar('00000000-0000-0000-0000-0000000000f3', 1991), 'and not after it');
select ok(not public.is_superstar('00000000-0000-0000-0000-0000000000f1', 1991), 'nobody else is');
select is((select label || ' ' || season from public.superstar_honor('00000000-0000-0000-0000-0000000000f2', 1991)),
  'All-Star 1990', 'superstar_honor names the honor and its most recent season');
select results_eq(
  $$select full_name from public.game_stars('00000000-0000-0000-0000-0000000000e5')$$,
  $$values ('Quiet Regular')$$,
  'game_stars lists the stars who appeared, and only them');

-- ---------------------------------------------------------------------------
-- The schedule layer
-- ---------------------------------------------------------------------------
select ok(public.rebuild_schedule_famous_games() >= 3, 'rebuild_schedule_famous_games returns the row count');
select is((select count(*) from public.famous_games f join public.games g on g.id = f.game_id where g.provider = 'test' and g.season = 1991),
  3::bigint, 'a complete postseason yields the final and both semifinals');
select is((select title from public.famous_games where game_id = '00000000-0000-0000-0000-0000000000e4' and source = 'schedule'),
  'World Series Game 2', 'the final is numbered within its series');
select is((select story from public.famous_games where game_id = '00000000-0000-0000-0000-0000000000e4' and source = 'schedule'),
  'The Nines beat the Rivals 7' || chr(8211) || '6 to win the 1991 World Series.',
  'the story names both nicknames and the score with an en dash');
select is((select category from public.famous_games where game_id = '00000000-0000-0000-0000-0000000000e2' and source = 'schedule'),
  'playoff', 'a semifinal is a playoff row');
select is((select count(*) from public.famous_games where game_id = '00000000-0000-0000-0000-0000000000e3'),
  0::bigint, 'a game between the finalists before the final is not a semifinal');
select is(public.rebuild_schedule_famous_games(), public.rebuild_schedule_famous_games(),
  'the rebuild is idempotent');

-- ---------------------------------------------------------------------------
-- Logging a famous game, and a famous row appearing later
-- ---------------------------------------------------------------------------
insert into public.attendances (user_id, game_id, source, status)
values ('a1000000-0000-4000-8000-0000000000f1', '00000000-0000-0000-0000-0000000000e4', 'manual', 'attended');
select is((select payload ->> 'title' from public.feed_events
           where actor_user_id = 'a1000000-0000-4000-8000-0000000000f1' and type = 'famous_game'
             and game_id = '00000000-0000-0000-0000-0000000000e4'),
  'World Series Game 2', 'logging a famous game writes a famous_game feed event with its title');

insert into public.attendances (user_id, game_id, source, status)
values ('a1000000-0000-4000-8000-0000000000f1', '00000000-0000-0000-0000-0000000000e5', 'manual', 'attended');
select is((select count(*) from public.feed_events
           where actor_user_id = 'a1000000-0000-4000-8000-0000000000f1' and type = 'famous_game'),
  1::bigint, 'an ordinary game writes none');

insert into public.famous_games (game_id, source, category, title, story, about_team_id)
values ('00000000-0000-0000-0000-0000000000e5', 'curated', 'debut', 'The night the Nines arrived', 'One sentence.', '00000000-0000-0000-0000-0000000000fa');
select is((select payload ->> 'title' from public.feed_events
           where actor_user_id = 'a1000000-0000-4000-8000-0000000000f1' and type = 'famous_game'
             and game_id = '00000000-0000-0000-0000-0000000000e5'),
  'The night the Nines arrived', 'a curated row added after the fact writes the event the fan would have had');

insert into public.famous_games (game_id, source, category, title, story)
values ('00000000-0000-0000-0000-0000000000e4', 'curated', 'championship', 'The one with the rain delay', '');
select is((select count(*) from public.feed_events
           where actor_user_id = 'a1000000-0000-4000-8000-0000000000f1' and type = 'famous_game'
             and game_id = '00000000-0000-0000-0000-0000000000e4'),
  1::bigint, 'a second famous row for the same game writes no second event');

-- ---------------------------------------------------------------------------
-- The fan's view: user_famous_games, the count, and the personal badges
-- ---------------------------------------------------------------------------
insert into public.user_players (user_id, player_id) values
  ('a1000000-0000-4000-8000-0000000000f1', '00000000-0000-0000-0000-0000000000f1'),
  ('a1000000-0000-4000-8000-0000000000f1', '00000000-0000-0000-0000-0000000000f2');

select is((select title from public.user_famous_games('a1000000-0000-4000-8000-0000000000f1')
           where game_id = '00000000-0000-0000-0000-0000000000e4' and not personal),
  'The one with the rain delay', 'a game with both rows shows the curated one, once');

select results_eq(
  $$select kind from public.user_famous_games('a1000000-0000-4000-8000-0000000000f1') where personal order by kind$$,
  $$values ('debut'), ('first_days'), ('first_td'), ('rookie')$$,
  'every personal badge rule fires for a favourite who appeared: debut day, within 14 days of joining, rookie season, first touchdown');

select is((select count(*) from public.user_famous_games('a1000000-0000-4000-8000-0000000000f1')
           where personal and player_id = '00000000-0000-0000-0000-0000000000f2'),
  0::bigint, 'a favourite with no debut, move or first earns nothing');

select is((select payload -> 'superlatives' -> 'famous_games' from public.user_stats_cache
           where user_id = 'a1000000-0000-4000-8000-0000000000f1'),
  '{"count": 2, "personal_count": 4}'::jsonb,
  'the stats payload counts games once and badges each, and the favourites trigger refreshed it');

delete from public.user_players where user_id = 'a1000000-0000-4000-8000-0000000000f1' and player_id = '00000000-0000-0000-0000-0000000000f1';
select is((select payload -> 'superlatives' -> 'famous_games' from public.user_stats_cache
           where user_id = 'a1000000-0000-4000-8000-0000000000f1'),
  '{"count": 2, "personal_count": 0}'::jsonb,
  'unfavouriting the player takes the badges with him');

-- ---------------------------------------------------------------------------
-- Through RLS, as the fan and as someone else
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"a1000000-0000-4000-8000-0000000000f1","role":"authenticated"}';

select is((select count(*) from public.my_famous_games()), 2::bigint, 'my_famous_games lists my two famous games');
select is((select count(*) from public.game_famous('00000000-0000-0000-0000-0000000000e4')), 1::bigint,
  'game_famous shows a game famous two ways once');
select is((select title from public.game_famous('00000000-0000-0000-0000-0000000000e4')), 'The one with the rain delay',
  'and it is the curated row');
select is((select count(*) from public.famous_games where game_id = '00000000-0000-0000-0000-0000000000e4'), 2::bigint,
  'authenticated can read famous_games');
select throws_ok($$insert into public.famous_games (game_id, source, category, title)
  values ('00000000-0000-0000-0000-0000000000e6', 'curated', 'record', 'Nope')$$,
  '42501', null, 'authenticated cannot write famous_games');
select throws_ok($$insert into public.player_honors (player_id, season, honor, source)
  values ('00000000-0000-0000-0000-0000000000f1', 1991, 'mvp', 'me')$$,
  '42501', null, 'authenticated cannot write player_honors');

set local request.jwt.claims to '{"sub":"a1000000-0000-4000-8000-0000000000f2","role":"authenticated"}';
select is((select count(*) from public.my_famous_games()), 0::bigint, 'someone else sees none of mine');

reset role;

select * from finish();
rollback;
