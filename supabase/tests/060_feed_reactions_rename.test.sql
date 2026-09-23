-- The emoji table is feed_reactions now (migration 20260924000100, 00_repo_reality.md R2): its
-- rows and policies moved with it, feed() and the data export read it, and `reactions` is the
-- photo table (20260924000500).
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

select has_table('public', 'feed_reactions', 'the emoji table is feed_reactions');
select has_column('public', 'reactions', 'front_path', 'reactions is the photo table');
select policies_are('public', 'feed_reactions', array['feed_reactions_select', 'feed_reactions_write'], 'its policies came with it, renamed');

insert into auth.users (id, email) values
  ('b6000000-0000-4000-8000-0000000000a1', 'fr-actor@test'),
  ('b6000000-0000-4000-8000-0000000000f1', 'fr-fan@test');
insert into public.follows (follower_id, followee_id) values ('b6000000-0000-4000-8000-0000000000f1', 'b6000000-0000-4000-8000-0000000000a1');
insert into public.feed_events (id, actor_user_id, type, visibility)
values ('b6000000-0000-4000-8000-0000000000e1', 'b6000000-0000-4000-8000-0000000000a1', 'milestone', 'followers');

set local role authenticated;
set local request.jwt.claims to '{"sub":"b6000000-0000-4000-8000-0000000000f1","role":"authenticated"}';
insert into public.feed_reactions (feed_event_id, user_id, emoji) values ('b6000000-0000-4000-8000-0000000000e1', 'b6000000-0000-4000-8000-0000000000f1', '🔥');
select is((select my_reaction from public.feed() where id = 'b6000000-0000-4000-8000-0000000000e1'), '🔥', 'feed() reads the viewer''s emoji from feed_reactions');
select is((select reactions ->> '🔥' from public.feed() where id = 'b6000000-0000-4000-8000-0000000000e1'), '1', 'feed() counts from feed_reactions');
select throws_ok(
  $$insert into public.feed_reactions (feed_event_id, user_id, emoji) values ('b6000000-0000-4000-8000-0000000000e1', 'b6000000-0000-4000-8000-0000000000a1', '👏')$$,
  '42501', null, 'the write policy still keeps a reaction to its own user');

select is(jsonb_array_length(public.export_my_data() -> 'feed_reactions'), 1, 'the export carries the fan''s emoji under feed_reactions');
select is(public.export_my_data() -> 'reactions', '[]'::jsonb, 'and their reaction photos under reactions');
select ok(public.export_my_data() ? 'posts', 'the export has the new social tables too');
reset role;

select * from finish();
rollback;
