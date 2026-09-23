-- Social v2, prompt 4: leaderboard, streak, counts and badge machinery
-- (docs/prompts/social/04_communities_and_leaderboards.md, docs/prompts/social/00_repo_reality.md).
--
-- Values live in `leaderboard_stats`, `season_streaks`, `user_counts` (created by prompt 1,
-- migration 20260924000700/000800) and are recomputed server side, never scanned by the client:
--   - `leaderboard_stats` and `user_counts`: plain SQL aggregation here, in
--     `recompute_user_leaderboard_stats` / `recompute_user_counts`.
--   - `season_streaks` and `user_badges`: `packages/core`'s `computeSeasonStreak` and
--     `evaluateGoal` (SPEC 6.13, R6) in the `evaluate-social` Edge Function, called the same way
--     `evaluate-goals` already is (guarded `to_regprocedure` hooks from `process_game_final` and
--     `attendances_after_write`, so this migration only needs to add the hook, not touch the
--     files that already call it optimistically).

-- ---------------------------------------------------------------------------
-- Season helpers, used for the "This season" leaderboard period and streak activity.
-- ---------------------------------------------------------------------------

create or replace function public.current_season(p_sport text)
returns integer
language sql
stable
as $$
  select season from public.games
  where sport_id = p_sport and scheduled_start <= now()
  order by scheduled_start desc limit 1;
$$;

create or replace function public.season_ended(p_sport text, p_season integer)
returns boolean
language sql
stable
as $$
  select not exists (
    select 1 from public.games
    where sport_id = p_sport and season = p_season and status in ('scheduled', 'live')
  );
$$;

-- The team row a franchise's history should be attributed to today, for a renamed or relocated
-- franchise: the active row when there is one, else the most recently added row.
create or replace function public.canonical_team_for_franchise(p_franchise_id text)
returns uuid
language sql
stable
as $$
  select id from public.teams where franchise_id = p_franchise_id order by active desc, id desc limit 1;
$$;

-- ---------------------------------------------------------------------------
-- goal_games: extended with the six fields badges need (00_repo_reality.md R6) that goals never
-- did. Doubleheader and Opening Day have no column, so both are derived here.
-- ---------------------------------------------------------------------------

create or replace function public.goal_games(p_user uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'gameId', u.game_id,
    'sport', u.sport_id,
    'scheduledStart', u.scheduled_start,
    'year', extract(year from (u.scheduled_start at time zone 'America/New_York'))::integer,
    'venueId', u.venue_id,
    'homeTeamId', u.home_team_id,
    'awayTeamId', u.away_team_id,
    'homeFranchiseId', ht.franchise_id,
    'awayFranchiseId', at.franchise_id,
    'rootingTeamId', u.rooting_team_id,
    'rootingFranchiseId', rt.franchise_id,
    'rootingBasis', u.rooting_basis,
    'result', u.result,
    'events', (select coalesce(jsonb_agg(distinct e.type), '[]'::jsonb) from public.game_events e where e.game_id = u.game_id),
    'companions', (select coalesce(jsonb_agg(ac.person_id), '[]'::jsonb) from public.attendance_companions ac where ac.attendance_id = u.attendance_id),
    'isNewVenue', u.venue_id is not null and not exists (
      select 1 from public.user_game_results(p_user) x
      where x.venue_id = u.venue_id and x.counted
        and (x.scheduled_start < u.scheduled_start or (x.scheduled_start = u.scheduled_start and x.attendance_id < u.attendance_id))),
    'isNewState', v.state is not null and not exists (
      select 1 from public.user_game_results(p_user) x
      join public.venues xv on xv.id = x.venue_id
      where xv.state = v.state and x.counted
        and (x.scheduled_start < u.scheduled_start or (x.scheduled_start = u.scheduled_start and x.attendance_id < u.attendance_id))),
    'timezone', v.tz,
    'temperatureF', u.temperature_f,
    'isDoubleheader', g.doubleheader_number is not null,
    'isOpeningDay', u.scheduled_start::date = (
      select min(g2.scheduled_start::date) from public.games g2
      where g2.sport_id = u.sport_id and g2.season = u.season and g2.game_type = 'regular'),
    'distanceFromHomeMiles', case
      when pr.home_lat is null or pr.home_lng is null or v.lat is null or v.lng is null then null
      else round((public.distance_km(pr.home_lat, pr.home_lng, v.lat, v.lng) * 0.621371)::numeric, 1)
    end,
    'pledge', (select jsonb_build_object('status', p.status, 'winProbAtPledge', p.win_prob_at_pledge) from public.pledges p where p.user_id = p_user and p.game_id = u.game_id),
    'isFinal', u.counted
  ) order by u.scheduled_start), '[]'::jsonb)
  from public.user_game_results(p_user) u
  join public.games g on g.id = u.game_id
  join public.teams ht on ht.id = u.home_team_id
  join public.teams at on at.id = u.away_team_id
  left join public.teams rt on rt.id = u.rooting_team_id
  left join public.venues v on v.id = u.venue_id
  left join public.profiles pr on pr.id = p_user
  where auth.uid() is null or public.can_view_user(p_user);
$$;

-- ---------------------------------------------------------------------------
-- Counts (section 4): lifetime (season = 0) and per-sport-per-season.
-- ---------------------------------------------------------------------------

create or replace function public.recompute_user_counts(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.user_counts where user_id = p_user;
  insert into public.user_counts (user_id, sport_id, season, games, verified_games)
  select p_user, sport_id, coalesce(season, 0), count(*)::integer, count(*) filter (where verified)::integer
  from (
    select g.sport_id, g.season, a.verified
    from public.attendances a
    join public.games g on g.id = a.game_id
    where a.user_id = p_user and a.status = 'attended' and g.status = 'final'
  ) x
  group by grouping sets ((sport_id, season), (sport_id));
end;
$$;

-- ---------------------------------------------------------------------------
-- Season game counts, for the Edge Function's streak computation (computeSeasonStreak).
-- ---------------------------------------------------------------------------

create or replace function public.season_game_counts(p_user uuid)
returns table (team_id uuid, sport_id text, season integer, games integer)
language sql
stable
security definer
set search_path = public
as $$
  select public.canonical_team_for_franchise(x.franchise_id), x.sport_id, x.season, count(*)::integer
  from (
    select g.id as game_id, g.season, g.sport_id, ht.franchise_id
    from public.attendances a
    join public.games g on g.id = a.game_id
    join public.teams ht on ht.id = g.home_team_id
    where a.user_id = p_user and a.status = 'attended' and g.status = 'final'
    union all
    select g.id, g.season, g.sport_id, at2.franchise_id
    from public.attendances a
    join public.games g on g.id = a.game_id
    join public.teams at2 on at2.id = g.away_team_id
    where a.user_id = p_user and a.status = 'attended' and g.status = 'final'
  ) x
  group by x.franchise_id, x.sport_id, x.season;
$$;

-- The current season and whether it has ended, for every sport in one call.
create or replace function public.season_status()
returns table (sport_id text, season integer, ended boolean)
language sql
stable
as $$
  select s.id, public.current_season(s.id), public.season_ended(s.id, public.current_season(s.id))
  from public.sports s;
$$;

-- ---------------------------------------------------------------------------
-- Leaderboard stats (section 2): additive per user per community per period. `achieved_at` is
-- the most recent qualifying game's timestamp, used only for the earliest-achievement tie-break
-- (leaderboard.ts `rankLeaderboard`): between two users tied on value, whoever's run of
-- qualifying games stopped growing earlier got there first.
-- ---------------------------------------------------------------------------

alter table public.leaderboard_stats add column if not exists achieved_at timestamptz not null default now();

-- `p_community_id`: null recomputes every community the user belongs to (game-final, a
-- verification change); a specific id scopes it to just that one (joining), so joining a second
-- community never wipes rows a nightly or game-final pass already wrote for the first.
create or replace function public.recompute_user_leaderboard_stats(p_user uuid, p_community_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_period text;
  v_season integer;
  v_bucket integer;
  v_month integer := extract(year from now())::integer * 100 + extract(month from now())::integer;
begin
  delete from public.leaderboard_stats
  where user_id = p_user and (p_community_id is null or community_id = p_community_id);

  for r in
    select cm.community_id, c.kind, c.venue_id, t.sport_id, t.franchise_id
    from public.community_members cm
    join public.communities c on c.id = cm.community_id
    left join public.teams t on t.id = c.team_id
    where cm.user_id = p_user and (p_community_id is null or cm.community_id = p_community_id)
  loop
    v_season := case when r.sport_id is not null then public.current_season(r.sport_id)
                     else extract(year from now())::integer end;

    for v_period in select unnest(array['all', 'season', 'month']) loop
      v_bucket := case v_period when 'all' then 0 when 'season' then v_season else v_month end;

      with qualifying as (
        select a.id as attendance_id, g.id as game_id, g.season, g.scheduled_start, g.venue_id,
               a.rooting_team_id,
               case
                 when a.rooting_team_id is null or g.home_score is null or g.away_score is null then null
                 when g.home_score = g.away_score then 'tie'
                 when (a.rooting_team_id = g.home_team_id) = (g.home_score > g.away_score) then 'win'
                 else 'loss'
               end as result
        from public.attendances a
        join public.games g on g.id = a.game_id
        left join public.teams ht on ht.id = g.home_team_id
        left join public.teams at2 on at2.id = g.away_team_id
        where a.user_id = p_user and a.status = 'attended' and a.verified and g.status = 'final'
          and (
            (r.kind = 'team' and (ht.franchise_id = r.franchise_id or at2.franchise_id = r.franchise_id))
            or (r.kind = 'venue' and g.venue_id = r.venue_id)
            or r.kind in ('school', 'custom')
          )
          and (
            v_period = 'all'
            or (v_period = 'season' and g.season = v_season)
            or (v_period = 'month' and to_char(g.scheduled_start, 'YYYYMM')::integer = v_month)
          )
      ),
      stats(stat_key, value, achieved_at) as (
        select 'games', count(*)::numeric, max(scheduled_start) from qualifying where r.kind <> 'venue'
        union all
        select 'venue_games', count(*)::numeric, max(scheduled_start) from qualifying where r.kind = 'venue'
        union all
        select 'wins', count(*)::numeric, max(scheduled_start) from qualifying where result = 'win'
        union all
        select 'stadiums', count(distinct venue_id)::numeric, max(scheduled_start)
        from qualifying where r.kind <> 'venue' and venue_id is not null
        union all
        select 'mlb_home_runs', coalesce(sum((ga.line->>'hr')::numeric), 0), max(q.scheduled_start)
        from qualifying q join public.game_appearances ga on ga.game_id = q.game_id
        where r.sport_id = 'mlb'
        union all
        select 'mlb_walk_offs', count(*)::numeric, max(q.scheduled_start)
        from qualifying q
        where r.sport_id = 'mlb' and exists (
          select 1 from public.game_events e where e.game_id = q.game_id and e.type in ('walk_off', 'walk_off_home_run'))
        union all
        select 'mlb_shutouts', count(*)::numeric, max(q.scheduled_start)
        from qualifying q
        where r.sport_id = 'mlb' and exists (
          select 1 from public.game_events e where e.game_id = q.game_id and e.type = 'shutout')
        union all
        select 'mlb_extra_innings', count(*)::numeric, max(q.scheduled_start)
        from qualifying q
        where r.sport_id = 'mlb' and exists (
          select 1 from public.game_events e where e.game_id = q.game_id and e.type = 'extra_innings')
        union all
        select 'nfl_touchdowns', coalesce(sum((ga.line->>'td')::numeric), 0), max(q.scheduled_start)
        from qualifying q join public.game_appearances ga on ga.game_id = q.game_id
        where r.sport_id = 'nfl'
        union all
        select 'nfl_overtimes', count(*)::numeric, max(q.scheduled_start)
        from qualifying q
        where r.sport_id = 'nfl' and exists (
          select 1 from public.game_events e where e.game_id = q.game_id and e.type = 'overtime')
        union all
        select 'nba_30pt_games', count(distinct q.game_id)::numeric, max(q.scheduled_start)
        from qualifying q join public.game_appearances ga on ga.game_id = q.game_id
        where r.sport_id = 'nba' and (ga.line->>'pts')::numeric >= 30
        union all
        select 'nba_buzzer_beaters', count(*)::numeric, max(q.scheduled_start)
        from qualifying q
        where r.sport_id = 'nba' and exists (
          select 1 from public.game_events e where e.game_id = q.game_id and e.type = 'buzzer_beater')
        union all
        select 'nba_overtimes', count(*)::numeric, max(q.scheduled_start)
        from qualifying q
        where r.sport_id = 'nba' and exists (
          select 1 from public.game_events e where e.game_id = q.game_id and e.type = 'overtime')
        union all
        select 'mls_goals', coalesce(sum((ga.line->>'goals')::numeric), 0), max(q.scheduled_start)
        from qualifying q join public.game_appearances ga on ga.game_id = q.game_id
        where r.sport_id = 'mls'
        union all
        select 'mls_clean_sheets', count(distinct q.game_id)::numeric, max(q.scheduled_start)
        from qualifying q join public.game_appearances ga on ga.game_id = q.game_id
        where r.sport_id = 'mls' and (ga.line->>'clean_sheet')::boolean is true
      )
      insert into public.leaderboard_stats (user_id, community_id, period, season, stat_key, value, verified_only, achieved_at, updated_at)
      select p_user, r.community_id, v_period, v_bucket, stat_key, value, true, coalesce(achieved_at, now()), now()
      from stats
      where value > 0
      on conflict (user_id, community_id, period, season, stat_key)
      do update set value = excluded.value, achieved_at = excluded.achieved_at, updated_at = now();
    end loop;
  end loop;
end;
$$;

-- One ranked page plus the viewer's own row, even when it falls outside `p_limit` (pinned).
create or replace function public.community_leaderboard(
  p_community_id uuid, p_period text, p_season integer, p_stat_key text,
  p_friends_only boolean default false, p_limit integer default 50
)
returns table (rank integer, user_id uuid, handle text, display_name text, avatar_path text, value numeric, is_viewer boolean)
language sql
stable
security definer
set search_path = public
as $$
  select r.rnk::integer, r.user_id, p.handle, p.display_name, p.avatar_path, r.value, (r.user_id = auth.uid())
  from (
    select ls.user_id, ls.value,
           row_number() over (order by ls.value desc, ls.achieved_at asc) as rnk
    from public.leaderboard_stats ls
    where ls.community_id = p_community_id and ls.period = p_period and ls.season = p_season
      and ls.stat_key = p_stat_key
      and (auth.uid() is null or not public.is_blocked_between(auth.uid(), ls.user_id))
      and (not p_friends_only or ls.user_id = auth.uid() or public.follows_active(auth.uid(), ls.user_id))
  ) r
  join public.profiles p on p.id = r.user_id
  where public.is_community_member(p_community_id)
    and (r.rnk <= greatest(p_limit, 1) or r.user_id = auth.uid())
  order by r.rnk;
$$;

revoke all on function public.recompute_user_counts(uuid) from public, anon, authenticated;
revoke all on function public.season_game_counts(uuid) from public, anon, authenticated;
revoke all on function public.recompute_user_leaderboard_stats(uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- The optional post-final hooks (same guarded pattern as evaluate_goals_for_users). Recomputing
-- counts and leaderboard stats is cheap SQL, so it always runs; evaluate_social_for_users is the
-- Edge Function call (streaks + badges), gated the same way evaluate_goals_for_users is.
-- ---------------------------------------------------------------------------

create or replace function public.recompute_social_stats_for_users(p_users uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare u uuid;
begin
  if p_users is null then return; end if;
  foreach u in array p_users loop
    perform public.recompute_user_counts(u);
    perform public.recompute_user_leaderboard_stats(u);
  end loop;
end;
$$;

create or replace function public.evaluate_social_for_users(p_users uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_users is null or array_length(p_users, 1) is null then return; end if;
  perform public.call_edge_function('evaluate-social', jsonb_build_object('user_ids', to_jsonb(p_users)));
end;
$$;

revoke all on function public.recompute_social_stats_for_users(uuid[]) from public, anon, authenticated;
revoke all on function public.evaluate_social_for_users(uuid[]) from public, anon, authenticated;

-- process_game_final: re-defined (as famous_games.sql already did once) to add the new calls
-- after the existing ones. Body otherwise identical.
create or replace function public.process_game_final(p_game_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_users uuid[];
  u uuid;
begin
  update public.attendances set status = 'attended' where game_id = p_game_id and status = 'going'
    and exists (select 1 from public.games g where g.id = p_game_id and g.status = 'final');
  if to_regprocedure('public.validate_pledges_for_game(uuid)') is not null then
    execute 'select public.validate_pledges_for_game($1)' using p_game_id;
  end if;
  select array_agg(distinct user_id) into v_users from public.attendances where game_id = p_game_id;
  if v_users is not null then
    foreach u in array v_users loop
      perform public.recompute_rooting_for_user(u);
      perform public.refresh_user_stats(u);
    end loop;
  end if;
  if to_regprocedure('public.evaluate_goals_for_users(uuid[])') is not null then
    execute 'select public.evaluate_goals_for_users($1)' using v_users;
  end if;
  if to_regprocedure('public.recompute_social_stats_for_users(uuid[])') is not null then
    execute 'select public.recompute_social_stats_for_users($1)' using v_users;
  end if;
  if to_regprocedure('public.evaluate_social_for_users(uuid[])') is not null then
    execute 'select public.evaluate_social_for_users($1)' using v_users;
  end if;
  return jsonb_build_object('users', coalesce(array_length(v_users, 1), 0));
end;
$$;

revoke all on function public.process_game_final(uuid) from public, anon, authenticated;

-- attendances_after_write: re-defined (as famous_games.sql already did once) to add the same
-- two calls after refresh_user_stats. Body otherwise identical to the famous_games.sql version.
create or replace function public.attendances_after_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := coalesce(new.user_id, old.user_id);
  v_count integer;
  v_first_at_venue boolean;
  v_venue record;
  v_famous jsonb;
begin
  if tg_op = 'INSERT' and new.status = 'attended' then
    select count(*) into v_count from public.attendances where user_id = v_user and status = 'attended';
    insert into public.feed_events (actor_user_id, type, game_id, payload)
    values (v_user, 'logged_game', new.game_id, jsonb_build_object('source', new.source));
    select v.id, v.name into v_venue from public.games g join public.venues v on v.id = g.venue_id where g.id = new.game_id;
    if v_venue.id is not null then
      select not exists (
        select 1 from public.attendances a
        join public.games g on g.id = a.game_id
        join public.games ng on ng.id = new.game_id
        where a.user_id = v_user and a.id <> new.id and g.venue_id = v_venue.id and a.status = 'attended'
          and (g.scheduled_start < ng.scheduled_start or (g.scheduled_start = ng.scheduled_start and a.id < new.id))
      ) into v_first_at_venue;
      if v_first_at_venue then
        insert into public.feed_events (actor_user_id, type, game_id, payload)
        values (v_user, 'new_stamp', new.game_id, jsonb_build_object('venue_id', v_venue.id, 'venue_name', v_venue.name));
        insert into public.notifications (user_id, kind, title, body, data)
        values (v_user, 'new_stamp', 'New stamp', v_venue.name || ' added to your passport.', jsonb_build_object('venue_id', v_venue.id));
      end if;
    end if;
    if v_count in (10, 25, 50, 100, 250, 500) then
      insert into public.feed_events (actor_user_id, type, game_id, payload)
      values (v_user, 'milestone', new.game_id, jsonb_build_object('games', v_count));
      insert into public.notifications (user_id, kind, title, body, data)
      values (v_user, 'milestone', 'Milestone', 'That was your ' || v_count || 'th game.', jsonb_build_object('games', v_count));
    end if;
    v_famous := public.famous_game_headline(new.game_id);
    if v_famous is not null and not exists (
      select 1 from public.feed_events e where e.actor_user_id = v_user and e.game_id = new.game_id and e.type = 'famous_game'
    ) then
      insert into public.feed_events (actor_user_id, type, game_id, payload)
      values (v_user, 'famous_game', new.game_id, v_famous);
    end if;
  end if;
  perform public.refresh_user_stats(v_user);
  if to_regprocedure('public.recompute_social_stats_for_users(uuid[])') is not null then
    perform public.recompute_social_stats_for_users(array[v_user]);
  end if;
  if to_regprocedure('public.evaluate_social_for_users(uuid[])') is not null then
    perform public.evaluate_social_for_users(array[v_user]);
  end if;
  return null;
end;
$$;

-- Joining a community: seed this member's leaderboard rows for it right away, so a fresh member
-- never sees a blank board until the next game-final recompute (section 7: "immediately").
create or replace function public.community_members_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.recompute_user_leaderboard_stats(new.user_id, new.community_id);
  return null;
end;
$$;

drop trigger if exists community_members_after_insert on public.community_members;
create trigger community_members_after_insert
  after insert on public.community_members
  for each row execute function public.community_members_after_insert();

-- A badge earned makes a system post (section 5: "creates a system post and a share card").
alter table public.feed_events drop constraint if exists feed_events_type_check;
alter table public.feed_events add constraint feed_events_type_check
  check (type in ('logged_game', 'pledge_won', 'pledge_lost', 'new_stamp', 'goal_completed', 'milestone', 'wrapped_published', 'famous_game', 'badge_earned'));
