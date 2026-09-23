-- The session's lifecycle (migration 20260924020000; docs/prompts/social/03, section 1): it
-- ends on the final plus 30, on "I have left", and six hours after the start with no final;
-- presence shows mutuals only, while the owner allows; the two prompt switches.
begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

insert into auth.users (id, email) values
  ('b8000000-0000-4000-8000-0000000000a1', 'sl-alice@test'),
  ('b8000000-0000-4000-8000-0000000000b1', 'sl-bob@test'),
  ('b8000000-0000-4000-8000-0000000000c1', 'sl-carol@test');
-- Alice and Bob are mutuals; Carol follows Alice only.
insert into public.follows (follower_id, followee_id) values
  ('b8000000-0000-4000-8000-0000000000a1', 'b8000000-0000-4000-8000-0000000000b1'),
  ('b8000000-0000-4000-8000-0000000000b1', 'b8000000-0000-4000-8000-0000000000a1'),
  ('b8000000-0000-4000-8000-0000000000c1', 'b8000000-0000-4000-8000-0000000000a1');
insert into public.teams (id, sport_id, name, city, abbreviation, provider, provider_team_id, franchise_id) values
  ('00000000-0000-0000-0000-00000080a001', 'nba', 'Lifecycle Home', 'Home', 'LHM', 'test', 'sl-t1', 'sl-f1'),
  ('00000000-0000-0000-0000-00000080a002', 'nba', 'Lifecycle Away', 'Away', 'LAW', 'test', 'sl-t2', 'sl-f2');
insert into public.venues (id, key, name, city, lat, lng, geofence_m) values
  ('00000000-0000-0000-0000-00000080b001', 'sl-venue', 'Lifecycle Arena', 'Home', 40, -75, 400);
-- Three games: one under way, one that went final, one that never got a final.
insert into public.games (id, sport_id, season, game_type, scheduled_start, venue_id, home_team_id, away_team_id, status, provider, provider_game_id, final_at) values
  ('00000000-0000-0000-0000-00000080c001', 'nba', 2026, 'regular', now() - interval '1 hour', '00000000-0000-0000-0000-00000080b001', '00000000-0000-0000-0000-00000080a001', '00000000-0000-0000-0000-00000080a002', 'live', 'test', 'sl-g1', null),
  ('00000000-0000-0000-0000-00000080c002', 'nba', 2026, 'regular', now() - interval '4 hours', '00000000-0000-0000-0000-00000080b001', '00000000-0000-0000-0000-00000080a001', '00000000-0000-0000-0000-00000080a002', 'final', 'test', 'sl-g2', now() - interval '40 minutes'),
  ('00000000-0000-0000-0000-00000080c003', 'nba', 2026, 'regular', now() - interval '5 hours', '00000000-0000-0000-0000-00000080b001', '00000000-0000-0000-0000-00000080a001', '00000000-0000-0000-0000-00000080a002', 'live', 'test', 'sl-g3', null);
insert into public.game_win_prob (game_id, home_win_prob) values
  ('00000000-0000-0000-0000-00000080c001', 0.5), ('00000000-0000-0000-0000-00000080c002', 0.5), ('00000000-0000-0000-0000-00000080c003', 0.5);

-- Alice checks in at the live game.
set local role authenticated;
set local request.jwt.claims to '{"sub":"b8000000-0000-4000-8000-0000000000a1","role":"authenticated"}';
select is((public.check_in('00000000-0000-0000-0000-00000080c001', 100, 20) ->> 'ok')::boolean, true, 'check-in opens a session');
select is((select verified from public.attendances where user_id = auth.uid() and game_id = '00000000-0000-0000-0000-00000080c001'), true, 'and creates a verified attendance');
select is((public.game_context('00000000-0000-0000-0000-00000080c001') -> 'checkin' ->> 'prompts_muted')::boolean, false, 'prompts are on for a new session');
select is((public.mute_checkin_prompts('00000000-0000-0000-0000-00000080c001', true) -> 'checkin' ->> 'prompts_muted')::boolean, true, '"not tonight" mutes the session');
select is((public.mute_checkin_prompts('00000000-0000-0000-0000-00000080c003', true) ->> 'reason'), 'not_checked_in', 'only a session you have can be muted');

-- Presence: Bob (mutual, checked in) sees Alice; Carol (one-way) does not; nobody sees a session switched off.
insert into public.attendance_seats (attendance_id, section, row, seat) select id, '104', '3', '7' from public.attendances where user_id = auth.uid() and game_id = '00000000-0000-0000-0000-00000080c001';
set local request.jwt.claims to '{"sub":"b8000000-0000-4000-8000-0000000000b1","role":"authenticated"}';
select is((select count(*)::int from public.also_here('00000000-0000-0000-0000-00000080c001')), 0, 'Also here needs an open session of your own');
select is((public.check_in('00000000-0000-0000-0000-00000080c001', 50, 10) ->> 'ok')::boolean, true, 'Bob checks in too');
select is((select user_id::text || ':' || coalesce(section, 'none') from public.also_here('00000000-0000-0000-0000-00000080c001')), 'b8000000-0000-4000-8000-0000000000a1:none', 'a mutual appears, without a section while seats are not shared');
set local request.jwt.claims to '{"sub":"b8000000-0000-4000-8000-0000000000c1","role":"authenticated"}';
select is((public.check_in('00000000-0000-0000-0000-00000080c001', 50, 10) ->> 'ok')::boolean, true, 'Carol checks in');
select is((select count(*)::int from public.also_here('00000000-0000-0000-0000-00000080c001')), 0, 'a one-way follower sees nobody');
reset role;
update public.profiles set share_seats = true where id = 'b8000000-0000-4000-8000-0000000000a1';
set local role authenticated;
set local request.jwt.claims to '{"sub":"b8000000-0000-4000-8000-0000000000b1","role":"authenticated"}';
select is((select section from public.also_here('00000000-0000-0000-0000-00000080c001')), '104', 'the section shows once seats are shared');
set local request.jwt.claims to '{"sub":"b8000000-0000-4000-8000-0000000000a1","role":"authenticated"}';
update public.checkins set visibility = 'off' where user_id = auth.uid() and game_id = '00000000-0000-0000-0000-00000080c001';
set local request.jwt.claims to '{"sub":"b8000000-0000-4000-8000-0000000000b1","role":"authenticated"}';
select is((select count(*)::int from public.also_here('00000000-0000-0000-0000-00000080c001')), 0, 'switched off, Alice is not here to anyone');

-- The profile default for new sessions.
reset role;
update public.profiles set checkin_visibility = 'off' where id = 'b8000000-0000-4000-8000-0000000000c1';
set local role authenticated;
set local request.jwt.claims to '{"sub":"b8000000-0000-4000-8000-0000000000c1","role":"authenticated"}';
select is((public.check_in('00000000-0000-0000-0000-00000080c003', 50, 10) -> 'checkin' ->> 'visibility'), 'off', 'a new session takes the profile''s "show that I am checked in" default');

-- "I have left".
set local request.jwt.claims to '{"sub":"b8000000-0000-4000-8000-0000000000a1","role":"authenticated"}';
select is((public.end_checkin('00000000-0000-0000-0000-00000080c001') -> 'checkin' ->> 'end_reason'), 'left', '"I have left" ends the session');
select is((public.end_checkin('00000000-0000-0000-0000-00000080c001') ->> 'reason'), 'not_checked_in', 'and ending it twice says so');
select is((public.check_in('00000000-0000-0000-0000-00000080c001', 100, 20) -> 'checkin' ->> 'open')::boolean, true, 'checking in again reopens it');
select is((public.game_context('00000000-0000-0000-0000-00000080c001') -> 'checkin' ->> 'prompts_muted')::boolean, false, 'with prompts back on');

-- The two ends nobody presses.
reset role;
insert into public.attendances (user_id, game_id, source, status) values
  ('b8000000-0000-4000-8000-0000000000b1', '00000000-0000-0000-0000-00000080c002', 'checkin', 'attended'),
  ('b8000000-0000-4000-8000-0000000000b1', '00000000-0000-0000-0000-00000080c003', 'checkin', 'attended');
insert into public.checkins (user_id, game_id, started_at, distance_m, accuracy_m) values
  ('b8000000-0000-4000-8000-0000000000b1', '00000000-0000-0000-0000-00000080c002', now() - interval '3 hours', 10, 10),
  ('b8000000-0000-4000-8000-0000000000b1', '00000000-0000-0000-0000-00000080c003', now() - interval '5 hours', 10, 10);
select cmp_ok(public.close_stale_checkins(now()), '>=', 1, 'the final plus 30 closes a session (the local database may hold older open ones too)');
select is((select end_reason from public.checkins where user_id = 'b8000000-0000-4000-8000-0000000000b1' and game_id = '00000000-0000-0000-0000-00000080c002'), 'final', 'with reason final');
select is((select end_reason from public.checkins where user_id = 'b8000000-0000-4000-8000-0000000000b1' and game_id = '00000000-0000-0000-0000-00000080c003'), null, 'the game with no final is still open at five hours');
select cmp_ok(public.close_stale_checkins(now() + interval '61 minutes'), '>=', 1, 'six hours in, the timeout closes it');
select is((select end_reason from public.checkins where user_id = 'b8000000-0000-4000-8000-0000000000b1' and game_id = '00000000-0000-0000-0000-00000080c003'), 'timeout', 'with reason timeout');

select * from finish();
rollback;
