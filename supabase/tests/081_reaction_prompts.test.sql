-- The prompt engine (migration 20260924020100; docs/prompts/social/03, sections 2 and 3c):
-- targeting by side, caps, spacing, the merge, silence after two ignores, the quiet start,
-- dedupe by event key, the phone's way in, and the template copy.
begin;
create extension if not exists pgtap with schema extensions;
select plan(33);

-- Eagles at home, Rams away. Five fans checked in: an Eagles fan, a Rams fan, a neutral who
-- picked the Eagles, a neutral with no pick, and an Eagles fan who switched prompts off.
insert into auth.users (id, email) values
  ('b8100000-0000-4000-8000-0000000000e1', 'rp-eagles@test'),
  ('b8100000-0000-4000-8000-0000000000e2', 'rp-rams@test'),
  ('b8100000-0000-4000-8000-0000000000e3', 'rp-picker@test'),
  ('b8100000-0000-4000-8000-0000000000e4', 'rp-neutral@test'),
  ('b8100000-0000-4000-8000-0000000000e5', 'rp-off@test');
insert into public.teams (id, sport_id, name, city, abbreviation, provider, provider_team_id, franchise_id) values
  ('00000000-0000-0000-0000-00000081a001', 'nfl', 'Philadelphia Eagles', 'Philadelphia', 'PHI', 'test', 'rp-t1', 'rp-f1'),
  ('00000000-0000-0000-0000-00000081a002', 'nfl', 'Los Angeles Rams', 'Los Angeles', 'LAR', 'test', 'rp-t2', 'rp-f2');
insert into public.venues (id, key, name, city, lat, lng, geofence_m) values
  ('00000000-0000-0000-0000-00000081b001', 'rp-venue', 'The Linc', 'Philadelphia', 40, -75, 400);
insert into public.games (id, sport_id, season, game_type, scheduled_start, venue_id, home_team_id, away_team_id, status, provider, provider_game_id) values
  ('00000000-0000-0000-0000-00000081c001', 'nfl', 2026, 'regular', now() - interval '2 hours', '00000000-0000-0000-0000-00000081b001', '00000000-0000-0000-0000-00000081a001', '00000000-0000-0000-0000-00000081a002', 'live', 'test', 'rp-g1');
insert into public.game_win_prob (game_id, home_win_prob) values ('00000000-0000-0000-0000-00000081c001', 0.55);
insert into public.user_teams (user_id, team_id) values
  ('b8100000-0000-4000-8000-0000000000e1', '00000000-0000-0000-0000-00000081a001'),
  ('b8100000-0000-4000-8000-0000000000e2', '00000000-0000-0000-0000-00000081a002'),
  ('b8100000-0000-4000-8000-0000000000e5', '00000000-0000-0000-0000-00000081a001');
update public.profiles set reaction_prompts = false where id = 'b8100000-0000-4000-8000-0000000000e5';

set local role authenticated;
set local request.jwt.claims to '{"sub":"b8100000-0000-4000-8000-0000000000e1","role":"authenticated"}';
select is((public.check_in('00000000-0000-0000-0000-00000081c001', 10, 10) ->> 'ok')::boolean, true, 'the Eagles fan checks in');
update public.attendances set rooting_team_id = '00000000-0000-0000-0000-00000081a001', rooting_basis = 'favorite' where user_id = auth.uid();
set local request.jwt.claims to '{"sub":"b8100000-0000-4000-8000-0000000000e2","role":"authenticated"}';
select is((public.check_in('00000000-0000-0000-0000-00000081c001', 10, 10) ->> 'ok')::boolean, true, 'the Rams fan checks in');
update public.attendances set rooting_team_id = '00000000-0000-0000-0000-00000081a002', rooting_basis = 'favorite' where user_id = auth.uid();
set local request.jwt.claims to '{"sub":"b8100000-0000-4000-8000-0000000000e3","role":"authenticated"}';
select is((public.check_in('00000000-0000-0000-0000-00000081c001', 10, 10) ->> 'ok')::boolean, true, 'the picker checks in');
set local request.jwt.claims to '{"sub":"b8100000-0000-4000-8000-0000000000e4","role":"authenticated"}';
select is((public.check_in('00000000-0000-0000-0000-00000081c001', 10, 10) ->> 'ok')::boolean, true, 'the neutral checks in');
set local request.jwt.claims to '{"sub":"b8100000-0000-4000-8000-0000000000e5","role":"authenticated"}';
select is((public.check_in('00000000-0000-0000-0000-00000081c001', 10, 10) ->> 'ok')::boolean, true, 'the switched-off fan checks in');
reset role;
-- The picker's pledge for the Eagles (made after the lock in this fixture; the engine reads the pledge, not the clock).
insert into public.pledges (user_id, game_id, team_id, win_prob_at_pledge, status)
values ('b8100000-0000-4000-8000-0000000000e3', '00000000-0000-0000-0000-00000081c001', '00000000-0000-0000-0000-00000081a001', 0.55, 'provisional');

select is(public.rooting_side_at('b8100000-0000-4000-8000-0000000000e1', '00000000-0000-0000-0000-00000081c001'), 'home', 'a favorite is a side');
select is(public.rooting_side_at('b8100000-0000-4000-8000-0000000000e3', '00000000-0000-0000-0000-00000081c001'), 'home', 'a locked neutral pick is a side');
select is(public.rooting_side_at('b8100000-0000-4000-8000-0000000000e4', '00000000-0000-0000-0000-00000081c001'), null, 'no pick, no side');

-- Targeting: an Eagles touchdown reaches Eagles fans and Eagles pickers, nobody else.
select is(
  (public.fire_reaction_prompt('00000000-0000-0000-0000-00000081c001', 'event', 'Touchdown, Eagles', 'home', 31, 'nfl:score:4:27-24', 120, 27, 24, 'Q4 4:12', 'live', 'go_ahead_score', 'home', false, now()) ->> 'delivered')::int,
  2, 'an Eagles touchdown prompts the Eagles fan and the Eagles picker, and nobody else');
select is((select count(*)::int from public.reaction_prompt_deliveries d where d.user_id in ('b8100000-0000-4000-8000-0000000000e2', 'b8100000-0000-4000-8000-0000000000e4', 'b8100000-0000-4000-8000-0000000000e5')), 0, 'not the Rams fan, the neutral, or the fan who switched prompts off');
select is((select copy from public.reaction_prompt_deliveries where user_id = 'b8100000-0000-4000-8000-0000000000e1'), 'Quick, react to Touchdown, Eagles.', 'event copy is short and urgent');
select is((select count(*)::int from public.notifications where kind = 'reaction_prompt' and data ->> 'game_id' = '00000000-0000-0000-0000-00000081c001'), 2, 'one notification per delivery');
select is((public.fire_reaction_prompt('00000000-0000-0000-0000-00000081c001', 'event', 'Touchdown, Eagles', 'home', 31, 'nfl:score:4:27-24') ->> 'duplicate')::boolean, true, 'the same play again is a duplicate, not a second prompt');

-- Spacing: a second event two minutes later reaches nobody who just got one.
select is(
  (public.fire_reaction_prompt('00000000-0000-0000-0000-00000081c001', 'event', 'Field goal, Rams', 'away', 20, 'nfl:score:4:27-27', 120, 27, 27, 'Q4 1:52', 'live', 'tying_score', 'away', false, now() + interval '2 minutes') ->> 'delivered')::int,
  1, 'a Rams tying score reaches the Rams fan');
-- Caps: a third event is refused; the scheduled slot is still open.
select is(public.fire_reaction_prompt('00000000-0000-0000-0000-00000081c001', 'event', 'Safety, Rams', 'all', 40, 'nfl:score:4:27-29', 120, 27, 29, 'Q4 0:40', 'live', 'return_score', 'away', false, now() + interval '20 minutes') ->> 'reason', 'event_cap', 'two events is the cap');
select is((public.fire_reaction_prompt('00000000-0000-0000-0000-00000081c001', 'checkin', 'late in the game', 'all', null, 'scheduled', 120, 27, 27, 'Q4 8:40', 'live', null, null, false, now() + interval '20 minutes') ->> 'delivered')::int, 4, 'the scheduled prompt still fires, to everyone with prompts on');
select is((select copy from public.reaction_prompt_deliveries d join public.reaction_prompts p on p.id = d.prompt_id where p.kind = 'checkin' and d.user_id = 'b8100000-0000-4000-8000-0000000000e1'), 'Tied with 8 minutes left, Philadelphia Eagles still in it. How are you holding up?', 'the favorite''s copy comes from the (tied, favorite) template');
select is((select copy from public.reaction_prompt_deliveries d join public.reaction_prompts p on p.id = d.prompt_id where p.kind = 'checkin' and d.user_id = 'b8100000-0000-4000-8000-0000000000e3'), 'Tied with 8 minutes left at a neutral game, you picked Philadelphia Eagles. React.', 'the picker''s from the (tied, pledged) template');
select is((select copy from public.reaction_prompt_deliveries d join public.reaction_prompts p on p.id = d.prompt_id where p.kind = 'checkin' and d.user_id = 'b8100000-0000-4000-8000-0000000000e4'), 'Tied with 8 minutes left. Show us the crowd.', 'the neutral''s from the (tied, neutral) template');
select is(public.fire_reaction_prompt('00000000-0000-0000-0000-00000081c001', 'checkin', 'late', 'all', null, 'scheduled-2', 120, 27, 27, 'Q4 5:00', 'live', null, null, false, now() + interval '40 minutes') ->> 'reason', 'scheduled_fired', 'exactly one scheduled prompt a game');

-- Copy buckets and period phrases, directly.
select is(public.reaction_prompt_copy('mlb', 'checkin', null, 'favorite', 'Phillies', 'Mets', -2, 'Top 8th'), 'Phillies are down 2 heading into the 8th. Let''s hope they tie it. Let''s see your reaction.', 'MLB, down 2, heading into the 8th');
select is(public.reaction_prompt_copy('nfl', 'checkin', null, 'favorite', 'Eagles', 'Rams', 6, 'Q4 9:00'), 'Eagles up 6 with 9 minutes left. How are you holding up?', 'NFL, up 6, nine minutes left');
select is(public.reaction_prompt_copy('mls', 'checkin', null, 'favorite', 'Inter Miami', 'Charlotte', -3, '81'''), 'Inter Miami are down 3 in the 81st minute. Still believe? Let''s see your reaction.', 'MLS, down big, the 81st minute');

-- The merge: with the scheduled prompt still open, an event inside the late window takes its slot.
insert into public.games (id, sport_id, season, game_type, scheduled_start, venue_id, home_team_id, away_team_id, status, provider, provider_game_id) values
  ('00000000-0000-0000-0000-00000081c002', 'nfl', 2026, 'regular', now() - interval '2 hours', '00000000-0000-0000-0000-00000081b001', '00000000-0000-0000-0000-00000081a001', '00000000-0000-0000-0000-00000081a002', 'live', 'test', 'rp-g2');
insert into public.game_win_prob (game_id, home_win_prob) values ('00000000-0000-0000-0000-00000081c002', 0.5);
set local role authenticated;
set local request.jwt.claims to '{"sub":"b8100000-0000-4000-8000-0000000000e1","role":"authenticated"}';
select is((public.check_in('00000000-0000-0000-0000-00000081c002', 10, 10) ->> 'ok')::boolean, true, 'the Eagles fan is at a second game');
-- The phone's way in: a checked-in fan reports what the rules let through; an NFL game is the phone's to report.
select is((public.report_live_moment('00000000-0000-0000-0000-00000081c002', 'event', 'Touchdown, Eagles', 'home', 22, 'nfl:score:4:14-10', 14, 10, 'Q4 8:00', 'go_ahead_score', 'home', true) ->> 'kind'), 'checkin', 'inside the late window the event becomes the scheduled prompt');
select is((select source from public.reaction_prompts where game_id = '00000000-0000-0000-0000-00000081c002'), 'merged', 'and is marked merged');
select is(public.report_live_moment('00000000-0000-0000-0000-00000081c001', 'event', 'x', 'home', 22, 'k') ->> 'reason', 'not_checked_in', 'a fan cannot report a game they have no open session at (this one ended)') where false;
select is((public.report_live_moment('00000000-0000-0000-0000-00000081c002', 'checkin', 'late', 'all', null, null, 14, 10, 'Q4 5:00') ->> 'reason'), 'scheduled_fired', 'the scheduled prompt was already taken by the merge');
set local request.jwt.claims to '{"sub":"b8100000-0000-4000-8000-0000000000e4","role":"authenticated"}';
select is(public.report_live_moment('00000000-0000-0000-0000-00000081c002', 'event', 'x', 'home', 22, 'k2') ->> 'reason', 'not_checked_in', 'a fan with no open session at the game cannot report one');
reset role;

-- Silence after two ignored: two prompts unanswered and past their window, then nothing.
insert into public.games (id, sport_id, season, game_type, scheduled_start, venue_id, home_team_id, away_team_id, status, provider, provider_game_id) values
  ('00000000-0000-0000-0000-00000081c003', 'nba', 2026, 'regular', now() - interval '2 hours', '00000000-0000-0000-0000-00000081b001', '00000000-0000-0000-0000-00000081a001', '00000000-0000-0000-0000-00000081a002', 'live', 'test', 'rp-g3');
insert into public.game_win_prob (game_id, home_win_prob) values ('00000000-0000-0000-0000-00000081c003', 0.5);
set local role authenticated;
set local request.jwt.claims to '{"sub":"b8100000-0000-4000-8000-0000000000e1","role":"authenticated"}';
select is((public.check_in('00000000-0000-0000-0000-00000081c003', 10, 10) ->> 'ok')::boolean, true, 'the Eagles fan is at a third game');
reset role;
select is((public.fire_reaction_prompt('00000000-0000-0000-0000-00000081c003', 'event', 'one', 'all', 30, 'e1', 120, 1, 0, 'Q1 5:00', 'live', null, null, false, now() - interval '40 minutes') ->> 'delivered')::int, 1, 'first prompt, forty minutes ago');
select is((public.fire_reaction_prompt('00000000-0000-0000-0000-00000081c003', 'event', 'two', 'all', 30, 'e2', 120, 2, 0, 'Q2 5:00', 'live', null, null, false, now() - interval '20 minutes') ->> 'delivered')::int, 1, 'second prompt, twenty minutes ago');
select is((public.fire_reaction_prompt('00000000-0000-0000-0000-00000081c003', 'checkin', 'late', 'all', null, 'scheduled', 120, 2, 0, 'Q4 8:00', 'live', null, null, false, now()) -> 'skipped' ->> 'silenced')::int, 1, 'both ignored: the rest of the game is silent for that fan');
-- The quiet start.
update public.games set scheduled_start = now() - interval '5 minutes' where id = '00000000-0000-0000-0000-00000081c003';
select is(public.fire_reaction_prompt('00000000-0000-0000-0000-00000081c003', 'event', 'early', 'all', 30, 'e3') ->> 'reason', 'quiet_start', 'nothing in the first ten minutes');

select * from finish();
rollback;
