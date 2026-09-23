-- Communities (migration 20260924000700; docs/prompts/social/01, section 4): membership is
-- public (minus blocks), you join as a member and leave yourself, the member count is kept by
-- trigger, community posts follow their post and a private community's need membership, and
-- leaderboards are for members and written by the server alone.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (id, email) values
  ('b6600000-0000-4000-8000-0000000000a1', 'cm-a@test'),
  ('b6600000-0000-4000-8000-0000000000b1', 'cm-b@test'),
  ('b6600000-0000-4000-8000-0000000000e1', 'cm-x@test');
insert into public.blocks (blocker_id, blocked_id) values ('b6600000-0000-4000-8000-0000000000e1', 'b6600000-0000-4000-8000-0000000000a1');
insert into public.teams (id, sport_id, name, city, abbreviation, provider, provider_team_id, franchise_id)
values ('00000000-0000-0000-0000-00000066a001', 'nba', 'Club Team', 'Club', 'CLB', 'test', 'cm-t1', 'cm-f1');
insert into public.communities (id, slug, name, kind, team_id) values
  ('b6600000-0000-4000-8000-0000000000c1', 'nba-club-team', 'Club Team fans', 'team', '00000000-0000-0000-0000-00000066a001');
insert into public.communities (id, slug, name, kind, is_official, is_private) values
  ('b6600000-0000-4000-8000-0000000000c2', 'secret-club', 'Secret club', 'custom', false, true);
insert into public.posts (id, author_id, kind, visibility) values
  ('b6600000-0000-4000-8000-0000000000d1', 'b6600000-0000-4000-8000-0000000000a1', 'milestone', 'public'),
  ('b6600000-0000-4000-8000-0000000000d2', 'b6600000-0000-4000-8000-0000000000b1', 'milestone', 'public');

select throws_ok(
  $$insert into public.communities (slug, name, kind) values ('team-without-team', 'X', 'team')$$,
  '23514', null, 'a team community names its team');

set local role authenticated;
set local request.jwt.claims to '{"sub":"b6600000-0000-4000-8000-0000000000a1","role":"authenticated"}';
select throws_ok(
  $$insert into public.communities (slug, name, kind) values ('mine', 'Mine', 'custom')$$,
  '42501', null, 'communities are the server''s to create at launch');
select throws_ok(
  $$insert into public.community_members (community_id, user_id, role) values ('b6600000-0000-4000-8000-0000000000c1', auth.uid(), 'owner')$$,
  '42501', null, 'nobody makes themselves an owner');
insert into public.community_members (community_id, user_id) values ('b6600000-0000-4000-8000-0000000000c1', auth.uid());
select is((select member_count from public.communities where id = 'b6600000-0000-4000-8000-0000000000c1'), 1, 'joining counts a member');
-- Seeded after the join (prompt 4, social v2): joining recomputes this user's real leaderboard
-- rows for the community, which would otherwise wipe a row seeded before it.
reset role;
insert into public.leaderboard_stats (user_id, community_id, period, season, stat_key, value)
values ('b6600000-0000-4000-8000-0000000000a1', 'b6600000-0000-4000-8000-0000000000c1', 'season', 2026, 'games', 7);
set local role authenticated;
set local request.jwt.claims to '{"sub":"b6600000-0000-4000-8000-0000000000a1","role":"authenticated"}';
select throws_ok(
  $$insert into public.community_members (community_id, user_id) values ('b6600000-0000-4000-8000-0000000000c2', auth.uid())$$,
  '42501', null, 'a private community cannot be joined by yourself');
select throws_ok(
  $$insert into public.community_members (community_id, user_id) values ('b6600000-0000-4000-8000-0000000000c1', 'b6600000-0000-4000-8000-0000000000b1')$$,
  '42501', null, 'nobody joins someone else up');
select is((select count(*)::int from public.leaderboard_stats where community_id = 'b6600000-0000-4000-8000-0000000000c1'), 1, 'a member reads the leaderboard');
update public.leaderboard_stats set value = 999 where user_id = auth.uid();
reset role;
select is((select value from public.leaderboard_stats where user_id = 'b6600000-0000-4000-8000-0000000000a1'), 7::numeric, 'and cannot write their own row');
set local role authenticated;
set local request.jwt.claims to '{"sub":"b6600000-0000-4000-8000-0000000000a1","role":"authenticated"}';

insert into public.community_posts (community_id, post_id) values ('b6600000-0000-4000-8000-0000000000c1', 'b6600000-0000-4000-8000-0000000000d1');
select throws_ok(
  $$insert into public.community_posts (community_id, post_id) values ('b6600000-0000-4000-8000-0000000000c1', 'b6600000-0000-4000-8000-0000000000d2')$$,
  '42501', null, 'a member files only their own posts');

set local request.jwt.claims to '{"sub":"b6600000-0000-4000-8000-0000000000b1","role":"authenticated"}';
select is((select count(*)::int from public.community_members where community_id = 'b6600000-0000-4000-8000-0000000000c1'), 1, 'membership is public');
select is((select count(*)::int from public.leaderboard_stats), 0, 'a non-member does not read the leaderboard');
select is((select count(*)::int from public.community_posts), 1, 'a community post shows with its post, to members and not');

set local request.jwt.claims to '{"sub":"b6600000-0000-4000-8000-0000000000e1","role":"authenticated"}';
select is((select count(*)::int from public.community_members where community_id = 'b6600000-0000-4000-8000-0000000000c1'), 0, 'a member someone blocked is hidden from them');

set local request.jwt.claims to '{"sub":"b6600000-0000-4000-8000-0000000000a1","role":"authenticated"}';
delete from public.community_members where community_id = 'b6600000-0000-4000-8000-0000000000c1' and user_id = auth.uid();
reset role;
select is((select member_count from public.communities where id = 'b6600000-0000-4000-8000-0000000000c1'), 0, 'leaving takes the count back down');

select * from finish();
rollback;
