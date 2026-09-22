-- Only regular season and postseason games exist in Jinx (Dean, 2026-09-22; migration
-- 20260923000100): the preseason rows are gone, none can come back, and the spring-training
-- parks that only existed for them are gone with their shapes and aliases.
begin;
select plan(7);

select is((select count(*) from public.games where game_type not in ('regular', 'postseason')), 0::bigint,
  'no game outside the regular season and postseason');

select throws_like(
  $$insert into public.games (sport_id, provider, provider_game_id, season, game_type, scheduled_start, home_team_id, away_team_id, status)
    select 'mlb', 'mlb', 'test-preseason', 2026, 'preseason', now(), h.id, a.id, 'scheduled'
    from (select id from public.teams where sport_id = 'mlb' order by id limit 1) h,
         (select id from public.teams where sport_id = 'mlb' order by id desc limit 1) a$$,
  '%games_game_type_check%',
  'a preseason game is refused by the check constraint');

select is((select count(*) from public.venues where key in ('mlb-osceola-county-stadium', 'mlb-kino-veterans-memorial-stadium', 'mlb-al-stadium', 'mlb-nl-stadium')), 0::bigint,
  'the spring-training and exhibition parks are gone');

select is((select count(*) from public.venue_aliases va where va.alias in ('Osceola County Stadium', 'AL Stadium')), 0::bigint,
  'and so are their aliases');

select is((select count(*) from public.venues v where v.lat is null and not exists (select 1 from public.games g where g.venue_id = v.id)), 0::bigint,
  'no venue without coordinates is left without a game');

select has_index('public', 'games', 'games_rescheduled_from_idx', 'the makeup-game link is indexed');
select has_index('public', 'games', 'games_rescheduled_to_idx', 'the postponed-game link is indexed');

select * from finish();
rollback;
