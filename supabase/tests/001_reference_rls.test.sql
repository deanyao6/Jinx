begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

-- Fixture rows written as the service role (tests run as postgres, which bypasses RLS).
insert into public.teams (id, sport_id, name, city, abbreviation, provider, provider_team_id, franchise_id)
values ('00000000-0000-0000-0000-00000000a001', 'mlb', 'Philadelphia Phillies', 'Philadelphia', 'PHI', 'test', 'phi', 'mlb-143'),
       ('00000000-0000-0000-0000-00000000a002', 'mlb', 'New York Mets', 'New York', 'NYM', 'test', 'nym', 'mlb-121');
insert into public.venues (id, key, name, lat, lng) values ('00000000-0000-0000-0000-00000000b001', 'cbp', 'Citizens Bank Park', 39.9057, -75.1665);
insert into public.games (id, sport_id, season, game_type, scheduled_start, venue_id, home_team_id, away_team_id, status, provider, provider_game_id)
values ('00000000-0000-0000-0000-00000000c001', 'mlb', 2024, 'regular', '2024-09-15T17:35:00Z', '00000000-0000-0000-0000-00000000b001',
        '00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-00000000a002', 'final', 'test', 'g1');

-- anon sees nothing
set local role anon;
select is((select count(*) from public.teams), 0::bigint, 'anon cannot read teams');
select is((select count(*) from public.games), 0::bigint, 'anon cannot read games');
select is((select count(*) from public.venues), 0::bigint, 'anon cannot read venues');
reset role;

-- authenticated can read reference data
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';
select is((select count(*) from public.teams where provider = 'test'), 2::bigint, 'authenticated reads teams');
select is((select count(*) from public.games where provider = 'test'), 1::bigint, 'authenticated reads games');
select is((select count(*) from public.venues where key = 'cbp'), 1::bigint, 'authenticated reads venues');
select throws_ok(
  $$insert into public.games (sport_id, season, game_type, scheduled_start, home_team_id, away_team_id, status, provider, provider_game_id)
    values ('mlb', 2024, 'regular', now(), '00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-00000000a002', 'scheduled', 'test', 'g2')$$,
  '42501', null, 'authenticated cannot insert games');
update public.teams set name = 'x' where id = '00000000-0000-0000-0000-00000000a001';
select is((select name from public.teams where id = '00000000-0000-0000-0000-00000000a001'), 'Philadelphia Phillies', 'authenticated update of teams is a no-op');
reset role;

select * from finish();
rollback;
