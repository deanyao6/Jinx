-- The welcome wall (SPEC.md 8.8, 4.5, 5.1): the six game cards drifting behind the sign-in
-- screen are real, recent games, restocked once a week without an app update.
--
-- Everything here is plain SQL that pg_cron calls directly. There is no Edge Function in the
-- scoring path on purpose: a scheduled call to a function needs both the legacy service JWT and
-- x-cron-secret (STATE.md section 7, trap 3), and a job that reads and writes one table has no
-- reason to leave Postgres. The public `welcome-wall` function only reads the result through
-- welcome_wall_current().
--
-- Judge the job by the rows in welcome_wall_cards, never by cron.job_run_details.

-- ---------------------------------------------------------------------------
-- 1. The table
-- ---------------------------------------------------------------------------
-- One row per card per week. `payload` holds only what the card draws (title, venue, date,
-- the side's W or L and how to find its colour); nothing about any user, because nobody is
-- signed in when it is shown.
create table public.welcome_wall_cards (
  week_start date not null,
  rank integer not null check (rank between 1 and 6),
  payload jsonb not null,
  created_at timestamptz not null default now(),
  primary key (week_start, rank)
);

-- Read by the service role through welcome_wall_current() only. No policy for anon or
-- authenticated: the app never queries this table itself.
alter table public.welcome_wall_cards enable row level security;

-- ---------------------------------------------------------------------------
-- 2. Scoring
-- ---------------------------------------------------------------------------
-- Every final, non-tied regular season or postseason game between p_from and p_to, with a
-- notability score. The weights, highest first, and what each one means:
--
--   100  postseason: any playoff game, the championship included
--    45  a detected moment in game_events: walk-off, no-hitter, perfect game, pick-six,
--        buzzer beater, grand slam, walk-off score (one per game, not stacked)
--    40  primetime: an NFL game starting 19:00 or later local time on a Thursday, Sunday or
--        Monday. NFL only: nearly every MLB, NBA and MLS game is a night game, so the label
--        would say nothing there
--    35  rivalry: the two teams share a division (teams.division; MLS has none)
--    30  a one-score finish: margin of 1 (MLB, MLS), 8 or less (NFL), 3 or less (NBA)
--    30  extra innings or overtime: innings_or_periods past regulation, or an event says so
--    25  a comeback: a comeback_14 event, or the scoring timeline shows the winner trailing by
--        14 or more (NFL, NBA) or 5 or more (MLB) at some point
--    15  a high combined score: 15 or more runs, 55 or more NFL points, 250 or more NBA
--        points, 5 or more goals
--    10  a large market or a big crowd: either team is in the market list below, or the
--        attendance is 40,000 (MLB), 70,000 (NFL), 19,000 (NBA) or 25,000 (MLS) or more
--
-- Ties are broken by recency. Draws are excluded: a card shows W or L and a draw is neither,
-- and a draw is rarely the result anyone talks about.
create or replace function public.welcome_wall_score_games(p_from timestamptz, p_to timestamptz)
returns table (
  game_id uuid,
  sport_id text,
  scheduled_start timestamptz,
  local_date date,
  night boolean,
  home_team_id uuid,
  away_team_id uuid,
  winner_team_id uuid,
  home_score integer,
  away_score integer,
  venue_name text,
  score integer,
  reasons text[]
)
language sql
stable
security definer
set search_path = public
as $$
  with base as (
    select
      g.id,
      g.sport_id,
      g.scheduled_start,
      g.game_type,
      g.home_team_id,
      g.away_team_id,
      g.winner_team_id,
      g.home_score,
      g.away_score,
      g.attendance,
      g.innings_or_periods,
      v.name as venue_name,
      (g.scheduled_start at time zone coalesce(nullif(v.tz, ''), 'America/New_York')) as local_start,
      ht.division as home_division,
      at.division as away_division,
      ht.abbreviation as home_abbr,
      at.abbreviation as away_abbr,
      abs(g.home_score - g.away_score) as margin,
      g.home_score + g.away_score as combined
    from public.games g
    join public.teams ht on ht.id = g.home_team_id
    join public.teams at on at.id = g.away_team_id
    left join public.venues v on v.id = g.venue_id
    where g.status = 'final'
      and g.game_type in ('regular', 'postseason')
      and not g.is_tie
      and g.home_score is not null
      and g.away_score is not null
      and g.home_score <> g.away_score
      and g.scheduled_start >= p_from
      and g.scheduled_start < p_to
  ),
  facts as (
    select
      b.*,
      extract(dow from b.local_start)::integer as local_dow,
      extract(hour from b.local_start)::integer as local_hour,
      exists (
        select 1 from public.game_events e
        where e.game_id = b.id
          and e.type in ('walk_off', 'walk_off_home_run', 'no_hitter', 'perfect_game', 'pick_six',
                         'buzzer_beater', 'grand_slam', 'walk_off_score')
      ) as has_moment,
      exists (
        select 1 from public.game_events e
        where e.game_id = b.id and e.type in ('overtime', 'extra_innings')
      ) as has_overtime_event,
      exists (
        select 1 from public.game_events e where e.game_id = b.id and e.type = 'comeback_14'
      ) as has_comeback_event,
      (
        -- The most the eventual winner trailed by, from the scoring timeline when it exists.
        select max(case when b.winner_team_id = b.home_team_id
                        then t.away_score - t.home_score
                        else t.home_score - t.away_score end)
        from public.game_scoring_timeline t
        where t.game_id = b.id
      ) as max_deficit,
      case b.sport_id when 'mlb' then 9 when 'nfl' then 4 when 'nba' then 4 else 2 end as regulation,
      case b.sport_id when 'mlb' then 1 when 'nfl' then 8 when 'nba' then 3 else 1 end as one_score,
      case b.sport_id when 'mlb' then 15 when 'nfl' then 55 when 'nba' then 250 else 5 end as high_combined,
      case b.sport_id when 'mlb' then 40000 when 'nfl' then 70000 when 'nba' then 19000 else 25000 end as big_crowd,
      case b.sport_id when 'mlb' then 5 else 14 end as comeback_margin,
      -- The largest markets and the teams a casual fan knows, by abbreviation as the seed spells it.
      case b.sport_id
        when 'mlb' then array['NYY', 'NYM', 'LAD', 'BOS', 'CHC', 'SF', 'PHI', 'ATL', 'HOU']
        when 'nfl' then array['DAL', 'NE', 'GB', 'PHI', 'KC', 'NYG', 'SF', 'PIT', 'CHI']
        when 'nba' then array['LAL', 'GSW', 'BOS', 'NYK', 'CHI', 'MIA', 'PHI', 'DAL']
        else array['LAFC', 'LA', 'MIA', 'ATL', 'SEA', 'NYC', 'RBNY']
      end as markets
    from base b
  ),
  scored as (
    select
      f.*,
      (f.game_type = 'postseason') as is_postseason,
      f.has_moment as is_moment,
      (f.sport_id = 'nfl' and f.local_hour >= 19 and f.local_dow in (0, 1, 4)) as is_primetime,
      (f.home_division is not null and f.home_division = f.away_division) as is_rivalry,
      (f.margin <= f.one_score) as is_one_score,
      (coalesce(f.innings_or_periods, 0) > f.regulation or f.has_overtime_event) as is_overtime,
      (f.has_comeback_event or coalesce(f.max_deficit, 0) >= f.comeback_margin) as is_comeback,
      (f.combined >= f.high_combined) as is_high_scoring,
      (f.home_abbr = any (f.markets) or f.away_abbr = any (f.markets)
        or coalesce(f.attendance, 0) >= f.big_crowd) as is_big_draw
    from facts f
  )
  select
    s.id,
    s.sport_id,
    s.scheduled_start,
    s.local_start::date,
    (s.local_hour >= 17),
    s.home_team_id,
    s.away_team_id,
    s.winner_team_id,
    s.home_score,
    s.away_score,
    s.venue_name,
    (case when s.is_postseason then 100 else 0 end
     + case when s.is_moment then 45 else 0 end
     + case when s.is_primetime then 40 else 0 end
     + case when s.is_rivalry then 35 else 0 end
     + case when s.is_one_score then 30 else 0 end
     + case when s.is_overtime then 30 else 0 end
     + case when s.is_comeback then 25 else 0 end
     + case when s.is_high_scoring then 15 else 0 end
     + case when s.is_big_draw then 10 else 0 end)::integer,
    array_remove(array[
      case when s.is_postseason then 'postseason' end,
      case when s.is_moment then 'moment' end,
      case when s.is_primetime then 'primetime' end,
      case when s.is_rivalry then 'rivalry' end,
      case when s.is_one_score then 'one_score' end,
      case when s.is_overtime then 'overtime' end,
      case when s.is_comeback then 'comeback' end,
      case when s.is_high_scoring then 'high_scoring' end,
      case when s.is_big_draw then 'big_draw' end
    ], null)
  from scored s
$$;

-- ---------------------------------------------------------------------------
-- 3. The date label
-- ---------------------------------------------------------------------------
-- What the card says under the venue, relative to the day it is read. The app recomputes this
-- from `played_on` and `night` with the same rules (features/onboarding/ui/wall/dateLabel.ts),
-- so a card written on Monday still reads right on Friday. The stored value is what the job saw.
--
--   yesterday            "Last night" for an evening game, "Yesterday" otherwise
--   2 to 6 days ago      the weekday, with " night" for an evening game: "Sunday", "Monday night"
--   today, or older      the date: "Sep 20, 2026"
create or replace function public.welcome_wall_date_label(p_played_on date, p_night boolean, p_today date)
returns text
language sql
immutable
as $$
  select case
    when p_today - p_played_on = 1 then case when p_night then 'Last night' else 'Yesterday' end
    when p_today - p_played_on between 2 and 6 then
      trim(to_char(p_played_on, 'FMDay')) || case when p_night then ' night' else '' end
    else trim(to_char(p_played_on, 'Mon')) || ' ' || extract(day from p_played_on)::text || ', ' || extract(year from p_played_on)::text
  end
$$;

-- ---------------------------------------------------------------------------
-- 4. The pick
-- ---------------------------------------------------------------------------
-- Six games for the week that contains p_now (weeks start on Monday, Eastern time), replacing
-- whatever that week already had. Candidates come from the last 7 days first; a week with
-- fewer than six is widened to 30 days, and after that to the whole of the last year, which
-- in the offseason is that season's biggest games (postseason first, by the same scores).
-- A card from a wider window carries a date rather than a weekday, so nothing stale reads as
-- current.
--
-- Within a window the pick is greedy by score: no team appears twice, no sport more than
-- three times, so with two or more sports in season the six are spread across them. The side
-- the card takes (its colour, its W or L) is the winner, except every third card, which takes
-- the loser, so the wall is not six green W's.
create or replace function public.welcome_wall_refresh(p_now timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (p_now at time zone 'America/New_York')::date;
  v_week_start date;
  v_picked integer := 0;
  v_used_teams uuid[] := '{}';
  v_by_sport jsonb := '{}'::jsonb;
  c record;
  v_side_is_winner boolean;
  v_side_team uuid;
  v_other_team uuid;
  v_side_score integer;
  v_other_score integer;
  v_side record;
  v_other record;
  v_winner_name text;
  v_loser_name text;
  v_winner_score integer;
  v_loser_score integer;
begin
  -- Monday of the week p_now falls in. dow: Sunday 0 .. Saturday 6.
  v_week_start := v_today - ((extract(dow from v_today)::integer + 6) % 7);

  delete from public.welcome_wall_cards where week_start = v_week_start;

  for c in
    with windows as (
      select 0 as tier, s.* from public.welcome_wall_score_games(p_now - interval '7 days', p_now) s
      union all
      select 1, s.* from public.welcome_wall_score_games(p_now - interval '30 days', p_now - interval '7 days') s
      union all
      select 2, s.* from public.welcome_wall_score_games(p_now - interval '365 days', p_now - interval '30 days') s
    )
    select * from windows w order by w.tier, w.score desc, w.scheduled_start desc
  loop
    exit when v_picked >= 6;
    continue when c.home_team_id = any (v_used_teams) or c.away_team_id = any (v_used_teams);
    continue when coalesce((v_by_sport ->> c.sport_id)::integer, 0) >= 3;

    v_picked := v_picked + 1;
    v_used_teams := v_used_teams || c.home_team_id || c.away_team_id;
    v_by_sport := jsonb_set(v_by_sport, array[c.sport_id],
      to_jsonb(coalesce((v_by_sport ->> c.sport_id)::integer, 0) + 1));

    v_side_is_winner := (v_picked % 3 <> 0);
    if (c.winner_team_id = c.home_team_id) = v_side_is_winner then
      v_side_team := c.home_team_id; v_other_team := c.away_team_id;
      v_side_score := c.home_score; v_other_score := c.away_score;
    else
      v_side_team := c.away_team_id; v_other_team := c.home_team_id;
      v_side_score := c.away_score; v_other_score := c.home_score;
    end if;

    select coalesce(nickname, name) as short_name, provider, provider_team_id into v_side
      from public.teams where id = v_side_team;
    select coalesce(nickname, name) as short_name into v_other
      from public.teams where id = v_other_team;

    if v_side_is_winner then
      v_winner_name := v_side.short_name; v_winner_score := v_side_score;
      v_loser_name := v_other.short_name; v_loser_score := v_other_score;
    else
      v_winner_name := v_other.short_name; v_winner_score := v_other_score;
      v_loser_name := v_side.short_name; v_loser_score := v_side_score;
    end if;

    insert into public.welcome_wall_cards (week_start, rank, payload)
    values (v_week_start, v_picked, jsonb_build_object(
      'game_id', c.game_id,
      'sport', c.sport_id,
      'title', v_winner_name || ' ' || v_winner_score || ', ' || v_loser_name || ' ' || v_loser_score,
      'venue', coalesce(c.venue_name, ''),
      'played_on', to_char(c.local_date, 'YYYY-MM-DD'),
      'night', c.night,
      'date_label', public.welcome_wall_date_label(c.local_date, c.night, v_today),
      'result', case when v_side_is_winner then 'W' else 'L' end,
      'team_id', v_side_team,
      'team_key', v_side.provider || ':' || v_side.provider_team_id,
      'score', c.score,
      'reasons', to_jsonb(c.reasons)
    ));
  end loop;

  return v_picked;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. What the public function serves
-- ---------------------------------------------------------------------------
-- The most recent week's cards, oldest rank first. The app validates the shape and falls
-- back to its bundled set on anything it does not understand, so this can only ever be
-- decorative.
create or replace function public.welcome_wall_current()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case when latest.week_start is null then null else jsonb_build_object(
    'week_start', to_char(latest.week_start, 'YYYY-MM-DD'),
    'updated_at', latest.updated_at,
    'cards', (
      select coalesce(jsonb_agg(w.payload order by w.rank), '[]'::jsonb)
      from public.welcome_wall_cards w
      where w.week_start = latest.week_start
    )
  ) end
  from (
    select week_start, max(created_at) as updated_at
    from public.welcome_wall_cards
    group by week_start
    order by week_start desc
    limit 1
  ) latest
$$;

revoke all on function public.welcome_wall_score_games(timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.welcome_wall_date_label(date, boolean, date) from public, anon, authenticated;
revoke all on function public.welcome_wall_refresh(timestamptz) from public, anon, authenticated;
revoke all on function public.welcome_wall_current() from public, anon, authenticated;
grant execute on function public.welcome_wall_score_games(timestamptz, timestamptz) to service_role;
grant execute on function public.welcome_wall_date_label(date, boolean, date) to service_role;
grant execute on function public.welcome_wall_refresh(timestamptz) to service_role;
grant execute on function public.welcome_wall_current() to service_role;

-- ---------------------------------------------------------------------------
-- 6. The schedule
-- ---------------------------------------------------------------------------
-- pg_cron runs in UTC. "Mondays 09:00 ET" is 13:00 UTC in summer and 14:00 in winter; 13:00 is
-- the one that is never later than 09:00 Eastern, so it is 8am there in winter and that is fine.
-- The Friday run only exists in NFL season (September to February), so a Thursday night game
-- can be on the wall for the weekend.
select cron.schedule('welcome-wall-weekly', '0 13 * * 1', $$select public.welcome_wall_refresh()$$);
select cron.schedule('welcome-wall-friday', '0 13 * 9-12,1,2 5', $$select public.welcome_wall_refresh()$$);
