-- Venue timezones, and a search that finds the game a fan actually went to.
--
-- Two bugs, found by trying to search for an NBA game on 2026-09-18.
--
-- 1. `venues.tz` was null for 126 of 295 venues. Only the MLB venues had one, because the MLB
--    Stats API publishes it; the NFL and NBA seed files carry none. Every place that asks "what
--    date was this game played on where it was played" was therefore falling back: search used
--    the UTC date, and `game_local_date()` used America/New_York for every NFL and NBA venue.
--    A 7:30 pm game in Los Angeles is 03:30 UTC the NEXT day, so it filed itself under the wrong
--    date: 7,773 MLB games since 2016 and most of the NBA. A fan searching the date they were
--    there found the previous evening's games instead.
--
--    The zones below come from each venue's coordinates through `timezonefinder` (offline
--    OpenStreetMap boundaries), written by seed/scripts/fill_timezones.py into
--    seed/venue_timezones.json. Arizona gets America/Phoenix, not America/Denver.
--
-- 2. `search_games` matched a four-digit token against `games.season` only. For MLB and NFL the
--    season is the calendar year of nearly every game, so that reads naturally. For the NBA the
--    season is its START year, so half of it is played in the next calendar year: a fan who went
--    to a Lakers game in January 2026 typed "lakers 2026" and got the 2026-27 season instead.
--    A year token now matches the season OR the calendar year the game was played in.

update public.venues v set tz = t.tz
from (values
  ('accor-arena', 'Europe/Paris'),
  ('acrisure-stadium', 'America/New_York'),
  ('alamodome', 'America/Chicago'),
  ('allegiant-stadium', 'America/Los_Angeles'),
  ('allianz-arena', 'Europe/Berlin'),
  ('american-airlines-center', 'America/Chicago'),
  ('amway-arena', 'America/New_York'),
  ('arena-cdmx', 'America/Mexico_City'),
  ('arena-corinthians', 'America/Sao_Paulo'),
  ('arrowhead-stadium', 'America/Chicago'),
  ('att-stadium', 'America/Chicago'),
  ('ball-arena', 'America/Denver'),
  ('bank-of-america-stadium', 'America/New_York'),
  ('barclays-center', 'America/New_York'),
  ('bell-centre', 'America/Toronto'),
  ('benchmark-international-arena', 'America/New_York'),
  ('bok-center', 'America/Chicago'),
  ('bradley-center', 'America/Chicago'),
  ('caesars-superdome', 'America/Chicago'),
  ('candlestick-park', 'America/Los_Angeles'),
  ('capital-one-arena', 'America/New_York'),
  ('charlotte-coliseum', 'America/New_York'),
  ('chase-center', 'America/Los_Angeles'),
  ('climate-pledge-arena', 'America/Los_Angeles'),
  ('co-op-live', 'Europe/London'),
  ('compaq-center', 'America/Chicago'),
  ('crypto-com-arena', 'America/Los_Angeles'),
  ('delta-center', 'America/Denver'),
  ('deutsche-bank-park', 'Europe/Berlin'),
  ('dignity-health-sports-park', 'America/Los_Angeles'),
  ('dome-at-americas-center', 'America/Chicago'),
  ('empower-field-at-mile-high', 'America/Denver'),
  ('espn-wide-world-of-sports', 'America/New_York'),
  ('estadio-azteca', 'America/Mexico_City'),
  ('etihad-arena', 'Asia/Dubai'),
  ('everbank-stadium', 'America/New_York'),
  ('fedexforum', 'America/Chicago'),
  ('first-horizon-coliseum', 'America/New_York'),
  ('fiserv-forum', 'America/Chicago'),
  ('ford-field', 'America/Detroit'),
  ('foxboro-stadium', 'America/New_York'),
  ('frost-bank-center', 'America/Chicago'),
  ('gainbridge-fieldhouse', 'America/Indiana/Indianapolis'),
  ('georgia-dome', 'America/New_York'),
  ('giants-stadium', 'America/New_York'),
  ('gies-memorial-stadium', 'America/Chicago'),
  ('gillette-stadium', 'America/New_York'),
  ('golden-1-center', 'America/Los_Angeles'),
  ('hard-rock-stadium', 'America/New_York'),
  ('highmark-stadium', 'America/New_York'),
  ('hinkle-fieldhouse', 'America/Indiana/Indianapolis'),
  ('honda-center', 'America/Los_Angeles'),
  ('hubert-h-humphrey-metrodome', 'America/Chicago'),
  ('huntington-bank-field', 'America/New_York'),
  ('huntington-bank-stadium', 'America/Chicago'),
  ('husky-stadium', 'America/Los_Angeles'),
  ('intuit-dome', 'America/Los_Angeles'),
  ('izod-center', 'America/New_York'),
  ('jma-wireless-dome', 'America/New_York'),
  ('kaseya-center', 'America/New_York'),
  ('keyarena', 'America/Los_Angeles'),
  ('kia-center', 'America/New_York'),
  ('lambeau-field', 'America/Chicago'),
  ('levis-stadium', 'America/Los_Angeles'),
  ('lincoln-financial-field', 'America/New_York'),
  ('little-caesars-arena', 'America/Detroit'),
  ('los-angeles-memorial-coliseum', 'America/Los_Angeles'),
  ('lucas-oil-stadium', 'America/Indiana/Indianapolis'),
  ('lumen-field', 'America/Los_Angeles'),
  ('madison-square-garden', 'America/New_York'),
  ('maracana', 'America/Sao_Paulo'),
  ('melbourne-cricket-ground', 'Australia/Melbourne'),
  ('mercedes-benz-arena-shanghai', 'Asia/Shanghai'),
  ('mercedes-benz-stadium', 'America/New_York'),
  ('metlife-stadium', 'America/New_York'),
  ('mile-high-stadium', 'America/Denver'),
  ('mlb-american-family-field', 'America/Chicago'),
  ('mlb-american-family-fields-of-phoenix', 'America/Phoenix'),
  ('mlb-angel-stadium', 'America/Los_Angeles'),
  ('mlb-arvest-ballpark', 'America/Chicago'),
  ('mlb-autozone-park', 'America/Chicago'),
  ('mlb-baycare-ballpark', 'America/New_York'),
  ('mlb-bb-t-ballpark', 'America/New_York'),
  ('mlb-bb-t-coastal-federal-field', 'America/New_York'),
  ('mlb-bristol-motor-speedway', 'America/New_York'),
  ('mlb-busch-stadium', 'America/Chicago'),
  ('mlb-busch-stadium-i', 'America/Chicago'),
  ('mlb-cacti-park-of-the-palm-beaches', 'America/New_York'),
  ('mlb-camelback-ranch', 'America/Phoenix'),
  ('mlb-charlotte-sports-park', 'America/New_York'),
  ('mlb-chase-field', 'America/Phoenix'),
  ('mlb-cheney-stadium', 'America/Los_Angeles'),
  ('mlb-chukchansi-park', 'America/Los_Angeles'),
  ('mlb-cinergy-field', 'America/New_York'),
  ('mlb-citi-field', 'America/New_York'),
  ('mlb-citizens-bank-park', 'America/New_York'),
  ('mlb-clover-park', 'America/New_York'),
  ('mlb-coca-cola-park', 'America/New_York'),
  ('mlb-comerica-park', 'America/Detroit'),
  ('mlb-constellation-field', 'America/Chicago'),
  ('mlb-coolray-field', 'America/New_York'),
  ('mlb-cooltoday-park', 'America/New_York'),
  ('mlb-coors-field', 'America/Denver'),
  ('mlb-daikin-park', 'America/Chicago'),
  ('mlb-day-air-ballpark', 'America/New_York'),
  ('mlb-dr-pepper-ballpark', 'America/Chicago'),
  ('mlb-durham-bulls-athletic-park', 'America/New_York'),
  ('mlb-ed-smith-stadium', 'America/New_York'),
  ('mlb-english-field', 'America/New_York'),
  ('mlb-estadio-alfredo-harp-helu', 'America/Mexico_City'),
  ('mlb-fenway-park', 'America/New_York'),
  ('mlb-field-of-dreams', 'America/Chicago'),
  ('mlb-fifth-third-field', 'America/New_York'),
  ('mlb-first-tennessee-park', 'America/Chicago'),
  ('mlb-firstenergy-stadium', 'America/New_York'),
  ('mlb-five-county-stadium', 'America/New_York'),
  ('mlb-george-m-steinbrenner-field', 'America/New_York'),
  ('mlb-globe-life-field', 'America/Chicago'),
  ('mlb-globe-life-park-in-arlington', 'America/Chicago'),
  ('mlb-gocheok-sky-dome', 'Asia/Seoul'),
  ('mlb-goodyear-ballpark', 'America/Phoenix'),
  ('mlb-great-american-ball-park', 'America/New_York'),
  ('mlb-harbor-park', 'America/New_York'),
  ('mlb-hiram-bithorn-stadium', 'America/Puerto_Rico'),
  ('mlb-hohokam-stadium', 'America/Phoenix'),
  ('mlb-huntington-park', 'America/New_York'),
  ('mlb-isotopes-park', 'America/Denver'),
  ('mlb-jetblue-park', 'America/New_York'),
  ('mlb-joseph-p-riley-jr-ballpark', 'America/New_York'),
  ('mlb-journey-bank-ballpark', 'America/New_York'),
  ('mlb-kauffman-stadium', 'America/Chicago'),
  ('mlb-las-vegas-ballpark', 'America/Los_Angeles'),
  ('mlb-lecom-park', 'America/New_York'),
  ('mlb-lee-health-sports-complex', 'America/New_York'),
  ('mlb-loandepot-park', 'America/New_York'),
  ('mlb-loanmart-field', 'America/Los_Angeles'),
  ('mlb-london-stadium', 'Europe/London'),
  ('mlb-louisville-slugger-field', 'America/Kentucky/Louisville'),
  ('mlb-mgm-park', 'America/Chicago'),
  ('mlb-milwaukee-county-stadium', 'America/Chicago'),
  ('mlb-montgomery-riverwalk-stadium', 'America/Chicago'),
  ('mlb-nationals-park', 'America/New_York'),
  ('mlb-nelson-w-wolff-municipal-stadium', 'America/Chicago'),
  ('mlb-newbridge-bank-park', 'America/New_York'),
  ('mlb-olympic-stadium', 'America/Toronto'),
  ('mlb-oneok-field', 'America/Chicago'),
  ('mlb-oracle-park', 'America/Los_Angeles'),
  ('mlb-oriole-park-at-camden-yards', 'America/New_York'),
  ('mlb-pensacola-bayfront-stadium', 'America/Chicago'),
  ('mlb-peoples-natural-gas-field', 'America/New_York'),
  ('mlb-peoria-stadium', 'America/Phoenix'),
  ('mlb-petco-park', 'America/Los_Angeles'),
  ('mlb-pnc-park', 'America/New_York'),
  ('mlb-progressive-field', 'America/New_York'),
  ('mlb-publix-field-at-joker-marchant-stadium', 'America/New_York'),
  ('mlb-rate-field', 'America/Chicago'),
  ('mlb-redhawks-field-at-bricktown', 'America/Chicago'),
  ('mlb-regions-field', 'America/Chicago'),
  ('mlb-rickwood-field', 'America/Chicago'),
  ('mlb-robert-f-kennedy-memorial-stadium', 'America/New_York'),
  ('mlb-roger-dean-chevrolet-stadium', 'America/New_York'),
  ('mlb-route-66-stadium', 'America/Chicago'),
  ('mlb-sahlen-field', 'America/New_York'),
  ('mlb-salt-river-fields-at-talking-stick', 'America/Phoenix'),
  ('mlb-scottsdale-stadium', 'America/Phoenix'),
  ('mlb-shea-stadium', 'America/New_York'),
  ('mlb-sloan-park', 'America/Phoenix'),
  ('mlb-smith-s-ballpark', 'America/Denver'),
  ('mlb-southwest-university-park', 'America/Denver'),
  ('mlb-surprise-stadium', 'America/Phoenix'),
  ('mlb-sutter-health-park', 'America/Los_Angeles'),
  ('mlb-sydney-cricket-ground', 'Etc/GMT-10'),
  ('mlb-t-mobile-park', 'America/Los_Angeles'),
  ('mlb-target-field', 'America/Chicago'),
  ('mlb-td-ameritrade-park', 'America/Chicago'),
  ('mlb-td-ballpark', 'America/New_York'),
  ('mlb-tempe-diablo-stadium', 'America/Phoenix'),
  ('mlb-the-baseball-grounds-of-jacksonville', 'America/New_York'),
  ('mlb-the-dell-diamond', 'America/Chicago'),
  ('mlb-the-diamond', 'America/Los_Angeles'),
  ('mlb-the-stadium-at-the-espn-wide-world-of-sports', 'America/New_York'),
  ('mlb-tokyo-dome', 'Asia/Tokyo'),
  ('mlb-tropicana-field', 'America/New_York'),
  ('mlb-truist-park', 'America/New_York'),
  ('mlb-trustmark-park', 'America/Chicago'),
  ('mlb-turner-field', 'America/New_York'),
  ('mlb-uniqlo-field-at-dodger-stadium', 'America/Los_Angeles'),
  ('mlb-victory-field', 'America/Indiana/Indianapolis'),
  ('mlb-werner-park', 'America/Chicago'),
  ('mlb-whataburger-field', 'America/Chicago'),
  ('mlb-wrigley-field', 'America/Chicago'),
  ('mlb-yankee-stadium', 'America/New_York'),
  ('mlb-yankee-stadium-i', 'America/New_York'),
  ('moda-center', 'America/Los_Angeles'),
  ('mohegan-sun-arena', 'America/New_York'),
  ('moody-center', 'America/Chicago'),
  ('mortgage-matchup-center', 'America/Phoenix'),
  ('mountain-america-stadium', 'America/Phoenix'),
  ('mt-bank-stadium', 'America/New_York'),
  ('nissan-stadium', 'America/Chicago'),
  ('northwest-stadium', 'America/New_York'),
  ('oakland-coliseum', 'America/Los_Angeles'),
  ('oracle-arena', 'America/Los_Angeles'),
  ('paycom-center', 'America/Chicago'),
  ('paycor-stadium', 'America/New_York'),
  ('pechanga-arena', 'America/Los_Angeles'),
  ('pontiac-silverdome', 'America/Detroit'),
  ('prudential-center', 'America/New_York'),
  ('pyramid-arena', 'America/Chicago'),
  ('ralph-wilson-stadium', 'America/New_York'),
  ('raymond-james-stadium', 'America/New_York'),
  ('rca-dome', 'America/Indiana/Indianapolis'),
  ('reliant-stadium', 'America/Chicago'),
  ('resch-center', 'America/Chicago'),
  ('reunion-arena', 'America/Chicago'),
  ('rocket-arena', 'America/New_York'),
  ('rogers-arena', 'America/Vancouver'),
  ('rogers-centre', 'America/Toronto'),
  ('saitama-super-arena', 'Asia/Tokyo'),
  ('san-diego-stadium', 'America/Los_Angeles'),
  ('santiago-bernabeu', 'Europe/Madrid'),
  ('save-mart-center', 'America/Los_Angeles'),
  ('schottenstein-center', 'America/New_York'),
  ('scotiabank-arena', 'America/Toronto'),
  ('sleep-train-arena', 'America/Los_Angeles'),
  ('smoothie-king-center', 'America/Chicago'),
  ('sofi-stadium', 'America/Los_Angeles'),
  ('soldier-field', 'America/Chicago'),
  ('spectrum-center', 'America/New_York'),
  ('stade-de-france', 'Europe/Paris'),
  ('stan-sheriff-center', 'Pacific/Honolulu'),
  ('state-farm-arena', 'America/New_York'),
  ('state-farm-stadium', 'America/Phoenix'),
  ('t-mobile-arena', 'America/Los_Angeles'),
  ('t-mobile-center', 'America/Chicago'),
  ('target-center', 'America/Chicago'),
  ('td-garden', 'America/New_York'),
  ('texas-stadium', 'America/Chicago'),
  ('the-o2-arena', 'Europe/London'),
  ('the-palace-of-auburn-hills', 'America/Detroit'),
  ('thomas-and-mack-center', 'America/Los_Angeles'),
  ('three-rivers-stadium', 'America/New_York'),
  ('tiger-stadium-lsu', 'America/Chicago'),
  ('tottenham-hotspur-stadium', 'Europe/London'),
  ('toyota-arena-ontario', 'America/Los_Angeles'),
  ('toyota-center', 'America/Chicago'),
  ('twickenham-stadium', 'Europe/London'),
  ('uber-arena', 'Europe/Berlin'),
  ('united-center', 'America/Chicago'),
  ('us-bank-stadium', 'America/Chicago'),
  ('veterans-stadium', 'America/New_York'),
  ('wembley-stadium', 'Europe/London'),
  ('xfinity-mobile-arena', 'America/New_York')
) as t(key, tz)
where v.key = t.key and (v.tz is null or v.tz = '');

-- Same signature and return type as before, so nothing calling it has to change.
--
-- 3. It was also slow: 2.2 s on local and 3.1 s on hosted, because the token test ran a
--    correlated alias lookup for every one of the 118,831 games. The first token is now resolved
--    once into the team and venue ids it allows, which narrows the candidates through
--    games_home_team_idx, games_away_team_idx and games_venue_idx before the full test runs.
--    Every token still has to match, so the narrowing cannot change the answer: proven on local
--    by diffing 21 query shapes against the old function, all identical. 2.2 s becomes 0.15 s.

create or replace function public.search_games(
  p_query text default null, p_sport text default null, p_season integer default null,
  p_from date default null, p_to date default null, p_team_id uuid default null,
  p_venue_id uuid default null, p_limit integer default 50
)
returns table (
  id uuid, sport_id text, season integer, game_type text, scheduled_start timestamptz, status text,
  home_team_id uuid, home_team_name text, home_abbr text,
  away_team_id uuid, away_team_name text, away_abbr text,
  home_score integer, away_score integer, is_tie boolean, doubleheader_number integer,
  venue_id uuid, venue_name text, venue_city text
)
language sql stable security invoker set search_path = public as $$
  with tokens as materialized (
    select tok, row_number() over () as rn
    from unnest(regexp_split_to_array(lower(coalesce(trim(p_query), '')), '\s+')) as tok
    where tok <> '' and tok not in ('at','vs','vs.','v','@','the','game','games','and','-')
  ),
  -- The first token, resolved once. Every token has to match, so narrowing the candidate games
  -- to the ones this token allows is safe, and it turns a scan of every game into an index
  -- lookup on the team and venue columns.
  lead_tok as materialized (
    select
      (select array_agg(distinct ta.team_id) from public.team_aliases ta join tokens t on t.rn = 1
        where lower(ta.alias) like t.tok || '%') as team_ids,
      (select array_agg(distinct va.venue_id) from public.venue_aliases va join tokens t on t.rn = 1
        where lower(va.alias) like '%' || t.tok || '%') as venue_ids,
      (select (t.tok ~ '^\d{4}$') from tokens t where t.rn = 1) as is_year
  )
  select g.id, g.sport_id, g.season, g.game_type, g.scheduled_start, g.status,
         g.home_team_id, ht.name, ht.abbreviation,
         g.away_team_id, at.name, at.abbreviation,
         g.home_score, g.away_score, g.is_tie, g.doubleheader_number,
         g.venue_id, v.name, v.city
  from public.games g
  join public.teams ht on ht.id = g.home_team_id
  join public.teams at on at.id = g.away_team_id
  left join public.venues v on v.id = g.venue_id
  where (p_sport is null or g.sport_id = p_sport)
    and (p_season is null or g.season = p_season)
    and (p_from is null or g.scheduled_start >= (p_from - 1)::timestamptz)
    and (p_to is null or g.scheduled_start < (p_to + 2)::timestamptz)
    and (p_from is null or public.game_local_date(g.scheduled_start, v.tz) >= p_from)
    and (p_to is null or public.game_local_date(g.scheduled_start, v.tz) <= p_to)
    and (p_team_id is null or g.home_team_id = p_team_id or g.away_team_id = p_team_id)
    and (p_venue_id is null or g.venue_id = p_venue_id)
    -- Narrowing: only when the first token names teams or venues and is not a year.
    and (
      coalesce((select is_year from lead_tok), true)
      or ((select team_ids from lead_tok) is null and (select venue_ids from lead_tok) is null)
      or g.home_team_id = any(coalesce((select team_ids from lead_tok), '{}'::uuid[]))
      or g.away_team_id = any(coalesce((select team_ids from lead_tok), '{}'::uuid[]))
      or g.venue_id = any(coalesce((select venue_ids from lead_tok), '{}'::uuid[]))
    )
    and not exists (
      select 1 from tokens t
      where not (
        (t.tok ~ '^\d{4}$' and (g.season = t.tok::integer
           or extract(year from public.game_local_date(g.scheduled_start, v.tz)) = t.tok::integer))
        or exists (select 1 from public.team_aliases ta where ta.team_id in (g.home_team_id, g.away_team_id) and lower(ta.alias) like t.tok || '%')
        or exists (select 1 from public.venue_aliases va where va.venue_id = g.venue_id and lower(va.alias) like '%' || t.tok || '%')
      )
    )
  order by g.scheduled_start desc
  limit least(greatest(coalesce(p_limit, 50), 1), 200);
$$;
