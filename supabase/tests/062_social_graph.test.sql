-- The social graph (migration 20260924000300): follower counts kept by trigger, profile columns
-- only the server writes, mutes seen by the muter alone, and reports on the new content.
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

insert into auth.users (id, email) values
  ('b6200000-0000-4000-8000-0000000000a1', 'sg-a@test'),
  ('b6200000-0000-4000-8000-0000000000b1', 'sg-b@test'),
  ('b6200000-0000-4000-8000-0000000000c1', 'sg-c@test');
update public.profiles set is_private = true where id = 'b6200000-0000-4000-8000-0000000000c1';

set local role authenticated;
set local request.jwt.claims to '{"sub":"b6200000-0000-4000-8000-0000000000a1","role":"authenticated"}';
insert into public.follows (follower_id, followee_id) values ('b6200000-0000-4000-8000-0000000000a1', 'b6200000-0000-4000-8000-0000000000b1');
insert into public.follows (follower_id, followee_id) values ('b6200000-0000-4000-8000-0000000000a1', 'b6200000-0000-4000-8000-0000000000c1');
reset role;
select is((select following_count from public.profiles where id = 'b6200000-0000-4000-8000-0000000000a1'), 1, 'following counts active follows, not a pending request');
select is((select followers_count from public.profiles where id = 'b6200000-0000-4000-8000-0000000000b1'), 1, 'followers count goes up on a follow');
select is((select followers_count from public.profiles where id = 'b6200000-0000-4000-8000-0000000000c1'), 0, 'a request is not a follower yet');

set local role authenticated;
set local request.jwt.claims to '{"sub":"b6200000-0000-4000-8000-0000000000c1","role":"authenticated"}';
update public.follows set status = 'active' where follower_id = 'b6200000-0000-4000-8000-0000000000a1' and followee_id = auth.uid();
reset role;
select is((select followers_count from public.profiles where id = 'b6200000-0000-4000-8000-0000000000c1'), 1, 'accepting the request counts it');

set local role authenticated;
set local request.jwt.claims to '{"sub":"b6200000-0000-4000-8000-0000000000a1","role":"authenticated"}';
delete from public.follows where follower_id = auth.uid() and followee_id = 'b6200000-0000-4000-8000-0000000000b1';
reset role;
select is((select followers_count from public.profiles where id = 'b6200000-0000-4000-8000-0000000000b1'), 0, 'unfollowing takes it back off');

-- A block removes follows both ways, and the counts follow.
set local role authenticated;
set local request.jwt.claims to '{"sub":"b6200000-0000-4000-8000-0000000000c1","role":"authenticated"}';
insert into public.blocks (blocker_id, blocked_id) values (auth.uid(), 'b6200000-0000-4000-8000-0000000000a1');
reset role;
select is((select following_count from public.profiles where id = 'b6200000-0000-4000-8000-0000000000a1'), 0, 'a block that removes a follow lowers the counts');

-- The server's profile columns.
set local role authenticated;
set local request.jwt.claims to '{"sub":"b6200000-0000-4000-8000-0000000000b1","role":"authenticated"}';
update public.profiles set is_creator = true, followers_count = 9000, posts_backfilled_at = '2000-01-01', display_name = 'Bee' where id = auth.uid();
reset role;
select is((select is_creator::text || '/' || followers_count || '/' || display_name from public.profiles where id = 'b6200000-0000-4000-8000-0000000000b1'),
  'false/0/Bee', 'a user edits their name, never their creator flag or counts');
select isnt((select posts_backfilled_at from public.profiles where id = 'b6200000-0000-4000-8000-0000000000b1'), '2000-01-01'::timestamptz,
  'nor the line before which attendances make no posts');

-- Mutes: only the muter sees them.
set local role authenticated;
set local request.jwt.claims to '{"sub":"b6200000-0000-4000-8000-0000000000b1","role":"authenticated"}';
insert into public.mutes (user_id, muted_id) values (auth.uid(), 'b6200000-0000-4000-8000-0000000000a1');
select is(public.is_muted('b6200000-0000-4000-8000-0000000000a1'), true, 'is_muted answers for the viewer');
select throws_ok(
  $$insert into public.mutes (user_id, muted_id) values ('b6200000-0000-4000-8000-0000000000a1', 'b6200000-0000-4000-8000-0000000000c1')$$,
  '42501', null, 'nobody mutes on someone else''s behalf');
set local request.jwt.claims to '{"sub":"b6200000-0000-4000-8000-0000000000a1","role":"authenticated"}';
select is((select count(*)::int from public.mutes), 0, 'the muted person cannot see that they are muted');

-- Reports cover the new content.
select lives_ok(
  $$insert into public.reports (reporter_id, target_type, target_id, reason) values (auth.uid(), 'comment', gen_random_uuid(), 'Abuse')$$,
  'a comment can be reported');
select throws_ok(
  $$insert into public.reports (reporter_id, target_type, target_id, reason) values (auth.uid(), 'nonsense', gen_random_uuid(), 'x')$$,
  '23514', null, 'an unknown kind cannot');
reset role;

select * from finish();
rollback;
