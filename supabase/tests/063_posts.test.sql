-- Posts, kudos and comments (migration 20260924000400; docs/prompts/social/01, section 4):
-- who sees a post, blocks in both directions, visibility inherited by kudos and comments, who
-- may delete a comment, and the counters, which only triggers move.
begin;
create extension if not exists pgtap with schema extensions;
select plan(31);

-- a: the author (public profile). f: follows a. s: a stranger. x: a blocked x. y: y blocked a.
-- p: a private author, followed by pf.
insert into auth.users (id, email) values
  ('b6300000-0000-4000-8000-0000000000a1', 'post-a@test'),
  ('b6300000-0000-4000-8000-0000000000f1', 'post-f@test'),
  ('b6300000-0000-4000-8000-000000000051', 'post-s@test'),
  ('b6300000-0000-4000-8000-0000000000e1', 'post-x@test'),
  ('b6300000-0000-4000-8000-0000000000e2', 'post-y@test'),
  ('b6300000-0000-4000-8000-0000000000b1', 'post-p@test'),
  ('b6300000-0000-4000-8000-0000000000b2', 'post-pf@test');
update public.profiles set is_private = true where id = 'b6300000-0000-4000-8000-0000000000b1';
insert into public.follows (follower_id, followee_id) values
  ('b6300000-0000-4000-8000-0000000000f1', 'b6300000-0000-4000-8000-0000000000a1'),
  ('b6300000-0000-4000-8000-0000000000e1', 'b6300000-0000-4000-8000-0000000000a1'),
  ('b6300000-0000-4000-8000-0000000000e2', 'b6300000-0000-4000-8000-0000000000a1'),
  ('b6300000-0000-4000-8000-0000000000b2', 'b6300000-0000-4000-8000-0000000000b1');
update public.follows set status = 'active' where followee_id = 'b6300000-0000-4000-8000-0000000000b1';
-- The blocks come after the follows: a block has to win over a follow, and removes it.
insert into public.blocks (blocker_id, blocked_id) values
  ('b6300000-0000-4000-8000-0000000000a1', 'b6300000-0000-4000-8000-0000000000e1'),
  ('b6300000-0000-4000-8000-0000000000e2', 'b6300000-0000-4000-8000-0000000000a1');

insert into public.teams (id, sport_id, name, city, abbreviation, provider, provider_team_id, franchise_id) values
  ('00000000-0000-0000-0000-00000063a001', 'mlb', 'Post Home', 'Home', 'PHM', 'test', 'post-t1', 'post-f1'),
  ('00000000-0000-0000-0000-00000063a002', 'mlb', 'Post Away', 'Away', 'PAW', 'test', 'post-t2', 'post-f2');
insert into public.games (id, sport_id, season, game_type, scheduled_start, home_team_id, away_team_id, status, provider, provider_game_id)
values ('00000000-0000-0000-0000-00000063c001', 'mlb', 2026, 'regular', '2026-09-01T23:00:00Z',
        '00000000-0000-0000-0000-00000063a001', '00000000-0000-0000-0000-00000063a002', 'final', 'test', 'post-g1');
insert into public.attendances (id, user_id, game_id, source) values
  ('b6300000-0000-4000-8000-0000000000c1', 'b6300000-0000-4000-8000-0000000000a1', '00000000-0000-0000-0000-00000063c001', 'manual'),
  ('b6300000-0000-4000-8000-0000000000c2', 'b6300000-0000-4000-8000-0000000000f1', '00000000-0000-0000-0000-00000063c001', 'manual');

insert into public.posts (id, author_id, kind, attendance_id, game_id, visibility, deleted_at) values
  ('b6300000-0000-4000-8000-0000000000d1', 'b6300000-0000-4000-8000-0000000000a1', 'game', 'b6300000-0000-4000-8000-0000000000c1', '00000000-0000-0000-0000-00000063c001', 'public', null),
  ('b6300000-0000-4000-8000-0000000000d2', 'b6300000-0000-4000-8000-0000000000a1', 'milestone', null, null, 'followers', null),
  ('b6300000-0000-4000-8000-0000000000d3', 'b6300000-0000-4000-8000-0000000000a1', 'stamp', null, null, 'private', null),
  ('b6300000-0000-4000-8000-0000000000d4', 'b6300000-0000-4000-8000-0000000000a1', 'goal', null, null, 'public', now()),
  ('b6300000-0000-4000-8000-0000000000d5', 'b6300000-0000-4000-8000-0000000000b1', 'milestone', null, null, 'public', null);

-- A post has exactly one subject.
select throws_ok(
  $$insert into public.posts (author_id, kind) values ('b6300000-0000-4000-8000-0000000000a1', 'game')$$,
  '23514', null, 'a game post needs an attendance');

-- ---------------------------------------------------------------------------
-- Who sees a's posts
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"b6300000-0000-4000-8000-0000000000a1","role":"authenticated"}';
select is((select count(*)::int from public.posts where author_id = auth.uid()), 4, 'the author sees every own post, the deleted one included');

set local request.jwt.claims to '{"sub":"b6300000-0000-4000-8000-000000000051","role":"authenticated"}';
select results_eq($$select id from public.posts where author_id = 'b6300000-0000-4000-8000-0000000000a1'$$,
  $$values ('b6300000-0000-4000-8000-0000000000d1'::uuid)$$, 'a stranger sees the public post of a public profile, nothing else');
select is((select count(*)::int from public.posts where author_id = 'b6300000-0000-4000-8000-0000000000b1'), 0, 'a stranger does not see a public post on a private profile');

set local request.jwt.claims to '{"sub":"b6300000-0000-4000-8000-0000000000f1","role":"authenticated"}';
select results_eq($$select id from public.posts where author_id = 'b6300000-0000-4000-8000-0000000000a1' order by id$$,
  $$values ('b6300000-0000-4000-8000-0000000000d1'::uuid), ('b6300000-0000-4000-8000-0000000000d2'::uuid)$$,
  'a follower sees public and followers posts, not private or deleted ones');

set local request.jwt.claims to '{"sub":"b6300000-0000-4000-8000-0000000000b2","role":"authenticated"}';
select is((select count(*)::int from public.posts where author_id = 'b6300000-0000-4000-8000-0000000000b1'), 1, 'a follower of a private profile sees its public post');

set local request.jwt.claims to '{"sub":"b6300000-0000-4000-8000-0000000000e1","role":"authenticated"}';
select is((select count(*)::int from public.posts where author_id = 'b6300000-0000-4000-8000-0000000000a1'), 0, 'blocked by the author: sees none of their posts, public ones included');
select throws_ok(
  $$insert into public.kudos (post_id, user_id) values ('b6300000-0000-4000-8000-0000000000d1', 'b6300000-0000-4000-8000-0000000000e1')$$,
  '42501', null, 'blocked by the author: cannot give kudos');
select throws_ok(
  $$insert into public.comments (post_id, author_id, body) values ('b6300000-0000-4000-8000-0000000000d1', 'b6300000-0000-4000-8000-0000000000e1', 'hi')$$,
  '42501', null, 'blocked by the author: cannot comment');

set local request.jwt.claims to '{"sub":"b6300000-0000-4000-8000-0000000000e2","role":"authenticated"}';
select is((select count(*)::int from public.posts where author_id = 'b6300000-0000-4000-8000-0000000000a1'), 0, 'having blocked the author: sees none of their posts either');
reset role;

-- The author does not see the posts of someone who blocked them, or whom they blocked.
insert into public.posts (id, author_id, kind, visibility) values
  ('b6300000-0000-4000-8000-0000000000d6', 'b6300000-0000-4000-8000-0000000000e2', 'milestone', 'public'),
  ('b6300000-0000-4000-8000-0000000000d7', 'b6300000-0000-4000-8000-0000000000e1', 'milestone', 'public');
set local role authenticated;
set local request.jwt.claims to '{"sub":"b6300000-0000-4000-8000-0000000000a1","role":"authenticated"}';
select is((select count(*)::int from public.posts where id in ('b6300000-0000-4000-8000-0000000000d6', 'b6300000-0000-4000-8000-0000000000d7')), 0,
  'blocks hide posts in both directions from the author''s side too');

-- ---------------------------------------------------------------------------
-- Writing posts: the server's columns stay the server's
-- ---------------------------------------------------------------------------
insert into public.posts (id, author_id, kind, visibility, kudos_count, comment_count, auto_posted)
values ('b6300000-0000-4000-8000-0000000000d8', 'b6300000-0000-4000-8000-0000000000a1', 'milestone', 'public', 50, 7, true);
select is((select kudos_count + comment_count from public.posts where id = 'b6300000-0000-4000-8000-0000000000d8'), 0, 'a new post starts with zero counters whatever the client sends');
select is((select auto_posted from public.posts where id = 'b6300000-0000-4000-8000-0000000000d8'), false, 'a client cannot mark a post auto-posted');
update public.posts set kudos_count = 99, caption = 'Great night' where id = 'b6300000-0000-4000-8000-0000000000d1';
select is((select kudos_count || '/' || caption from public.posts where id = 'b6300000-0000-4000-8000-0000000000d1'), '0/Great night', 'the author edits the caption, not the counters');
select throws_ok(
  $$insert into public.posts (author_id, kind, attendance_id, visibility) values ('b6300000-0000-4000-8000-0000000000a1', 'game', 'b6300000-0000-4000-8000-0000000000c2', 'public')$$,
  '42501', null, 'a game post cannot be about someone else''s attendance');
select throws_ok(
  $$insert into public.posts (author_id, kind, visibility) values ('b6300000-0000-4000-8000-0000000000f1', 'milestone', 'public')$$,
  '42501', null, 'nobody posts as someone else');

-- ---------------------------------------------------------------------------
-- Kudos: inherit the post's visibility; counted by trigger
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"b6300000-0000-4000-8000-0000000000f1","role":"authenticated"}';
insert into public.kudos (post_id, user_id) values ('b6300000-0000-4000-8000-0000000000d2', 'b6300000-0000-4000-8000-0000000000f1');
select is((select kudos_count from public.posts where id = 'b6300000-0000-4000-8000-0000000000d2'), 1, 'kudos: the count goes up');
set local request.jwt.claims to '{"sub":"b6300000-0000-4000-8000-000000000051","role":"authenticated"}';
select throws_ok(
  $$insert into public.kudos (post_id, user_id) values ('b6300000-0000-4000-8000-0000000000d2', 'b6300000-0000-4000-8000-000000000051')$$,
  '42501', null, 'no kudos on a post you cannot see');
select is((select count(*)::int from public.kudos where post_id = 'b6300000-0000-4000-8000-0000000000d2'), 0, 'kudos on a post you cannot see are invisible to you');
set local request.jwt.claims to '{"sub":"b6300000-0000-4000-8000-0000000000f1","role":"authenticated"}';
delete from public.kudos where post_id = 'b6300000-0000-4000-8000-0000000000d2';
select is((select kudos_count from public.posts where id = 'b6300000-0000-4000-8000-0000000000d2'), 0, 'unkudos: the count goes back down');

-- ---------------------------------------------------------------------------
-- Comments: inherit visibility; own delete; the post's author deletes any on their post
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"b6300000-0000-4000-8000-000000000051","role":"authenticated"}';
insert into public.comments (id, post_id, author_id, body) values
  ('b6300000-0000-4000-8000-0000000000a5', 'b6300000-0000-4000-8000-0000000000d1', 'b6300000-0000-4000-8000-000000000051', 'What a game');
select is((select comment_count from public.posts where id = 'b6300000-0000-4000-8000-0000000000d1'), 1, 'comment: the count goes up');
select throws_ok(
  $$insert into public.comments (post_id, author_id, body) values ('b6300000-0000-4000-8000-0000000000d2', 'b6300000-0000-4000-8000-000000000051', 'hi')$$,
  '42501', null, 'no comments on a post you cannot see');
update public.comments set deleted_at = now() where id = 'b6300000-0000-4000-8000-0000000000a5';
select is((select comment_count from public.posts where id = 'b6300000-0000-4000-8000-0000000000d1'), 0, 'deleting your own comment takes it out of the count');

set local request.jwt.claims to '{"sub":"b6300000-0000-4000-8000-0000000000f1","role":"authenticated"}';
select is((select count(*)::int from public.comments where id = 'b6300000-0000-4000-8000-0000000000a5'), 0, 'a deleted comment is gone for everyone else');
insert into public.comments (id, post_id, author_id, body) values
  ('b6300000-0000-4000-8000-0000000000a6', 'b6300000-0000-4000-8000-0000000000d1', 'b6300000-0000-4000-8000-0000000000f1', 'I was there');
set local request.jwt.claims to '{"sub":"b6300000-0000-4000-8000-000000000051","role":"authenticated"}';
delete from public.comments where id = 'b6300000-0000-4000-8000-0000000000a6';
update public.comments set deleted_at = now() where id = 'b6300000-0000-4000-8000-0000000000a6';
set local request.jwt.claims to '{"sub":"b6300000-0000-4000-8000-0000000000f1","role":"authenticated"}';
select is((select deleted_at is null from public.comments where id = 'b6300000-0000-4000-8000-0000000000a6'), true, 'nobody else can delete or hide your comment');
set local request.jwt.claims to '{"sub":"b6300000-0000-4000-8000-0000000000a1","role":"authenticated"}';
delete from public.comments where id = 'b6300000-0000-4000-8000-0000000000a6';
select is((select comment_count from public.posts where id = 'b6300000-0000-4000-8000-0000000000d1'), 0, 'the post''s author deletes a comment on their post, and the count follows');

set local request.jwt.claims to '{"sub":"b6300000-0000-4000-8000-0000000000e2","role":"authenticated"}';
select is((select count(*)::int from public.comments where post_id = 'b6300000-0000-4000-8000-0000000000d1'), 0, 'comments on a blocked author''s post are hidden with it');

-- Photos go with the post.
reset role;
insert into public.post_photos (post_id, storage_path, ordinal) values ('b6300000-0000-4000-8000-0000000000d2', 'a1/p.jpg', 0);
set local role authenticated;
set local request.jwt.claims to '{"sub":"b6300000-0000-4000-8000-000000000051","role":"authenticated"}';
select is((select count(*)::int from public.post_photos where post_id = 'b6300000-0000-4000-8000-0000000000d2'), 0, 'a post''s photos are hidden with the post');
select throws_ok(
  $$insert into public.post_photos (post_id, storage_path, ordinal) values ('b6300000-0000-4000-8000-0000000000d1', 's/p.jpg', 1)$$,
  '42501', null, 'only the post''s author adds photos to it');
set local request.jwt.claims to '{"sub":"b6300000-0000-4000-8000-0000000000f1","role":"authenticated"}';
select is((select count(*)::int from public.post_photos where post_id = 'b6300000-0000-4000-8000-0000000000d2'), 1, 'a follower sees the photos of a followers post');

-- A soft-deleted post stops being reachable for kudos.
reset role;
set local role authenticated;
set local request.jwt.claims to '{"sub":"b6300000-0000-4000-8000-0000000000f1","role":"authenticated"}';
select throws_ok(
  $$insert into public.kudos (post_id, user_id) values ('b6300000-0000-4000-8000-0000000000d4', 'b6300000-0000-4000-8000-0000000000f1')$$,
  '42501', null, 'no kudos on a deleted post');

reset role;
select * from finish();
rollback;
