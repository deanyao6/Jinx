-- The feed's visibility matrix (migration 20260924010100; social brief 02, sections 2 and 9):
-- public, followers, private, blocked in both directions, and muted (hidden from the feed, not
-- from the post's own page); Discover leaves out people I follow; and a page is stable when new
-- posts arrive at the top.
begin;
create extension if not exists pgtap with schema extensions;
select plan(21);

-- me, a followed friend, a stranger with a public profile, a private stranger, a blocker and a
-- blocked person (I follow both of the last two), a creator.
insert into auth.users (id, email) values
  ('b7100000-0000-4000-8000-0000000000a1', 'fv-me@test'),
  ('b7100000-0000-4000-8000-0000000000b1', 'fv-friend@test'),
  ('b7100000-0000-4000-8000-0000000000c1', 'fv-stranger@test'),
  ('b7100000-0000-4000-8000-0000000000c2', 'fv-private@test'),
  ('b7100000-0000-4000-8000-0000000000d1', 'fv-blocker@test'),
  ('b7100000-0000-4000-8000-0000000000d2', 'fv-blocked@test'),
  ('b7100000-0000-4000-8000-0000000000e1', 'fv-creator@test');
update public.profiles set is_private = true where id = 'b7100000-0000-4000-8000-0000000000c2';
update public.profiles set is_creator = true where id = 'b7100000-0000-4000-8000-0000000000e1';
insert into public.teams (id, sport_id, name, city, abbreviation, provider, provider_team_id, franchise_id, nickname) values
  ('00000000-0000-0000-0000-00000071a001', 'mlb', 'Feed Home', 'Home', 'FHM', 'test', 'fv-t1', 'fv-f1', 'Feeders'),
  ('00000000-0000-0000-0000-00000071a002', 'mlb', 'Feed Away', 'Away', 'FAW', 'test', 'fv-t2', 'fv-f2', 'Readers');
insert into public.games (id, sport_id, season, game_type, scheduled_start, home_team_id, away_team_id, status, provider, provider_game_id) values
  ('00000000-0000-0000-0000-00000071c001', 'mlb', 2026, 'regular', now() - interval '1 day', '00000000-0000-0000-0000-00000071a001', '00000000-0000-0000-0000-00000071a002', 'final', 'test', 'fv-g1');
insert into public.user_teams (user_id, team_id) values ('b7100000-0000-4000-8000-0000000000a1', '00000000-0000-0000-0000-00000071a001');
insert into public.follows (follower_id, followee_id) values
  ('b7100000-0000-4000-8000-0000000000a1', 'b7100000-0000-4000-8000-0000000000b1'),
  ('b7100000-0000-4000-8000-0000000000a1', 'b7100000-0000-4000-8000-0000000000d1'),
  ('b7100000-0000-4000-8000-0000000000a1', 'b7100000-0000-4000-8000-0000000000d2');
insert into public.blocks (blocker_id, blocked_id) values
  ('b7100000-0000-4000-8000-0000000000d1', 'b7100000-0000-4000-8000-0000000000a1'),
  ('b7100000-0000-4000-8000-0000000000a1', 'b7100000-0000-4000-8000-0000000000d2');

-- Posts, written as the server so each can be placed in time. Captions name them.
insert into public.posts (id, author_id, kind, game_id, visibility, caption, created_at, published_at) values
  ('b7100000-0000-4000-8000-000000000f01', 'b7100000-0000-4000-8000-0000000000b1', 'milestone', '00000000-0000-0000-0000-00000071c001', 'followers', 'friend followers', now() - interval '10 minutes', now() - interval '10 minutes'),
  ('b7100000-0000-4000-8000-000000000f02', 'b7100000-0000-4000-8000-0000000000b1', 'milestone', null, 'private', 'friend private', now() - interval '9 minutes', now() - interval '9 minutes'),
  ('b7100000-0000-4000-8000-000000000f03', 'b7100000-0000-4000-8000-0000000000b1', 'milestone', null, 'public', 'friend public', now() - interval '8 minutes', now() - interval '8 minutes'),
  ('b7100000-0000-4000-8000-000000000f04', 'b7100000-0000-4000-8000-0000000000c1', 'milestone', null, 'public', 'stranger public', now() - interval '7 minutes', now() - interval '7 minutes'),
  ('b7100000-0000-4000-8000-000000000f05', 'b7100000-0000-4000-8000-0000000000c1', 'milestone', null, 'followers', 'stranger followers', now() - interval '6 minutes', now() - interval '6 minutes'),
  ('b7100000-0000-4000-8000-000000000f06', 'b7100000-0000-4000-8000-0000000000c2', 'milestone', null, 'public', 'private stranger public', now() - interval '5 minutes', now() - interval '5 minutes'),
  ('b7100000-0000-4000-8000-000000000f07', 'b7100000-0000-4000-8000-0000000000d1', 'milestone', null, 'public', 'blocker public', now() - interval '4 minutes', now() - interval '4 minutes'),
  ('b7100000-0000-4000-8000-000000000f08', 'b7100000-0000-4000-8000-0000000000d2', 'milestone', null, 'public', 'blocked public', now() - interval '3 minutes', now() - interval '3 minutes'),
  ('b7100000-0000-4000-8000-000000000f09', 'b7100000-0000-4000-8000-0000000000a1', 'milestone', null, 'private', 'mine private', now() - interval '2 minutes', now() - interval '2 minutes'),
  ('b7100000-0000-4000-8000-000000000f10', 'b7100000-0000-4000-8000-0000000000e1', 'milestone', '00000000-0000-0000-0000-00000071c001', 'public', 'creator about my team', now() - interval '1 minute', now() - interval '1 minute');

set local role authenticated;
set local request.jwt.claims to '{"sub":"b7100000-0000-4000-8000-0000000000a1","role":"authenticated"}';

-- ---- The matrix, as the posts table itself answers ----
select ok(exists (select 1 from public.posts where caption = 'friend followers'), 'followers-only: I follow them, I see it');
select ok(not exists (select 1 from public.posts where caption = 'friend private'), 'private: not even a follower sees it');
select ok(exists (select 1 from public.posts where caption = 'stranger public'), 'public on a public profile: anyone signed in sees it');
select ok(not exists (select 1 from public.posts where caption = 'stranger followers'), 'followers-only, not following: hidden');
select ok(not exists (select 1 from public.posts where caption = 'private stranger public'), 'public on a private profile: followers only');
select ok(not exists (select 1 from public.posts where caption = 'blocker public'), 'they blocked me: hidden, though I follow them');
select ok(not exists (select 1 from public.posts where caption = 'blocked public'), 'I blocked them: hidden, though I follow them');
select ok(exists (select 1 from public.posts where caption = 'mine private'), 'my own private post: mine to see');

-- ---- Following ----
select results_eq(
  $$select caption from public.feed_posts('following')$$,
  $$values ('mine private'), ('friend public'), ('friend followers')$$,
  'Following: me and the people I follow, newest first, minus private and blocked');

insert into public.mutes (user_id, muted_id) values ('b7100000-0000-4000-8000-0000000000a1', 'b7100000-0000-4000-8000-0000000000b1');
select results_eq(
  $$select caption from public.feed_posts('following')$$,
  $$values ('mine private')$$,
  'muting someone takes them out of the feed');
select is((select caption from public.post_card('b7100000-0000-4000-8000-000000000f01')), 'friend followers',
  'and leaves their post on its own page');
delete from public.mutes where user_id = 'b7100000-0000-4000-8000-0000000000a1';

-- ---- Discover ----
select results_eq(
  $$select caption from public.feed_posts('discover')$$,
  $$values ('creator about my team')$$,
  'Discover: a creator I do not follow posting about my team; never someone I follow');

-- ---- Pagination is stable when a post arrives mid-scroll ----
select results_eq(
  $$select caption from public.feed_posts('following', null, null, 2)$$,
  $$values ('mine private'), ('friend public')$$,
  'page one');
reset role;
insert into public.posts (author_id, kind, visibility, caption, created_at, published_at) values
  ('b7100000-0000-4000-8000-0000000000b1', 'milestone', 'followers', 'arrived later', now(), now());
set local role authenticated;
set local request.jwt.claims to '{"sub":"b7100000-0000-4000-8000-0000000000a1","role":"authenticated"}';
select results_eq(
  $$select caption from public.feed_posts('following', now() - interval '8 minutes', 'b7100000-0000-4000-8000-000000000f03', 2)$$,
  $$values ('friend followers')$$,
  'page two after a new post arrived: no repeat, nothing skipped');
select is((select caption from public.feed_posts('following') limit 1), 'arrived later', 'a refresh shows the new post on top');

-- ---- Blocked people are left out of counts ----
reset role;
insert into public.kudos (post_id, user_id) values
  ('b7100000-0000-4000-8000-000000000f03', 'b7100000-0000-4000-8000-0000000000c1'),
  ('b7100000-0000-4000-8000-000000000f03', 'b7100000-0000-4000-8000-0000000000d2');
insert into public.comments (post_id, author_id, body) values
  ('b7100000-0000-4000-8000-000000000f03', 'b7100000-0000-4000-8000-0000000000d2', 'from the blocked'),
  ('b7100000-0000-4000-8000-000000000f03', 'b7100000-0000-4000-8000-0000000000c1', 'from a stranger');
set local role authenticated;
set local request.jwt.claims to '{"sub":"b7100000-0000-4000-8000-0000000000a1","role":"authenticated"}';
select is((select kudos_count from public.post_card('b7100000-0000-4000-8000-000000000f03')), 1,
  'a kudos from someone I blocked is not in my count');
select is((select comment_count from public.post_card('b7100000-0000-4000-8000-000000000f03')), 1,
  'nor is their comment');
select results_eq(
  $$select body from public.post_comments('b7100000-0000-4000-8000-000000000f03')$$,
  $$values ('from a stranger')$$,
  'and the thread leaves them out');
set local request.jwt.claims to '{"sub":"b7100000-0000-4000-8000-0000000000c1","role":"authenticated"}';
select is((select kudos_count from public.post_card('b7100000-0000-4000-8000-000000000f03')), 2,
  'someone with no block sees both');

-- ---- Discover's people ----
set local request.jwt.claims to '{"sub":"b7100000-0000-4000-8000-0000000000a1","role":"authenticated"}';
reset role;
select public.refresh_creator_rankings();
set local role authenticated;
set local request.jwt.claims to '{"sub":"b7100000-0000-4000-8000-0000000000a1","role":"authenticated"}';
select results_eq(
  $$select section, user_id from public.discover_people()$$,
  $$values ('creator'::text, 'b7100000-0000-4000-8000-0000000000e1'::uuid)$$,
  'Discover lists the creator I do not follow');
select is((select count(*)::integer from public.creator_rankings), 0, 'the ranking table itself is not readable');

select * from finish();
rollback;
