-- user_players and team_roster (SPEC.md 5.1, 6.9).
--
-- Every count is scoped to this file's own fixtures, for the reason given at the top of
-- 006_detail_relive_photos.test.sql: the database is not empty and a test that assumes it is
-- only passes by luck.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

-- Two users, so "your favourites are yours" is actually tested against someone else's.
insert into auth.users (id, email, aud, role)
values ('a1000000-0000-4000-8000-0000000000f1', 'fav-owner@test', 'authenticated', 'authenticated'),
       ('a1000000-0000-4000-8000-0000000000f2', 'fav-other@test', 'authenticated', 'authenticated')
on conflict (id) do nothing;

insert into public.profiles (id, handle, display_name, is_private)
values ('a1000000-0000-4000-8000-0000000000f1', 'favowner', 'Fav Owner', false),
       ('a1000000-0000-4000-8000-0000000000f2', 'favother', 'Fav Other', false)
on conflict (id) do nothing;

insert into public.players (id, sport_id, full_name, provider, provider_player_id)
values ('00000000-0000-0000-0000-0000000000f1', 'mlb', 'Test Slugger', 'test', 'fav-p1'),
       ('00000000-0000-0000-0000-0000000000f2', 'mlb', 'Test Reliever', 'test', 'fav-p2')
on conflict (provider, provider_player_id) do nothing;

insert into public.venues (id, key, name) values ('00000000-0000-0000-0000-0000000000fb', 'fav-venue', 'Fav Park')
on conflict (key) do nothing;
-- Two teams: a game cannot have the same side twice.
insert into public.teams (id, sport_id, name, city, abbreviation, provider, provider_team_id, franchise_id)
values ('00000000-0000-0000-0000-0000000000fa', 'mlb', 'Fav Nine', 'Testville', 'FAV', 'test', 'fav-t1', 'fav-f1'),
       ('00000000-0000-0000-0000-0000000000fd', 'mlb', 'Other Nine', 'Elsewhere', 'OTH', 'test', 'fav-t2', 'fav-f2')
on conflict (provider, provider_team_id) do nothing;

insert into public.games (id, sport_id, season, game_type, scheduled_start, venue_id, home_team_id, away_team_id, status, home_score, away_score, provider, provider_game_id)
values ('00000000-0000-0000-0000-0000000000fc', 'mlb', 2026, 'regular', '2026-05-01T18:00:00Z',
        '00000000-0000-0000-0000-0000000000fb', '00000000-0000-0000-0000-0000000000fa',
        '00000000-0000-0000-0000-0000000000fd', 'final', 3, 2, 'test', 'fav-g1')
on conflict (provider, provider_game_id) do nothing;

-- The slugger played in a game the owner attended; the reliever played in it too but the
-- owner's attendance is what makes only ONE of them "seen".
insert into public.game_appearances (game_id, player_id, team_id) values
  ('00000000-0000-0000-0000-0000000000fc', '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000fa'),
  ('00000000-0000-0000-0000-0000000000fc', '00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000fa')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- user_players: yours to write, visible per can_view_user.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"a1000000-0000-4000-8000-0000000000f1","role":"authenticated"}';

select lives_ok($$insert into public.user_players (user_id, player_id)
  values ('a1000000-0000-4000-8000-0000000000f1', '00000000-0000-0000-0000-0000000000f1')$$,
  'you can favourite a player');

select is((select count(*) from public.user_players where user_id = 'a1000000-0000-4000-8000-0000000000f1'),
  1::bigint, 'your favourite is readable by you');

select throws_ok($$insert into public.user_players (user_id, player_id)
  values ('a1000000-0000-4000-8000-0000000000f2', '00000000-0000-0000-0000-0000000000f1')$$,
  '42501', null, 'you cannot favourite a player for someone else');

-- The roster names both, and separates "was in the game" from "you were there".
select is((select count(*) from public.team_roster('00000000-0000-0000-0000-0000000000fa')),
  2::bigint, 'the roster lists everyone who appeared for the team');

select is((select seen_by_you from public.team_roster('00000000-0000-0000-0000-0000000000fa')
           where full_name = 'Test Slugger'), 0::bigint,
  'a game you did not attend does not count as seen');

insert into public.attendances (user_id, game_id, source, status)
values ('a1000000-0000-4000-8000-0000000000f1', '00000000-0000-0000-0000-0000000000fc', 'manual', 'attended');

select is((select seen_by_you from public.team_roster('00000000-0000-0000-0000-0000000000fa')
           where full_name = 'Test Slugger'), 1::bigint,
  'attending the game makes the player seen');

select is((select appearances from public.team_roster('00000000-0000-0000-0000-0000000000fa')
           where full_name = 'Test Slugger'), 1::bigint,
  'appearances counts the game itself, not the attendance');

select is((select count(*) from public.team_roster('00000000-0000-0000-0000-0000000000fa', 'slug')),
  1::bigint, 'the roster search filters by name, case insensitively');

reset role;

-- ---------------------------------------------------------------------------
-- Someone else's favourites, and their view of the same roster.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"a1000000-0000-4000-8000-0000000000f2","role":"authenticated"}';

-- The owner is public, so the favourite is visible. This is the same rule as user_teams.
select is((select count(*) from public.user_players where user_id = 'a1000000-0000-4000-8000-0000000000f1'),
  1::bigint, 'a public account''s favourite players are visible');

select is((select seen_by_you from public.team_roster('00000000-0000-0000-0000-0000000000fa')
           where full_name = 'Test Slugger'), 0::bigint,
  'seen_by_you is the caller''s own count, not the other user''s');

-- A DELETE that RLS filters does not raise: the USING clause simply matches no rows, so the
-- statement succeeds having changed nothing. The outcome is what matters, so that is what is
-- asserted. (An INSERT is different, and does raise 42501 above, because WITH CHECK rejects
-- the row rather than hiding it.)
delete from public.user_players where user_id = 'a1000000-0000-4000-8000-0000000000f1';
reset role;
set local role authenticated;
set local request.jwt.claims to '{"sub":"a1000000-0000-4000-8000-0000000000f1","role":"authenticated"}';
select is((select count(*) from public.user_players where user_id = 'a1000000-0000-4000-8000-0000000000f1'),
  1::bigint, 'someone else''s delete left your favourite alone');

reset role;

select * from finish();
rollback;
