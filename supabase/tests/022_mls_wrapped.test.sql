-- MLS Wrapped (migration 20260923000900): a fan whose only attendances are MLS matches gets a
-- Wrapped for the calendar year, the draw counts in the record, an MLS moment is ranked, and the
-- daily job publishes MLS. Numbered 022 (046 to 049 are this wave's others, 050 on the
-- welcome-screen session's).
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users (id, email, aud, role)
values ('a1000000-0000-4000-8000-0000000000d1', 'mls-wrapped@test', 'authenticated', 'authenticated')
on conflict (id) do nothing;
insert into public.profiles (id, handle, display_name, is_private)
values ('a1000000-0000-4000-8000-0000000000d1', 'mlswrapped', 'MLS Wrapped', false)
on conflict (id) do update set handle = excluded.handle;
-- Two 2026 matches at Inter Miami: a home win and a draw, the fan an Inter Miami fan.
insert into public.games (id, sport_id, season, season_key, season_label, game_type, scheduled_start, venue_id, home_team_id, away_team_id, status, home_score, away_score, winner_team_id, is_tie, decision_method, provider, provider_game_id)
select '00000000-0000-0000-0000-0000000000d2', 'mls', 2026, 'mls:2026', '2026', 'regular', '2026-05-02T23:30Z', h.home_venue_id, h.id, a.id, 'final', 2, 0, h.id, false, 'regulation', 'mls_test', 'w1'
from public.teams h, public.teams a where h.provider = 'espn_mls' and h.provider_team_id = '20232' and a.provider = 'espn_mls' and a.provider_team_id = '22529';
insert into public.games (id, sport_id, season, season_key, season_label, game_type, scheduled_start, venue_id, home_team_id, away_team_id, status, home_score, away_score, winner_team_id, is_tie, decision_method, provider, provider_game_id)
select '00000000-0000-0000-0000-0000000000d3', 'mls', 2026, 'mls:2026', '2026', 'regular', '2026-09-20T23:00Z', h.home_venue_id, h.id, a.id, 'final', 2, 2, null, true, 'regulation', 'mls_test', 'w2'
from public.teams h, public.teams a where h.provider = 'espn_mls' and h.provider_team_id = '20232' and a.provider = 'espn_mls' and a.provider_team_id = '22529';
insert into public.user_teams (user_id, team_id)
select 'a1000000-0000-4000-8000-0000000000d1', id from public.teams where provider = 'espn_mls' and provider_team_id = '20232';
insert into public.attendances (user_id, game_id, source)
values ('a1000000-0000-4000-8000-0000000000d1', '00000000-0000-0000-0000-0000000000d2', 'manual'),
       ('a1000000-0000-4000-8000-0000000000d1', '00000000-0000-0000-0000-0000000000d3', 'manual');
insert into public.game_events (game_id, type, detail)
values ('00000000-0000-0000-0000-0000000000d3', 'red_card', '{"minute": 88, "playerName": "Someone"}'),
       ('00000000-0000-0000-0000-0000000000d3', 'hat_trick', '{"goals": 3, "playerName": "Lionel Messi"}');

select isnt(public.generate_wrapped('a1000000-0000-4000-8000-0000000000d1', 'mls', 2026), null,
  'a fan with only MLS matches gets a Wrapped for the calendar year');
select is((public.generate_wrapped('a1000000-0000-4000-8000-0000000000d1', 'mls', 2026)) -> 'cards' -> 0 ->> 'games', '2',
  'both matches count');
select is((public.generate_wrapped('a1000000-0000-4000-8000-0000000000d1', 'mls', 2026)) -> 'cards' -> 1 -> 'record' ->> 'ties', '1',
  'the draw is in the record');
select is((public.generate_wrapped('a1000000-0000-4000-8000-0000000000d1', 'mls', 2026)) -> 'cards' -> 1 -> 'record' ->> 'wins', '1',
  'so is the win');
select is((public.generate_wrapped('a1000000-0000-4000-8000-0000000000d1', 'mls', 2026)) -> 'cards' -> 5 -> 'moment' ->> 'type', 'hat_trick',
  'the hat trick outranks the red card');
select is(public.generate_wrapped('a1000000-0000-4000-8000-0000000000d1', 'nba', 2025), null,
  'and no NBA Wrapped, having seen no NBA');
select ok((select command like '%''mls''%' from cron.job where jobname = 'wrapped-daily'), 'the daily job publishes MLS');

select * from finish();
rollback;
