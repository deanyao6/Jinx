-- NFL detail only for logged, queued or famous games (migration 20260923000600). Numbered 019
-- because 046 to 049 hold this wave's other tests and 050 on belongs to the welcome-screen session.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

-- After the cleanup no NFL game without an attendance, a queue row or a famous entry has detail.
select is((select count(*) from public.games g
  where g.provider = 'nflverse' and g.detail_ingested_at is not null
    and not exists (select 1 from public.attendances a where a.game_id = g.id)
    and not exists (select 1 from public.famous_games f where f.game_id = g.id)
    and not exists (select 1 from public.detail_queue q where q.game_id = g.id)), 0::bigint,
  'no unwanted NFL game keeps detail');
select is((select count(*) from public.game_appearances ap join public.games g on g.id = ap.game_id
  where g.provider = 'nflverse' and g.detail_ingested_at is null), 0::bigint,
  'and none keeps appearance rows');

-- Every attended NFL game still has its detail, so nothing a fan sees changed.
select is((select count(*) from public.games g
  where g.provider = 'nflverse' and g.status = 'final' and g.detail_ingested_at is null
    and exists (select 1 from public.attendances a where a.game_id = g.id)), 0::bigint,
  'every attended NFL game keeps its detail');

-- The function: a fresh attendance on a game without detail wants it, and a queue row wants it
-- even when detail exists (a refresh).
insert into auth.users (id, email, aud, role)
values ('a1000000-0000-4000-8000-0000000000d1', 'nfl-wants@test', 'authenticated', 'authenticated')
on conflict (id) do nothing;
insert into public.profiles (id, handle, display_name, is_private)
values ('a1000000-0000-4000-8000-0000000000d1', 'nflwants', 'NFL Wants', false)
on conflict (id) do update set handle = excluded.handle;
insert into public.venues (id, key, name) values ('00000000-0000-0000-0000-0000000000cb', 'nfl-wants-venue', 'Wants Field')
on conflict (key) do nothing;
insert into public.teams (id, sport_id, name, city, abbreviation, provider, provider_team_id, franchise_id)
values ('00000000-0000-0000-0000-0000000000ca', 'nfl', 'Wants', 'Testville', 'WNT', 'test', 'wants-t1', 'wants-f1'),
       ('00000000-0000-0000-0000-0000000000cd', 'nfl', 'Others', 'Elsewhere', 'OTH', 'test', 'wants-t2', 'wants-f2')
on conflict (provider, provider_team_id) do nothing;
insert into public.games (id, sport_id, season, game_type, scheduled_start, venue_id, home_team_id, away_team_id, status, home_score, away_score, provider, provider_game_id)
values ('00000000-0000-0000-0000-0000000000cc', 'nfl', 2025, 'regular', '2025-09-07T17:00:00Z',
        '00000000-0000-0000-0000-0000000000cb', '00000000-0000-0000-0000-0000000000ca',
        '00000000-0000-0000-0000-0000000000cd', 'final', 24, 17, 'nflverse', '2025_01_OTH_WNT'),
       ('00000000-0000-0000-0000-0000000000ce', 'nfl', 2025, 'regular', '2025-09-14T17:00:00Z',
        '00000000-0000-0000-0000-0000000000cb', '00000000-0000-0000-0000-0000000000ca',
        '00000000-0000-0000-0000-0000000000cd', 'final', 10, 3, 'nflverse', '2025_02_OTH_WNT')
on conflict (provider, provider_game_id) do nothing;

select is((select count(*) from public.games_wanting_detail('nflverse') w where w.provider_game_id like '2025_0_OTH_WNT'), 0::bigint,
  'a game nobody logged is not wanted');

insert into public.attendances (id, user_id, game_id, source)
values ('a1000000-0000-4000-8000-0000000000d2', 'a1000000-0000-4000-8000-0000000000d1', '00000000-0000-0000-0000-0000000000cc', 'manual')
on conflict (id) do nothing;
select is((select reason from public.games_wanting_detail('nflverse') w where w.provider_game_id = '2025_01_OTH_WNT'), 'queue',
  'logging a game queues it, and the queue is why it is wanted');

-- Once detail lands and the queue settles, it is no longer asked for again.
update public.games set detail_ingested_at = now() where id = '00000000-0000-0000-0000-0000000000cc';
update public.detail_queue set done_at = now() where game_id = '00000000-0000-0000-0000-0000000000cc';
select is((select count(*) from public.games_wanting_detail('nflverse') w where w.provider_game_id = '2025_01_OTH_WNT'), 0::bigint,
  'a detailed, settled game is not wanted again');

select * from finish();
rollback;
