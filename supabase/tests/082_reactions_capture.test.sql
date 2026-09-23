-- The capture's server-side truths (migration 20260924020100, sections 4, 5 and 7): lateness
-- by the server clock, the delivery answered, the self-trigger cap, the crowd signal, the
-- photo bucket, and what game_reactions shows to whom.
begin;
create extension if not exists pgtap with schema extensions;
select plan(21);

insert into auth.users (id, email) values
  ('b8200000-0000-4000-8000-0000000000a1', 'rc-a@test'),
  ('b8200000-0000-4000-8000-0000000000b1', 'rc-b@test'),
  ('b8200000-0000-4000-8000-0000000000c1', 'rc-c@test'),
  ('b8200000-0000-4000-8000-0000000000d1', 'rc-d@test');
-- b follows a; d is a stranger.
insert into public.follows (follower_id, followee_id) values ('b8200000-0000-4000-8000-0000000000b1', 'b8200000-0000-4000-8000-0000000000a1');
insert into public.teams (id, sport_id, name, city, abbreviation, provider, provider_team_id, franchise_id) values
  ('00000000-0000-0000-0000-00000082a001', 'mls', 'Capture Home', 'Home', 'CHM', 'test', 'rc-t1', 'rc-f1'),
  ('00000000-0000-0000-0000-00000082a002', 'mls', 'Capture Away', 'Away', 'CAW', 'test', 'rc-t2', 'rc-f2');
insert into public.venues (id, key, name, city, lat, lng, geofence_m) values
  ('00000000-0000-0000-0000-00000082b001', 'rc-venue', 'Capture Park', 'Home', 40, -75, 400);
insert into public.games (id, sport_id, season, season_key, season_label, game_type, scheduled_start, venue_id, home_team_id, away_team_id, status, provider, provider_game_id) values
  ('00000000-0000-0000-0000-00000082c001', 'mls', 2026, '2026', '2026', 'regular', now() - interval '1 hour', '00000000-0000-0000-0000-00000082b001', '00000000-0000-0000-0000-00000082a001', '00000000-0000-0000-0000-00000082a002', 'live', 'test', 'rc-g1');
insert into public.game_win_prob (game_id, home_win_prob) values ('00000000-0000-0000-0000-00000082c001', 0.5);

set local role authenticated;
set local request.jwt.claims to '{"sub":"b8200000-0000-4000-8000-0000000000a1","role":"authenticated"}';
select is((public.check_in('00000000-0000-0000-0000-00000082c001', 10, 10) ->> 'ok')::boolean, true, 'a checks in');
set local request.jwt.claims to '{"sub":"b8200000-0000-4000-8000-0000000000b1","role":"authenticated"}';
select is((public.check_in('00000000-0000-0000-0000-00000082c001', 10, 10) ->> 'ok')::boolean, true, 'b checks in');
set local request.jwt.claims to '{"sub":"b8200000-0000-4000-8000-0000000000c1","role":"authenticated"}';
select is((public.check_in('00000000-0000-0000-0000-00000082c001', 10, 10) ->> 'ok')::boolean, true, 'c checks in');
set local request.jwt.claims to '{"sub":"b8200000-0000-4000-8000-0000000000d1","role":"authenticated"}';
select is((public.check_in('00000000-0000-0000-0000-00000082c001', 10, 10) ->> 'ok')::boolean, true, 'd checks in');
reset role;

-- A prompt fired four minutes ago.
select is((public.fire_reaction_prompt('00000000-0000-0000-0000-00000082c001', 'event', 'Goal, Capture Home', 'all', 30, 'mls:event:9', 120, 1, 0, '87''', 'live', 'late_goal', 'home', false, now() - interval '4 minutes') ->> 'delivered')::int, 4, 'everyone got the prompt');

set local role authenticated;
set local request.jwt.claims to '{"sub":"b8200000-0000-4000-8000-0000000000a1","role":"authenticated"}';
insert into public.reactions (id, user_id, game_id, prompt_id, attendance_id, back_path, front_path, late_seconds, visibility)
select 'b8200000-0000-4000-8000-0000000000f1', auth.uid(), '00000000-0000-0000-0000-00000082c001', p.id, a.id,
       'b8200000-0000-4000-8000-0000000000a1/g1/x-back.jpg', 'b8200000-0000-4000-8000-0000000000a1/g1/x-front.jpg', 5, 'followers'
from public.reaction_prompts p, public.attendances a
where p.game_id = '00000000-0000-0000-0000-00000082c001' and a.user_id = auth.uid() and a.game_id = '00000000-0000-0000-0000-00000082c001';
select cmp_ok((select late_seconds from public.reactions where id = 'b8200000-0000-4000-8000-0000000000f1'), '>=', 235, 'lateness is the server''s, not the client''s 5');
select is((select period_label from public.reactions where id = 'b8200000-0000-4000-8000-0000000000f1'), '87''', 'the reaction takes the prompt''s moment');
select is((select reacted_at is not null from public.reaction_prompt_deliveries where user_id = auth.uid() and game_id = '00000000-0000-0000-0000-00000082c001'), true, 'the delivery is answered');
select is((select self_triggered from public.reactions where id = 'b8200000-0000-4000-8000-0000000000f1'), false, 'a prompted reaction is not self-triggered');

-- Only me: a private reaction never enters anyone else's read.
set local request.jwt.claims to '{"sub":"b8200000-0000-4000-8000-0000000000b1","role":"authenticated"}';
select is((select count(*)::int from public.game_reactions('00000000-0000-0000-0000-00000082c001')), 0, 'a reaction with no post is its author''s alone, even to a follower');
set local request.jwt.claims to '{"sub":"b8200000-0000-4000-8000-0000000000a1","role":"authenticated"}';
select is((select count(*)::int from public.game_reactions('00000000-0000-0000-0000-00000082c001')), 1, 'the author sees it');
-- Posting it: followers see it, strangers do not.
insert into public.posts (id, author_id, kind, reaction_id, game_id, visibility)
values ('b8200000-0000-4000-8000-0000000000e1', auth.uid(), 'reaction', 'b8200000-0000-4000-8000-0000000000f1', '00000000-0000-0000-0000-00000082c001', 'followers');
update public.reactions set post_id = 'b8200000-0000-4000-8000-0000000000e1' where id = 'b8200000-0000-4000-8000-0000000000f1';
set local request.jwt.claims to '{"sub":"b8200000-0000-4000-8000-0000000000b1","role":"authenticated"}';
select is((select label || ' ' || (mine::text) from public.game_reactions('00000000-0000-0000-0000-00000082c001')), 'Goal, Capture Home false', 'posted, a follower sees it with the prompt''s label');
set local request.jwt.claims to '{"sub":"b8200000-0000-4000-8000-0000000000d1","role":"authenticated"}';
select is((select count(*)::int from public.game_reactions('00000000-0000-0000-0000-00000082c001')), 0, 'a stranger does not');

-- The photo objects follow the same rule.
reset role;
insert into storage.objects (bucket_id, name, owner) values ('reaction-photos', 'b8200000-0000-4000-8000-0000000000a1/g1/x-back.jpg', 'b8200000-0000-4000-8000-0000000000a1');
set local role authenticated;
set local request.jwt.claims to '{"sub":"b8200000-0000-4000-8000-0000000000b1","role":"authenticated"}';
select is((select count(*)::int from storage.objects where bucket_id = 'reaction-photos' and name = 'b8200000-0000-4000-8000-0000000000a1/g1/x-back.jpg'), 1, 'a follower can read the photo object');
set local request.jwt.claims to '{"sub":"b8200000-0000-4000-8000-0000000000d1","role":"authenticated"}';
select is((select count(*)::int from storage.objects where bucket_id = 'reaction-photos' and name = 'b8200000-0000-4000-8000-0000000000a1/g1/x-back.jpg'), 0, 'a stranger cannot');
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('reaction-photos', 'b8200000-0000-4000-8000-0000000000a1/g1/y.jpg')$$,
  '42501', null, 'nobody writes into another fan''s folder');

-- Pinning: once the line exists, a reaction sits on the last point at or before its capture.
reset role;
insert into public.game_wp_timeline (game_id, seq, period, half, home_wp, occurred_at) values
  ('00000000-0000-0000-0000-00000082c001', 1, 1, null, 0.5, now() - interval '50 minutes'),
  ('00000000-0000-0000-0000-00000082c001', 2, 2, null, 0.7, now() - interval '10 minutes'),
  ('00000000-0000-0000-0000-00000082c001', 3, 2, null, 0.9, now() + interval '10 minutes');
select is(public.pin_reactions('00000000-0000-0000-0000-00000082c001'), 1, 'pin_reactions pins the unpinned reaction');
select is((select wp_seq from public.reactions where id = 'b8200000-0000-4000-8000-0000000000f1'), 2, 'to the last point at or before the capture');
set local role authenticated;

-- Self-triggers: uncapped by the prompt rules, five at most, and three fans within 90 seconds is a crowd moment.
set local request.jwt.claims to '{"sub":"b8200000-0000-4000-8000-0000000000b1","role":"authenticated"}';
insert into public.reactions (user_id, game_id, attendance_id, back_path, front_path, period_label)
select auth.uid(), '00000000-0000-0000-0000-00000082c001', a.id, 'b/1b.jpg', 'b/1f.jpg', '88''' from public.attendances a where a.user_id = auth.uid() and a.game_id = '00000000-0000-0000-0000-00000082c001';
set local request.jwt.claims to '{"sub":"b8200000-0000-4000-8000-0000000000c1","role":"authenticated"}';
insert into public.reactions (user_id, game_id, attendance_id, back_path, front_path, period_label)
select auth.uid(), '00000000-0000-0000-0000-00000082c001', a.id, 'c/1b.jpg', 'c/1f.jpg', '88''' from public.attendances a where a.user_id = auth.uid() and a.game_id = '00000000-0000-0000-0000-00000082c001';
select is((select count(*)::int from public.reaction_prompts where game_id = '00000000-0000-0000-0000-00000082c001' and source = 'crowd'), 0, 'two fans self-triggering is not yet a crowd');
set local request.jwt.claims to '{"sub":"b8200000-0000-4000-8000-0000000000d1","role":"authenticated"}';
insert into public.reactions (user_id, game_id, attendance_id, back_path, front_path, period_label)
select auth.uid(), '00000000-0000-0000-0000-00000082c001', a.id, 'd/1b.jpg', 'd/1f.jpg', '88''' from public.attendances a where a.user_id = auth.uid() and a.game_id = '00000000-0000-0000-0000-00000082c001';
select is((select audience || ':' || source from public.reaction_prompts where game_id = '00000000-0000-0000-0000-00000082c001' and source = 'crowd'), 'all:crowd', 'the third fan makes it a crowd moment for everyone, once, on an event slot');
reset role;
-- Nobody had a prompt in the last twelve minutes except a (the earlier one was 4 minutes ago for everyone: too soon), so the crowd prompt reached nobody yet; that is the spacing rule, tested in 081.
set local role authenticated;
set local request.jwt.claims to '{"sub":"b8200000-0000-4000-8000-0000000000d1","role":"authenticated"}';
insert into public.reactions (user_id, game_id, attendance_id, back_path, front_path)
select auth.uid(), '00000000-0000-0000-0000-00000082c001', a.id, 'd/' || n || 'b.jpg', 'd/' || n || 'f.jpg' from public.attendances a, generate_series(2, 5) n where a.user_id = auth.uid() and a.game_id = '00000000-0000-0000-0000-00000082c001';
select throws_ok(
  $$insert into public.reactions (user_id, game_id, attendance_id, back_path, front_path) select auth.uid(), '00000000-0000-0000-0000-00000082c001', a.id, 'd/6b.jpg', 'd/6f.jpg' from public.attendances a where a.user_id = auth.uid() and a.game_id = '00000000-0000-0000-0000-00000082c001'$$,
  '23514', null, 'the sixth self-triggered reaction at a game is refused');
reset role;

select * from finish();
rollback;
