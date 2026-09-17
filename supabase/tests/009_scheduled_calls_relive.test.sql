-- Scheduled calls authenticate, the detail queue and Relive can be drained, and storylines are
-- requested on a schedule and on a walk-up check-in (migration 20260917000200).
--
-- The first block is the regression test for the bug that made every hosted cron job report
-- success while calling nothing: what matters is the request pg_net actually queues, headers
-- included, so that is what is read back here.
begin;
create extension if not exists pgtap with schema extensions;
select plan(21);

-- ---------------------------------------------------------------------------
-- call_edge_function
-- ---------------------------------------------------------------------------
delete from vault.secrets where name in ('project_url', 'service_role_key', 'cron_secret');

select is(public.call_edge_function('mlb-sync'), null, 'with no vault secrets nothing is called');
select is((select count(*)::int from net.http_request_queue), 0, 'and nothing is queued');

select vault.create_secret('http://functions.test', 'project_url');
select vault.create_secret('legacy.jwt.value', 'service_role_key');

select isnt(public.call_edge_function('mlb-sync'), null, 'with url and key the call is queued');
select is((select headers ? 'x-cron-secret' from net.http_request_queue order by id desc limit 1), false,
  'without a cron_secret in vault the header is left off, so legacy-key projects still work');

select vault.create_secret('s3cret', 'cron_secret');
select isnt(public.call_edge_function('storylines', '{"upcoming_hours": 20}'::jsonb), null, 'call with all three secrets is queued');
select is((select headers ->> 'x-cron-secret' from net.http_request_queue order by id desc limit 1), 's3cret',
  'the function-level secret is sent');
select is((select headers ->> 'Authorization' from net.http_request_queue order by id desc limit 1), 'Bearer legacy.jwt.value',
  'alongside the JWT the gateway requires');
select is((select url from net.http_request_queue order by id desc limit 1), 'http://functions.test/functions/v1/storylines',
  'to the named function');

select is(has_function_privilege('authenticated', 'public.call_edge_function(text, jsonb)', 'execute'), false,
  'a signed-in user cannot trigger internal functions');
select is(has_function_privilege('anon', 'public.games_needing_relive(text, integer)', 'execute'), false,
  'the worker queries are not callable by anon');
select is(has_function_privilege('authenticated', 'public.detail_queue_settle()', 'execute'), false,
  'nor by a signed-in user');

-- ---------------------------------------------------------------------------
-- The queue and Relive targets
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values ('a9000000-0000-4000-8000-0000000000a1', 'relive@example.com');
insert into public.venues (id, key, name, lat, lng, geofence_m) values
  ('00000000-0000-0000-0000-0000000009b1', 'relive-park', 'Relive Park', 40.0, -75.0, 400);
insert into public.teams (id, sport_id, name, city, abbreviation, provider, provider_team_id, franchise_id) values
  ('00000000-0000-0000-0000-0000000009a1', 'mlb', 'Relive Home', 'Home', 'RHM', 'test', 'relive-h', 'relive-fh'),
  ('00000000-0000-0000-0000-0000000009a2', 'mlb', 'Relive Away', 'Away', 'RAW', 'test', 'relive-a', 'relive-fa');
-- c1: final with detail, attended. c2: final, no detail yet. c3: starts in 75 minutes.
insert into public.games (id, sport_id, season, game_type, scheduled_start, venue_id, home_team_id, away_team_id, status, home_score, away_score, detail_ingested_at, provider, provider_game_id) values
  ('00000000-0000-0000-0000-0000000009c1', 'mlb', 2024, 'regular', '2024-06-01T23:05:00Z', '00000000-0000-0000-0000-0000000009b1',
   '00000000-0000-0000-0000-0000000009a1', '00000000-0000-0000-0000-0000000009a2', 'final', 5, 3, now(), 'test', 'relive-g1'),
  ('00000000-0000-0000-0000-0000000009c2', 'mlb', 2024, 'regular', '2024-06-02T23:05:00Z', '00000000-0000-0000-0000-0000000009b1',
   '00000000-0000-0000-0000-0000000009a1', '00000000-0000-0000-0000-0000000009a2', 'final', 1, 2, null, 'test', 'relive-g2'),
  ('00000000-0000-0000-0000-0000000009c3', 'mlb', 2026, 'regular', now() + interval '75 minutes', '00000000-0000-0000-0000-0000000009b1',
   '00000000-0000-0000-0000-0000000009a1', '00000000-0000-0000-0000-0000000009a2', 'scheduled', null, null, null, 'test', 'relive-g3');

insert into public.attendances (user_id, game_id, status, source) values
  ('a9000000-0000-4000-8000-0000000000a1', '00000000-0000-0000-0000-0000000009c1', 'attended', 'manual'),
  ('a9000000-0000-4000-8000-0000000000a1', '00000000-0000-0000-0000-0000000009c2', 'attended', 'manual');

select is((select count(*)::int from public.detail_queue where game_id = '00000000-0000-0000-0000-0000000009c2' and done_at is null), 1,
  'logging a game without detail queues it');
select is((select count(*)::int from public.detail_queue_pending('test', 10)), 1, 'and the worker sees it');

update public.detail_queue set attempts = 8 where game_id = '00000000-0000-0000-0000-0000000009c2';
select is((select count(*)::int from public.detail_queue_pending('test', 10)), 0, 'a row that failed eight times is left for a person');

update public.games set detail_ingested_at = now() where id = '00000000-0000-0000-0000-0000000009c2';
-- Counted per game, not by the return value: a developer database has open rows of its own.
select public.detail_queue_settle();
select is((select done_at is not null from public.detail_queue where game_id = '00000000-0000-0000-0000-0000000009c2'), true,
  'a queued game whose detail arrived by another path is closed');

select is((select array_agg(provider_game_id order by provider_game_id) from public.games_needing_relive('test', 10)),
  array['relive-g1', 'relive-g2'], 'attended final games with detail and no story are owed one');

insert into public.game_wp_timeline (game_id, seq, period, half, home_wp) values ('00000000-0000-0000-0000-0000000009c1', 1, 1, 'top', 0.5);
insert into public.game_story_steps (game_id, seq, wp_seq, away_score, home_score, label, text)
values ('00000000-0000-0000-0000-0000000009c1', 1, 1, 0, 0, 'Pregame', 'First pitch.');
update public.games set relive_checked_at = now() where id = '00000000-0000-0000-0000-0000000009c2';
select is((select count(*)::int from public.games_needing_relive('test', 10)), 0,
  'a game with a story is done, and an old game already checked is not refetched');

-- ---------------------------------------------------------------------------
-- Storylines: the schedule guard and the walk-up check-in
-- ---------------------------------------------------------------------------
select is(public.going_game_starts_between(interval '60 minutes', interval '90 minutes'), false, 'nobody is going yet');
insert into public.attendances (user_id, game_id, status, source) values
  ('a9000000-0000-4000-8000-0000000000a1', '00000000-0000-0000-0000-0000000009c3', 'going', 'manual');
select is(public.going_game_starts_between(interval '60 minutes', interval '90 minutes'), true,
  'a going game 75 minutes out is inside the refresh window');

delete from net.http_request_queue;
insert into public.checkins (user_id, game_id, distance_m, accuracy_m)
values ('a9000000-0000-4000-8000-0000000000a1', '00000000-0000-0000-0000-0000000009c3', 120, 20);
select is((select convert_from(body, 'utf8')::jsonb from net.http_request_queue order by id desc limit 1),
  '{"game_ids": ["00000000-0000-0000-0000-0000000009c3"]}'::jsonb,
  'a check-in at a game with no storylines requests them for that game');

select is((select count(*)::int from cron.job where jobname in ('storylines-morning', 'storylines-refresh') and active), 2,
  'both storyline schedules exist');

select * from finish();
rollback;
