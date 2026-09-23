-- Leaderboards, counts and the community join hook (migration 20260924030000; docs/prompts/social/04,
-- sections 2 and 4): only verified attendance ranks, ties break by whoever got there first, a
-- friends-only board excludes non-friends, a blocked user is excluded either way, the viewer's
-- own row is returned even off the visible page, and joining a community seeds it immediately.
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email) values
  ('b9000000-0000-4000-8000-0000000000a1', 'lb-a@test'),
  ('b9000000-0000-4000-8000-0000000000b1', 'lb-b@test'),
  ('b9000000-0000-4000-8000-0000000000c1', 'lb-c@test'),
  ('b9000000-0000-4000-8000-0000000000e1', 'lb-x@test');
insert into public.follows (follower_id, followee_id, status) values
  ('b9000000-0000-4000-8000-0000000000a1', 'b9000000-0000-4000-8000-0000000000b1', 'active');
insert into public.blocks (blocker_id, blocked_id) values
  ('b9000000-0000-4000-8000-0000000000a1', 'b9000000-0000-4000-8000-0000000000e1');

insert into public.teams (id, sport_id, name, city, abbreviation, provider, provider_team_id, franchise_id) values
  ('00000000-0000-0000-0000-000000090a01', 'mlb', 'Home Club', 'Home', 'HOM', 'test', 'lb-home', 'lb-fr-home'),
  ('00000000-0000-0000-0000-000000090a02', 'mlb', 'Away Club', 'Away', 'AWY', 'test', 'lb-away', 'lb-fr-away');
insert into public.communities (id, slug, name, kind, team_id) values
  ('b9000000-0000-4000-8000-0000000000c9', 'lb-home-fans', 'Home Club Fans', 'team', '00000000-0000-0000-0000-000000090a01');

-- a: 3 verified games (earliest finishing last, so a "gets there" latest among the ties),
-- b: 3 verified games (finishes its third game earlier than a), c: 1 verified + 1 unverified.
insert into public.games (id, sport_id, season, game_type, scheduled_start, home_team_id, away_team_id, status, home_score, away_score, provider, provider_game_id)
select ('00000000-0000-0000-0000-00000009000' || n)::uuid, 'mlb', public.current_season('mlb'), 'regular',
       now() - (10 - n) * interval '1 day',
       '00000000-0000-0000-0000-000000090a01', '00000000-0000-0000-0000-000000090a02', 'final', 5, 1, 'test', 'lb-g' || n
from generate_series(1, 6) n;

insert into public.attendances (user_id, game_id, source, status, verified, rooting_team_id, rooting_basis) values
  ('b9000000-0000-4000-8000-0000000000a1', '00000000-0000-0000-0000-000000090001', 'manual', 'attended', true, '00000000-0000-0000-0000-000000090a01', 'favorite'),
  ('b9000000-0000-4000-8000-0000000000a1', '00000000-0000-0000-0000-000000090002', 'manual', 'attended', true, '00000000-0000-0000-0000-000000090a01', 'favorite'),
  ('b9000000-0000-4000-8000-0000000000a1', '00000000-0000-0000-0000-000000090006', 'manual', 'attended', true, '00000000-0000-0000-0000-000000090a01', 'favorite'),
  ('b9000000-0000-4000-8000-0000000000b1', '00000000-0000-0000-0000-000000090001', 'manual', 'attended', true, '00000000-0000-0000-0000-000000090a01', 'favorite'),
  ('b9000000-0000-4000-8000-0000000000b1', '00000000-0000-0000-0000-000000090003', 'manual', 'attended', true, '00000000-0000-0000-0000-000000090a01', 'favorite'),
  ('b9000000-0000-4000-8000-0000000000b1', '00000000-0000-0000-0000-000000090004', 'manual', 'attended', true, '00000000-0000-0000-0000-000000090a01', 'favorite'),
  ('b9000000-0000-4000-8000-0000000000c1', '00000000-0000-0000-0000-000000090005', 'manual', 'attended', true, '00000000-0000-0000-0000-000000090a01', 'favorite'),
  ('b9000000-0000-4000-8000-0000000000c1', '00000000-0000-0000-0000-000000090001', 'manual', 'attended', false, '00000000-0000-0000-0000-000000090a01', 'favorite'),
  ('b9000000-0000-4000-8000-0000000000e1', '00000000-0000-0000-0000-000000090001', 'manual', 'attended', true, '00000000-0000-0000-0000-000000090a01', 'favorite');

-- --- Counts: verified vs total, lifetime and per season ---------------------------------------
select public.recompute_user_counts('b9000000-0000-4000-8000-0000000000c1');
select is(
  (select games || '/' || verified_games from public.user_counts where user_id = 'b9000000-0000-4000-8000-0000000000c1' and season = 0),
  '2/1', 'counts hold total and verified separately');

-- --- Joining seeds this member''s leaderboard rows immediately, from real attendance data -----
insert into public.community_members (community_id, user_id) values ('b9000000-0000-4000-8000-0000000000c9', 'b9000000-0000-4000-8000-0000000000a1');
insert into public.community_members (community_id, user_id) values ('b9000000-0000-4000-8000-0000000000c9', 'b9000000-0000-4000-8000-0000000000b1');
insert into public.community_members (community_id, user_id) values ('b9000000-0000-4000-8000-0000000000c9', 'b9000000-0000-4000-8000-0000000000c1');
insert into public.community_members (community_id, user_id) values ('b9000000-0000-4000-8000-0000000000c9', 'b9000000-0000-4000-8000-0000000000e1');
select is(
  (select value from public.leaderboard_stats where user_id = 'b9000000-0000-4000-8000-0000000000a1' and community_id = 'b9000000-0000-4000-8000-0000000000c9' and period = 'all' and stat_key = 'games'),
  3::numeric, 'joining recomputes and writes this member''s games count right away');
select is(
  (select count(*)::int from public.leaderboard_stats where user_id = 'b9000000-0000-4000-8000-0000000000c1' and stat_key = 'games' and period = 'all'),
  1, 'only the verified game counts toward the leaderboard, not the unverified one');

-- --- community_leaderboard: rank, tie-break, friends-only, blocked exclusion, pinned viewer ----
set local role authenticated;
set local request.jwt.claims to '{"sub":"b9000000-0000-4000-8000-0000000000a1","role":"authenticated"}';

select is(
  (select count(*)::int from public.community_leaderboard('b9000000-0000-4000-8000-0000000000c9', 'all', 0, 'games', false, 50) where value = 3),
  2, 'a and b tie at 3 games');
select ok(
  (select rank from public.community_leaderboard('b9000000-0000-4000-8000-0000000000c9', 'all', 0, 'games', false, 50) where user_id = 'b9000000-0000-4000-8000-0000000000b1')
  <
  (select rank from public.community_leaderboard('b9000000-0000-4000-8000-0000000000c9', 'all', 0, 'games', false, 50) where user_id = 'b9000000-0000-4000-8000-0000000000a1'),
  'tied on value, b ranks above a: b''s third qualifying game happened earlier, so b got there first');

select is(
  (select count(*)::int from public.community_leaderboard('b9000000-0000-4000-8000-0000000000c9', 'all', 0, 'games', false, 50) where user_id = 'b9000000-0000-4000-8000-0000000000e1'),
  0, 'a blocked user never appears on a board read by whoever blocked them');

select is(
  (select array_agg(user_id order by user_id) from public.community_leaderboard('b9000000-0000-4000-8000-0000000000c9', 'all', 0, 'games', true, 50)),
  array['b9000000-0000-4000-8000-0000000000a1'::uuid, 'b9000000-0000-4000-8000-0000000000b1'::uuid],
  'friends-only keeps the viewer and the one person they follow, nobody else');

select is(
  (select rank from public.community_leaderboard('b9000000-0000-4000-8000-0000000000c9', 'all', 0, 'games', false, 1) where user_id = 'b9000000-0000-4000-8000-0000000000a1'),
  (select rank from public.community_leaderboard('b9000000-0000-4000-8000-0000000000c9', 'all', 0, 'games', false, 50) where user_id = 'b9000000-0000-4000-8000-0000000000a1'),
  'the viewer''s own row is still returned, with its real rank, even past a small page limit');

reset role;
select * from finish();
rollback;
