-- A check-in is a session (migration 20260924000200, 00_repo_reality.md R4): started_at, an
-- end with its reason, the attendance it verified, and who may see it. Pick a side needs an
-- open session; game_context keeps `checked_in_at` for the builds in the field.
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (id, email) values
  ('b6100000-0000-4000-8000-0000000000a1', 'cs-alice@test'),
  ('b6100000-0000-4000-8000-0000000000b1', 'cs-bob@test'),
  ('b6100000-0000-4000-8000-0000000000c1', 'cs-carol@test');
-- Alice and Bob are mutuals; Carol follows Alice only.
insert into public.follows (follower_id, followee_id) values
  ('b6100000-0000-4000-8000-0000000000a1', 'b6100000-0000-4000-8000-0000000000b1'),
  ('b6100000-0000-4000-8000-0000000000b1', 'b6100000-0000-4000-8000-0000000000a1'),
  ('b6100000-0000-4000-8000-0000000000c1', 'b6100000-0000-4000-8000-0000000000a1');
insert into public.teams (id, sport_id, name, city, abbreviation, provider, provider_team_id, franchise_id) values
  ('00000000-0000-0000-0000-00000061a001', 'nfl', 'Session Home', 'Home', 'SHM', 'test', 'cs-t1', 'cs-f1'),
  ('00000000-0000-0000-0000-00000061a002', 'nfl', 'Session Away', 'Away', 'SAW', 'test', 'cs-t2', 'cs-f2');
insert into public.venues (id, key, name, city, lat, lng, geofence_m) values
  ('00000000-0000-0000-0000-00000061b001', 'cs-venue', 'Session Field', 'Home', 40, -75, 400);
insert into public.games (id, sport_id, season, game_type, scheduled_start, venue_id, home_team_id, away_team_id, status, provider, provider_game_id)
values ('00000000-0000-0000-0000-00000061c001', 'nfl', 2026, 'regular', now() + interval '1 hour', '00000000-0000-0000-0000-00000061b001',
        '00000000-0000-0000-0000-00000061a001', '00000000-0000-0000-0000-00000061a002', 'scheduled', 'test', 'cs-g1');
insert into public.game_win_prob (game_id, home_win_prob) values ('00000000-0000-0000-0000-00000061c001', 0.5);

select has_column('public', 'checkins', 'started_at', 'checked_in_at is now started_at');
select hasnt_column('public', 'checkins', 'checked_in_at', 'and the old name is gone');

set local role authenticated;
set local request.jwt.claims to '{"sub":"b6100000-0000-4000-8000-0000000000a1","role":"authenticated"}';
select is((public.check_in('00000000-0000-0000-0000-00000061c001', 100, 20) ->> 'ok')::boolean, true, 'checking in still works');
select is(
  (select attendance_id from public.checkins where user_id = auth.uid()),
  (select id from public.attendances where user_id = auth.uid() and game_id = '00000000-0000-0000-0000-00000061c001'),
  'the session points at the attendance it verified');
select isnt(public.game_context('00000000-0000-0000-0000-00000061c001') ->> 'checked_in_at', null, 'game_context keeps checked_in_at for builds 4 and 5');
select is((public.game_context('00000000-0000-0000-0000-00000061c001') -> 'checkin' ->> 'open')::boolean, true, 'and says the session is open');

-- Only the owner ends or hides a session, and the proof is not theirs to rewrite.
update public.checkins set distance_m = 0, started_at = now() - interval '1 day' where user_id = auth.uid();
select is((select distance_m from public.checkins where user_id = auth.uid()), 100, 'the distance proof cannot be rewritten');
select throws_ok(
  $$update public.checkins set ended_at = now() where user_id = auth.uid()$$,
  '23514', null, 'an ended session has to say why');
update public.checkins set ended_at = now(), end_reason = 'left' where user_id = auth.uid();
select is((public.game_context('00000000-0000-0000-0000-00000061c001') -> 'checkin' ->> 'end_reason'), 'left', 'the owner ends it');
select is(public.make_pledge('00000000-0000-0000-0000-00000061c001', '00000000-0000-0000-0000-00000061a001') ->> 'reason', 'not_checked_in',
  'Pick a side needs an open session');
select is((public.check_in('00000000-0000-0000-0000-00000061c001', 100, 20) ->> 'ok')::boolean, true, 'checking in again reopens it');
select is((select ended_at is null and end_reason is null from public.checkins where user_id = auth.uid()), true, 'with no end left on it');

-- Who sees it: mutuals, while the owner allows.
set local request.jwt.claims to '{"sub":"b6100000-0000-4000-8000-0000000000b1","role":"authenticated"}';
select is((select count(*)::int from public.checkins where user_id = 'b6100000-0000-4000-8000-0000000000a1'), 1, 'a mutual sees a check-in');
update public.checkins set visibility = 'off' where user_id = 'b6100000-0000-4000-8000-0000000000a1';
reset role;
select is((select visibility from public.checkins where user_id = 'b6100000-0000-4000-8000-0000000000a1'), 'mutuals', 'nobody but the owner can switch it off');
set local role authenticated;
set local request.jwt.claims to '{"sub":"b6100000-0000-4000-8000-0000000000c1","role":"authenticated"}';
select is((select count(*)::int from public.checkins where user_id = 'b6100000-0000-4000-8000-0000000000a1'), 0, 'a one-way follower does not');
set local request.jwt.claims to '{"sub":"b6100000-0000-4000-8000-0000000000a1","role":"authenticated"}';
update public.checkins set visibility = 'off' where user_id = auth.uid();
set local request.jwt.claims to '{"sub":"b6100000-0000-4000-8000-0000000000b1","role":"authenticated"}';
select is((select count(*)::int from public.checkins where user_id = 'b6100000-0000-4000-8000-0000000000a1'), 0, 'switched off, not even a mutual sees it');
reset role;

select * from finish();
rollback;
