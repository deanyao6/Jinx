-- MLS Pick a side (migration 20260923000800): pledges are allowed, the pledged side's probability
-- is its own three-way number, a draw voids the pledge (a shootout too, since the match drew),
-- and an extra-time winner scores. Numbered 021 (046 to 049 are this wave's others, 050 on the
-- welcome-screen session's).
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id, email, aud, role)
values ('a1000000-0000-4000-8000-0000000000c1', 'mls-neutral@test', 'authenticated', 'authenticated')
on conflict (id) do nothing;
insert into public.profiles (id, handle, display_name, is_private)
values ('a1000000-0000-4000-8000-0000000000c1', 'mlsneutral', 'MLS Neutral', false)
on conflict (id) do update set handle = excluded.handle;
insert into public.venues (id, key, name, lat, lng, geofence_m) values ('00000000-0000-0000-0000-0000000000ab', 'draw-venue', 'Draw Stadium', 40.7, -74.1, 400)
on conflict (key) do nothing;
insert into public.teams (id, sport_id, name, city, abbreviation, provider, provider_team_id, franchise_id)
values ('00000000-0000-0000-0000-0000000000aa', 'mls', 'Draw FC', 'Testville', 'DRW', 'test', 'draw-t1', 'draw-f1'),
       ('00000000-0000-0000-0000-0000000000ad', 'mls', 'Other SC', 'Elsewhere', 'OTH', 'test', 'draw-t2', 'draw-f2')
on conflict (provider, provider_team_id) do nothing;
-- Four matches, kicking off now: a regulation draw, a shootout, an extra-time win, a regulation win.
insert into public.games (id, sport_id, season, season_key, season_label, game_type, scheduled_start, venue_id, home_team_id, away_team_id, status, provider, provider_game_id)
select ('00000000-0000-0000-0000-0000000000' || suffix)::uuid, 'mls', 2026, 'mls:2026', '2026', 'regular', now() - interval '30 minutes',
       '00000000-0000-0000-0000-0000000000ab', '00000000-0000-0000-0000-0000000000aa', '00000000-0000-0000-0000-0000000000ad', 'scheduled', 'test', 'draw-' || suffix
from unnest(array['a1','a2','a3','a4']) as suffix
on conflict (provider, provider_game_id) do nothing;
insert into public.game_win_prob (game_id, home_win_prob, draw_prob, method)
values ('00000000-0000-0000-0000-0000000000a1', 0.45, 0.30, 'elo_draw_v1')
on conflict (game_id) do update set home_win_prob = excluded.home_win_prob, draw_prob = excluded.draw_prob;

select is(public.estimated_pledge_lock('mls', '2026-10-01T23:00:00Z'), '2026-10-01T23:15:00Z'::timestamptz,
  'the MLS lock estimate is kick-off plus 15 minutes');

set local role authenticated;
set local request.jwt.claims to '{"sub":"a1000000-0000-4000-8000-0000000000c1","role":"authenticated"}';

-- Checked in at all four.
insert into public.checkins (user_id, game_id, distance_m, accuracy_m)
select 'a1000000-0000-4000-8000-0000000000c1', ('00000000-0000-0000-0000-0000000000' || suffix)::uuid, 10, 5
from unnest(array['a1','a2','a3','a4']) as suffix
on conflict do nothing;

select is((public.make_pledge('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000ad') ->> 'ok')::boolean, true,
  'a neutral fan can pick a side at an MLS match');
select is((select win_prob_at_pledge from public.pledges where game_id = '00000000-0000-0000-0000-0000000000a1' and user_id = 'a1000000-0000-4000-8000-0000000000c1'), 0.25000,
  'the away pick carries its own probability, one minus home minus draw');
select is((public.make_pledge('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000aa') ->> 'ok')::boolean, true,
  'and can switch before the lock');
select is((select win_prob_at_pledge from public.pledges where game_id = '00000000-0000-0000-0000-0000000000a1' and user_id = 'a1000000-0000-4000-8000-0000000000c1'), 0.45000,
  'to the home side and its probability');
select ok((public.make_pledge('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000aa') ->> 'ok')::boolean, 'pledge at the shootout match');
select ok((public.make_pledge('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000aa') ->> 'ok')::boolean, 'pledge at the extra-time match');
select ok((public.make_pledge('00000000-0000-0000-0000-0000000000a4', '00000000-0000-0000-0000-0000000000ad') ->> 'ok')::boolean, 'pledge at the regulation match');

reset role;
-- Finals. Draw 1-1; shootout 2-2 won by the home side on penalties; extra time 3-2 home;
-- regulation 0-1 away.
update public.games set status = 'final', home_score = 1, away_score = 1, is_tie = true, decision_method = 'regulation' where id = '00000000-0000-0000-0000-0000000000a1';
update public.games set status = 'final', home_score = 2, away_score = 2, is_tie = false, decision_method = 'shootout', home_shootout_score = 4, away_shootout_score = 3, winner_team_id = '00000000-0000-0000-0000-0000000000aa' where id = '00000000-0000-0000-0000-0000000000a2';
update public.games set status = 'final', home_score = 3, away_score = 2, is_tie = false, decision_method = 'extra_time', winner_team_id = '00000000-0000-0000-0000-0000000000aa' where id = '00000000-0000-0000-0000-0000000000a3';
update public.games set status = 'final', home_score = 0, away_score = 1, is_tie = false, decision_method = 'regulation', winner_team_id = '00000000-0000-0000-0000-0000000000ad' where id = '00000000-0000-0000-0000-0000000000a4';
select public.validate_pledges_for_game(('00000000-0000-0000-0000-0000000000' || suffix)::uuid) from unnest(array['a1','a2','a3','a4']) as suffix;

select is((select status || '/' || coalesce(void_reason, '-') || '/' || coalesce(result, '-') from public.pledges where game_id = '00000000-0000-0000-0000-0000000000a1'), 'void/draw/-',
  'a regulation draw voids the pledge: no result');
select is((select status || '/' || coalesce(void_reason, '-') || '/' || coalesce(result, '-') from public.pledges where game_id = '00000000-0000-0000-0000-0000000000a2'), 'void/draw/-',
  'a shootout is a drawn match: void, even with a winner on penalties');
select is((select status || '/' || coalesce(void_reason, '-') || '/' || coalesce(result, '-') from public.pledges where game_id = '00000000-0000-0000-0000-0000000000a3'), 'valid/unreliable_timestamps/win',
  'an extra-time winner scores as a win');
select is((select title from public.notifications where user_id = 'a1000000-0000-4000-8000-0000000000c1' and kind = 'pledge_void' and data ->> 'reason' = 'draw' limit 1), 'Drawn, no result',
  'the notification says so');

select * from finish();
rollback;
