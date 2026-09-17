-- The avatars bucket (SPEC.md 8.6, 9). The storage.objects policies are what guard the file, so
-- they are what is tested: a profile photo is visible exactly where the profile card is, which
-- means every signed-in user except one blocked in either direction, and nobody signed out.
begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

insert into auth.users (id, email) values
  ('a7000000-0000-4000-8000-0000000000a1', 'avatar-owner@example.com'),
  ('a7000000-0000-4000-8000-0000000000a2', 'avatar-stranger@example.com'),
  ('a7000000-0000-4000-8000-0000000000a3', 'avatar-blocked@example.com'),
  ('a7000000-0000-4000-8000-0000000000a4', 'avatar-blocker@example.com');
-- The signup trigger has already made a profile for each; give them names to search for.
update public.profiles set handle = 'avatar_owner', display_name = 'Avery Owner' where id = 'a7000000-0000-4000-8000-0000000000a1';
update public.profiles set handle = 'avatar_stranger', display_name = 'Stranger' where id = 'a7000000-0000-4000-8000-0000000000a2';
-- The owner is a private account: the card, and so the avatar, is still visible (SPEC.md 9).
update public.profiles set is_private = true where id = 'a7000000-0000-4000-8000-0000000000a1';
-- The owner blocked a3; a4 blocked the owner. Blocks are symmetric in effect.
insert into public.blocks (blocker_id, blocked_id) values
  ('a7000000-0000-4000-8000-0000000000a1', 'a7000000-0000-4000-8000-0000000000a3'),
  ('a7000000-0000-4000-8000-0000000000a4', 'a7000000-0000-4000-8000-0000000000a1');

select is((select public from storage.buckets where id = 'avatars'), false, 'the avatars bucket is private');

-- The owner uploads, the way the app names the file: <user>/avatar-<timestamp>.jpg.
set local role authenticated;
set local request.jwt.claims to '{"sub":"a7000000-0000-4000-8000-0000000000a1","role":"authenticated"}';

select lives_ok($$insert into storage.objects (bucket_id, name, owner_id) values
  ('avatars', 'a7000000-0000-4000-8000-0000000000a1/avatar-1.jpg', 'a7000000-0000-4000-8000-0000000000a1'),
  ('avatars', 'a7000000-0000-4000-8000-0000000000a1/avatar-2.jpg', 'a7000000-0000-4000-8000-0000000000a1')$$,
  'a user can upload into their own folder');

select throws_ok($$insert into storage.objects (bucket_id, name, owner_id) values
  ('avatars', 'a7000000-0000-4000-8000-0000000000a2/avatar-1.jpg', 'a7000000-0000-4000-8000-0000000000a1')$$,
  '42501', null, 'and not into anyone else''s');

select throws_ok($$update public.profiles set avatar_path = 'a7000000-0000-4000-8000-0000000000a2/avatar-1.jpg'
  where id = 'a7000000-0000-4000-8000-0000000000a1'$$,
  '23514', null, 'a profile cannot point at a file in someone else''s folder');

select lives_ok($$update public.profiles set avatar_path = 'a7000000-0000-4000-8000-0000000000a1/avatar-2.jpg'
  where id = 'a7000000-0000-4000-8000-0000000000a1'$$,
  'it can point at one in its own');

select is((select count(*)::int from storage.objects where bucket_id = 'avatars'
           and name like 'a7000000-0000-4000-8000-0000000000a1/%'), 2,
  'the owner can read every file in their folder, current or not');

-- A stranger: signed in, not a follower, not blocked. The owner is private; the card still shows.
set local request.jwt.claims to '{"sub":"a7000000-0000-4000-8000-0000000000a2","role":"authenticated"}';

select is((select array_agg(name order by name) from storage.objects where bucket_id = 'avatars'),
  array['a7000000-0000-4000-8000-0000000000a1/avatar-2.jpg'],
  'any signed-in user can read the current avatar, and not a replaced one');

select is((select avatar_path from public.search_profiles('avatar_owner')),
  'a7000000-0000-4000-8000-0000000000a1/avatar-2.jpg', 'search results carry the avatar path');

set local storage.allow_delete_query = 'true';
delete from storage.objects where bucket_id = 'avatars';
select is((select count(*)::int from storage.objects where bucket_id = 'avatars'), 1,
  'a stranger cannot delete someone else''s avatar');

update storage.objects set name = 'a7000000-0000-4000-8000-0000000000a2/stolen.jpg'
  where bucket_id = 'avatars' and name = 'a7000000-0000-4000-8000-0000000000a1/avatar-2.jpg';
select is((select count(*)::int from storage.objects where bucket_id = 'avatars'
           and name = 'a7000000-0000-4000-8000-0000000000a1/avatar-2.jpg'), 1,
  'or move it');

-- Blocked by the owner.
set local request.jwt.claims to '{"sub":"a7000000-0000-4000-8000-0000000000a3","role":"authenticated"}';
select is((select count(*)::int from storage.objects where bucket_id = 'avatars'), 0,
  'a user the owner blocked cannot read the avatar');
select is((select count(*)::int from public.search_profiles('avatar_owner')), 0,
  'and does not find them in search');

-- The one who blocked the owner.
set local request.jwt.claims to '{"sub":"a7000000-0000-4000-8000-0000000000a4","role":"authenticated"}';
select is((select count(*)::int from storage.objects where bucket_id = 'avatars'), 0,
  'a user who blocked the owner cannot read it either');

-- Companion records: a linked person's photo comes with them; a placeholder has none.
-- Linking a person to an account is the invite flow's job, not a client insert, so set it up as
-- the database owner.
reset role;
insert into public.people (owner_user_id, display_name, linked_user_id) values
  ('a7000000-0000-4000-8000-0000000000a2', 'Avery', 'a7000000-0000-4000-8000-0000000000a1'),
  ('a7000000-0000-4000-8000-0000000000a2', 'Dad', null);
set local role authenticated;
set local request.jwt.claims to '{"sub":"a7000000-0000-4000-8000-0000000000a2","role":"authenticated"}';
select is((select linked_avatar_path from public.companion_records() where display_name = 'Avery'),
  'a7000000-0000-4000-8000-0000000000a1/avatar-2.jpg', 'a linked companion carries their avatar path');
select is((select linked_avatar_path from public.companion_records() where display_name = 'Dad'),
  null, 'a placeholder person has none');

-- The feed: the actor's avatar rides along with their event.
reset role;
insert into public.follows (follower_id, followee_id, status) values
  ('a7000000-0000-4000-8000-0000000000a2', 'a7000000-0000-4000-8000-0000000000a1', 'active');
-- The owner is private, so the insert trigger files that as a request. Accept it.
update public.follows set status = 'active'
  where follower_id = 'a7000000-0000-4000-8000-0000000000a2' and followee_id = 'a7000000-0000-4000-8000-0000000000a1';
insert into public.feed_events (actor_user_id, type, payload, visibility) values
  ('a7000000-0000-4000-8000-0000000000a1', 'milestone', '{}'::jsonb, 'followers');
set local role authenticated;
set local request.jwt.claims to '{"sub":"a7000000-0000-4000-8000-0000000000a2","role":"authenticated"}';
select is((select actor_avatar_path from public.feed(null, 10) where actor_user_id = 'a7000000-0000-4000-8000-0000000000a1' limit 1),
  'a7000000-0000-4000-8000-0000000000a1/avatar-2.jpg', 'feed events carry the actor''s avatar path');

-- Removing the photo: the path goes, and the file goes dark to everyone else at once, even
-- before the object itself is deleted.
set local request.jwt.claims to '{"sub":"a7000000-0000-4000-8000-0000000000a1","role":"authenticated"}';
update public.profiles set avatar_path = null where id = 'a7000000-0000-4000-8000-0000000000a1';
set local request.jwt.claims to '{"sub":"a7000000-0000-4000-8000-0000000000a2","role":"authenticated"}';
select is((select count(*)::int from storage.objects where bucket_id = 'avatars'), 0,
  'a removed avatar is unreadable even while its object still exists');

-- The owner can delete their own files.
set local request.jwt.claims to '{"sub":"a7000000-0000-4000-8000-0000000000a1","role":"authenticated"}';
delete from storage.objects where bucket_id = 'avatars' and name like 'a7000000-0000-4000-8000-0000000000a1/%';
select is((select count(*)::int from storage.objects where bucket_id = 'avatars'
           and name like 'a7000000-0000-4000-8000-0000000000a1/%'), 0,
  'the owner can delete their own avatar files');

reset role;
insert into storage.objects (bucket_id, name, owner_id) values
  ('avatars', 'a7000000-0000-4000-8000-0000000000a1/avatar-3.jpg', 'a7000000-0000-4000-8000-0000000000a1');
update public.profiles set avatar_path = 'a7000000-0000-4000-8000-0000000000a1/avatar-3.jpg'
  where id = 'a7000000-0000-4000-8000-0000000000a1';
set local role anon;
select is((select count(*)::int from storage.objects where bucket_id = 'avatars'), 0,
  'a signed-out caller sees no avatar files at all');

select * from finish();
rollback;
