begin;
create extension if not exists pgtap with schema extensions;
select plan(33);

-- alice, bob and carol all follow each other. dana follows nobody. erin and alice are mutuals
-- until one blocks the other. alice, bob, dana and erin are checked in; carol is not.
insert into auth.users (id, email) values
  ('a1000000-0000-4000-8000-0000000000a1', 'alice@example.com'),
  ('b2000000-0000-4000-8000-0000000000b2', 'bob@example.com'),
  ('c3000000-0000-4000-8000-0000000000c3', 'carol@example.com'),
  ('d4000000-0000-4000-8000-0000000000d4', 'dana@example.com'),
  ('e5000000-0000-4000-8000-0000000000e5', 'erin@example.com');
update public.profiles set handle = 'alice', display_name = 'Alice' where id = 'a1000000-0000-4000-8000-0000000000a1';
update public.profiles set handle = 'bob', display_name = 'Bob' where id = 'b2000000-0000-4000-8000-0000000000b2';
update public.profiles set handle = 'carol', display_name = 'Carol' where id = 'c3000000-0000-4000-8000-0000000000c3';
update public.profiles set handle = 'dana', display_name = 'Dana' where id = 'd4000000-0000-4000-8000-0000000000d4';
update public.profiles set handle = 'erin', display_name = 'Erin' where id = 'e5000000-0000-4000-8000-0000000000e5';

insert into public.teams (id, sport_id, name, city, abbreviation, provider, provider_team_id, franchise_id) values
  ('00000000-0000-0000-0000-00000000a106', 'nfl', 'Chicago Bears', 'Chicago', 'CHI', 'test', 'hs-chi', 'nfl-bears'),
  ('00000000-0000-0000-0000-00000000a107', 'nfl', 'Green Bay Packers', 'Green Bay', 'GB', 'test', 'hs-gb', 'nfl-packers');
insert into public.venues (id, key, name, city, state, lat, lng, geofence_m) values
  ('00000000-0000-0000-0000-00000000b104', 'hs-soldier', 'Soldier Field', 'Chicago', 'IL', 41.8623, -87.6167, 400);
-- One game inside its check-in window (starts in an hour), one long over.
insert into public.games (id, sport_id, season, game_type, scheduled_start, venue_id, home_team_id, away_team_id, status, provider, provider_game_id) values
  ('00000000-0000-0000-0000-00000000c106', 'nfl', 2026, 'regular', now() + interval '1 hour', '00000000-0000-0000-0000-00000000b104',
   '00000000-0000-0000-0000-00000000a106', '00000000-0000-0000-0000-00000000a107', 'scheduled', 'test', 'hs-live'),
  ('00000000-0000-0000-0000-00000000c107', 'nfl', 2025, 'regular', now() - interval '30 days', '00000000-0000-0000-0000-00000000b104',
   '00000000-0000-0000-0000-00000000a106', '00000000-0000-0000-0000-00000000a107', 'final', 'test', 'hs-old');

insert into public.follows (follower_id, followee_id, status) values
  ('a1000000-0000-4000-8000-0000000000a1', 'b2000000-0000-4000-8000-0000000000b2', 'active'),
  ('b2000000-0000-4000-8000-0000000000b2', 'a1000000-0000-4000-8000-0000000000a1', 'active'),
  ('a1000000-0000-4000-8000-0000000000a1', 'c3000000-0000-4000-8000-0000000000c3', 'active'),
  ('c3000000-0000-4000-8000-0000000000c3', 'a1000000-0000-4000-8000-0000000000a1', 'active'),
  ('a1000000-0000-4000-8000-0000000000a1', 'e5000000-0000-4000-8000-0000000000e5', 'active'),
  ('e5000000-0000-4000-8000-0000000000e5', 'a1000000-0000-4000-8000-0000000000a1', 'active'),
  -- alice follows dana, dana does not follow back: one-way is not mutual.
  ('a1000000-0000-4000-8000-0000000000a1', 'd4000000-0000-4000-8000-0000000000d4', 'active'),
  ('b2000000-0000-4000-8000-0000000000b2', 'e5000000-0000-4000-8000-0000000000e5', 'active'),
  ('e5000000-0000-4000-8000-0000000000e5', 'b2000000-0000-4000-8000-0000000000b2', 'active');
-- bob asked to follow erin and has not been accepted: a request is not a follow. (The insert
-- trigger decides the status from the target's privacy, so the request is set afterwards.)
update public.follows set status = 'requested', accepted_at = null
  where follower_id = 'b2000000-0000-4000-8000-0000000000b2' and followee_id = 'e5000000-0000-4000-8000-0000000000e5';

insert into public.checkins (user_id, game_id, distance_m, accuracy_m) values
  ('a1000000-0000-4000-8000-0000000000a1', '00000000-0000-0000-0000-00000000c106', 40, 10),
  ('b2000000-0000-4000-8000-0000000000b2', '00000000-0000-0000-0000-00000000c106', 60, 10),
  ('d4000000-0000-4000-8000-0000000000d4', '00000000-0000-0000-0000-00000000c106', 60, 10),
  ('e5000000-0000-4000-8000-0000000000e5', '00000000-0000-0000-0000-00000000c106', 60, 10),
  ('a1000000-0000-4000-8000-0000000000a1', '00000000-0000-0000-0000-00000000c107', 40, 10),
  ('b2000000-0000-4000-8000-0000000000b2', '00000000-0000-0000-0000-00000000c107', 60, 10);

-- Nobody without an account gets near it.
select is(has_function_privilege('anon', 'public.offer_handshake(uuid, uuid)', 'execute'), false, 'anon cannot execute offer_handshake');
select is(has_function_privilege('anon', 'public.my_handshakes(uuid)', 'execute'), false, 'anon cannot execute my_handshakes');
select is(has_function_privilege('anon', 'public.handshake_candidates(uuid)', 'execute'), false, 'anon cannot execute handshake_candidates');
select is(has_table_privilege('anon', 'public.handshakes', 'select'), false, 'anon cannot read the table');
select is(has_table_privilege('authenticated', 'public.handshakes', 'insert'), false, 'a signed-in user has no insert privilege on the table');

-- ---------------------------------------------------------------------------
-- alice
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"a1000000-0000-4000-8000-0000000000a1","role":"authenticated"}';

select throws_ok(
  $$insert into public.handshakes (game_id, from_user, to_user) values ('00000000-0000-0000-0000-00000000c106', 'a1000000-0000-4000-8000-0000000000a1', 'b2000000-0000-4000-8000-0000000000b2')$$,
  '42501', null, 'a client cannot insert a handshake directly, even its own');

select is((select public.offer_handshake('00000000-0000-0000-0000-00000000c106', 'a1000000-0000-4000-8000-0000000000a1') ->> 'reason'), 'self', 'refused: yourself');
select is((select public.offer_handshake('00000000-0000-0000-0000-00000000c106', 'c3000000-0000-4000-8000-0000000000c3') ->> 'reason'), 'they_are_not_checked_in', 'refused: the other person is not checked in');
select is((select public.offer_handshake('00000000-0000-0000-0000-00000000c106', 'd4000000-0000-4000-8000-0000000000d4') ->> 'reason'), 'not_mutual', 'refused: a one-way follow is not mutual');
select is((select public.offer_handshake('00000000-0000-0000-0000-00000000c107', 'b2000000-0000-4000-8000-0000000000b2') ->> 'reason'), 'outside_window', 'refused: the check-in window has closed');

select set_eq(
  $$select user_id from public.handshake_candidates('00000000-0000-0000-0000-00000000c106')$$,
  array['b2000000-0000-4000-8000-0000000000b2'::uuid, 'e5000000-0000-4000-8000-0000000000e5'::uuid],
  'candidates are the checked-in mutuals: not carol (not checked in), not dana (not mutual)');

-- The offer.
select is(public.offer_handshake('00000000-0000-0000-0000-00000000c106', 'b2000000-0000-4000-8000-0000000000b2'),
  '{"offered": true, "complete": false}'::jsonb, 'alice offers bob: offered, not complete');
select is(public.offer_handshake('00000000-0000-0000-0000-00000000c106', 'b2000000-0000-4000-8000-0000000000b2'),
  '{"offered": true, "complete": false}'::jsonb, 'offering again is idempotent');
select is((select count(*)::int from public.handshakes), 1, 'and leaves one row');
select results_eq(
  $$select user_id, state from public.my_handshakes('00000000-0000-0000-0000-00000000c106')$$,
  $$values ('b2000000-0000-4000-8000-0000000000b2'::uuid, 'waiting')$$,
  'alice sees her own offer as waiting');
reset role;

-- ---------------------------------------------------------------------------
-- bob: the secret. alice's offer to him must be invisible in every form.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"b2000000-0000-4000-8000-0000000000b2","role":"authenticated"}';

select is_empty($$select * from public.my_handshakes('00000000-0000-0000-0000-00000000c106')$$, 'bob: my_handshakes says nothing about an incoming offer');
select is_empty($$select * from public.handshakes$$, 'bob: the table shows him no row aimed at him');
select is((select public.offer_handshake('00000000-0000-0000-0000-00000000c106', 'e5000000-0000-4000-8000-0000000000e5') ->> 'reason'), 'not_mutual', 'refused: a follow request is not a follow');

select is(public.offer_handshake('00000000-0000-0000-0000-00000000c106', 'a1000000-0000-4000-8000-0000000000a1'),
  '{"offered": true, "complete": true}'::jsonb, 'bob offers back: complete');
select results_eq(
  $$select user_id, display_name, state, completed_at is not null from public.my_handshakes('00000000-0000-0000-0000-00000000c106')$$,
  $$values ('a1000000-0000-4000-8000-0000000000a1'::uuid, 'Alice', 'complete', true)$$,
  'bob now sees alice, complete');
select is((select count(*)::int from public.handshakes), 1, 'bob still reads only the row he offered');
reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub":"a1000000-0000-4000-8000-0000000000a1","role":"authenticated"}';
select results_eq(
  $$select user_id, display_name, state from public.my_handshakes('00000000-0000-0000-0000-00000000c106')$$,
  $$values ('b2000000-0000-4000-8000-0000000000b2'::uuid, 'Bob', 'complete')$$,
  'alice now sees bob, complete');
select is(public.offer_handshake('00000000-0000-0000-0000-00000000c106', 'b2000000-0000-4000-8000-0000000000b2'),
  '{"offered": true, "complete": true}'::jsonb, 'asking again after completion changes nothing');
reset role;
select is((select count(*)::int from public.handshakes where game_id = '00000000-0000-0000-0000-00000000c106'), 2, 'one handshake per pair per game: two rows, one each way');

-- ---------------------------------------------------------------------------
-- carol is a mutual of alice but is not at the game.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"c3000000-0000-4000-8000-0000000000c3","role":"authenticated"}';
select is((select public.offer_handshake('00000000-0000-0000-0000-00000000c106', 'a1000000-0000-4000-8000-0000000000a1') ->> 'reason'), 'not_checked_in', 'refused: the caller is not checked in');
select is_empty($$select * from public.handshake_candidates('00000000-0000-0000-0000-00000000c106')$$, 'and she is told nothing about who is there');
select is_empty($$select * from public.handshakes$$, 'and sees nobody else''s handshakes');
reset role;

-- ---------------------------------------------------------------------------
-- Blocks, either way. erin offers alice first, then is blocked.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"e5000000-0000-4000-8000-0000000000e5","role":"authenticated"}';
select is((select (public.offer_handshake('00000000-0000-0000-0000-00000000c106', 'a1000000-0000-4000-8000-0000000000a1') ->> 'offered')::boolean), true, 'erin offers alice while they are mutuals');
reset role;

insert into public.blocks (blocker_id, blocked_id) values ('a1000000-0000-4000-8000-0000000000a1', 'e5000000-0000-4000-8000-0000000000e5');

set local role authenticated;
set local request.jwt.claims to '{"sub":"a1000000-0000-4000-8000-0000000000a1","role":"authenticated"}';
select is((select public.offer_handshake('00000000-0000-0000-0000-00000000c106', 'e5000000-0000-4000-8000-0000000000e5') ->> 'reason'), 'not_mutual', 'refused: the blocker cannot offer the person they blocked');
select set_eq(
  $$select user_id from public.handshake_candidates('00000000-0000-0000-0000-00000000c106')$$,
  array['b2000000-0000-4000-8000-0000000000b2'::uuid],
  'and the blocked person is no longer a candidate');
reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub":"e5000000-0000-4000-8000-0000000000e5","role":"authenticated"}';
select is((select public.offer_handshake('00000000-0000-0000-0000-00000000c106', 'a1000000-0000-4000-8000-0000000000a1') ->> 'reason'), 'not_mutual', 'refused: the blocked person cannot offer, and is not told why');
select is_empty($$select * from public.my_handshakes('00000000-0000-0000-0000-00000000c106')$$, 'and her earlier offer drops out of my_handshakes');
reset role;

-- Signed out.
set local role authenticated;
set local request.jwt.claims to '{"role":"authenticated"}';
select throws_ok(
  $$select public.offer_handshake('00000000-0000-0000-0000-00000000c106', 'a1000000-0000-4000-8000-0000000000a1')$$,
  '42501', 'not signed in', 'refused: no user');
reset role;

select * from finish();
rollback;
