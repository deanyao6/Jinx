-- Search finds the game a fan actually went to (migration 20260918110000).
--
-- Two bugs this pins down, both found by searching for an NBA game on 2026-09-18:
--   1. The date filter compared UTC dates, so a 7:30 pm game in Los Angeles (03:30 UTC the next
--      day) was filed under the following day and the fan searching the date they were there got
--      the previous evening's games instead.
--   2. A four-digit token matched `games.season` only. The NBA season is its START year, so a
--      January 2026 game belongs to season 2025 and "lakers 2026" returned the 2026-27 season.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

-- A west coast arena and an east coast one, so the zones differ.
insert into public.venues (id, key, name, city, state, lat, lng, tz) values
  ('00000000-0000-0000-0000-00000000f001', 'search-west', 'Search West Arena', 'Los Angeles', 'CA', 34.043, -118.267, 'America/Los_Angeles'),
  ('00000000-0000-0000-0000-00000000f002', 'search-east', 'Search East Arena', 'Boston', 'MA', 42.366, -71.062, 'America/New_York')
on conflict (key) do nothing;
insert into public.venue_aliases (venue_id, alias) values
  ('00000000-0000-0000-0000-00000000f001', 'Search West Arena')
on conflict do nothing;

insert into public.teams (id, sport_id, name, city, abbreviation, provider, provider_team_id, franchise_id) values
  ('00000000-0000-0000-0000-00000000f0a1', 'nba', 'Search Westers', 'Los Angeles', 'SWE', 'test', 'search-w', 'search-fw'),
  ('00000000-0000-0000-0000-00000000f0a2', 'nba', 'Search Easters', 'Boston', 'SEA', 'test', 'search-e', 'search-fe')
on conflict (provider, provider_team_id) do nothing;
insert into public.team_aliases (team_id, alias) values
  ('00000000-0000-0000-0000-00000000f0a1', 'Westers'),
  ('00000000-0000-0000-0000-00000000f0a2', 'Easters')
on conflict do nothing;

-- Tip-off 7:30 pm Los Angeles on 2 January 2026, which is 03:30 UTC on the 3rd. Season 2025,
-- because the NBA names a season for the year it starts in.
insert into public.games (id, sport_id, season, game_type, scheduled_start, venue_id, home_team_id, away_team_id, status, provider, provider_game_id) values
  ('00000000-0000-0000-0000-00000000f0c1', 'nba', 2025, 'regular', '2026-01-03T03:30:00Z',
   '00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-00000000f0a1',
   '00000000-0000-0000-0000-00000000f0a2', 'final', 'test', 'search-g1')
on conflict (provider, provider_game_id) do nothing;

-- 1. The fan was there on 2 January. Searching that date has to find it.
select is(
  (select count(*)::int from public.search_games('westers', null, null, '2026-01-02', '2026-01-02')),
  1, 'a west coast evening game is found on the date it was played, not the UTC date');

-- 2. And must NOT appear on the 3rd, which is only its UTC date.
select is(
  (select count(*)::int from public.search_games('westers', null, null, '2026-01-03', '2026-01-03')),
  0, 'the same game is not filed under the next day');

-- 3. An east coast game keeps behaving: 7 pm Boston is 00:00 UTC the next day.
insert into public.games (id, sport_id, season, game_type, scheduled_start, venue_id, home_team_id, away_team_id, status, provider, provider_game_id) values
  ('00000000-0000-0000-0000-00000000f0c2', 'nba', 2025, 'regular', '2026-01-03T00:00:00Z',
   '00000000-0000-0000-0000-00000000f002', '00000000-0000-0000-0000-00000000f0a2',
   '00000000-0000-0000-0000-00000000f0a1', 'final', 'test', 'search-g2')
on conflict (provider, provider_game_id) do nothing;
-- Both fixture games involve the Easters, so this asks for the east one by id.
select ok(
  exists (select 1 from public.search_games('easters', null, null, '2026-01-02', '2026-01-02')
           where id = '00000000-0000-0000-0000-00000000f0c2'),
  'an east coast game at 00:00 UTC belongs to the evening before');

-- 4. The year token matches the calendar year the game was played in.
select is(
  (select count(*)::int from public.search_games('westers 2026')),
  2, 'a year token finds games played in that calendar year, whatever the season is called');

-- 5. And still matches the season, which is what MLB and NFL fans mean.
insert into public.games (id, sport_id, season, game_type, scheduled_start, venue_id, home_team_id, away_team_id, status, provider, provider_game_id) values
  ('00000000-0000-0000-0000-00000000f0c3', 'nba', 2026, 'regular', '2026-11-20T03:30:00Z',
   '00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-00000000f0a1',
   '00000000-0000-0000-0000-00000000f0a2', 'scheduled', 'test', 'search-g3')
on conflict (provider, provider_game_id) do nothing;
select is(
  (select count(*)::int from public.search_games('westers 2026')),
  3, 'the 2026-27 season is still found by "2026" as well');

-- 6. A year that matches nothing still excludes.
select is(
  (select count(*)::int from public.search_games('westers 1998')),
  0, 'a year with no games returns nothing');

-- 7. Narrowing by the first token cannot drop a venue match. "Search" leads and names a venue.
select is(
  (select count(*)::int from public.search_games('search west arena')),
  2, 'a venue name still finds its games when the first token only matches the venue');

-- 8. Preserve the original three-league timezone audit. MLS was added later with
-- explicitly incomplete venue metadata (docs/MLS_ROLLOUT.md); its 38 unzoned venues
-- are not evidence that this migration regressed the existing leagues.
select is(
  (select count(*)::int from public.venues v
    where v.tz is null and exists (select 1 from public.games g where g.venue_id = v.id
      and g.sport_id in ('mlb','nfl','nba') and g.scheduled_start > '2016-01-01')),
  0, 'every MLB/NFL/NBA venue with a game since 2016 has a timezone');
select is(public.game_local_date('2026-01-15T06:30:00Z',null),date '2026-01-15',
  'unknown venue zones explicitly retain the existing New York fallback');

select * from finish();
rollback;
