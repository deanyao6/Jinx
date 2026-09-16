begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

-- alice (Phillies fan) and jordan (Cowboys fan) are mutual follows; dave is a placeholder "Dad" who links later.
insert into auth.users (id, email) values
  ('a1000000-0000-4000-8000-0000000000a1', 'alice@example.com'),
  ('b2000000-0000-4000-8000-0000000000b2', 'jordan@example.com'),
  ('d4000000-0000-4000-8000-0000000000d4', 'dad@example.com');
update public.profiles set handle = 'alice', display_name = 'Alice', share_seats = true where id = 'a1000000-0000-4000-8000-0000000000a1';
update public.profiles set handle = 'jordan', display_name = 'Jordan', share_seats = true where id = 'b2000000-0000-4000-8000-0000000000b2';
update public.profiles set handle = 'dad' where id = 'd4000000-0000-4000-8000-0000000000d4';

insert into public.teams (id, sport_id, name, city, abbreviation, provider, provider_team_id, franchise_id) values
  ('00000000-0000-0000-0000-00000000a010', 'nfl', 'Philadelphia Eagles', 'Philadelphia', 'PHI', 'test', 'phi-nfl', 'nfl-eagles'),
  ('00000000-0000-0000-0000-00000000a011', 'nfl', 'Dallas Cowboys', 'Dallas', 'DAL', 'test', 'dal', 'nfl-cowboys');
insert into public.venues (id, key, name, city, state, lat, lng) values ('00000000-0000-0000-0000-00000000b010', 'linc', 'Lincoln Financial Field', 'Philadelphia', 'PA', 39.9008, -75.1675);
insert into public.games (id, sport_id, season, game_type, scheduled_start, venue_id, home_team_id, away_team_id, status, home_score, away_score, provider, provider_game_id) values
  ('00000000-0000-0000-0000-00000000c010', 'nfl', 2023, 'regular', '2023-11-05T21:25:00Z', '00000000-0000-0000-0000-00000000b010', '00000000-0000-0000-0000-00000000a010', '00000000-0000-0000-0000-00000000a011', 'final', 28, 23, 'test', 'g10'),
  ('00000000-0000-0000-0000-00000000c011', 'nfl', 2024, 'regular', '2024-12-29T18:00:00Z', '00000000-0000-0000-0000-00000000b010', '00000000-0000-0000-0000-00000000a010', '00000000-0000-0000-0000-00000000a011', 'final', 41, 7, 'test', 'g11'),
  ('00000000-0000-0000-0000-00000000c012', 'nfl', 2025, 'regular', '2025-09-14T17:00:00Z', '00000000-0000-0000-0000-00000000b010', '00000000-0000-0000-0000-00000000a010', '00000000-0000-0000-0000-00000000a011', 'final', 20, 24, 'test', 'g12');
insert into public.game_events (game_id, type) values ('00000000-0000-0000-0000-00000000c011', 'pick_six');

insert into public.user_teams (user_id, team_id) values
  ('a1000000-0000-4000-8000-0000000000a1', '00000000-0000-0000-0000-00000000a010'),
  ('b2000000-0000-4000-8000-0000000000b2', '00000000-0000-0000-0000-00000000a011');

-- Mutual follow established 2024-06-01 (so the 2023 game is "before you connected").
insert into public.follows (follower_id, followee_id, status, created_at, accepted_at) values
  ('a1000000-0000-4000-8000-0000000000a1', 'b2000000-0000-4000-8000-0000000000b2', 'active', '2024-06-01', '2024-06-01'),
  ('b2000000-0000-4000-8000-0000000000b2', 'a1000000-0000-4000-8000-0000000000a1', 'active', '2024-06-01', '2024-06-01');

-- Both attended all three games; seats 11 sections apart at the first.
insert into public.attendances (id, user_id, game_id, source) values
  ('00000000-0000-0000-0000-00000000d010', 'a1000000-0000-4000-8000-0000000000a1', '00000000-0000-0000-0000-00000000c010', 'manual'),
  ('00000000-0000-0000-0000-00000000d011', 'a1000000-0000-4000-8000-0000000000a1', '00000000-0000-0000-0000-00000000c011', 'manual'),
  ('00000000-0000-0000-0000-00000000d012', 'a1000000-0000-4000-8000-0000000000a1', '00000000-0000-0000-0000-00000000c012', 'manual'),
  ('00000000-0000-0000-0000-00000000d020', 'b2000000-0000-4000-8000-0000000000b2', '00000000-0000-0000-0000-00000000c010', 'manual'),
  ('00000000-0000-0000-0000-00000000d021', 'b2000000-0000-4000-8000-0000000000b2', '00000000-0000-0000-0000-00000000c011', 'manual'),
  ('00000000-0000-0000-0000-00000000d022', 'b2000000-0000-4000-8000-0000000000b2', '00000000-0000-0000-0000-00000000c012', 'manual');
insert into public.attendance_seats (attendance_id, section) values ('00000000-0000-0000-0000-00000000d010', '121'), ('00000000-0000-0000-0000-00000000d020', '132');

-- Alice's placeholder Dad tagged at two games.
insert into public.people (id, owner_user_id, display_name) values ('00000000-0000-0000-0000-00000000e010', 'a1000000-0000-4000-8000-0000000000a1', 'Dad');
insert into public.attendance_companions (attendance_id, person_id) values
  ('00000000-0000-0000-0000-00000000d010', '00000000-0000-0000-0000-00000000e010'),
  ('00000000-0000-0000-0000-00000000d011', '00000000-0000-0000-0000-00000000e010');

-- ---- alice's view
set local role authenticated;
set local request.jwt.claims to '{"sub":"a1000000-0000-4000-8000-0000000000a1","role":"authenticated"}';
select is((select my_wins || '-' || rival_wins from public.rivalries() where rival_handle = 'jordan'), '2-1', 'head-to-head tallies opposing sides');
select is((select my_meetings_attended from public.rivalries() where rival_handle = 'jordan'), 3, 'meetings attended');
select is((select count(*) from public.overlaps()), 3::bigint, 'overlap lists shared games');
select is((select before_connected from public.overlaps() where game_id = '00000000-0000-0000-0000-00000000c010'), true, 'games before the mutual follow are labeled');
select is((select section_gap from public.overlaps() where game_id = '00000000-0000-0000-0000-00000000c010'), 11, 'section gap when both share seats');
select is((select games from public.companion_records() where display_name = 'Dad'), 2, 'companion games');
select is((select wins || '-' || losses from public.companion_records() where display_name = 'Dad'), '2-0', 'companion record uses my side');
select is((select count(*) from public.feed(null, 50)), 8::bigint, 'feed shows own and followee events (3 logged + 1 stamp each)');
select is((select count(*) from public.mutuals_at_game('00000000-0000-0000-0000-00000000c011')), 1::bigint, 'mutuals at a game');
select is((select jsonb_array_length(public.goal_games('a1000000-0000-4000-8000-0000000000a1'))), 3, 'goal games for evaluator');
select is((select (public.goal_games('a1000000-0000-4000-8000-0000000000a1') -> 1 ->> 'isNewVenue')::boolean), false, 'second visit is not a new venue');
select is((select (public.goal_games('a1000000-0000-4000-8000-0000000000a1') -> 1 -> 'events')::jsonb), '["pick_six"]'::jsonb, 'events attached');
select is((select jsonb_array_length(public.my_wrapped('nfl', 2024) -> 'cards')), 10, 'wrapped has ten cards');
select is((select my_wrapped('nfl', 2024) -> 'cards' -> 0 ->> 'games'), '1', 'wrapped counts the season games');
-- invite Dad
create temp table _tok on commit drop as select public.create_person_invite('00000000-0000-0000-0000-00000000e010') as token;
select isnt((select token from _tok), null, 'invite token created');
reset role;

-- ---- dad accepts the invite and imports
set local role authenticated;
set local request.jwt.claims to '{"sub":"d4000000-0000-4000-8000-0000000000d4","role":"authenticated"}';
select is((select (public.accept_person_invite((select token from _tok)) ->> 'ok')::boolean), true, 'invite accepted');
select is((select count(*) from public.tagged_games_for_me('a1000000-0000-4000-8000-0000000000a1')), 2::bigint, 'tagged games offered for import');
select is(public.import_tagged_games('a1000000-0000-4000-8000-0000000000a1', array['00000000-0000-0000-0000-00000000c010'::uuid]), 1, 'import creates the chosen attendance');
reset role;

select * from finish();
rollback;
