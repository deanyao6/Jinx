-- favorite_players_seen: the Passport's favourite players section.
--
-- Scoped to this file's fixtures, like 007: the database is not empty.
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email, aud, role)
values ('a1000000-0000-4000-8000-0000000001f1', 'fps-owner@test', 'authenticated', 'authenticated'),
       ('a1000000-0000-4000-8000-0000000001f2', 'fps-other@test', 'authenticated', 'authenticated')
on conflict (id) do nothing;
insert into public.profiles (id, handle, display_name, is_private)
values ('a1000000-0000-4000-8000-0000000001f1', 'fpsowner', 'FPS Owner', false),
       ('a1000000-0000-4000-8000-0000000001f2', 'fpsother', 'FPS Other', false)
on conflict (id) do nothing;

insert into public.players (id, sport_id, full_name, provider, provider_player_id)
values ('00000000-0000-0000-0000-0000000001a1', 'mlb', 'Traded Slugger', 'test', 'fps-p1'),
       ('00000000-0000-0000-0000-0000000001a2', 'mlb', 'Never Seen', 'test', 'fps-p2')
on conflict (provider, provider_player_id) do nothing;
insert into public.venues (id, key, name) values ('00000000-0000-0000-0000-0000000001b1', 'fps-venue', 'FPS Park')
on conflict (key) do nothing;
insert into public.teams (id, sport_id, name, city, abbreviation, provider, provider_team_id, franchise_id)
values ('00000000-0000-0000-0000-0000000001c1', 'mlb', 'First Club', 'One', 'FC1', 'test', 'fps-t1', 'fps-f1'),
       ('00000000-0000-0000-0000-0000000001c2', 'mlb', 'Second Club', 'Two', 'FC2', 'test', 'fps-t2', 'fps-f2')
on conflict (provider, provider_team_id) do nothing;

-- Three finals and one postponed game. The slugger plays for the first club twice, is traded, and
-- plays for the second club once. The postponed game has an appearance row but must not count.
insert into public.games (id, sport_id, season, game_type, scheduled_start, venue_id, home_team_id, away_team_id, status, home_score, away_score, provider, provider_game_id)
values ('00000000-0000-0000-0000-0000000001d1', 'mlb', 2025, 'regular', '2025-05-01T18:00:00Z', '00000000-0000-0000-0000-0000000001b1', '00000000-0000-0000-0000-0000000001c1', '00000000-0000-0000-0000-0000000001c2', 'final', 3, 2, 'test', 'fps-g1'),
       ('00000000-0000-0000-0000-0000000001d2', 'mlb', 2025, 'regular', '2025-06-01T18:00:00Z', '00000000-0000-0000-0000-0000000001b1', '00000000-0000-0000-0000-0000000001c1', '00000000-0000-0000-0000-0000000001c2', 'final', 1, 0, 'test', 'fps-g2'),
       ('00000000-0000-0000-0000-0000000001d3', 'mlb', 2025, 'regular', '2025-08-01T18:00:00Z', '00000000-0000-0000-0000-0000000001b1', '00000000-0000-0000-0000-0000000001c1', '00000000-0000-0000-0000-0000000001c2', 'final', 4, 5, 'test', 'fps-g3'),
       ('00000000-0000-0000-0000-0000000001d4', 'mlb', 2025, 'regular', '2025-09-01T18:00:00Z', '00000000-0000-0000-0000-0000000001b1', '00000000-0000-0000-0000-0000000001c1', '00000000-0000-0000-0000-0000000001c2', 'postponed', null, null, 'test', 'fps-g4')
on conflict (provider, provider_game_id) do nothing;
insert into public.game_appearances (game_id, player_id, team_id) values
  ('00000000-0000-0000-0000-0000000001d1', '00000000-0000-0000-0000-0000000001a1', '00000000-0000-0000-0000-0000000001c1'),
  ('00000000-0000-0000-0000-0000000001d2', '00000000-0000-0000-0000-0000000001a1', '00000000-0000-0000-0000-0000000001c1'),
  ('00000000-0000-0000-0000-0000000001d3', '00000000-0000-0000-0000-0000000001a1', '00000000-0000-0000-0000-0000000001c2'),
  ('00000000-0000-0000-0000-0000000001d4', '00000000-0000-0000-0000-0000000001a1', '00000000-0000-0000-0000-0000000001c2')
on conflict do nothing;

-- The owner attended all four; the other user attended only the first.
insert into public.attendances (user_id, game_id, source, status) values
  ('a1000000-0000-4000-8000-0000000001f1', '00000000-0000-0000-0000-0000000001d1', 'manual', 'attended'),
  ('a1000000-0000-4000-8000-0000000001f1', '00000000-0000-0000-0000-0000000001d2', 'manual', 'attended'),
  ('a1000000-0000-4000-8000-0000000001f1', '00000000-0000-0000-0000-0000000001d3', 'manual', 'attended'),
  ('a1000000-0000-4000-8000-0000000001f1', '00000000-0000-0000-0000-0000000001d4', 'manual', 'attended'),
  ('a1000000-0000-4000-8000-0000000001f2', '00000000-0000-0000-0000-0000000001d1', 'manual', 'attended');
insert into public.user_players (user_id, player_id) values
  ('a1000000-0000-4000-8000-0000000001f1', '00000000-0000-0000-0000-0000000001a1'),
  ('a1000000-0000-4000-8000-0000000001f1', '00000000-0000-0000-0000-0000000001a2'),
  ('a1000000-0000-4000-8000-0000000001f2', '00000000-0000-0000-0000-0000000001a1');

set local role authenticated;
set local request.jwt.claims to '{"sub":"a1000000-0000-4000-8000-0000000001f1","role":"authenticated"}';

select is((select count(*) from public.favorite_players_seen()), 3::bigint,
  'one row per favourite per team seen for, plus one for the favourite never seen');
select is((select seen from public.favorite_players_seen() where team_id = '00000000-0000-0000-0000-0000000001c1'),
  2, 'counts games seen for the first team');
select is((select seen from public.favorite_players_seen() where team_id = '00000000-0000-0000-0000-0000000001c2'),
  1, 'after the trade, counts under the new team, and the postponed game does not count');
select is((select last_game_id from public.favorite_players_seen() where team_id = '00000000-0000-0000-0000-0000000001c1'),
  '00000000-0000-0000-0000-0000000001d2'::uuid, 'last game is the most recent one for that team');
select results_eq($$select seen, team_id, last_game_id from public.favorite_players_seen() where full_name = 'Never Seen'$$,
  $$values (0, null::uuid, null::uuid)$$, 'a favourite never seen is a single zero row');

reset role;
set local role authenticated;
set local request.jwt.claims to '{"sub":"a1000000-0000-4000-8000-0000000001f2","role":"authenticated"}';
select is((select count(*) from public.favorite_players_seen()), 1::bigint,
  'the caller sees only their own favourites');
select is((select seen from public.favorite_players_seen()), 1,
  'and only games the caller attended');

reset role;
set local role anon;
select throws_ok($$select * from public.favorite_players_seen()$$, '42501', null,
  'signed-out callers cannot run it');
reset role;

select * from finish();
rollback;
