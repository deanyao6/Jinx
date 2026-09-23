-- How posts come to exist (migration 20260924010000; social brief 02, sections 1 and 9):
-- auto-post fires once per attendance and respects the edit window, turning it off mid-window
-- cancels the draft, drafts are the author's alone, system posts come from feed events, and
-- attaching a reaction to a game post makes no second feed entry.
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

insert into auth.users (id, email) values
  ('b7000000-0000-4000-8000-0000000000a1', 'pp-author@test'),
  ('b7000000-0000-4000-8000-0000000000b1', 'pp-follower@test');
insert into public.teams (id, sport_id, name, city, abbreviation, provider, provider_team_id, franchise_id, nickname) values
  ('00000000-0000-0000-0000-00000070a001', 'mlb', 'Post Home', 'Home', 'PHM', 'test', 'pp-t1', 'pp-f1', 'Homers'),
  ('00000000-0000-0000-0000-00000070a002', 'mlb', 'Post Away', 'Away', 'PAW', 'test', 'pp-t2', 'pp-f2', 'Awayers');
-- g1 ends now; g2 ended last year; g3 is tomorrow.
insert into public.games (id, sport_id, season, game_type, scheduled_start, final_at, home_team_id, away_team_id, status, home_score, away_score, winner_team_id, provider, provider_game_id) values
  ('00000000-0000-0000-0000-00000070c001', 'mlb', 2026, 'regular', now() - interval '3 hours', now(), '00000000-0000-0000-0000-00000070a001', '00000000-0000-0000-0000-00000070a002', 'final', 5, 2, '00000000-0000-0000-0000-00000070a001', 'test', 'pp-g1'),
  ('00000000-0000-0000-0000-00000070c002', 'mlb', 2025, 'regular', now() - interval '1 year', now() - interval '1 year', '00000000-0000-0000-0000-00000070a001', '00000000-0000-0000-0000-00000070a002', 'final', 1, 2, '00000000-0000-0000-0000-00000070a002', 'test', 'pp-g2'),
  ('00000000-0000-0000-0000-00000070c003', 'mlb', 2026, 'regular', now() + interval '1 day', null, '00000000-0000-0000-0000-00000070a001', '00000000-0000-0000-0000-00000070a002', 'scheduled', null, null, null, 'test', 'pp-g3');
insert into public.follows (follower_id, followee_id) values ('b7000000-0000-4000-8000-0000000000b1', 'b7000000-0000-4000-8000-0000000000a1');
insert into public.attendances (id, user_id, game_id, source) values
  ('b7000000-0000-4000-8000-0000000000d1', 'b7000000-0000-4000-8000-0000000000a1', '00000000-0000-0000-0000-00000070c001', 'manual'),
  ('b7000000-0000-4000-8000-0000000000d2', 'b7000000-0000-4000-8000-0000000000a1', '00000000-0000-0000-0000-00000070c002', 'manual');

-- ---- The window ----
select is((public.auto_post_tick(now() + interval '10 minutes')) ->> 'drafted', '0',
  'nothing is drafted in the first 15 minutes after the final');
select is((public.auto_post_tick(now() + interval '16 minutes')) ->> 'drafted', '1',
  'the draft appears 15 minutes after the final, for the recent game only');
select is((select count(*)::integer from public.posts where attendance_id = 'b7000000-0000-4000-8000-0000000000d2'), 0,
  'a game logged a year after it ended never auto-posts: it waits for "Post this"');
select ok((select published_at is null and auto_posted and publish_at = now() + interval '30 minutes'
           from public.posts where attendance_id = 'b7000000-0000-4000-8000-0000000000d1'),
  'the draft is unpublished and due 30 minutes after the final');

set local role authenticated;
set local request.jwt.claims to '{"sub":"b7000000-0000-4000-8000-0000000000b1","role":"authenticated"}';
select is((select count(*)::integer from public.posts where author_id = 'b7000000-0000-4000-8000-0000000000a1'), 0,
  'a follower cannot see a draft');
set local request.jwt.claims to '{"sub":"b7000000-0000-4000-8000-0000000000a1","role":"authenticated"}';
select is((select count(*)::integer from public.posts where author_id = 'b7000000-0000-4000-8000-0000000000a1'), 1,
  'its author can, to edit it');
update public.posts set caption = 'Great night', published_at = now() - interval '1 day', auto_posted = false
  where attendance_id = 'b7000000-0000-4000-8000-0000000000d1';
select ok((select caption = 'Great night' and published_at is null and auto_posted from public.posts
           where attendance_id = 'b7000000-0000-4000-8000-0000000000d1'),
  'the author edits the caption inside the window, and cannot publish or unflag it by hand');
reset role;

select is((public.auto_post_tick(now() + interval '31 minutes')) ->> 'published', '1', 'it publishes at 30 minutes');
set local role authenticated;
set local request.jwt.claims to '{"sub":"b7000000-0000-4000-8000-0000000000b1","role":"authenticated"}';
select is((select caption from public.posts where attendance_id = 'b7000000-0000-4000-8000-0000000000d1'), 'Great night',
  'the follower now sees it, with the edit');
reset role;

-- ---- Once, never twice ----
delete from public.posts where attendance_id = 'b7000000-0000-4000-8000-0000000000d1';
select is((public.auto_post_tick(now() + interval '2 hours')) ->> 'drafted', '0',
  'deleting the post does not make the tick post it again');
delete from public.attendances where id = 'b7000000-0000-4000-8000-0000000000d1';
insert into public.attendances (id, user_id, game_id, source) values
  ('b7000000-0000-4000-8000-0000000000d3', 'b7000000-0000-4000-8000-0000000000a1', '00000000-0000-0000-0000-00000070c001', 'manual');
select is((public.auto_post_tick(now() + interval '3 hours')) ->> 'drafted', '0',
  'nor does unlogging and relogging the same game');

-- ---- Turning auto-post off inside the window cancels ----
insert into auth.users (id, email) values ('b7000000-0000-4000-8000-0000000000a2', 'pp-second@test');
insert into public.attendances (id, user_id, game_id, source) values
  ('b7000000-0000-4000-8000-0000000000d4', 'b7000000-0000-4000-8000-0000000000a2', '00000000-0000-0000-0000-00000070c001', 'manual');
select public.auto_post_tick(now() + interval '20 minutes');
select is((select count(*)::integer from public.posts where author_id = 'b7000000-0000-4000-8000-0000000000a2'), 1, 'a second fan has a draft');
set local role authenticated;
set local request.jwt.claims to '{"sub":"b7000000-0000-4000-8000-0000000000a2","role":"authenticated"}';
update public.profiles set auto_post = false where id = 'b7000000-0000-4000-8000-0000000000a2';
reset role;
select is((select count(*)::integer from public.posts where author_id = 'b7000000-0000-4000-8000-0000000000a2'), 0,
  'turning auto-post off mid-window removes the draft');
select is((select outcome from public.auto_post_runs where user_id = 'b7000000-0000-4000-8000-0000000000a2'), 'cancelled', 'and records why');
select is((public.auto_post_tick(now() + interval '40 minutes')) ->> 'published', '0', 'nothing publishes afterwards');

-- ---- "Post this" publishes at once; a client makes only game and reaction posts ----
set local role authenticated;
set local request.jwt.claims to '{"sub":"b7000000-0000-4000-8000-0000000000a2","role":"authenticated"}';
-- The trap the app avoids: `insert ... returning` re-checks the new row against the SELECT
-- policy, and can_view_post() cannot see a row its own statement is inserting.
select throws_ok(
  $$insert into public.posts (author_id, kind, attendance_id) values ('b7000000-0000-4000-8000-0000000000a2', 'game', 'b7000000-0000-4000-8000-0000000000d4') returning id$$,
  '42501', null, 'insert ... returning is refused, which is why the app makes the id itself and does not read the row back');
-- The app's own shape (features/feed/queries.ts useSaveGamePost): an id made on the phone, no RETURNING.
insert into public.posts (id, author_id, kind, attendance_id, caption) values
  ('b7000000-0000-4000-8000-0000000000f1', 'b7000000-0000-4000-8000-0000000000a2', 'game', 'b7000000-0000-4000-8000-0000000000d4', 'Posted by hand');
select ok((select published_at is not null and not auto_posted and game_id = '00000000-0000-0000-0000-00000070c001'
           from public.posts where id = 'b7000000-0000-4000-8000-0000000000f1'),
  '"Post this" publishes at once under the id the app made, and takes its game from the attendance');
select throws_ok(
  $$insert into public.posts (author_id, kind, game_id) values ('b7000000-0000-4000-8000-0000000000a2', 'milestone', '00000000-0000-0000-0000-00000070c001')$$,
  '42501', null, 'a client cannot make a system post');
reset role;

-- ---- System posts from feed events ----
insert into public.attendances (id, user_id, game_id, source) values
  ('b7000000-0000-4000-8000-0000000000d5', 'b7000000-0000-4000-8000-0000000000b1', '00000000-0000-0000-0000-00000070c001', 'manual');
insert into public.feed_events (actor_user_id, type, game_id, payload) values
  ('b7000000-0000-4000-8000-0000000000b1', 'new_stamp', '00000000-0000-0000-0000-00000070c001', '{"venue_name":"Test Park"}');
select is((select payload ->> 'venue_name' from public.posts where author_id = 'b7000000-0000-4000-8000-0000000000b1' and kind = 'stamp'), 'Test Park',
  'a new stamp makes a stamp post carrying the venue');
insert into public.feed_events (actor_user_id, type, game_id, payload) values
  ('b7000000-0000-4000-8000-0000000000b1', 'milestone', '00000000-0000-0000-0000-00000070c002', '{"games":10}');
select is((select count(*)::integer from public.posts where author_id = 'b7000000-0000-4000-8000-0000000000b1' and kind = 'milestone'), 0,
  'a milestone reached by logging a year-old game is backfill and makes no post');
update public.profiles set muted_post_kinds = array['goal'] where id = 'b7000000-0000-4000-8000-0000000000b1';
insert into public.feed_events (actor_user_id, type, payload) values
  ('b7000000-0000-4000-8000-0000000000b1', 'goal_completed', '{"title":"Ten parks"}'),
  ('b7000000-0000-4000-8000-0000000000b1', 'pledge_won', '{}');
select is((select count(*)::integer from public.posts where author_id = 'b7000000-0000-4000-8000-0000000000b1' and kind in ('goal')), 0,
  'a muted system post kind is not made');
select is((select count(*)::integer from public.posts where author_id = 'b7000000-0000-4000-8000-0000000000b1'), 1,
  'and a pledge event has no post kind at all');

-- ---- Attaching a reaction to a game post makes no second feed entry ----
insert into public.reactions (id, user_id, game_id, attendance_id, back_path, front_path) values
  ('b7000000-0000-4000-8000-0000000000e1', 'b7000000-0000-4000-8000-0000000000a2', '00000000-0000-0000-0000-00000070c001',
   'b7000000-0000-4000-8000-0000000000d4', 'b/back.jpg', 'b/front.jpg');
insert into public.posts (author_id, kind, reaction_id, published_at) values
  ('b7000000-0000-4000-8000-0000000000a2', 'reaction', 'b7000000-0000-4000-8000-0000000000e1', now());
set local role authenticated;
set local request.jwt.claims to '{"sub":"b7000000-0000-4000-8000-0000000000a2","role":"authenticated"}';
update public.reactions set post_id = (select id from public.posts where attendance_id = 'b7000000-0000-4000-8000-0000000000d4')
  where id = 'b7000000-0000-4000-8000-0000000000e1';
select is((select count(*)::integer from public.posts where author_id = 'b7000000-0000-4000-8000-0000000000a2'), 2,
  'attaching the reaction adds no post: the game post and the reaction post, as before');
select is((select jsonb_array_length(reactions) from public.post_card((select id from public.posts where attendance_id = 'b7000000-0000-4000-8000-0000000000d4'))), 1,
  'and the game post card carries the attached reaction');
reset role;

select * from finish();
rollback;
