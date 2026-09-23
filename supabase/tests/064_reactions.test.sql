-- Reactions and reaction prompts (migration 20260924000500; docs/prompts/social/01, section 4):
-- a reaction with no post is its author's alone; with a post it follows the post; only the
-- server fires prompts.
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users (id, email) values
  ('b6400000-0000-4000-8000-0000000000a1', 'rx-a@test'),
  ('b6400000-0000-4000-8000-0000000000f1', 'rx-f@test'),
  ('b6400000-0000-4000-8000-0000000000e1', 'rx-x@test');
insert into public.follows (follower_id, followee_id) values
  ('b6400000-0000-4000-8000-0000000000f1', 'b6400000-0000-4000-8000-0000000000a1'),
  ('b6400000-0000-4000-8000-0000000000e1', 'b6400000-0000-4000-8000-0000000000a1');
insert into public.blocks (blocker_id, blocked_id) values ('b6400000-0000-4000-8000-0000000000e1', 'b6400000-0000-4000-8000-0000000000a1');
insert into public.teams (id, sport_id, name, city, abbreviation, provider, provider_team_id, franchise_id) values
  ('00000000-0000-0000-0000-00000064a001', 'nba', 'React Home', 'Home', 'RHM', 'test', 'rx-t1', 'rx-f1'),
  ('00000000-0000-0000-0000-00000064a002', 'nba', 'React Away', 'Away', 'RAW', 'test', 'rx-t2', 'rx-f2');
insert into public.games (id, sport_id, season, game_type, scheduled_start, home_team_id, away_team_id, status, provider, provider_game_id)
values ('00000000-0000-0000-0000-00000064c001', 'nba', 2026, 'regular', now(), '00000000-0000-0000-0000-00000064a001', '00000000-0000-0000-0000-00000064a002', 'live', 'test', 'rx-g1');
insert into public.attendances (id, user_id, game_id, source) values
  ('b6400000-0000-4000-8000-0000000000c1', 'b6400000-0000-4000-8000-0000000000a1', '00000000-0000-0000-0000-00000064c001', 'checkin'),
  ('b6400000-0000-4000-8000-0000000000c2', 'b6400000-0000-4000-8000-0000000000f1', '00000000-0000-0000-0000-00000064c001', 'checkin');
insert into public.reaction_prompts (id, game_id, kind, window_seconds, label)
values ('b6400000-0000-4000-8000-0000000000b1', '00000000-0000-0000-0000-00000064c001', 'checkin', 120, 'Fourth quarter: react');

set local role authenticated;
set local request.jwt.claims to '{"sub":"b6400000-0000-4000-8000-0000000000a1","role":"authenticated"}';
select is((select count(*)::int from public.reaction_prompts where game_id = '00000000-0000-0000-0000-00000064c001'), 1, 'any fan reads a game''s prompts');
select throws_ok(
  $$insert into public.reaction_prompts (game_id, kind, window_seconds, label) values ('00000000-0000-0000-0000-00000064c001', 'checkin', 60, 'Fake')$$,
  '42501', null, 'only the server fires a prompt');

insert into public.reactions (id, user_id, game_id, prompt_id, attendance_id, back_path, front_path, late_seconds)
values ('b6400000-0000-4000-8000-0000000000d1', auth.uid(), '00000000-0000-0000-0000-00000064c001', 'b6400000-0000-4000-8000-0000000000b1',
        'b6400000-0000-4000-8000-0000000000c1', 'a/back.jpg', 'a/front.jpg', 12);
select throws_ok(
  $$insert into public.reactions (user_id, game_id, attendance_id, back_path, front_path) values (auth.uid(), '00000000-0000-0000-0000-00000064c001', 'b6400000-0000-4000-8000-0000000000c2', 'b', 'f')$$,
  '42501', null, 'a reaction is taken on your own attendance');

set local request.jwt.claims to '{"sub":"b6400000-0000-4000-8000-0000000000f1","role":"authenticated"}';
select is((select count(*)::int from public.reactions where user_id = 'b6400000-0000-4000-8000-0000000000a1'), 0, 'a reaction with no post is private to its author');
reset role;
insert into public.posts (id, author_id, kind, reaction_id, game_id, visibility)
values ('b6400000-0000-4000-8000-0000000000e9', 'b6400000-0000-4000-8000-0000000000a1', 'reaction', 'b6400000-0000-4000-8000-0000000000d1', '00000000-0000-0000-0000-00000064c001', 'followers');
insert into public.posts (id, author_id, kind, visibility)
values ('b6400000-0000-4000-8000-0000000000e8', 'b6400000-0000-4000-8000-0000000000f1', 'milestone', 'public');
set local role authenticated;
set local request.jwt.claims to '{"sub":"b6400000-0000-4000-8000-0000000000a1","role":"authenticated"}';
select throws_ok(
  $$update public.reactions set post_id = 'b6400000-0000-4000-8000-0000000000e8' where id = 'b6400000-0000-4000-8000-0000000000d1'$$,
  '23514', null, 'a reaction attaches only to its author''s own post');
update public.reactions set post_id = 'b6400000-0000-4000-8000-0000000000e9', back_path = 'swapped.jpg' where id = 'b6400000-0000-4000-8000-0000000000d1';
select is((select back_path from public.reactions where id = 'b6400000-0000-4000-8000-0000000000d1'), 'a/back.jpg', 'the capture itself cannot be swapped');
select is((select count(*)::int from public.reactions where id = 'b6400000-0000-4000-8000-0000000000d1' and wp_seq is null), 1, 'the author still has it, for Relive');

set local request.jwt.claims to '{"sub":"b6400000-0000-4000-8000-0000000000f1","role":"authenticated"}';
select is((select count(*)::int from public.reactions where user_id = 'b6400000-0000-4000-8000-0000000000a1'), 1, 'posted, it follows the post: a follower sees it');
set local request.jwt.claims to '{"sub":"b6400000-0000-4000-8000-0000000000e1","role":"authenticated"}';
select is((select count(*)::int from public.reactions where user_id = 'b6400000-0000-4000-8000-0000000000a1'), 0, 'someone who blocked the author does not');
reset role;
insert into public.blocks (blocker_id, blocked_id) values ('b6400000-0000-4000-8000-0000000000a1', 'b6400000-0000-4000-8000-0000000000f1');
set local role authenticated;
set local request.jwt.claims to '{"sub":"b6400000-0000-4000-8000-0000000000f1","role":"authenticated"}';
select is((select count(*)::int from public.reactions where user_id = 'b6400000-0000-4000-8000-0000000000a1'), 0, 'nor someone the author blocked');
reset role;

select * from finish();
rollback;
