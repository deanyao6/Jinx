-- Compatibility (migration 20260924010300; social brief 02, section 6): the SQL twin agrees with
-- packages/core/src/compatibility.ts on its four examples, only mutuals get a number, and it
-- is cached.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

-- The same four examples as compatibility.test.ts.
select results_eq($$select * from public.compatibility_score(2, 1, 1, 14, 8, 6, 2, null, null)$$,
  $$values (53, 'venues'::text, 6)$$, 'example A');
select results_eq($$select * from public.compatibility_score(1, 1, 0, 3, 3, 1, 0, 0.6, 0.5)$$,
  $$values (20, 'picks'::text, 0)$$, 'example B');
select results_eq($$select * from public.compatibility_score(2, 2, 2, 5, 5, 5, 12, 0.25, 0.25)$$,
  $$values (91, 'teams'::text, 2)$$, 'example C');
select results_eq($$select * from public.compatibility_score(3, 3, 1, 1, 20, 1, 9, null, null)$$,
  $$values (47, 'games'::text, 9)$$, 'example D');

insert into auth.users (id, email) values
  ('b7400000-0000-4000-8000-0000000000a1', 'cp-me@test'),
  ('b7400000-0000-4000-8000-0000000000b1', 'cp-mutual@test'),
  ('b7400000-0000-4000-8000-0000000000c1', 'cp-oneway@test');
insert into public.teams (id, sport_id, name, city, abbreviation, provider, provider_team_id, franchise_id) values
  ('00000000-0000-0000-0000-00000074a001', 'mlb', 'Compat Home', 'Home', 'CHM', 'test', 'cp-t1', 'cp-f1'),
  ('00000000-0000-0000-0000-00000074a002', 'mlb', 'Compat Away', 'Away', 'CAW', 'test', 'cp-t2', 'cp-f2');
insert into public.venues (id, key, name, city) values ('00000000-0000-0000-0000-00000074b001', 'cp-park', 'Compat Park', 'Home');
insert into public.games (id, sport_id, season, game_type, scheduled_start, venue_id, home_team_id, away_team_id, status, provider, provider_game_id) values
  ('00000000-0000-0000-0000-00000074c001', 'mlb', 2026, 'regular', '2026-06-01T23:00:00Z', '00000000-0000-0000-0000-00000074b001', '00000000-0000-0000-0000-00000074a001', '00000000-0000-0000-0000-00000074a002', 'final', 'test', 'cp-g1');
insert into public.user_teams values
  ('b7400000-0000-4000-8000-0000000000a1', '00000000-0000-0000-0000-00000074a001'),
  ('b7400000-0000-4000-8000-0000000000b1', '00000000-0000-0000-0000-00000074a001');
insert into public.attendances (user_id, game_id, source) values
  ('b7400000-0000-4000-8000-0000000000a1', '00000000-0000-0000-0000-00000074c001', 'manual'),
  ('b7400000-0000-4000-8000-0000000000b1', '00000000-0000-0000-0000-00000074c001', 'manual');
insert into public.follows (follower_id, followee_id) values
  ('b7400000-0000-4000-8000-0000000000a1', 'b7400000-0000-4000-8000-0000000000b1'),
  ('b7400000-0000-4000-8000-0000000000b1', 'b7400000-0000-4000-8000-0000000000a1'),
  ('b7400000-0000-4000-8000-0000000000a1', 'b7400000-0000-4000-8000-0000000000c1');

set local role authenticated;
set local request.jwt.claims to '{"sub":"b7400000-0000-4000-8000-0000000000a1","role":"authenticated"}';
-- One team of one each (1.0 * 30), one stadium of one each (1/3 * 30), one game (0.28 * 25): 47.09 / 85.
select results_eq($$select score, driver, driver_count from public.compatibility_with('b7400000-0000-4000-8000-0000000000b1')$$,
  $$values (55, 'teams'::text, 1)$$, 'two mutuals get a number and its driver');
select is((select count(*)::integer from public.compatibility_with('b7400000-0000-4000-8000-0000000000c1')), 0,
  'a one-way follow gets nothing');
select is((select count(*)::integer from public.compatibility_cache), 0, 'the cache is not readable directly');
reset role;
select is((select count(*)::integer from public.compatibility_cache), 1, 'the mutual pair was cached, once');

insert into public.blocks (blocker_id, blocked_id) values ('b7400000-0000-4000-8000-0000000000b1', 'b7400000-0000-4000-8000-0000000000a1');
set local role authenticated;
set local request.jwt.claims to '{"sub":"b7400000-0000-4000-8000-0000000000a1","role":"authenticated"}';
select is((select count(*)::integer from public.compatibility_with('b7400000-0000-4000-8000-0000000000b1')), 0,
  'a block ends it, even with the follows still in place');
reset role;

select * from finish();
rollback;
