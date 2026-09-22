-- The NBA as a third sport (migration 20260918100000): the sport row and its constraint, the
-- seeded reference rows, the venue noun per sport in the curated lists, live state with a
-- clock, the poll function serving two sports, and the scheduled calls.
begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

-- The sport and its constraint.
select is((select name from public.sports where id = 'nba'), 'National Basketball Association', 'the sport row exists');
select throws_ok($$insert into public.sports (id, name) values ('nhl', 'x')$$, '23514', null, 'a sport not in the check constraint is refused');

-- Reference rows from the seed.
select is((select count(*)::int from public.teams where sport_id = 'nba' and active), 30, '30 active NBA teams');
select is((select count(*)::int from public.teams where sport_id = 'nba' and not active), 6, 'six historical identities (Sonics, Nets, Grizzlies, two Charlottes, Hornets)');
select is((select provider_team_id from public.teams where sport_id = 'nba' and name = 'Seattle SuperSonics'), '1610612760-SEA', 'a historical identity has its own provider id');
select is((select nickname from public.teams where provider = 'nba' and provider_team_id = '1610612757'), 'Trail Blazers', 'a two-word nickname is stored, not derived');
select is((select count(*)::int from public.teams t join public.team_colors c on c.team_id = t.id where t.sport_id = 'nba'), 30, 'every active NBA team has a palette');
select is((select count(*)::int from public.teams where sport_id = 'nba' and active and home_venue_id is null), 0, 'every active NBA team has a home arena');
select ok((select count(*)::int from public.venues where provider_ids ? 'espn_venue_ids') >= 72, 'the original arenas retain ESPN venue ids as other sports are added');
select is((select shape_key from public.venue_shapes s join public.venues v on v.id = s.venue_id where v.key = 'td-garden'), 'arena', 'an arena is drawn as one');
select is((select count(*)::int from public.team_aliases a join public.teams t on t.id = a.team_id where t.provider = 'nba' and lower(a.alias) in ('sixers', 'cavs', 't-wolves', 'blazers')), 4, 'the nicknames tickets print are aliases');
select ok((select elevation_ft from public.venues where key = 'ball-arena') >= 5000, 'Ball Arena is a mile high');

-- The venue noun.
select is(public.venue_noun('mlb', true), 'ballparks', 'baseball plays in ballparks');
select is(public.venue_noun('nfl', true), 'stadiums', 'football in stadiums');
select is(public.venue_noun('nba', false), 'arena', 'basketball in an arena');
select is((select title from public.bucket_lists where slug = 'nba-all-venues'), 'Every NBA arena', 'the league list uses the word');
select is((select title from public.bucket_lists where slug = 'nba-division-atlantic-division'), 'Atlantic Division arenas', 'and so does each division');
select is((select title from public.bucket_lists where slug = 'nfl-division-afc-east'), 'AFC East stadiums', 'the NFL lists are unchanged');
select is((select definition ->> 'type' from public.bucket_lists where slug = 'see-a-buzzer-beater'), 'exists', 'the buzzer-beater list exists');

-- Live state has a clock; the poll function serves both live sports.
select has_column('public', 'game_live_state', 'clock', 'game_live_state has a clock');
select is(public.estimated_pledge_lock('nba', '2026-10-22T00:00:00Z'::timestamptz), '2026-10-22T00:30:00Z'::timestamptz, 'the NBA estimate is tip-off plus 30 minutes');

-- Scheduled calls: none. Supabase's egress cannot reach any NBA host (20260918100200), so the
-- daily GitHub job is the NBA's path and no cron row may pretend otherwise.
select is((select count(*)::int from cron.job where jobname in ('nba-sync', 'nba-live')), 0, 'nba-sync and nba-live are not scheduled');

select * from finish();
rollback;
