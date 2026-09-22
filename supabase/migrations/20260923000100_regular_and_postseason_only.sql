-- Only regular season and postseason games exist in Jinx (Dean, 2026-09-22, decision 13).
-- Spring training and NBA preseason games were stored since the first backfills (9,763 MLB and
-- 1,940 NBA on local; 4,875 and 774 on hosted) and nobody had logged one on hosted. This
-- migration removes them, forbids them from coming back, and removes the spring-training and
-- minor-league parks that only existed for them and never had coordinates.
--
-- Safety: it refuses to run if any attendance, pledge or check-in points at a game it would
-- delete, so a fan's record can never lose a game here.

-- The two self-references on games have no index, so each cascaded delete scanned the whole
-- table: 11,703 deletes took minutes. Indexed first, and useful for the makeup-game lookups.
create index if not exists games_rescheduled_from_idx on public.games (rescheduled_from_game_id)
  where rescheduled_from_game_id is not null;
create index if not exists games_rescheduled_to_idx on public.games (rescheduled_to_game_id)
  where rescheduled_to_game_id is not null;

do $$
declare
  n_att bigint;
  n_pledge bigint;
  n_checkin bigint;
  n_games bigint;
begin
  select count(*) into n_att from public.attendances a
    join public.games g on g.id = a.game_id where g.game_type not in ('regular', 'postseason');
  select count(*) into n_pledge from public.pledges p
    join public.games g on g.id = p.game_id where g.game_type not in ('regular', 'postseason');
  select count(*) into n_checkin from public.checkins c
    join public.games g on g.id = c.game_id where g.game_type not in ('regular', 'postseason');
  if n_att > 0 or n_pledge > 0 or n_checkin > 0 then
    raise exception 'refusing to delete preseason games: % attendances, % pledges, % check-ins point at one',
      n_att, n_pledge, n_checkin;
  end if;

  -- A makeup game can only be rescheduled from a game of its own kind; clear any stray link
  -- rather than let the delete fail on it.
  update public.games set rescheduled_from_game_id = null
    where rescheduled_from_game_id in (select id from public.games where game_type not in ('regular', 'postseason'));
  update public.games set rescheduled_to_game_id = null
    where rescheduled_to_game_id in (select id from public.games where game_type not in ('regular', 'postseason'));

  delete from public.games where game_type not in ('regular', 'postseason');
  get diagnostics n_games = row_count;
  raise notice 'deleted % preseason games', n_games;
end $$;

alter table public.games drop constraint if exists games_game_type_check;
alter table public.games add constraint games_game_type_check
  check (game_type in ('regular', 'postseason'));

-- The parks that only ever hosted spring training or exhibitions: no coordinates in any seed,
-- no regular season or postseason game on the full 2000-on history, and no team's home. The
-- list is the 40 keys local held on 2026-09-22 (they are gone from the seed in the same
-- commit); each is deleted only if it still has no game and is nobody's home venue, which
-- keeps the statement safe on any database.
delete from public.venues v
where v.key in (
  'mlb-al-stadium', 'mlb-cashman-field', 'mlb-chain-of-lakes-park',
  'mlb-chengcing-lake-baseball-stadium', 'mlb-christensen-stadium', 'mlb-city-of-palms-park',
  'mlb-cooper-stadium', 'mlb-desert-sun-stadium', 'mlb-doubleday-field', 'mlb-drillers-stadium',
  'mlb-el-paso', 'mlb-estadio-de-beisbol-fray-nano', 'mlb-estadio-latinoamericano',
  'mlb-estadio-nacional-rod-carew', 'mlb-estadio-quisqueya-juan-marichal', 'mlb-estadio-sonora',
  'mlb-florida-power-park', 'mlb-fort-lauderdale-stadium', 'mlb-fowler-park-and-cunningham-field',
  'mlb-hector-espino', 'mlb-holman-stadium', 'mlb-jack-russell-stadium',
  'mlb-johnson-stadium-at-doubleday-field', 'mlb-kino-veterans-memorial-stadium',
  'mlb-knights-stadium', 'mlb-mark-light-stadium', 'mlb-maryvale-baseball-complex',
  'mlb-max-bishop-stadium', 'mlb-nl-stadium', 'mlb-osceola-county-stadium', 'mlb-pge-park',
  'mlb-phoenix-municipal-stadium', 'mlb-progress-energy-park-home-of-al-lang-field',
  'mlb-regions-park', 'mlb-security-service-field', 'mlb-space-coast-stadium',
  'mlb-tianmu-baseball-stadium', 'mlb-us-west-sports-complex-hi-corbett-field',
  'mlb-wukesong-baseball-stadium', 'mlb-zephyr-field'
)
  and v.lat is null
  and not exists (select 1 from public.games g where g.venue_id = v.id)
  and not exists (select 1 from public.teams t where t.home_venue_id = v.id);
