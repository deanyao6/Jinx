begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

-- Users: alice (public), bob (private), carol (blocked by alice), dave (follows bob, accepted)
insert into auth.users (id, email, raw_user_meta_data) values
  ('a1000000-0000-4000-8000-0000000000a1', 'alice@example.com', '{"full_name":"Alice"}'),
  ('b2000000-0000-4000-8000-0000000000b2', 'bob@example.com', '{}'),
  ('c3000000-0000-4000-8000-0000000000c3', 'carol@example.com', '{}'),
  ('d4000000-0000-4000-8000-0000000000d4', 'dave@example.com', '{}');

select is((select count(*) from public.profiles where id in ('a1000000-0000-4000-8000-0000000000a1','b2000000-0000-4000-8000-0000000000b2','c3000000-0000-4000-8000-0000000000c3','d4000000-0000-4000-8000-0000000000d4')), 4::bigint, 'auth trigger creates profiles');
select is((select count(*) from public.inbound_addresses where user_id in ('a1000000-0000-4000-8000-0000000000a1','b2000000-0000-4000-8000-0000000000b2','c3000000-0000-4000-8000-0000000000c3','d4000000-0000-4000-8000-0000000000d4')), 4::bigint, 'auth trigger creates inbound addresses');
select ok((select length(token) >= 10 from public.inbound_addresses where user_id = 'a1000000-0000-4000-8000-0000000000a1'), 'inbound token is at least 10 chars');

update public.profiles set is_private = true where id = 'b2000000-0000-4000-8000-0000000000b2';
insert into public.blocks (blocker_id, blocked_id) values ('a1000000-0000-4000-8000-0000000000a1', 'c3000000-0000-4000-8000-0000000000c3');

insert into public.teams (id, sport_id, name, city, abbreviation, provider, provider_team_id, franchise_id)
values ('00000000-0000-0000-0000-00000000a001', 'mlb', 'Philadelphia Phillies', 'Philadelphia', 'PHI', 'test', 'phi', 'mlb-143'),
       ('00000000-0000-0000-0000-00000000a002', 'mlb', 'New York Mets', 'New York', 'NYM', 'test', 'nym', 'mlb-121');
insert into public.games (id, sport_id, season, game_type, scheduled_start, home_team_id, away_team_id, status, home_score, away_score, provider, provider_game_id)
values ('00000000-0000-0000-0000-00000000c001', 'mlb', 2024, 'regular', '2024-09-15T17:35:00Z', '00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-00000000a002', 'final', 5, 2, 'test', 'g1');

insert into public.attendances (id, user_id, game_id, source) values
  ('00000000-0000-0000-0000-00000000d001', 'a1000000-0000-4000-8000-0000000000a1', '00000000-0000-0000-0000-00000000c001', 'manual'),
  ('00000000-0000-0000-0000-00000000d002', 'b2000000-0000-4000-8000-0000000000b2', '00000000-0000-0000-0000-00000000c001', 'manual');
insert into public.attendance_seats (attendance_id, section, row, seat) values ('00000000-0000-0000-0000-00000000d001', '121', '14', '7');
insert into public.people (id, owner_user_id, display_name) values ('00000000-0000-0000-0000-00000000e001', 'a1000000-0000-4000-8000-0000000000a1', 'Dad');
insert into public.ticket_imports (user_id, source, status) values ('a1000000-0000-4000-8000-0000000000a1', 'screenshot', 'pending');

-- dave follows bob: private target, so the row starts as requested
set local role authenticated;
set local request.jwt.claims to '{"sub":"d4000000-0000-4000-8000-0000000000d4","role":"authenticated"}';
insert into public.follows (follower_id, followee_id) values ('d4000000-0000-4000-8000-0000000000d4', 'b2000000-0000-4000-8000-0000000000b2');
select is((select status from public.follows where follower_id = 'd4000000-0000-4000-8000-0000000000d4'), 'requested', 'follow of a private user is a request');
select is((select count(*) from public.attendances where user_id = 'b2000000-0000-4000-8000-0000000000b2'), 0::bigint, 'requester cannot see private attendances');
select is((select count(*) from public.attendances where user_id = 'a1000000-0000-4000-8000-0000000000a1'), 1::bigint, 'anyone can see public attendances');
select is((select count(*) from public.attendance_seats), 0::bigint, 'seats hidden from non-mutuals');
select is((select count(*) from public.people), 0::bigint, 'placeholder people are owner-only');
select is((select count(*) from public.ticket_imports), 0::bigint, 'ticket imports are owner-only');
select throws_ok($$insert into public.follows (follower_id, followee_id) values ('a1000000-0000-4000-8000-0000000000a1', 'd4000000-0000-4000-8000-0000000000d4')$$,
  '42501', null, 'cannot insert a follow on behalf of someone else');
reset role;

-- bob accepts dave
set local role authenticated;
set local request.jwt.claims to '{"sub":"b2000000-0000-4000-8000-0000000000b2","role":"authenticated"}';
update public.follows set status = 'active', accepted_at = now() where follower_id = 'd4000000-0000-4000-8000-0000000000d4' and followee_id = 'b2000000-0000-4000-8000-0000000000b2';
select is((select status from public.follows where follower_id = 'd4000000-0000-4000-8000-0000000000d4'), 'active', 'followee can accept a request');
reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub":"d4000000-0000-4000-8000-0000000000d4","role":"authenticated"}';
select is((select count(*) from public.attendances where user_id = 'b2000000-0000-4000-8000-0000000000b2'), 1::bigint, 'accepted follower sees private attendances');
reset role;

-- carol is blocked by alice: sees nothing of alice, cannot follow her
set local role authenticated;
set local request.jwt.claims to '{"sub":"c3000000-0000-4000-8000-0000000000c3","role":"authenticated"}';
select is((select count(*) from public.profiles where id = 'a1000000-0000-4000-8000-0000000000a1'), 0::bigint, 'blocked user cannot see the blocker profile');
select is((select count(*) from public.attendances where user_id = 'a1000000-0000-4000-8000-0000000000a1'), 0::bigint, 'blocked user cannot see the blocker attendances');
select throws_ok($$insert into public.follows (follower_id, followee_id) values ('c3000000-0000-4000-8000-0000000000c3', 'a1000000-0000-4000-8000-0000000000a1')$$,
  '42501', null, 'blocked user cannot follow');
select is((select count(*) from public.blocks), 0::bigint, 'blocked user cannot see the block row');
reset role;

-- alice: owner sees own private data, cannot see bob's private data
set local role authenticated;
set local request.jwt.claims to '{"sub":"a1000000-0000-4000-8000-0000000000a1","role":"authenticated"}';
select is((select count(*) from public.people), 1::bigint, 'owner sees own people');
select is((select count(*) from public.ticket_imports), 1::bigint, 'owner sees own imports');
select is((select section from public.attendance_seats where attendance_id = '00000000-0000-0000-0000-00000000d001'), '121', 'owner sees own seats');
select is((select count(*) from public.attendances where user_id = 'b2000000-0000-4000-8000-0000000000b2'), 0::bigint, 'non-follower cannot see private attendances');
select is((select count(*) from public.profiles where id = 'c3000000-0000-4000-8000-0000000000c3'), 0::bigint, 'blocker cannot see blocked profile either');
select throws_ok($$update public.profiles set birth_date = current_date - interval '10 years' where id = 'a1000000-0000-4000-8000-0000000000a1'$$,
  '23514', null, 'under-13 birth date is rejected');
select lives_ok($$update public.profiles set handle = 'deanyao', display_name = 'Dean' where id = 'a1000000-0000-4000-8000-0000000000a1'$$, 'owner can edit profile');
reset role;

-- Account deletion cascades cleanly even with attendances and favorites.
insert into public.user_teams (user_id, team_id) values ('a1000000-0000-4000-8000-0000000000a1', '00000000-0000-0000-0000-00000000a001');
select lives_ok($$delete from auth.users where id = 'a1000000-0000-4000-8000-0000000000a1'$$, 'deleting a user with attendances and favorites cascades');

select * from finish();
rollback;
