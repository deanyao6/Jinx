begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (id, email) values ('a1000000-0000-4000-8000-0000000000a1', 'alice@example.com');
insert into public.teams (id, sport_id, name, city, abbreviation, provider, provider_team_id, franchise_id) values
  ('00000000-0000-0000-0000-00000000a006', 'nfl', 'Chicago Bears', 'Chicago', 'CHI', 'test', 'chi', 'nfl-bears'),
  ('00000000-0000-0000-0000-00000000a007', 'nfl', 'Green Bay Packers', 'Green Bay', 'GB', 'test', 'gb', 'nfl-packers'),
  ('00000000-0000-0000-0000-00000000a001', 'mlb', 'Philadelphia Phillies', 'Philadelphia', 'PHI', 'test', 'phi', 'mlb-143');
insert into public.venues (id, key, name, city, state, lat, lng, geofence_m) values
  ('00000000-0000-0000-0000-00000000b004', 'soldier', 'Soldier Field', 'Chicago', 'IL', 41.8623, -87.6167, 400);
-- A game starting in one hour (inside the check-in window).
insert into public.games (id, sport_id, season, game_type, scheduled_start, venue_id, home_team_id, away_team_id, status, provider, provider_game_id)
values ('00000000-0000-0000-0000-00000000c006', 'nfl', 2026, 'regular', now() + interval '1 hour', '00000000-0000-0000-0000-00000000b004',
        '00000000-0000-0000-0000-00000000a006', '00000000-0000-0000-0000-00000000a007', 'scheduled', 'test', 'g6');
insert into public.game_win_prob (game_id, home_win_prob) values ('00000000-0000-0000-0000-00000000c006', 0.38);
-- Alice follows the Phillies only, so she is neutral at Bears vs Packers.
insert into public.user_teams (user_id, team_id) values ('a1000000-0000-4000-8000-0000000000a1', '00000000-0000-0000-0000-00000000a001');

set local role authenticated;
set local request.jwt.claims to '{"sub":"a1000000-0000-4000-8000-0000000000a1","role":"authenticated"}';

select is((select public.make_pledge('00000000-0000-0000-0000-00000000c006', '00000000-0000-0000-0000-00000000a006') ->> 'reason'), 'not_checked_in', 'pledge requires a check-in');
select is((select public.check_in('00000000-0000-0000-0000-00000000c006', 900, 50) ->> 'reason'), 'too_far', 'check-in rejects far locations');
select is((select public.check_in('00000000-0000-0000-0000-00000000c006', 650, 500) ->> 'reason'), 'too_far', 'accuracy bonus is capped at 200m');
select is((select public.check_in('00000000-0000-0000-0000-00000000c006', 550, 180) ->> 'ok')::boolean, true, 'check-in inside geofence + accuracy succeeds');
select is((select verified from public.attendances where user_id = 'a1000000-0000-4000-8000-0000000000a1' and game_id = '00000000-0000-0000-0000-00000000c006'), true, 'check-in creates a verified attendance');
select is((select (public.game_context('00000000-0000-0000-0000-00000000c006') ->> 'neutral_for_user')::boolean), true, 'game context reports neutral');

select is((select public.make_pledge('00000000-0000-0000-0000-00000000c006', '00000000-0000-0000-0000-00000000a006') ->> 'ok')::boolean, true, 'neutral checked-in user can pledge');
select is((select win_prob_at_pledge from public.pledges where user_id = 'a1000000-0000-4000-8000-0000000000a1'), 0.38::numeric, 'pledge stores the pledged team win probability');
select is((select public.make_pledge('00000000-0000-0000-0000-00000000c006', '00000000-0000-0000-0000-00000000a007') ->> 'ok')::boolean, true, 'pledge can be changed while provisional');
select is((select win_prob_at_pledge from public.pledges where user_id = 'a1000000-0000-4000-8000-0000000000a1'), 0.62::numeric, 'switching sides updates the probability');
select is((select rooting_basis from public.attendances where user_id = 'a1000000-0000-4000-8000-0000000000a1'), null, 'provisional pledge gives no side yet');
reset role;

-- Game goes final: Packers win 20-19, pledge made before the lock -> valid win.
update public.games set status = 'final', home_score = 19, away_score = 20, final_at = now(),
  pledge_lock_at = now() + interval '10 minutes', pledge_lock_reliable = true
  where id = '00000000-0000-0000-0000-00000000c006';
select is(public.validate_pledges_for_game('00000000-0000-0000-0000-00000000c006'), 1, 'one pledge validated');
select is((select status || '/' || result from public.pledges where user_id = 'a1000000-0000-4000-8000-0000000000a1'), 'valid/win', 'pledge valid and won');
select * from public.process_game_final('00000000-0000-0000-0000-00000000c006');
select is((select payload -> 'pledge' -> 'record' ->> 'wins' from public.user_stats_cache where user_id = 'a1000000-0000-4000-8000-0000000000a1'), '1', 'pledge record updated after final');

select * from finish();
rollback;
