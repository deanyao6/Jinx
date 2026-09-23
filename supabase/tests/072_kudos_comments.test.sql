-- Kudos and comments (migration 20260924010100; social brief 02, sections 3 and 9): no kudos on
-- your own post, one batched notification, 500-character comments that the post's author can
-- delete, and rate limits that answer with a code the app turns into friendly copy.
begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

insert into auth.users (id, email, raw_user_meta_data) values
  ('b7200000-0000-4000-8000-0000000000a1', 'kc-author@test', '{"full_name":"Dean"}'),
  ('b7200000-0000-4000-8000-0000000000b1', 'kc-maya@test', '{"full_name":"Maya"}'),
  ('b7200000-0000-4000-8000-0000000000b2', 'kc-sam@test', '{"full_name":"Sam"}'),
  ('b7200000-0000-4000-8000-0000000000b3', 'kc-jo@test', '{"full_name":"Jo"}');
insert into public.posts (id, author_id, kind, visibility, created_at, published_at) values
  ('b7200000-0000-4000-8000-000000000f01', 'b7200000-0000-4000-8000-0000000000a1', 'milestone', 'public', now(), now());

-- ---- Kudos ----
set local role authenticated;
set local request.jwt.claims to '{"sub":"b7200000-0000-4000-8000-0000000000a1","role":"authenticated"}';
select throws_ok(
  $$insert into public.kudos (post_id, user_id) values ('b7200000-0000-4000-8000-000000000f01', 'b7200000-0000-4000-8000-0000000000a1')$$,
  '42501', null, 'no kudos on your own post');

set local request.jwt.claims to '{"sub":"b7200000-0000-4000-8000-0000000000b2","role":"authenticated"}';
insert into public.kudos (post_id, user_id) values ('b7200000-0000-4000-8000-000000000f01', 'b7200000-0000-4000-8000-0000000000b2');
set local request.jwt.claims to '{"sub":"b7200000-0000-4000-8000-0000000000b3","role":"authenticated"}';
insert into public.kudos (post_id, user_id) values ('b7200000-0000-4000-8000-000000000f01', 'b7200000-0000-4000-8000-0000000000b3');
set local request.jwt.claims to '{"sub":"b7200000-0000-4000-8000-0000000000b1","role":"authenticated"}';
insert into public.kudos (post_id, user_id) values ('b7200000-0000-4000-8000-000000000f01', 'b7200000-0000-4000-8000-0000000000b1');
reset role;

select is((select count(*)::integer from public.notifications where user_id = 'b7200000-0000-4000-8000-0000000000a1' and kind = 'kudos'), 1,
  'three kudos make one notification');
select is((select body from public.notifications where user_id = 'b7200000-0000-4000-8000-0000000000a1' and kind = 'kudos'),
  'Maya and 2 others gave kudos.', 'batched, naming the latest');
update public.notifications set sent_at = now() where user_id = 'b7200000-0000-4000-8000-0000000000a1' and kind = 'kudos';

-- Undo and redo: tapping again removes it, and the count follows.
set local role authenticated;
set local request.jwt.claims to '{"sub":"b7200000-0000-4000-8000-0000000000b1","role":"authenticated"}';
delete from public.kudos where post_id = 'b7200000-0000-4000-8000-000000000f01' and user_id = 'b7200000-0000-4000-8000-0000000000b1';
select is((select kudos_count from public.post_card('b7200000-0000-4000-8000-000000000f01')), 2, 'undo takes the kudos back');
select is((select my_kudos from public.post_card('b7200000-0000-4000-8000-000000000f01')), false, 'and my kudos is off');
insert into public.kudos (post_id, user_id) values ('b7200000-0000-4000-8000-000000000f01', 'b7200000-0000-4000-8000-0000000000b1');
reset role;
select is((select count(*)::integer from public.notifications where user_id = 'b7200000-0000-4000-8000-0000000000a1' and kind = 'kudos'), 2,
  'once the first was pushed, a new one starts');

-- A blocked fan's kudos says nothing to the author.
insert into public.blocks (blocker_id, blocked_id) values ('b7200000-0000-4000-8000-0000000000a1', 'b7200000-0000-4000-8000-0000000000b3');
update public.notifications set read_at = now() where user_id = 'b7200000-0000-4000-8000-0000000000a1';
delete from public.kudos where user_id = 'b7200000-0000-4000-8000-0000000000b3';
insert into public.kudos (post_id, user_id) values ('b7200000-0000-4000-8000-000000000f01', 'b7200000-0000-4000-8000-0000000000b3');
select is((select count(*)::integer from public.notifications where user_id = 'b7200000-0000-4000-8000-0000000000a1' and read_at is null), 0,
  'a kudos from someone blocked notifies nobody');

-- ---- Comments ----
set local role authenticated;
set local request.jwt.claims to '{"sub":"b7200000-0000-4000-8000-0000000000b1","role":"authenticated"}';
select throws_ok(
  format($$insert into public.comments (post_id, author_id, body) values ('b7200000-0000-4000-8000-000000000f01', 'b7200000-0000-4000-8000-0000000000b1', %L)$$, repeat('x', 501)),
  '23514', null, 'a comment is at most 500 characters');
insert into public.comments (id, post_id, author_id, body) values
  ('b7200000-0000-4000-8000-00000000c001', 'b7200000-0000-4000-8000-000000000f01', 'b7200000-0000-4000-8000-0000000000b1', 'Great seats.');
insert into public.comments (id, post_id, author_id, body) values
  ('b7200000-0000-4000-8000-00000000c002', 'b7200000-0000-4000-8000-000000000f01', 'b7200000-0000-4000-8000-0000000000b1', 'Told you.');
select results_eq(
  $$select body, can_delete from public.post_comments('b7200000-0000-4000-8000-000000000f01')$$,
  $$values ('Great seats.', true), ('Told you.', true)$$,
  'flat, oldest first, and I can delete my own');
reset role;
select results_eq(
  $$select body from public.notifications where user_id = 'b7200000-0000-4000-8000-0000000000a1' and kind = 'comment' order by body$$,
  $$values ('Maya: Great seats.'), ('Maya: Told you.')$$,
  'the author hears about each comment');

set local role authenticated;
set local request.jwt.claims to '{"sub":"b7200000-0000-4000-8000-0000000000b2","role":"authenticated"}';
select is((select bool_or(can_delete) from public.post_comments('b7200000-0000-4000-8000-000000000f01')), false,
  'a third person cannot delete anything');
delete from public.comments where id = 'b7200000-0000-4000-8000-00000000c001';
set local request.jwt.claims to '{"sub":"b7200000-0000-4000-8000-0000000000a1","role":"authenticated"}';
select is((select count(*)::integer from public.post_comments('b7200000-0000-4000-8000-000000000f01')), 2, 'their delete did nothing');
delete from public.comments where id = 'b7200000-0000-4000-8000-00000000c001';
select results_eq(
  $$select body from public.post_comments('b7200000-0000-4000-8000-000000000f01')$$,
  $$values ('Told you.')$$,
  'the post''s author deletes a comment on their post');
select is((select comment_count from public.post_card('b7200000-0000-4000-8000-000000000f01')), 1, 'and the count follows');

-- ---- Rate limits: a friendly code, not a crash ----
set local request.jwt.claims to '{"sub":"b7200000-0000-4000-8000-0000000000b2","role":"authenticated"}';
select throws_ok(
  $q$do $d$ begin for i in 1..21 loop
    insert into public.comments (post_id, author_id, body) values ('b7200000-0000-4000-8000-000000000f01', 'b7200000-0000-4000-8000-0000000000b2', 'again ' || i);
  end loop; end $d$$q$,
  'JX429', 'rate_limited: comment', 'the 21st comment in ten minutes is refused with JX429');
reset role;

select * from finish();
rollback;
