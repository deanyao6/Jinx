-- Players seen shows superstars for good games, and the ten-timers (migration 20260923000700).
-- Numbered 020: 046 to 049 hold this wave's other tests, 050 on is the welcome-screen session's.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email, aud, role)
values ('a1000000-0000-4000-8000-0000000000b1', 'seen-fan@test', 'authenticated', 'authenticated')
on conflict (id) do nothing;
insert into public.profiles (id, handle, display_name, is_private)
values ('a1000000-0000-4000-8000-0000000000b1', 'seenfan', 'Seen Fan', false)
on conflict (id) do update set handle = excluded.handle;
insert into public.venues (id, key, name) values ('00000000-0000-0000-0000-0000000000bb', 'seen-venue', 'Seen Park')
on conflict (key) do nothing;
insert into public.teams (id, sport_id, name, city, abbreviation, provider, provider_team_id, franchise_id)
values ('00000000-0000-0000-0000-0000000000ba', 'mlb', 'Seen Nine', 'Testville', 'SEE', 'test', 'seen-t1', 'seen-f1'),
       ('00000000-0000-0000-0000-0000000000bd', 'mlb', 'Other Nine', 'Elsewhere', 'OTS', 'test', 'seen-t2', 'seen-f2')
on conflict (provider, provider_team_id) do nothing;
insert into public.players (id, sport_id, full_name, provider, provider_player_id)
values ('00000000-0000-0000-0000-0000000000b1', 'mlb', 'Star Slugger', 'test', 'seen-p1'),
       ('00000000-0000-0000-0000-0000000000b2', 'mlb', 'Carl Jones', 'test', 'seen-p2'),
       ('00000000-0000-0000-0000-0000000000b3', 'mlb', 'Ten Timer', 'test', 'seen-p3')
on conflict (provider, provider_player_id) do nothing;
-- Star Slugger is a superstar: an MVP for 2026.
insert into public.player_honors (player_id, season, honor, source)
values ('00000000-0000-0000-0000-0000000000b1', 2026, 'mvp', 'test')
on conflict do nothing;

-- Eleven attended games. Game 1: the star homers (good), Carl goes 1 for 4 (not good), Ten Timer
-- homers (good). Games 2 to 11: Ten Timer homers in each; the star has quiet nights.
do $$
declare i integer;
begin
  for i in 1..11 loop
    insert into public.games (id, sport_id, season, game_type, scheduled_start, venue_id, home_team_id, away_team_id, status, home_score, away_score, provider, provider_game_id, detail_ingested_at)
    values (('00000000-0000-0000-0000-0000000000' || lpad(to_hex(160 + i), 2, '0'))::uuid, 'mlb', 2026, 'regular',
            ('2026-05-' || lpad(i::text, 2, '0') || 'T18:00:00Z')::timestamptz,
            '00000000-0000-0000-0000-0000000000bb', '00000000-0000-0000-0000-0000000000ba', '00000000-0000-0000-0000-0000000000bd',
            'final', 3, 2, 'test', 'seen-g' || i, now())
    on conflict (provider, provider_game_id) do nothing;
    insert into public.attendances (user_id, game_id, source)
    values ('a1000000-0000-4000-8000-0000000000b1', ('00000000-0000-0000-0000-0000000000' || lpad(to_hex(160 + i), 2, '0'))::uuid, 'manual')
    on conflict do nothing;
    insert into public.game_appearances (game_id, player_id, team_id, line, good_game) values
      (('00000000-0000-0000-0000-0000000000' || lpad(to_hex(160 + i), 2, '0'))::uuid, '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000ba',
        case when i = 1 then '{"ab":4,"h":2,"hr":1,"rbi":2}' else '{"ab":4,"h":0,"hr":0,"rbi":0}' end::jsonb, i = 1),
      (('00000000-0000-0000-0000-0000000000' || lpad(to_hex(160 + i), 2, '0'))::uuid, '00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000ba',
        '{"ab":4,"h":1,"hr":0,"rbi":0}'::jsonb, false),
      (('00000000-0000-0000-0000-0000000000' || lpad(to_hex(160 + i), 2, '0'))::uuid, '00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-0000000000ba',
        '{"ab":4,"h":1,"hr":1,"rbi":1}'::jsonb, true)
    on conflict do nothing;
  end loop;
end $$;

set local role authenticated;
set local request.jwt.claims to '{"sub":"a1000000-0000-4000-8000-0000000000b1","role":"authenticated"}';

select is((select count(*) from public.players_seen('a1000000-0000-4000-8000-0000000000b1') where full_name = 'Star Slugger'), 1::bigint,
  'a superstar with one good game is seen');
select is((select seen from public.players_seen('a1000000-0000-4000-8000-0000000000b1') where full_name = 'Star Slugger'), 1,
  'and counted once, not for the ten quiet nights');
select is((select count(*) from public.players_seen('a1000000-0000-4000-8000-0000000000b1') where full_name = 'Carl Jones'), 0::bigint,
  'a role player who played every game is not seen');
select is((select seen from public.players_seen('a1000000-0000-4000-8000-0000000000b1') where full_name = 'Ten Timer'), 11,
  'a non-superstar with ten or more good games earns a row');
select is(public.players_seen_count('a1000000-0000-4000-8000-0000000000b1'), 2, 'the count follows the same rule');

-- Game 1 on the game page: the star (with the honor) and Ten Timer (niche), not Carl.
select is((select count(*) from public.game_players_seen('00000000-0000-0000-0000-0000000000a1')), 2::bigint,
  'the game page names two');
select is((select niche from public.game_players_seen('00000000-0000-0000-0000-0000000000a1') where full_name = 'Star Slugger'), false,
  'the superstar by honor');
select is((select niche from public.game_players_seen('00000000-0000-0000-0000-0000000000a1') where full_name = 'Ten Timer'), true,
  'the ten-timer by repetition');
select is((select line ->> 'hr' from public.game_players_seen('00000000-0000-0000-0000-0000000000a1') where full_name = 'Star Slugger'), '1',
  'with the line that made it a good game');

select * from finish();
rollback;
