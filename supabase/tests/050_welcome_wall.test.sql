-- The welcome wall (migration 20260923100000): six recent games scored for notability, picked
-- once a week by pg_cron, served to the signed-out welcome screen through welcome_wall_current().
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

select has_table('public', 'welcome_wall_cards', 'the table exists');
select ok((select relrowsecurity from pg_class where oid = 'public.welcome_wall_cards'::regclass), 'RLS is on');
select is((select count(*)::int from pg_policies where tablename = 'welcome_wall_cards'), 0, 'and nobody but the service role has a policy');

-- The scheduled jobs, in UTC: Monday 13:00 all year, Friday 13:00 in NFL season only.
select is((select schedule from cron.job where jobname = 'welcome-wall-weekly'), '0 13 * * 1', 'weekly job on Monday 13:00 UTC');
select is((select schedule from cron.job where jobname = 'welcome-wall-friday'), '0 13 * 9-12,1,2 5', 'Friday re-run only from September to February');

-- The date label, relative to the day it is read.
select is(public.welcome_wall_date_label('2026-09-20', true, '2026-09-21'), 'Last night', 'yesterday evening is Last night');
select is(public.welcome_wall_date_label('2026-09-20', false, '2026-09-21'), 'Yesterday', 'yesterday afternoon is Yesterday');
select is(public.welcome_wall_date_label('2026-09-20', false, '2026-09-22'), 'Sunday', 'two days ago is the weekday');
select is(public.welcome_wall_date_label('2026-09-21', true, '2026-09-24'), 'Monday night', 'an evening game three days ago is the weekday night');
select is(public.welcome_wall_date_label('2026-09-13', true, '2026-09-21'), 'Sep 13, 2026', 'a week or more ago is the date');
select is(public.welcome_wall_date_label('2026-09-21', true, '2026-09-21'), 'Sep 21, 2026', 'today is the date too: the job runs in the morning');

-- Synthetic games in the last week, scored far above anything real so the pick is deterministic.
insert into public.venues (id, key, name, city, state, country, tz)
values ('a1500000-0000-4000-8000-000000000001', 'welcome-test-park', 'Welcome Test Park', 'Philadelphia', 'PA', 'USA', 'America/New_York');

-- 1. An NFL postseason game on a Sunday night between two NFC East teams, decided by 3: postseason,
--    primetime, rivalry, one score.
insert into public.games (id, sport_id, season, game_type, scheduled_start, venue_id, home_team_id, away_team_id, status, home_score, away_score, winner_team_id, provider, provider_game_id)
select 'a1500000-0000-4000-8000-000000000011', 'nfl', 2026, 'postseason', now() - interval '1 day', 'a1500000-0000-4000-8000-000000000001', h.id, a.id, 'final', 27, 24, h.id, 'welcome_test', 'g1'
from (select id from public.teams where sport_id = 'nfl' and abbreviation = 'PHI') h,
     (select id from public.teams where sport_id = 'nfl' and abbreviation = 'DAL') a;
-- Pin the local start to 20:15 on the most recent Thursday, Sunday or Monday (one of the last
-- four days is always one of those) so the primetime rule fires whatever day the test runs.
update public.games set scheduled_start = (
  select ((now() at time zone 'America/New_York')::date - i)::timestamp + interval '20 hours 15 minutes'
  from generate_series(1, 4) i
  where extract(dow from (now() at time zone 'America/New_York')::date - i) in (0, 1, 4)
  order by i limit 1
) at time zone 'America/New_York'
where id = 'a1500000-0000-4000-8000-000000000011';

-- 2. An MLB walk-off in extra innings between the Phillies and the Mets: moment, rivalry, one score,
--    extra innings, big draw.
insert into public.games (id, sport_id, season, game_type, scheduled_start, venue_id, home_team_id, away_team_id, status, home_score, away_score, winner_team_id, innings_or_periods, provider, provider_game_id)
select 'a1500000-0000-4000-8000-000000000012', 'mlb', 2026, 'regular', now() - interval '2 days', 'a1500000-0000-4000-8000-000000000001', h.id, a.id, 'final', 7, 6, h.id, 11, 'welcome_test', 'g2'
from (select id from public.teams where sport_id = 'mlb' and abbreviation = 'PHI') h,
     (select id from public.teams where sport_id = 'mlb' and abbreviation = 'NYM') a;
insert into public.game_events (game_id, type, team_id)
select 'a1500000-0000-4000-8000-000000000012', 'walk_off', home_team_id from public.games where id = 'a1500000-0000-4000-8000-000000000012';

-- 3. The Phillies again, a blowout the next day. Must not be picked: a team appears once.
insert into public.games (id, sport_id, season, game_type, scheduled_start, venue_id, home_team_id, away_team_id, status, home_score, away_score, winner_team_id, provider, provider_game_id)
select 'a1500000-0000-4000-8000-000000000013', 'mlb', 2026, 'postseason', now() - interval '1 day', 'a1500000-0000-4000-8000-000000000001', h.id, a.id, 'final', 12, 1, h.id, 'welcome_test', 'g3'
from (select id from public.teams where sport_id = 'mlb' and abbreviation = 'PHI') h,
     (select id from public.teams where sport_id = 'mlb' and abbreviation = 'ATL') a;

-- 4. A draw. Must not be picked: a card shows W or L.
insert into public.games (id, sport_id, season, season_key, season_label, game_type, scheduled_start, venue_id, home_team_id, away_team_id, status, home_score, away_score, is_tie, provider, provider_game_id)
select 'a1500000-0000-4000-8000-000000000014', 'mls', 2026, 'mls:2026', '2026', 'postseason', now() - interval '1 day', 'a1500000-0000-4000-8000-000000000001', h.id, a.id, 'final', 2, 2, true, 'welcome_test', 'g4'
from (select id from public.teams where sport_id = 'mls' and abbreviation = 'LAFC') h,
     (select id from public.teams where sport_id = 'mls' and abbreviation = 'MIA') a;

select is((select score from public.welcome_wall_score_games(now() - interval '7 days', now()) where game_id = 'a1500000-0000-4000-8000-000000000011'),
  100 + 40 + 35 + 30 + 10, 'the NFL playoff game scores postseason, primetime, rivalry, one score and big draw');
select is((select reasons from public.welcome_wall_score_games(now() - interval '7 days', now()) where game_id = 'a1500000-0000-4000-8000-000000000012'),
  array['moment', 'rivalry', 'one_score', 'overtime', 'big_draw'], 'the walk-off scores moment, rivalry, one score, extra innings and big draw');
select is((select count(*)::int from public.welcome_wall_score_games(now() - interval '7 days', now()) where game_id = 'a1500000-0000-4000-8000-000000000014'),
  0, 'a draw is never a candidate');

select is(public.welcome_wall_refresh(now()), 6, 'the refresh writes six cards');
select is((select count(*)::int from public.welcome_wall_cards), 6, 'six rows for this week');
select is((select payload ->> 'game_id' from public.welcome_wall_cards where rank = 1), 'a1500000-0000-4000-8000-000000000011', 'the playoff game is first');
select is((select payload ->> 'game_id' from public.welcome_wall_cards where rank = 2), 'a1500000-0000-4000-8000-000000000012', 'the walk-off is second');
select is((select count(*)::int from public.welcome_wall_cards where payload ->> 'game_id' in ('a1500000-0000-4000-8000-000000000013', 'a1500000-0000-4000-8000-000000000014')),
  0, 'the second Phillies game and the draw are left out');
select is((select payload - 'game_id' - 'venue' - 'played_on' - 'date_label' - 'score' - 'reasons' - 'team_id' - 'team_key' from public.welcome_wall_cards where rank = 1),
  '{"sport": "nfl", "title": "Eagles 27, Cowboys 24", "night": true, "result": "W"}'::jsonb,
  'the first card is the Eagles side of Eagles 27, Cowboys 24, a night game, a W');
select is((select payload ->> 'result' from public.welcome_wall_cards where rank = 3), 'L', 'every third card takes the losing side');
select ok((select bool_and(payload ? 'team_key' and payload ->> 'team_key' ~ '^[a-z_]+:[A-Za-z0-9]+$') from public.welcome_wall_cards),
  'every card names its side by provider and provider team id, which is stable across environments');
select is((select jsonb_array_length(public.welcome_wall_current() -> 'cards')), 6, 'welcome_wall_current serves the six');
select is((select public.welcome_wall_current() ->> 'week_start'),
  to_char((now() at time zone 'America/New_York')::date - ((extract(dow from (now() at time zone 'America/New_York')::date)::integer + 6) % 7), 'YYYY-MM-DD'),
  'under the Monday of this week');

select * from finish();
rollback;
