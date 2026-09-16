begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

-- Fixture: one user who follows the Phillies (mlb-143 franchise) and the Rams via the current LA row,
-- attending a mix of wins, losses, a tie, a postponed game, a neutral game, and a relocated-franchise game.
insert into auth.users (id, email) values ('a1000000-0000-4000-8000-0000000000a1', 'alice@example.com');

insert into public.teams (id, sport_id, name, city, abbreviation, provider, provider_team_id, franchise_id, active) values
  ('00000000-0000-0000-0000-00000000a001', 'mlb', 'Philadelphia Phillies', 'Philadelphia', 'PHI', 'test', 'phi', 'mlb-143', true),
  ('00000000-0000-0000-0000-00000000a002', 'mlb', 'New York Mets', 'New York', 'NYM', 'test', 'nym', 'mlb-121', true),
  ('00000000-0000-0000-0000-00000000a003', 'nfl', 'Los Angeles Rams', 'Los Angeles', 'LA', 'test', 'la', 'nfl-rams', true),
  ('00000000-0000-0000-0000-00000000a004', 'nfl', 'St. Louis Rams', 'St. Louis', 'STL', 'test', 'stl', 'nfl-rams', false),
  ('00000000-0000-0000-0000-00000000a005', 'nfl', 'Seattle Seahawks', 'Seattle', 'SEA', 'test', 'sea', 'nfl-seahawks', true),
  ('00000000-0000-0000-0000-00000000a006', 'nfl', 'Chicago Bears', 'Chicago', 'CHI', 'test', 'chi', 'nfl-bears', true),
  ('00000000-0000-0000-0000-00000000a007', 'nfl', 'Green Bay Packers', 'Green Bay', 'GB', 'test', 'gb', 'nfl-packers', true);
insert into public.venues (id, key, name, city, state, lat, lng) values
  ('00000000-0000-0000-0000-00000000b001', 'cbp', 'Citizens Bank Park', 'Philadelphia', 'PA', 39.9057, -75.1665),
  ('00000000-0000-0000-0000-00000000b002', 'citi', 'Citi Field', 'Queens', 'NY', 40.7571, -73.8458),
  ('00000000-0000-0000-0000-00000000b003', 'dome', 'The Dome at America''s Center', 'St. Louis', 'MO', 38.6328, -90.1886),
  ('00000000-0000-0000-0000-00000000b004', 'soldier', 'Soldier Field', 'Chicago', 'IL', 41.8623, -87.6167);

insert into public.games (id, sport_id, season, game_type, scheduled_start, venue_id, home_team_id, away_team_id, status, home_score, away_score, temperature_f, duration_minutes, provider, provider_game_id) values
  ('00000000-0000-0000-0000-00000000c001', 'mlb', 2024, 'regular', '2024-04-01T23:05:00Z', '00000000-0000-0000-0000-00000000b001', '00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-00000000a002', 'final', 5, 2, 48, 160, 'test', 'g1'),
  ('00000000-0000-0000-0000-00000000c002', 'mlb', 2024, 'regular', '2024-04-02T23:05:00Z', '00000000-0000-0000-0000-00000000b001', '00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-00000000a002', 'final', 1, 4, 55, 150, 'test', 'g2'),
  ('00000000-0000-0000-0000-00000000c003', 'mlb', 2024, 'preseason', '2024-03-02T18:05:00Z', '00000000-0000-0000-0000-00000000b002', '00000000-0000-0000-0000-00000000a002', '00000000-0000-0000-0000-00000000a001', 'final', 3, 3, 81, 170, 'test', 'g3'),
  ('00000000-0000-0000-0000-00000000c004', 'mlb', 2024, 'regular', '2024-04-04T23:05:00Z', '00000000-0000-0000-0000-00000000b001', '00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-00000000a002', 'postponed', null, null, null, null, 'test', 'g4'),
  ('00000000-0000-0000-0000-00000000c005', 'nfl', 2015, 'regular', '2015-09-13T20:25:00Z', '00000000-0000-0000-0000-00000000b003', '00000000-0000-0000-0000-00000000a004', '00000000-0000-0000-0000-00000000a005', 'final', 34, 31, 72, null, 'test', 'g5'),
  ('00000000-0000-0000-0000-00000000c006', 'nfl', 2024, 'regular', '2024-11-17T18:00:00Z', '00000000-0000-0000-0000-00000000b004', '00000000-0000-0000-0000-00000000a006', '00000000-0000-0000-0000-00000000a007', 'final', 19, 20, 19, null, 'test', 'g6');

-- Comeback timeline for g1: Phillies trailed 0-2 then won 5-2.
insert into public.game_scoring_timeline (game_id, seq, period, half, home_score, away_score, scoring_side, description) values
  ('00000000-0000-0000-0000-00000000c001', 1, 1, 'top', 0, 2, 'away', 'two-run homer'),
  ('00000000-0000-0000-0000-00000000c001', 2, 6, 'bottom', 3, 2, 'home', 'three-run homer'),
  ('00000000-0000-0000-0000-00000000c001', 3, 8, 'bottom', 5, 2, 'home', 'two-run double');
insert into public.players (id, sport_id, full_name, provider, provider_player_id) values
  ('00000000-0000-0000-0000-00000000f001', 'mlb', 'Bryce Harper', 'test', 'harper'),
  ('00000000-0000-0000-0000-00000000f002', 'mlb', 'Francisco Lindor', 'test', 'lindor');
insert into public.game_appearances (game_id, player_id, team_id) values
  ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-00000000a001'),
  ('00000000-0000-0000-0000-00000000c002', '00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-00000000a001'),
  ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000f002', '00000000-0000-0000-0000-00000000a002');
insert into public.game_events (game_id, type, team_id) values ('00000000-0000-0000-0000-00000000c002', 'walk_off', '00000000-0000-0000-0000-00000000a002');

-- Follows Phillies and (current) LA Rams.
insert into public.user_teams (user_id, team_id) values
  ('a1000000-0000-4000-8000-0000000000a1', '00000000-0000-0000-0000-00000000a001'),
  ('a1000000-0000-4000-8000-0000000000a1', '00000000-0000-0000-0000-00000000a003');

insert into public.attendances (user_id, game_id, source) values
  ('a1000000-0000-4000-8000-0000000000a1', '00000000-0000-0000-0000-00000000c001', 'manual'),
  ('a1000000-0000-4000-8000-0000000000a1', '00000000-0000-0000-0000-00000000c002', 'manual'),
  ('a1000000-0000-4000-8000-0000000000a1', '00000000-0000-0000-0000-00000000c003', 'manual'),
  ('a1000000-0000-4000-8000-0000000000a1', '00000000-0000-0000-0000-00000000c004', 'manual'),
  ('a1000000-0000-4000-8000-0000000000a1', '00000000-0000-0000-0000-00000000c005', 'manual'),
  ('a1000000-0000-4000-8000-0000000000a1', '00000000-0000-0000-0000-00000000c006', 'manual');

-- Rooting side trigger
select is((select rooting_basis from public.attendances where game_id = '00000000-0000-0000-0000-00000000c001'), 'favorite', 'single favorite -> favorite basis');
select is((select rooting_team_id from public.attendances where game_id = '00000000-0000-0000-0000-00000000c005'), '00000000-0000-0000-0000-00000000a004'::uuid, 'relocated franchise (STL Rams) counts for LA Rams fan');
select is((select rooting_team_id from public.attendances where game_id = '00000000-0000-0000-0000-00000000c006'), null, 'neutral game has no side');

-- Records
select is((select payload -> 'overall' from public.user_stats_cache where user_id = 'a1000000-0000-4000-8000-0000000000a1'),
  '{"wins": 2, "losses": 1, "ties": 1}'::jsonb, 'overall record counts wins, losses, ties; skips postponed and neutral');
select is((select (payload -> 'totals' ->> 'games')::int from public.user_stats_cache where user_id = 'a1000000-0000-4000-8000-0000000000a1'), 5, 'totals count every final game including neutral');
select is((select (payload -> 'totals' ->> 'venues')::int from public.user_stats_cache where user_id = 'a1000000-0000-4000-8000-0000000000a1'), 4, 'venue count');
select is((select t -> 'record' from public.user_stats_cache, jsonb_array_elements(payload -> 'teams') t where user_id = 'a1000000-0000-4000-8000-0000000000a1' and t ->> 'franchise_id' = 'mlb-143'),
  '{"wins": 1, "losses": 1, "ties": 1}'::jsonb, 'Phillies team record');
select is((select t -> 'record' from public.user_stats_cache, jsonb_array_elements(payload -> 'teams') t where user_id = 'a1000000-0000-4000-8000-0000000000a1' and t ->> 'franchise_id' = 'nfl-rams'),
  '{"wins": 1, "losses": 0, "ties": 0}'::jsonb, 'Rams team record includes the St. Louis era');
select is((select payload -> 'superlatives' -> 'coldest' ->> 'value' from public.user_stats_cache where user_id = 'a1000000-0000-4000-8000-0000000000a1'), '19', 'coldest game');
select is((select payload -> 'superlatives' -> 'biggest_comeback' ->> 'deficit' from public.user_stats_cache where user_id = 'a1000000-0000-4000-8000-0000000000a1'), '2', 'biggest comeback from the timeline');
select is((select payload -> 'superlatives' -> 'most_seen_player' ->> 'name' from public.user_stats_cache where user_id = 'a1000000-0000-4000-8000-0000000000a1'), 'Bryce Harper', 'most seen player');
select is((select payload -> 'streaks' ->> 'longest_loss' from public.user_stats_cache where user_id = 'a1000000-0000-4000-8000-0000000000a1'), '1', 'streaks');
select is((select jsonb_array_length(payload -> 'stamps') from public.user_stats_cache where user_id = 'a1000000-0000-4000-8000-0000000000a1'), 4, 'one stamp per venue');
select is((select count(*) from public.feed_events where actor_user_id = 'a1000000-0000-4000-8000-0000000000a1' and type = 'new_stamp'), 4::bigint, 'new stamp feed events');

-- Unfollowing the Phillies recolors history: their games become neutral.
delete from public.user_teams where user_id = 'a1000000-0000-4000-8000-0000000000a1' and team_id = '00000000-0000-0000-0000-00000000a001';
select is((select payload -> 'overall' from public.user_stats_cache where user_id = 'a1000000-0000-4000-8000-0000000000a1'),
  '{"wins": 1, "losses": 0, "ties": 0}'::jsonb, 'favorites evaluated as of now');

-- Both favorites: needs a choice, then honors it.
insert into public.user_teams (user_id, team_id) values ('a1000000-0000-4000-8000-0000000000a1', '00000000-0000-0000-0000-00000000a001'), ('a1000000-0000-4000-8000-0000000000a1', '00000000-0000-0000-0000-00000000a002');
select is((select rooting_basis from public.attendances where game_id = '00000000-0000-0000-0000-00000000c001'), null, 'both favorites -> no side until chosen');
update public.attendances set rooting_team_id = '00000000-0000-0000-0000-00000000a002', rooting_basis = 'chosen' where game_id = '00000000-0000-0000-0000-00000000c001';

-- Superlatives survive missing data: strip temperatures and the home city, keep the rest.
update public.games set temperature_f = null where provider = 'test';
select public.refresh_user_stats('a1000000-0000-4000-8000-0000000000a1');
select is((select payload -> 'superlatives' ? 'coldest' from public.user_stats_cache where user_id = 'a1000000-0000-4000-8000-0000000000a1'), false, 'no temperature: no coldest');
select is((select payload -> 'superlatives' ? 'first_game' from public.user_stats_cache where user_id = 'a1000000-0000-4000-8000-0000000000a1'), true, 'other superlatives still present');

select * from finish();
rollback;
