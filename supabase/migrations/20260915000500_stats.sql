-- Rooting side, records, stamps, superlatives, stats cache, feed events, post-final processing.
-- Mirrors packages/core/src/{rooting,records}.ts (SPEC.md 6.1, 6.2, 6.8, 6.9, 6.16).

-- ---------------------------------------------------------------------------
-- Geometry helper (great-circle distance in km)
-- ---------------------------------------------------------------------------
create or replace function public.distance_km(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns double precision
language sql
immutable
as $$
  select case when lat1 is null or lng1 is null or lat2 is null or lng2 is null then null
  else 2 * 6371.0088 * asin(sqrt(
      power(sin(radians(lat2 - lat1) / 2), 2)
      + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)))
  end;
$$;

-- ---------------------------------------------------------------------------
-- Rooting side (SPEC 6.1). Favorites are matched by franchise, evaluated as of now.
-- ---------------------------------------------------------------------------
create or replace function public.compute_rooting(p_user uuid, p_game uuid, p_current_team uuid, p_current_basis text)
returns table (team_id uuid, basis text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  g record;
  home_fav boolean;
  away_fav boolean;
  pledge_team uuid;
begin
  select gm.home_team_id, gm.away_team_id, ht.franchise_id as home_fr, at.franchise_id as away_fr
    into g
  from public.games gm
  join public.teams ht on ht.id = gm.home_team_id
  join public.teams at on at.id = gm.away_team_id
  where gm.id = p_game;
  if not found then
    return query select null::uuid, null::text; return;
  end if;
  home_fav := exists (select 1 from public.user_teams ut join public.teams t on t.id = ut.team_id where ut.user_id = p_user and t.franchise_id = g.home_fr);
  away_fav := exists (select 1 from public.user_teams ut join public.teams t on t.id = ut.team_id where ut.user_id = p_user and t.franchise_id = g.away_fr);
  if home_fav and away_fav then
    if p_current_basis = 'chosen' and p_current_team in (g.home_team_id, g.away_team_id) then
      return query select p_current_team, 'chosen'::text; return;
    end if;
    return query select null::uuid, null::text; return;
  elsif home_fav then
    return query select g.home_team_id, 'favorite'::text; return;
  elsif away_fav then
    return query select g.away_team_id, 'favorite'::text; return;
  end if;
  select p.team_id into pledge_team from public.pledges p where p.user_id = p_user and p.game_id = p_game and p.status = 'valid';
  if pledge_team is not null then
    return query select pledge_team, 'pledge'::text; return;
  end if;
  return query select null::uuid, null::text;
end;
$$;

create or replace function public.attendances_before_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  select * into r from public.compute_rooting(new.user_id, new.game_id, new.rooting_team_id, new.rooting_basis);
  new.rooting_team_id := r.team_id;
  new.rooting_basis := r.basis;
  return new;
end;
$$;

create trigger attendances_rooting
  before insert or update of rooting_team_id, rooting_basis, game_id on public.attendances
  for each row execute function public.attendances_before_write();

-- Recompute rooting for every attendance of a user (favorites changed, pledge validated).
create or replace function public.recompute_rooting_for_user(p_user uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.attendances a
  set rooting_team_id = r.team_id, rooting_basis = r.basis
  from (
    select a2.id, c.team_id, c.basis
    from public.attendances a2
    cross join lateral public.compute_rooting(a2.user_id, a2.game_id, a2.rooting_team_id, a2.rooting_basis) c
    where a2.user_id = p_user
  ) r
  where r.id = a.id
    and (a.rooting_team_id is distinct from r.team_id or a.rooting_basis is distinct from r.basis);
$$;

-- ---------------------------------------------------------------------------
-- Records and stats (SPEC 6.2, 6.8, 6.9)
-- ---------------------------------------------------------------------------

-- One row per attended game with its result from the user's side.
create or replace function public.user_game_results(p_user uuid)
returns table (
  attendance_id uuid, game_id uuid, sport_id text, season integer, scheduled_start timestamptz, status text,
  venue_id uuid, home_team_id uuid, away_team_id uuid, home_score integer, away_score integer,
  rooting_team_id uuid, rooting_basis text, result text, counted boolean,
  temperature_f integer, duration_minutes integer, innings_or_periods integer, attendance integer
)
language sql
stable
security definer
set search_path = public
as $$
  select a.id, g.id, g.sport_id, g.season, g.scheduled_start, g.status,
         g.venue_id, g.home_team_id, g.away_team_id, g.home_score, g.away_score,
         a.rooting_team_id, a.rooting_basis,
         case
           when g.status <> 'final' or a.rooting_team_id is null or g.home_score is null or g.away_score is null then null
           when g.home_score = g.away_score then 'tie'
           when (a.rooting_team_id = g.home_team_id) = (g.home_score > g.away_score) then 'win'
           else 'loss'
         end as result,
         (g.status = 'final') as counted,
         g.temperature_f, g.duration_minutes, g.innings_or_periods, g.attendance
  from public.attendances a
  join public.games g on g.id = a.game_id
  where a.user_id = p_user and a.status = 'attended';
$$;

create or replace function public.record_json(p_wins bigint, p_losses bigint, p_ties bigint)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object('wins', coalesce(p_wins, 0), 'losses', coalesce(p_losses, 0), 'ties', coalesce(p_ties, 0));
$$;

create or replace function public.compute_user_stats(p_user uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_home_lat double precision;
  v_home_lng double precision;
  v_totals jsonb;
  v_overall jsonb;
  v_teams jsonb;
  v_pledge jsonb;
  v_stamps jsonb;
  v_super jsonb := '{}'::jsonb;
  v_moments jsonb;
  v_players_seen integer;
  v_streaks jsonb;
  r record;
  run integer := 0;
  longest_win integer := 0;
  longest_loss integer := 0;
begin
  select home_lat, home_lng into v_home_lat, v_home_lng from public.profiles where id = p_user;

  create temp table if not exists _ugr on commit drop as select * from public.user_game_results(p_user);
  truncate _ugr;
  insert into _ugr select * from public.user_game_results(p_user);

  select jsonb_build_object(
    'games', count(*) filter (where counted),
    'venues', count(distinct venue_id) filter (where counted),
    'states', count(distinct v.state) filter (where counted and v.state is not null),
    'countries', count(distinct coalesce(v.country, 'USA')) filter (where counted)
  ) into v_totals
  from _ugr u left join public.venues v on v.id = u.venue_id;

  select public.record_json(count(*) filter (where result = 'win'), count(*) filter (where result = 'loss'), count(*) filter (where result = 'tie'))
    into v_overall from _ugr;

  -- Team records: one tile per followed franchise (current team row carries the name).
  select coalesce(jsonb_agg(t order by t -> 'record' desc), '[]'::jsonb) into v_teams
  from (
    select jsonb_build_object(
      'franchise_id', f.franchise_id,
      'team_id', f.team_id,
      'name', f.name,
      'abbreviation', f.abbreviation,
      'sport_id', f.sport_id,
      'record', public.record_json(
        (select count(*) from _ugr u join public.teams rt on rt.id = u.rooting_team_id where rt.franchise_id = f.franchise_id and u.result = 'win'),
        (select count(*) from _ugr u join public.teams rt on rt.id = u.rooting_team_id where rt.franchise_id = f.franchise_id and u.result = 'loss'),
        (select count(*) from _ugr u join public.teams rt on rt.id = u.rooting_team_id where rt.franchise_id = f.franchise_id and u.result = 'tie'))
    ) as t
    from (
      select distinct on (t.franchise_id) t.franchise_id, t.id as team_id, t.name, t.abbreviation, t.sport_id
      from public.user_teams ut join public.teams t on t.id = ut.team_id
      where ut.user_id = p_user
      order by t.franchise_id, t.active desc
    ) f
  ) s;

  select jsonb_build_object(
    'record', public.record_json(count(*) filter (where u.result = 'win'), count(*) filter (where u.result = 'loss'), count(*) filter (where u.result = 'tie')),
    'vs_expected', round(coalesce(sum(case u.result when 'win' then 1 when 'tie' then 0.5 else 0 end - p.win_prob_at_pledge), 0)::numeric, 2)
  ) into v_pledge
  from _ugr u
  join public.pledges p on p.game_id = u.game_id and p.user_id = p_user and p.status = 'valid'
  where u.rooting_basis = 'pledge' and u.result is not null;

  select coalesce(jsonb_agg(s order by s -> 'visits' desc, s ->> 'first_visit'), '[]'::jsonb) into v_stamps
  from (
    select jsonb_build_object(
      'venue_id', v.id, 'name', v.name, 'city', v.city, 'state', v.state, 'country', v.country,
      'visits', count(*), 'first_visit', min(u.scheduled_start),
      'sports', (select jsonb_agg(distinct x.sport_id) from _ugr x where x.venue_id = v.id),
      'closed', v.closed_year is not null and v.closed_year <= extract(year from now())::integer,
      'lat', v.lat, 'lng', v.lng
    ) as s
    from _ugr u join public.venues v on v.id = u.venue_id
    where u.counted
    group by v.id
  ) q;

  -- Superlatives (each skips games missing the needed data). Every piece is wrapped in coalesce so a
  -- missing superlative never nulls the accumulator.
  v_super := v_super || coalesce((select jsonb_build_object('coldest', jsonb_build_object('game_id', game_id, 'value', temperature_f))
    from _ugr where counted and temperature_f is not null order by temperature_f asc, scheduled_start limit 1), '{}'::jsonb);
  v_super := v_super || coalesce((select jsonb_build_object('hottest', jsonb_build_object('game_id', game_id, 'value', temperature_f))
    from _ugr where counted and temperature_f is not null order by temperature_f desc, scheduled_start limit 1), '{}'::jsonb);
  v_super := v_super || coalesce((select jsonb_build_object('longest', jsonb_build_object('game_id', game_id, 'minutes', duration_minutes, 'periods', innings_or_periods))
    from _ugr where counted and (duration_minutes is not null or innings_or_periods is not null)
    order by coalesce(duration_minutes, 0) desc, coalesce(innings_or_periods, 0) desc limit 1), '{}'::jsonb);
  v_super := v_super || coalesce((select jsonb_build_object('highest_scoring', jsonb_build_object('game_id', game_id, 'total', home_score + away_score))
    from _ugr where counted and home_score is not null order by home_score + away_score desc, scheduled_start limit 1), '{}'::jsonb);
  v_super := v_super || coalesce((select jsonb_build_object('lowest_scoring', jsonb_build_object('game_id', game_id, 'total', home_score + away_score))
    from _ugr where counted and home_score is not null order by home_score + away_score asc, scheduled_start limit 1), '{}'::jsonb);

  -- Biggest comeback by the user's side: max deficit later overcome in a win.
  v_super := v_super || coalesce((
    select jsonb_build_object('biggest_comeback', jsonb_build_object('game_id', c.game_id, 'deficit', c.deficit))
    from (
      select u.game_id,
             max(case when u.rooting_team_id = u.home_team_id then t.away_score - t.home_score else t.home_score - t.away_score end) as deficit
      from _ugr u join public.game_scoring_timeline t on t.game_id = u.game_id
      where u.result = 'win'
      group by u.game_id
    ) c
    where c.deficit > 0
    order by c.deficit desc limit 1), '{}'::jsonb);

  v_super := v_super || coalesce((
    select jsonb_build_object('most_seen_player', jsonb_build_object('player_id', p.id, 'name', p.full_name, 'count', cnt))
    from (
      select ga.player_id, count(*) as cnt
      from _ugr u join public.game_appearances ga on ga.game_id = u.game_id
      where u.counted group by ga.player_id order by cnt desc limit 1
    ) m join public.players p on p.id = m.player_id), '{}'::jsonb);

  v_super := v_super || jsonb_build_object('most_seen_by_team', coalesce((
    select jsonb_agg(x) from (
      select distinct on (f.franchise_id) jsonb_build_object('franchise_id', f.franchise_id, 'team_name', f.name, 'player_id', p.id, 'name', p.full_name, 'count', cnt) as x
      from (
        select distinct on (t.franchise_id) t.franchise_id, t.name from public.user_teams ut join public.teams t on t.id = ut.team_id where ut.user_id = p_user order by t.franchise_id, t.active desc
      ) f
      join lateral (
        select ga.player_id, count(*) as cnt
        from _ugr u join public.game_appearances ga on ga.game_id = u.game_id join public.teams gt on gt.id = ga.team_id
        where u.counted and gt.franchise_id = f.franchise_id group by ga.player_id order by cnt desc limit 1
      ) m on true
      join public.players p on p.id = m.player_id
    ) q), '[]'::jsonb));

  v_super := v_super || coalesce((
    select jsonb_build_object('most_visited_venue', jsonb_build_object('venue_id', v.id, 'name', v.name, 'visits', cnt))
    from (select venue_id, count(*) cnt from _ugr where counted and venue_id is not null group by venue_id order by cnt desc limit 1) m
    join public.venues v on v.id = m.venue_id), '{}'::jsonb);

  if v_home_lat is not null then
    v_super := v_super || coalesce((
      select jsonb_build_object('farthest_venue', jsonb_build_object('venue_id', v.id, 'name', v.name, 'km', round(d::numeric)))
      from (select distinct u.venue_id, public.distance_km(v_home_lat, v_home_lng, v.lat, v.lng) d from _ugr u join public.venues v on v.id = u.venue_id where u.counted and v.lat is not null) m
      join public.venues v on v.id = m.venue_id
      order by d desc limit 1), '{}'::jsonb);

    v_super := v_super || coalesce((
      select jsonb_build_object('most_miles_team', jsonb_build_object('franchise_id', m.franchise_id, 'team_name', m.name, 'km', round(m.km::numeric)))
      from (
        select rt.franchise_id, min(rt.name) as name, sum(public.distance_km(v_home_lat, v_home_lng, v.lat, v.lng)) as km
        from _ugr u join public.teams rt on rt.id = u.rooting_team_id join public.venues v on v.id = u.venue_id
        where u.counted and v.lat is not null and u.rooting_team_id <> u.home_team_id
        group by rt.franchise_id
      ) m order by m.km desc limit 1), '{}'::jsonb);
  end if;

  v_super := v_super || coalesce((select jsonb_build_object('first_game', jsonb_build_object('game_id', game_id, 'date', scheduled_start))
    from _ugr where counted order by scheduled_start asc limit 1), '{}'::jsonb);

  -- Streaks.
  for r in select result from _ugr where result is not null order by scheduled_start loop
    if r.result = 'win' then run := case when run > 0 then run + 1 else 1 end;
    elsif r.result = 'loss' then run := case when run < 0 then run - 1 else -1 end;
    else run := 0;
    end if;
    longest_win := greatest(longest_win, run);
    longest_loss := greatest(longest_loss, -run);
  end loop;
  v_streaks := jsonb_build_object('longest_win', longest_win, 'longest_loss', longest_loss, 'current', run);

  select coalesce(jsonb_agg(jsonb_build_object('type', type, 'count', cnt) order by cnt desc), '[]'::jsonb) into v_moments
  from (
    select e.type, count(*) cnt
    from _ugr u join public.game_events e on e.game_id = u.game_id
    where u.counted and e.type <> 'home_run'
    group by e.type
  ) m;

  select count(distinct ga.player_id) into v_players_seen
  from _ugr u join public.game_appearances ga on ga.game_id = u.game_id where u.counted;

  return jsonb_build_object(
    'totals', v_totals,
    'overall', v_overall,
    'teams', v_teams,
    'pledge', coalesce(v_pledge, jsonb_build_object('record', public.record_json(0, 0, 0), 'vs_expected', 0)),
    'stamps', v_stamps,
    'superlatives', v_super,
    'streaks', v_streaks,
    'moments', v_moments,
    'players_seen', coalesce(v_players_seen, 0),
    'computed_at', now()
  );
end;
$$;

create or replace function public.refresh_user_stats(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- During an account deletion cascade the profile is already gone; nothing to cache.
  if not exists (select 1 from public.profiles where id = p_user) then return; end if;
  insert into public.user_stats_cache (user_id, payload, computed_at)
  values (p_user, public.compute_user_stats(p_user), now())
  on conflict (user_id) do update set payload = excluded.payload, computed_at = excluded.computed_at;
end;
$$;

-- Client-callable: recompute my own stats and return them.
create or replace function public.refresh_my_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode = 'insufficient_privilege'; end if;
  perform public.recompute_rooting_for_user(auth.uid());
  perform public.refresh_user_stats(auth.uid());
  return (select payload from public.user_stats_cache where user_id = auth.uid());
end;
$$;

-- ---------------------------------------------------------------------------
-- Feed events and milestones on attendance changes; stats refresh
-- ---------------------------------------------------------------------------
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
begin
  if tg_op = 'INSERT' and new.status = 'attended' then
    select count(*) into v_count from public.attendances where user_id = v_user and status = 'attended';
    insert into public.feed_events (actor_user_id, type, game_id, payload)
    values (v_user, 'logged_game', new.game_id, jsonb_build_object('source', new.source));
    select v.id, v.name into v_venue from public.games g join public.venues v on v.id = g.venue_id where g.id = new.game_id;
    if v_venue.id is not null then
      -- First visit = no other attended game at this venue that is earlier by date (ties broken by id),
      -- so bulk inserts in one statement still award exactly one stamp per venue.
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
  end if;
  perform public.refresh_user_stats(v_user);
  return null;
end;
$$;

create trigger attendances_after_change
  after insert or update or delete on public.attendances
  for each row execute function public.attendances_after_write();

create or replace function public.user_teams_after_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_user uuid := coalesce(new.user_id, old.user_id);
begin
  perform public.recompute_rooting_for_user(v_user);
  perform public.refresh_user_stats(v_user);
  return null;
end;
$$;

create trigger user_teams_after_change
  after insert or update or delete on public.user_teams
  for each row execute function public.user_teams_after_change();

-- ---------------------------------------------------------------------------
-- Post-final processing (SPEC 4.5): called by ingestion after a game's detail lands.
-- Pledge validation hooks in here once the pledge module exists (M5).
-- ---------------------------------------------------------------------------
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
  return jsonb_build_object('users', coalesce(array_length(v_users, 1), 0));
end;
$$;

revoke all on function public.process_game_final(uuid) from public, anon, authenticated;
revoke all on function public.refresh_user_stats(uuid) from public, anon, authenticated;
revoke all on function public.recompute_rooting_for_user(uuid) from public, anon, authenticated;
revoke all on function public.compute_user_stats(uuid) from public, anon, authenticated;
revoke all on function public.user_game_results(uuid) from public, anon, authenticated;

-- Players seen, paginated and searchable, for the passport list screen.
create or replace function public.players_seen(p_user uuid, p_query text default null, p_limit integer default 50, p_offset integer default 0)
returns table (player_id uuid, full_name text, sport_id text, seen integer, last_seen timestamptz)
language sql
stable
security invoker
set search_path = public
as $$
  select p.id, p.full_name, p.sport_id, count(*)::integer, max(g.scheduled_start)
  from public.attendances a
  join public.games g on g.id = a.game_id and g.status = 'final'
  join public.game_appearances ga on ga.game_id = g.id
  join public.players p on p.id = ga.player_id
  where a.user_id = p_user and a.status = 'attended' and public.can_view_user(p_user)
    and (p_query is null or lower(p.full_name) like '%' || lower(trim(p_query)) || '%')
  group by p.id
  order by count(*) desc, max(g.scheduled_start) desc
  limit least(greatest(coalesce(p_limit, 50), 1), 200) offset greatest(coalesce(p_offset, 0), 0);
$$;
