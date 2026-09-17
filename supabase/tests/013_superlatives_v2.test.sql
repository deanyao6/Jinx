-- Superlatives v2 (20260917000600): the favourite player seen most, the comeback by win
-- probability, the largest crowd, the highest stadium, and a game to open behind every venue row.
--
-- Scoped to this file's fixtures: the local database holds 82,000 real games.
begin;
create extension if not exists pgtap with schema extensions;
select plan(28);

insert into auth.users (id, email) values
  ('a1000000-0000-4000-8000-000000000d01', 'sup-fan@example.com'),
  ('a1000000-0000-4000-8000-000000000d02', 'sup-other@example.com');

insert into public.teams (id, sport_id, name, city, abbreviation, provider, provider_team_id, franchise_id, active) values
  ('00000000-0000-0000-0000-0000000d0a01', 'mlb', 'Sup Phillies', 'Philadelphia', 'SPH', 'test', 'sup-phi', 'sup-phi', true),
  ('00000000-0000-0000-0000-0000000d0a02', 'mlb', 'Sup Mets', 'New York', 'SNY', 'test', 'sup-nym', 'sup-nym', true);

-- `low` sits one foot under the altitude threshold; `flat` has no elevation at all.
insert into public.venues (id, key, name, city, state, lat, lng, elevation_ft) values
  ('00000000-0000-0000-0000-0000000d0b01', 'sup-low', 'Sup Low Park', 'Philadelphia', 'PA', 39.9057, -75.1665, 999),
  ('00000000-0000-0000-0000-0000000d0b02', 'sup-flat', 'Sup Flat Field', 'Queens', 'NY', 40.7571, -73.8458, null),
  ('00000000-0000-0000-0000-0000000d0b03', 'sup-mile', 'Sup Mile High', 'Denver', 'CO', 39.7559, -104.9942, 5180);

-- g1..g4 are wins for the fan's side, g5 is a loss, g6 is a win a mile up.
insert into public.games (id, sport_id, season, game_type, scheduled_start, venue_id, home_team_id, away_team_id, status, home_score, away_score, attendance, provider, provider_game_id) values
  ('00000000-0000-0000-0000-0000000d0c01', 'mlb', 2024, 'regular', '2024-04-01T23:05:00Z', '00000000-0000-0000-0000-0000000d0b01', '00000000-0000-0000-0000-0000000d0a01', '00000000-0000-0000-0000-0000000d0a02', 'final', 5, 2, 30000, 'test', 'sup-g1'),
  ('00000000-0000-0000-0000-0000000d0c02', 'mlb', 2024, 'regular', '2024-04-02T23:05:00Z', '00000000-0000-0000-0000-0000000d0b01', '00000000-0000-0000-0000-0000000d0a01', '00000000-0000-0000-0000-0000000d0a02', 'final', 4, 3, 45000, 'test', 'sup-g2'),
  ('00000000-0000-0000-0000-0000000d0c03', 'mlb', 2024, 'regular', '2024-05-01T23:05:00Z', '00000000-0000-0000-0000-0000000d0b01', '00000000-0000-0000-0000-0000000d0a01', '00000000-0000-0000-0000-0000000d0a02', 'final', 1, 0, null, 'test', 'sup-g3'),
  ('00000000-0000-0000-0000-0000000d0c04', 'mlb', 2024, 'regular', '2024-05-02T23:05:00Z', '00000000-0000-0000-0000-0000000d0b02', '00000000-0000-0000-0000-0000000d0a02', '00000000-0000-0000-0000-0000000d0a01', 'final', 2, 6, 41000, 'test', 'sup-g4'),
  ('00000000-0000-0000-0000-0000000d0c05', 'mlb', 2024, 'regular', '2024-05-03T23:05:00Z', '00000000-0000-0000-0000-0000000d0b02', '00000000-0000-0000-0000-0000000d0a02', '00000000-0000-0000-0000-0000000d0a01', 'final', 7, 1, 0, 'test', 'sup-g5'),
  ('00000000-0000-0000-0000-0000000d0c06', 'mlb', 2024, 'regular', '2024-06-01T23:05:00Z', '00000000-0000-0000-0000-0000000d0b03', '00000000-0000-0000-0000-0000000d0a02', '00000000-0000-0000-0000-0000000d0a01', 'final', 0, 3, null, 'test', 'sup-g6');

-- Deficits: down 2 in g1, down 3 in g2, down 2 in g4 (as the away side). g3 never trailed.
insert into public.game_scoring_timeline (game_id, seq, period, half, home_score, away_score, scoring_side, description) values
  ('00000000-0000-0000-0000-0000000d0c01', 1, 1, 'top', 0, 2, 'away', 'two-run homer'),
  ('00000000-0000-0000-0000-0000000d0c01', 2, 6, 'bottom', 5, 2, 'home', 'grand slam and one'),
  ('00000000-0000-0000-0000-0000000d0c02', 1, 1, 'top', 0, 3, 'away', 'three-run homer'),
  ('00000000-0000-0000-0000-0000000d0c02', 2, 9, 'bottom', 4, 3, 'home', 'walk-off grand slam'),
  ('00000000-0000-0000-0000-0000000d0c03', 1, 9, 'bottom', 1, 0, 'home', 'walk-off single'),
  ('00000000-0000-0000-0000-0000000d0c04', 1, 1, 'bottom', 2, 0, 'home', 'two-run homer'),
  ('00000000-0000-0000-0000-0000000d0c04', 2, 9, 'top', 2, 6, 'away', 'six-run ninth');

insert into public.players (id, sport_id, full_name, provider, provider_player_id) values
  ('00000000-0000-0000-0000-0000000d0f01', 'mlb', 'Aaron Sup', 'test', 'sup-p1'),
  ('00000000-0000-0000-0000-0000000d0f02', 'mlb', 'Zed Sup', 'test', 'sup-p2'),
  ('00000000-0000-0000-0000-0000000d0f03', 'mlb', 'Once Sup', 'test', 'sup-p3'),
  ('00000000-0000-0000-0000-0000000d0f04', 'mlb', 'Never Sup', 'test', 'sup-p4');
-- Aaron and Zed both play in g1 and g2; Once plays in g1 only; Never plays in a game nobody attends.
insert into public.game_appearances (game_id, player_id, team_id) values
  ('00000000-0000-0000-0000-0000000d0c01', '00000000-0000-0000-0000-0000000d0f01', '00000000-0000-0000-0000-0000000d0a01'),
  ('00000000-0000-0000-0000-0000000d0c02', '00000000-0000-0000-0000-0000000d0f01', '00000000-0000-0000-0000-0000000d0a01'),
  ('00000000-0000-0000-0000-0000000d0c01', '00000000-0000-0000-0000-0000000d0f02', '00000000-0000-0000-0000-0000000d0a01'),
  ('00000000-0000-0000-0000-0000000d0c02', '00000000-0000-0000-0000-0000000d0f02', '00000000-0000-0000-0000-0000000d0a01'),
  ('00000000-0000-0000-0000-0000000d0c01', '00000000-0000-0000-0000-0000000d0f03', '00000000-0000-0000-0000-0000000d0a01'),
  ('00000000-0000-0000-0000-0000000d0c05', '00000000-0000-0000-0000-0000000d0f04', '00000000-0000-0000-0000-0000000d0a01');

insert into public.user_teams (user_id, team_id) values
  ('a1000000-0000-4000-8000-000000000d01', '00000000-0000-0000-0000-0000000d0a01');
insert into public.attendances (user_id, game_id, source) values
  ('a1000000-0000-4000-8000-000000000d01', '00000000-0000-0000-0000-0000000d0c01', 'manual'),
  ('a1000000-0000-4000-8000-000000000d01', '00000000-0000-0000-0000-0000000d0c02', 'manual');

create temp view sup as
  select payload -> 'superlatives' as s from public.user_stats_cache where user_id = 'a1000000-0000-4000-8000-000000000d01';
grant select on sup to public;

-- ---------------------------------------------------------------------------
-- Favourite player
-- ---------------------------------------------------------------------------
select is((select s ? 'most_seen_favorite_player' from sup), false, 'no favourite players: no favourite superlative');
select is((select s ? 'most_seen_player' from sup), true, 'the overall most seen player is still sent for installed builds');

insert into public.user_players (user_id, player_id, created_at) values
  ('a1000000-0000-4000-8000-000000000d01', '00000000-0000-0000-0000-0000000d0f04', '2025-12-01T00:00:00Z');
select is((select s ? 'most_seen_favorite_player' from sup), false, 'a favourite never seen is not a superlative');

-- Zed and Aaron are both seen twice. Zed was favourited first, and loses on name, so only the
-- created_at rule can put Zed on top. Once was favourited earliest of all but seen once.
insert into public.user_players (user_id, player_id, created_at) values
  ('a1000000-0000-4000-8000-000000000d01', '00000000-0000-0000-0000-0000000d0f03', '2026-01-01T00:00:00Z'),
  ('a1000000-0000-4000-8000-000000000d01', '00000000-0000-0000-0000-0000000d0f02', '2026-02-01T00:00:00Z'),
  ('a1000000-0000-4000-8000-000000000d01', '00000000-0000-0000-0000-0000000d0f01', '2026-03-01T00:00:00Z');
select is((select s -> 'most_seen_favorite_player' ->> 'name' from sup), 'Zed Sup', 'most seen favourite; a tie goes to the one favourited first');
select is((select (s -> 'most_seen_favorite_player' ->> 'count')::int from sup), 2, 'with the number of counted games they appeared in');
select is((select s -> 'most_seen_favorite_player' ->> 'player_id' from sup), '00000000-0000-0000-0000-0000000d0f02', 'and the player id, for the page of games');

delete from public.user_players where user_id = 'a1000000-0000-4000-8000-000000000d01' and player_id = '00000000-0000-0000-0000-0000000d0f02';
select is((select s -> 'most_seen_favorite_player' ->> 'name' from sup), 'Aaron Sup', 'unfavouriting refreshes the cache by itself');

-- Same created_at: the name decides.
update public.user_players set created_at = '2026-03-01T00:00:00Z' where user_id = 'a1000000-0000-4000-8000-000000000d01';
insert into public.user_players (user_id, player_id, created_at) values
  ('a1000000-0000-4000-8000-000000000d01', '00000000-0000-0000-0000-0000000d0f02', '2026-03-01T00:00:00Z');
select is((select s -> 'most_seen_favorite_player' ->> 'name' from sup), 'Aaron Sup', 'same count, same moment: by name');

-- Somebody else's favourites are theirs alone.
insert into public.user_players (user_id, player_id) values
  ('a1000000-0000-4000-8000-000000000d02', '00000000-0000-0000-0000-0000000d0f01');
select is((select payload -> 'superlatives' ? 'most_seen_favorite_player' from public.user_stats_cache where user_id = 'a1000000-0000-4000-8000-000000000d02'),
  false, 'a fan with a favourite and no games has no such superlative');

-- ---------------------------------------------------------------------------
-- Biggest comeback
-- ---------------------------------------------------------------------------
select is((select s -> 'biggest_comeback' ->> 'game_id' from sup), '00000000-0000-0000-0000-0000000d0c02', 'no timeline anywhere: the largest deficit decides');
select is((select (s -> 'biggest_comeback' ->> 'deficit')::int from sup), 3, 'deficit fallback value');
select is((select s -> 'biggest_comeback' ->> 'sport_id' from sup), 'mlb', 'the sport, so the app can say runs or points');
select is((select s -> 'biggest_comeback' ? 'low_win_prob' from sup), false, 'no timeline: no win probability');

-- A timeline that never drops below an even chance is not a comeback, so the deficit still decides.
insert into public.game_wp_timeline (game_id, seq, period, half, home_wp) values
  ('00000000-0000-0000-0000-0000000d0c01', 1, 1, 'top', 0.55000),
  ('00000000-0000-0000-0000-0000000d0c01', 2, 9, 'top', 0.99000);
select public.refresh_user_stats('a1000000-0000-4000-8000-000000000d01');
select is((select s -> 'biggest_comeback' ->> 'game_id' from sup), '00000000-0000-0000-0000-0000000d0c02', 'a win that was never in doubt does not outrank a real deficit');
select is((select s -> 'biggest_comeback' ? 'low_win_prob' from sup), false, 'and brings no win probability with it');

-- g3: at home, low point 30%, never trailed. g4: AWAY, the home side peaked at 92%, so 8%.
-- g5: a loss with a 1% low point, which must never be chosen.
insert into public.game_wp_timeline (game_id, seq, period, half, home_wp) values
  ('00000000-0000-0000-0000-0000000d0c03', 1, 1, 'top', 0.50000),
  ('00000000-0000-0000-0000-0000000d0c03', 2, 9, 'top', 0.30000),
  ('00000000-0000-0000-0000-0000000d0c03', 3, 9, 'bottom', 1.00000),
  ('00000000-0000-0000-0000-0000000d0c04', 1, 1, 'top', 0.50000),
  ('00000000-0000-0000-0000-0000000d0c04', 2, 8, 'bottom', 0.92000),
  ('00000000-0000-0000-0000-0000000d0c04', 3, 9, 'top', 0.02000),
  ('00000000-0000-0000-0000-0000000d0c05', 1, 1, 'top', 0.50000),
  ('00000000-0000-0000-0000-0000000d0c05', 2, 9, 'top', 0.99000);
insert into public.attendances (user_id, game_id, source) values
  ('a1000000-0000-4000-8000-000000000d01', '00000000-0000-0000-0000-0000000d0c03', 'manual');
select is((select s -> 'biggest_comeback' ->> 'game_id' from sup), '00000000-0000-0000-0000-0000000d0c03', 'a won game with a timeline outranks a larger deficit without one');
select is((select (s -> 'biggest_comeback' ->> 'low_win_prob')::numeric from sup), 0.3, 'low point for the home side is the lowest home_wp');
select is((select (s -> 'biggest_comeback' ->> 'deficit')::int from sup), 0, 'deficit is always a number, even when the side never trailed');

insert into public.attendances (user_id, game_id, source) values
  ('a1000000-0000-4000-8000-000000000d01', '00000000-0000-0000-0000-0000000d0c04', 'manual'),
  ('a1000000-0000-4000-8000-000000000d01', '00000000-0000-0000-0000-0000000d0c05', 'manual');
select is((select s -> 'biggest_comeback' ->> 'game_id' from sup), '00000000-0000-0000-0000-0000000d0c04', 'the lowest win probability overcome wins; a loss never counts');
select is((select (s -> 'biggest_comeback' ->> 'low_win_prob')::numeric from sup), 0.08, 'low point for the away side is one minus the highest home_wp');
select is((select (s -> 'biggest_comeback' ->> 'deficit')::int from sup), 2, 'and the deficit in that game comes along');

-- ---------------------------------------------------------------------------
-- Largest crowd
-- ---------------------------------------------------------------------------
select is((select s -> 'largest_crowd' from sup),
  '{"game_id": "00000000-0000-0000-0000-0000000d0c02", "attendance": 45000}'::jsonb, 'largest crowd, skipping games with no attendance or a zero');

-- ---------------------------------------------------------------------------
-- Highest altitude, and the game behind each venue row
-- ---------------------------------------------------------------------------
select is((select s ? 'highest_altitude' from sup), false, '999 ft and an unknown elevation: no altitude superlative');

update public.venues set elevation_ft = 1000 where key = 'sup-low';
select public.refresh_user_stats('a1000000-0000-4000-8000-000000000d01');
select is((select s -> 'highest_altitude' from sup),
  '{"venue_id": "00000000-0000-0000-0000-0000000d0b01", "name": "Sup Low Park", "elevation_ft": 1000, "game_id": "00000000-0000-0000-0000-0000000d0c03"}'::jsonb,
  '1,000 ft is enough, and the row opens the most recent game there');

insert into public.attendances (user_id, game_id, source) values
  ('a1000000-0000-4000-8000-000000000d01', '00000000-0000-0000-0000-0000000d0c06', 'manual');
select is((select s -> 'highest_altitude' ->> 'name' from sup), 'Sup Mile High', 'the highest stadium wins');
select is((select (s -> 'highest_altitude' ->> 'elevation_ft')::int from sup), 5180, 'with its elevation in feet');

select is((select s -> 'most_visited_venue' ->> 'game_id' from sup), '00000000-0000-0000-0000-0000000d0c03', 'most visited venue carries its most recent game');

update public.profiles set home_lat = 39.9526, home_lng = -75.1652 where id = 'a1000000-0000-4000-8000-000000000d01';
select public.refresh_user_stats('a1000000-0000-4000-8000-000000000d01');
select is((select (s -> 'farthest_venue') - 'km'::text from sup),
  '{"venue_id": "00000000-0000-0000-0000-0000000d0b03", "name": "Sup Mile High", "game_id": "00000000-0000-0000-0000-0000000d0c06"}'::jsonb,
  'farthest venue carries a game to open');

select * from finish();
rollback;
