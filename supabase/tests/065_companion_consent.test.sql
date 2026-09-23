-- Companion tags are consent-based for real users only (migration 20260924000600,
-- 00_repo_reality.md R5). A placeholder ("Dad") is confirmed at once, as before; a linked user
-- starts pending, and only they answer.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email) values
  ('b6500000-0000-4000-8000-0000000000a1', 'cc-owner@test'),
  ('b6500000-0000-4000-8000-0000000000b1', 'cc-friend@test'),
  ('b6500000-0000-4000-8000-0000000000c1', 'cc-other@test');
insert into public.teams (id, sport_id, name, city, abbreviation, provider, provider_team_id, franchise_id) values
  ('00000000-0000-0000-0000-00000065a001', 'mlb', 'Tag Home', 'Home', 'THM', 'test', 'cc-t1', 'cc-f1'),
  ('00000000-0000-0000-0000-00000065a002', 'mlb', 'Tag Away', 'Away', 'TAW', 'test', 'cc-t2', 'cc-f2');
insert into public.games (id, sport_id, season, game_type, scheduled_start, home_team_id, away_team_id, status, provider, provider_game_id)
values ('00000000-0000-0000-0000-00000065c001', 'mlb', 2026, 'regular', '2026-08-01T23:00:00Z', '00000000-0000-0000-0000-00000065a001', '00000000-0000-0000-0000-00000065a002', 'final', 'test', 'cc-g1');
insert into public.attendances (id, user_id, game_id, source)
values ('b6500000-0000-4000-8000-0000000000d1', 'b6500000-0000-4000-8000-0000000000a1', '00000000-0000-0000-0000-00000065c001', 'manual');
-- Dad has no account; Friend is linked to one.
insert into public.people (id, owner_user_id, display_name, linked_user_id) values
  ('b6500000-0000-4000-8000-0000000000e1', 'b6500000-0000-4000-8000-0000000000a1', 'Dad', null),
  ('b6500000-0000-4000-8000-0000000000e2', 'b6500000-0000-4000-8000-0000000000a1', 'Friend', 'b6500000-0000-4000-8000-0000000000b1');

set local role authenticated;
set local request.jwt.claims to '{"sub":"b6500000-0000-4000-8000-0000000000a1","role":"authenticated"}';
insert into public.attendance_companions (attendance_id, person_id, status) values
  ('b6500000-0000-4000-8000-0000000000d1', 'b6500000-0000-4000-8000-0000000000e1', 'pending'),
  ('b6500000-0000-4000-8000-0000000000d1', 'b6500000-0000-4000-8000-0000000000e2', 'confirmed');
reset role;

select is((select status from public.attendance_companions where person_id = 'b6500000-0000-4000-8000-0000000000e1'), 'confirmed',
  'a placeholder tag is confirmed at once, whatever the client sends');
select results_eq(
  $$select user_id from public.notifications where kind = 'tagged' and data ->> 'user_id' = 'b6500000-0000-4000-8000-0000000000a1'$$,
  $$values ('b6500000-0000-4000-8000-0000000000b1'::uuid)$$,
  'the placeholder tag notifies nobody; only the real user hears about theirs');
select is((select status from public.attendance_companions where person_id = 'b6500000-0000-4000-8000-0000000000e2'), 'pending',
  'a tag of a real user starts pending, whatever the client sends');
select is((select invited_by from public.attendance_companions where person_id = 'b6500000-0000-4000-8000-0000000000e2'), 'b6500000-0000-4000-8000-0000000000a1'::uuid,
  'and records who tagged them');

-- The tagger cannot answer for them, nor can anyone else.
set local role authenticated;
set local request.jwt.claims to '{"sub":"b6500000-0000-4000-8000-0000000000a1","role":"authenticated"}';
update public.attendance_companions set status = 'confirmed' where person_id = 'b6500000-0000-4000-8000-0000000000e2';
set local request.jwt.claims to '{"sub":"b6500000-0000-4000-8000-0000000000c1","role":"authenticated"}';
update public.attendance_companions set status = 'confirmed' where person_id = 'b6500000-0000-4000-8000-0000000000e2';
reset role;
select is((select status from public.attendance_companions where person_id = 'b6500000-0000-4000-8000-0000000000e2'), 'pending', 'only the tagged user answers');

set local role authenticated;
set local request.jwt.claims to '{"sub":"b6500000-0000-4000-8000-0000000000b1","role":"authenticated"}';
update public.attendance_companions set status = 'confirmed' where person_id = 'b6500000-0000-4000-8000-0000000000e2';
select isnt((select confirmed_at from public.attendance_companions where person_id = 'b6500000-0000-4000-8000-0000000000e2'), null, 'confirming stamps the time');
update public.attendance_companions set status = 'declined' where person_id = 'b6500000-0000-4000-8000-0000000000e2';
select is((select status || '/' || coalesce(confirmed_at::text, 'none') from public.attendance_companions where person_id = 'b6500000-0000-4000-8000-0000000000e2'), 'declined/none', 'declining clears it');
select throws_ok(
  $$update public.attendance_companions set status = 'pending' where person_id = 'b6500000-0000-4000-8000-0000000000e2'$$,
  '23514', null, 'an answered tag cannot go back to pending');
-- The tagged user can still remove the tag of themselves, as before (SPEC 6.10).
delete from public.attendance_companions where person_id = 'b6500000-0000-4000-8000-0000000000e2';
reset role;
select is((select count(*)::int from public.attendance_companions where attendance_id = 'b6500000-0000-4000-8000-0000000000d1'), 1, 'and can remove it altogether');

select * from finish();
rollback;
