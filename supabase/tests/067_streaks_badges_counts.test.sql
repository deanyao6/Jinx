-- Streaks, badges, counts and four favorites (migration 20260924000800): passport data read
-- with the passport and written by the server alone; a secret badge stays secret until earned;
-- four favorites are the fan's own, four at most.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, email) values
  ('b6700000-0000-4000-8000-0000000000a1', 'sb-a@test'),
  ('b6700000-0000-4000-8000-0000000000b1', 'sb-b@test'),
  ('b6700000-0000-4000-8000-0000000000c1', 'sb-private@test');
update public.profiles set is_private = true where id = 'b6700000-0000-4000-8000-0000000000c1';
insert into public.teams (id, sport_id, name, city, abbreviation, provider, provider_team_id, franchise_id)
values ('00000000-0000-0000-0000-00000067a001', 'mls', 'Streak FC', 'Streak', 'STK', 'test', 'sb-t1', 'sb-f1');
insert into public.games (id, sport_id, season, game_type, scheduled_start, home_team_id, away_team_id, status, provider, provider_game_id)
select ('00000000-0000-0000-0000-00000067c00' || n)::uuid, 'mlb', 2026, 'regular', '2026-06-01T23:00:00Z'::timestamptz + n * interval '1 day',
       (select id from public.teams where sport_id = 'mlb' order by id limit 1), (select id from public.teams where sport_id = 'mlb' order by id offset 1 limit 1),
       'final', 'test', 'sb-g' || n
from generate_series(1, 5) n;
insert into public.badges (key, name, description, criteria, is_secret) values
  ('three_parks_weekend', 'Weekend warrior', 'Three stadiums in one weekend', '{"type":"distinct_venues","target":3}', false),
  ('curse_breaker', 'Curse breaker', 'A secret', '{"type":"count","target":1}', true),
  ('rally_cap', 'Rally cap', 'Another secret', '{"type":"count","target":1}', true);
insert into public.user_badges (user_id, badge_key) values
  ('b6700000-0000-4000-8000-0000000000a1', 'curse_breaker'),
  ('b6700000-0000-4000-8000-0000000000c1', 'three_parks_weekend');
insert into public.season_streaks (user_id, team_id, sport_id, start_season, end_season, seasons, min_games)
values ('b6700000-0000-4000-8000-0000000000a1', '00000000-0000-0000-0000-00000067a001', 'mls', 2022, 2026, 5, 2);
insert into public.user_counts (user_id, sport_id, season, games, verified_games)
values ('b6700000-0000-4000-8000-0000000000a1', 'mls', 0, 12, 4);

set local role authenticated;
set local request.jwt.claims to '{"sub":"b6700000-0000-4000-8000-0000000000a1","role":"authenticated"}';
select results_eq($$select key from public.badges order by key$$, $$values ('curse_breaker'), ('three_parks_weekend')$$,
  'a secret badge shows only to someone who has earned it');
select throws_ok(
  $$insert into public.user_badges (user_id, badge_key) values (auth.uid(), 'rally_cap')$$,
  '42501', null, 'nobody awards themselves a badge');
update public.user_counts set games = 500 where user_id = auth.uid();
update public.season_streaks set seasons = 50 where user_id = auth.uid();
reset role;
select is((select games from public.user_counts where user_id = 'b6700000-0000-4000-8000-0000000000a1'), 12, 'nobody writes their own counts');
select is((select seasons from public.season_streaks where user_id = 'b6700000-0000-4000-8000-0000000000a1'), 5, 'or their own streak');

set local role authenticated;
set local request.jwt.claims to '{"sub":"b6700000-0000-4000-8000-0000000000b1","role":"authenticated"}';
select is((select count(*)::int from public.season_streaks where user_id = 'b6700000-0000-4000-8000-0000000000a1'), 1, 'another fan sees a public passport''s streaks');
select is((select count(*)::int from public.user_badges where user_id = 'b6700000-0000-4000-8000-0000000000c1'), 0, 'but not a private one''s badges');
insert into public.favorite_games (user_id, ordinal, game_id) values (auth.uid(), 1, '00000000-0000-0000-0000-00000067c001');
select throws_ok(
  $$insert into public.favorite_games (user_id, ordinal, game_id) values (auth.uid(), 5, '00000000-0000-0000-0000-00000067c005')$$,
  '23514', null, 'four favorites means four');
select throws_ok(
  $$insert into public.favorite_games (user_id, ordinal, game_id) values (auth.uid(), 2, '00000000-0000-0000-0000-00000067c001')$$,
  '23505', null, 'the same game once');
select throws_ok(
  $$insert into public.favorite_games (user_id, ordinal, game_id) values ('b6700000-0000-4000-8000-0000000000a1', 1, '00000000-0000-0000-0000-00000067c002')$$,
  '42501', null, 'nobody sets someone else''s favorites');

set local request.jwt.claims to '{"sub":"b6700000-0000-4000-8000-0000000000a1","role":"authenticated"}';
select is((select count(*)::int from public.favorite_games where user_id = 'b6700000-0000-4000-8000-0000000000b1'), 1, 'favorites show with a public passport');
set local request.jwt.claims to '{"sub":"b6700000-0000-4000-8000-0000000000c1","role":"authenticated"}';
select is((select count(*)::int from public.user_counts where user_id = 'b6700000-0000-4000-8000-0000000000a1'), 1, 'counts show with the passport');
reset role;

select * from finish();
rollback;
