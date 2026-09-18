-- team_rosters and the roster-aware team_roster RPC (SPEC.md 5.1, 6.9).
--
-- Fixtures are this file's own (the database is not empty; see 006). Two teams: one with a
-- roster and one without, so the fallback is tested against a real absence rather than assumed.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (id, email, aud, role)
values ('a1000000-0000-4000-8000-0000000000e1', 'roster-fan@test', 'authenticated', 'authenticated'),
       ('a1000000-0000-4000-8000-0000000000e2', 'roster-other@test', 'authenticated', 'authenticated')
on conflict (id) do nothing;

insert into public.profiles (id, handle, display_name, is_private)
values ('a1000000-0000-4000-8000-0000000000e1', 'rosterfan', 'Roster Fan', false),
       ('a1000000-0000-4000-8000-0000000000e2', 'rosterother', 'Roster Other', false)
on conflict (id) do nothing;

-- Four players:
--   e1 Current Starter: on the roster, has appeared, seen by the fan
--   e2 Fresh Signing:   on the roster, never appeared for anyone (a new arrival)
--   e3 Traded Away:     off the roster, appeared, seen by the fan
--   e4 Forgotten Bench: off the roster, appeared, seen by nobody
insert into public.players (id, sport_id, full_name, provider, provider_player_id)
values ('00000000-0000-0000-0000-0000000000e1', 'mlb', 'Current Starter', 'test', 'ros-p1'),
       ('00000000-0000-0000-0000-0000000000e2', 'mlb', 'Fresh Signing', 'test', 'ros-p2'),
       ('00000000-0000-0000-0000-0000000000e3', 'mlb', 'Traded Away', 'test', 'ros-p3'),
       ('00000000-0000-0000-0000-0000000000e4', 'mlb', 'Forgotten Bench', 'test', 'ros-p4')
on conflict (provider, provider_player_id) do nothing;

insert into public.venues (id, key, name) values ('00000000-0000-0000-0000-0000000000eb', 'ros-venue', 'Roster Park')
on conflict (key) do nothing;

insert into public.teams (id, sport_id, name, city, abbreviation, provider, provider_team_id, franchise_id)
values ('00000000-0000-0000-0000-0000000000ea', 'mlb', 'Roster Nine', 'Testville', 'ROS', 'test', 'ros-t1', 'ros-f1'),
       ('00000000-0000-0000-0000-0000000000ed', 'mlb', 'Defunct Nine', 'Nowhere', 'DEF', 'test', 'ros-t2', 'ros-f2')
on conflict (provider, provider_team_id) do nothing;

-- Two games: one the fan attended, one nobody did.
insert into public.games (id, sport_id, season, game_type, scheduled_start, venue_id, home_team_id, away_team_id, status, home_score, away_score, provider, provider_game_id)
values ('00000000-0000-0000-0000-0000000000ec', 'mlb', 2025, 'regular', '2025-05-01T18:00:00Z',
        '00000000-0000-0000-0000-0000000000eb', '00000000-0000-0000-0000-0000000000ea',
        '00000000-0000-0000-0000-0000000000ed', 'final', 3, 2, 'test', 'ros-g1'),
       ('00000000-0000-0000-0000-0000000000ee', 'mlb', 2025, 'regular', '2025-05-02T18:00:00Z',
        '00000000-0000-0000-0000-0000000000eb', '00000000-0000-0000-0000-0000000000ea',
        '00000000-0000-0000-0000-0000000000ed', 'final', 1, 0, 'test', 'ros-g2')
on conflict (provider, provider_game_id) do nothing;

insert into public.game_appearances (game_id, player_id, team_id) values
  -- attended game: starter and the traded player, for Roster Nine
  ('00000000-0000-0000-0000-0000000000ec', '00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000ea'),
  ('00000000-0000-0000-0000-0000000000ec', '00000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-0000000000ea'),
  -- the same game, but the bench player played for the OTHER side (Defunct Nine)
  ('00000000-0000-0000-0000-0000000000ec', '00000000-0000-0000-0000-0000000000e4', '00000000-0000-0000-0000-0000000000ed'),
  -- unattended game: bench player for Roster Nine
  ('00000000-0000-0000-0000-0000000000ee', '00000000-0000-0000-0000-0000000000e4', '00000000-0000-0000-0000-0000000000ea')
on conflict do nothing;

insert into public.attendances (user_id, game_id, source, status)
values ('a1000000-0000-4000-8000-0000000000e1', '00000000-0000-0000-0000-0000000000ec', 'manual', 'attended');

-- Roster Nine has two seasons of roster; only the latest counts. Traded Away was on last
-- season's, which must not keep him "on roster" now.
insert into public.team_rosters (team_id, player_id, season, position, jersey, status) values
  ('00000000-0000-0000-0000-0000000000ea', '00000000-0000-0000-0000-0000000000e1', 2025, 'SS', '7', 'A'),
  ('00000000-0000-0000-0000-0000000000ea', '00000000-0000-0000-0000-0000000000e3', 2025, 'P', '45', 'A'),
  ('00000000-0000-0000-0000-0000000000ea', '00000000-0000-0000-0000-0000000000e1', 2026, 'SS', '7', 'A'),
  ('00000000-0000-0000-0000-0000000000ea', '00000000-0000-0000-0000-0000000000e2', 2026, 'C', '12', 'D15');

-- ---------------------------------------------------------------------------
-- The fan's view.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"a1000000-0000-4000-8000-0000000000e1","role":"authenticated"}';

select is((select count(*) from public.team_roster('00000000-0000-0000-0000-0000000000ea')),
  3::bigint, 'the roster is the current season plus players you have seen');

select is((select on_roster from public.team_roster('00000000-0000-0000-0000-0000000000ea')
           where full_name = 'Current Starter'), true,
  'a current player is on_roster');

select is((select position from public.team_roster('00000000-0000-0000-0000-0000000000ea')
           where full_name = 'Current Starter'), 'SS',
  'a current player carries the roster position');

select is((select on_roster from public.team_roster('00000000-0000-0000-0000-0000000000ea')
           where full_name = 'Fresh Signing'), true,
  'a current player who has never appeared still shows');

select is((select appearances from public.team_roster('00000000-0000-0000-0000-0000000000ea')
           where full_name = 'Fresh Signing'), 0::bigint,
  'and has zero appearances rather than being dropped');

select is((select on_roster from public.team_roster('00000000-0000-0000-0000-0000000000ea')
           where full_name = 'Traded Away'), false,
  'a player you saw who has since left shows with on_roster false');

select is((select seen_by_you from public.team_roster('00000000-0000-0000-0000-0000000000ea')
           where full_name = 'Traded Away'), 1::bigint,
  'and keeps the seen-by-you count');

select is((select count(*) from public.team_roster('00000000-0000-0000-0000-0000000000ea')
           where full_name = 'Forgotten Bench'), 0::bigint,
  'someone neither on the roster nor seen by you does not show');

select results_eq(
  $$select full_name from public.team_roster('00000000-0000-0000-0000-0000000000ea')$$,
  $$values ('Current Starter'), ('Traded Away'), ('Fresh Signing')$$,
  'seen first, then the roster, then by appearances and name');

select is((select count(*) from public.team_roster('00000000-0000-0000-0000-0000000000ea', 'fresh')),
  1::bigint, 'the search filters roster rows by name too');

-- A team with no roster rows: everyone who ever appeared, as before.
select is((select count(*) from public.team_roster('00000000-0000-0000-0000-0000000000ed')),
  1::bigint, 'a team with no roster falls back to appearances');

select is((select on_roster from public.team_roster('00000000-0000-0000-0000-0000000000ed')
           where full_name = 'Forgotten Bench'), false,
  'fallback rows are not on_roster');

-- RLS: reference data is readable, not writable.
select is((select count(*) from public.team_rosters where team_id = '00000000-0000-0000-0000-0000000000ea'),
  4::bigint, 'authenticated can read team_rosters');

select throws_ok($$insert into public.team_rosters (team_id, player_id, season)
  values ('00000000-0000-0000-0000-0000000000ea', '00000000-0000-0000-0000-0000000000e4', 2026)$$,
  '42501', null, 'authenticated cannot write team_rosters');

reset role;

select * from finish();
rollback;
