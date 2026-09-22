-- games.final_at survives the schedule refresh (migration 20260923000500). Numbered 042 because
-- 046 to 049 are this wave's other tests and 050 on belongs to the welcome-screen session.
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

insert into public.venues (id, key, name) values ('00000000-0000-0000-0000-0000000000db', 'final-at-venue', 'Final At Park')
on conflict (key) do nothing;
insert into public.teams (id, sport_id, name, city, abbreviation, provider, provider_team_id, franchise_id)
values ('00000000-0000-0000-0000-0000000000da', 'mlb', 'Final Nine', 'Testville', 'FIN', 'test', 'fin-t1', 'fin-f1'),
       ('00000000-0000-0000-0000-0000000000dd', 'mlb', 'Other Nine', 'Elsewhere', 'OTN', 'test', 'fin-t2', 'fin-f2')
on conflict (provider, provider_team_id) do nothing;
insert into public.games (id, sport_id, season, game_type, scheduled_start, venue_id, home_team_id, away_team_id, status, home_score, away_score, provider, provider_game_id, final_at)
values ('00000000-0000-0000-0000-0000000000dc', 'mlb', 2026, 'regular', '2026-05-01T18:00:00Z',
        '00000000-0000-0000-0000-0000000000db', '00000000-0000-0000-0000-0000000000da',
        '00000000-0000-0000-0000-0000000000dd', 'final', 3, 2, 'test', 'fin-g1', '2026-05-01T20:40:00Z')
on conflict (provider, provider_game_id) do nothing;

-- A schedule refresh with nothing to say does not wipe the estimate.
update public.games set final_at = null where id = '00000000-0000-0000-0000-0000000000dc';
select is((select final_at from public.games where id = '00000000-0000-0000-0000-0000000000dc'), '2026-05-01T20:40:00Z'::timestamptz,
  'null never replaces a value');

-- A better estimate from a schedule refresh replaces a schedule estimate.
update public.games set final_at = '2026-05-01T20:45:00Z' where id = '00000000-0000-0000-0000-0000000000dc';
select is((select final_at from public.games where id = '00000000-0000-0000-0000-0000000000dc'), '2026-05-01T20:45:00Z'::timestamptz,
  'a schedule estimate can replace a schedule estimate');

-- A detail pass stamps detail_ingested_at and sets the exact time.
update public.games set final_at = '2026-05-01T20:43:17Z', detail_ingested_at = now() where id = '00000000-0000-0000-0000-0000000000dc';
select is((select final_at from public.games where id = '00000000-0000-0000-0000-0000000000dc'), '2026-05-01T20:43:17Z'::timestamptz,
  'a detail pass sets the exact time');

-- The next schedule refresh, with its estimate, leaves the exact time alone.
update public.games set final_at = '2026-05-01T20:45:00Z', home_score = 3 where id = '00000000-0000-0000-0000-0000000000dc';
select is((select final_at from public.games where id = '00000000-0000-0000-0000-0000000000dc'), '2026-05-01T20:43:17Z'::timestamptz,
  'a schedule estimate never replaces a detail value');

-- A later detail pass (the 12-hour recheck) can still correct it.
update public.games set final_at = '2026-05-01T20:43:20Z', detail_ingested_at = now() + interval '1 second' where id = '00000000-0000-0000-0000-0000000000dc';
select is((select final_at from public.games where id = '00000000-0000-0000-0000-0000000000dc'), '2026-05-01T20:43:20Z'::timestamptz,
  'a later detail pass can correct it');

select * from finish();
rollback;
