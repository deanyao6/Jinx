-- Season Wrapped (SPEC.md 6.15, 8.8): per user, per sport, per season.

create or replace function public.generate_wrapped(p_user uuid, p_sport text, p_season integer)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_home_lat double precision;
  v_home_lng double precision;
  v_games integer;
  v_record jsonb;
  v_teams jsonb;
  v_pledge jsonb;
  v_stamps jsonb;
  v_player jsonb;
  v_moment jsonb;
  v_best jsonb;
  v_worst jsonb;
  v_km numeric;
  v_super jsonb := '{}'::jsonb;
  v_goals jsonb;
  v_year integer;
begin
  select home_lat, home_lng into v_home_lat, v_home_lng from public.profiles where id = p_user;
  create temp table if not exists _wg on commit drop as select * from public.user_game_results(p_user) where false;
  truncate _wg;
  insert into _wg select * from public.user_game_results(p_user) u where u.sport_id = p_sport and u.season = p_season and u.counted;

  select count(*) into v_games from _wg;
  if v_games = 0 then return null; end if;

  select public.record_json(count(*) filter (where result = 'win'), count(*) filter (where result = 'loss'), count(*) filter (where result = 'tie')) into v_record from _wg;

  select coalesce(jsonb_agg(jsonb_build_object('team_id', t.id, 'name', t.name, 'record', public.record_json(w, l, ti)) order by w desc), '[]'::jsonb) into v_teams
  from (
    select rooting_team_id, count(*) filter (where result = 'win') w, count(*) filter (where result = 'loss') l, count(*) filter (where result = 'tie') ti
    from _wg where rooting_team_id is not null group by rooting_team_id
  ) r join public.teams t on t.id = r.rooting_team_id;

  select jsonb_build_object(
    'record', public.record_json(count(*) filter (where u.result = 'win'), count(*) filter (where u.result = 'loss'), count(*) filter (where u.result = 'tie')),
    'vs_expected', round(coalesce(sum(case u.result when 'win' then 1 when 'tie' then 0.5 else 0 end - p.win_prob_at_pledge), 0)::numeric, 2)
  ) into v_pledge
  from _wg u join public.pledges p on p.game_id = u.game_id and p.user_id = p_user and p.status = 'valid'
  where u.rooting_basis = 'pledge';

  select jsonb_build_object(
    'venues', count(distinct venue_id),
    'new', coalesce(jsonb_agg(jsonb_build_object('venue_id', v.id, 'name', v.name) order by first_visit) filter (where is_new), '[]'::jsonb)
  ) into v_stamps
  from (
    select w.venue_id, min(w.scheduled_start) first_visit,
           not exists (select 1 from public.user_game_results(p_user) x where x.venue_id = w.venue_id and x.counted and x.scheduled_start < min(w.scheduled_start)) as is_new
    from _wg w where w.venue_id is not null group by w.venue_id
  ) s join public.venues v on v.id = s.venue_id;

  select jsonb_build_object('player_id', p.id, 'name', p.full_name, 'count', m.cnt) into v_player
  from (select ga.player_id, count(*) cnt from _wg u join public.game_appearances ga on ga.game_id = u.game_id group by ga.player_id order by cnt desc limit 1) m
  join public.players p on p.id = m.player_id;

  select jsonb_build_object('type', e.type, 'game_id', e.game_id, 'player', e.detail ->> 'playerName', 'occurred_at', e.occurred_at) into v_moment
  from _wg u join public.game_events e on e.game_id = u.game_id
  where e.type <> 'home_run'
  order by array_position(array['perfect_game','no_hitter','walk_off_home_run','cycle','walk_off','grand_slam','walk_off_score','comeback_14','pick_six','immaculate_inning','overtime','extra_innings','late_go_ahead_score','kick_return_td','fumble_return_td','long_field_goal','safety','shutout'], e.type) nulls last
  limit 1;

  with comp as (
    select p.id, p.display_name, count(*) games,
           count(*) filter (where u.result = 'win') w, count(*) filter (where u.result = 'loss') l, count(*) filter (where u.result = 'tie') ti
    from _wg u join public.attendance_companions ac on ac.attendance_id = u.attendance_id join public.people p on p.id = ac.person_id
    where u.result is not null group by p.id
  )
  select (select jsonb_build_object('person_id', id, 'name', display_name, 'record', public.record_json(w, l, ti)) from comp where w + l >= 2 order by w::numeric / greatest(w + l, 1) desc, games desc limit 1),
         (select jsonb_build_object('person_id', id, 'name', display_name, 'record', public.record_json(w, l, ti)) from comp where w + l >= 2 order by w::numeric / greatest(w + l, 1) asc, games desc limit 1)
  into v_best, v_worst;

  if v_home_lat is not null then
    select round(coalesce(sum(public.distance_km(v_home_lat, v_home_lng, v.lat, v.lng)), 0)::numeric) into v_km
    from _wg u join public.venues v on v.id = u.venue_id where v.lat is not null;
  end if;

  select jsonb_strip_nulls(jsonb_build_object(
    'coldest', (select jsonb_build_object('game_id', game_id, 'value', temperature_f) from _wg where temperature_f is not null order by temperature_f asc limit 1),
    'hottest', (select jsonb_build_object('game_id', game_id, 'value', temperature_f) from _wg where temperature_f is not null order by temperature_f desc limit 1),
    'longest', (select jsonb_build_object('game_id', game_id, 'minutes', duration_minutes, 'periods', innings_or_periods) from _wg where duration_minutes is not null or innings_or_periods is not null order by coalesce(duration_minutes, 0) desc, coalesce(innings_or_periods, 0) desc limit 1),
    'highest_scoring', (select jsonb_build_object('game_id', game_id, 'total', home_score + away_score) from _wg where home_score is not null order by home_score + away_score desc limit 1)
  )) into v_super;

  v_year := case when p_sport = 'nfl' then p_season else p_season end;
  select coalesce(jsonb_agg(jsonb_build_object('goal_id', id, 'title', title)), '[]'::jsonb) into v_goals
  from public.goals where user_id = p_user and year = v_year and completed_at is not null;

  return jsonb_build_object(
    'sport_id', p_sport,
    'season', p_season,
    'cards', jsonb_build_array(
      jsonb_build_object('kind', 'games', 'games', v_games),
      jsonb_build_object('kind', 'record', 'record', v_record, 'teams', v_teams),
      jsonb_build_object('kind', 'pledge', 'pledge', v_pledge),
      jsonb_build_object('kind', 'stamps', 'stamps', v_stamps),
      jsonb_build_object('kind', 'player', 'player', v_player),
      jsonb_build_object('kind', 'moment', 'moment', v_moment),
      jsonb_build_object('kind', 'companions', 'best', v_best, 'worst', v_worst),
      jsonb_build_object('kind', 'miles', 'km', v_km),
      jsonb_build_object('kind', 'superlative', 'superlatives', v_super),
      jsonb_build_object('kind', 'goals', 'goals', v_goals)
    ),
    'generated_at', now()
  );
end;
$$;

revoke all on function public.generate_wrapped(uuid, text, integer) from public, anon, authenticated;

-- On-demand preview / refresh for the signed-in user.
create or replace function public.my_wrapped(p_sport text, p_season integer, p_force boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_payload jsonb;
begin
  if v_uid is null then raise exception 'not signed in' using errcode = 'insufficient_privilege'; end if;
  if not p_force then
    select payload into v_payload from public.wrapped_snapshots where user_id = v_uid and sport_id = p_sport and season = p_season;
    if v_payload is not null then return v_payload; end if;
  end if;
  v_payload := public.generate_wrapped(v_uid, p_sport, p_season);
  if v_payload is null then return null; end if;
  insert into public.wrapped_snapshots (user_id, sport_id, season, payload, generated_at)
  values (v_uid, p_sport, p_season, v_payload, now())
  on conflict (user_id, sport_id, season) do update set payload = excluded.payload, generated_at = now();
  return v_payload;
end;
$$;

-- Season over? Publish Wrapped for everyone with games that season, once.
create or replace function public.publish_wrapped_if_season_over(p_sport text, p_season integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_over boolean;
  u record;
  v_payload jsonb;
  v_count integer := 0;
begin
  select exists (select 1 from public.games where sport_id = p_sport and season = p_season and game_type = 'postseason' and status = 'final')
     and not exists (select 1 from public.games where sport_id = p_sport and season = p_season and status in ('scheduled', 'live'))
     and (select max(scheduled_start) from public.games where sport_id = p_sport and season = p_season and status = 'final') < now() - interval '2 days'
  into v_over;
  if not v_over then return 0; end if;
  for u in
    select distinct a.user_id from public.attendances a join public.games g on g.id = a.game_id
    where g.sport_id = p_sport and g.season = p_season and a.status = 'attended'
      and not exists (select 1 from public.wrapped_snapshots w where w.user_id = a.user_id and w.sport_id = p_sport and w.season = p_season)
  loop
    v_payload := public.generate_wrapped(u.user_id, p_sport, p_season);
    if v_payload is null then continue; end if;
    insert into public.wrapped_snapshots (user_id, sport_id, season, payload) values (u.user_id, p_sport, p_season, v_payload)
    on conflict do nothing;
    insert into public.feed_events (actor_user_id, type, payload) values (u.user_id, 'wrapped_published', jsonb_build_object('sport_id', p_sport, 'season', p_season));
    insert into public.notifications (user_id, kind, title, body, data)
    values (u.user_id, 'wrapped_ready', 'Your ' || p_season || ' ' || upper(p_sport) || ' Wrapped is ready', 'See your season in numbers.', jsonb_build_object('sport_id', p_sport, 'season', p_season));
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.publish_wrapped_if_season_over(text, integer) from public, anon, authenticated;

select cron.schedule('wrapped-daily', '0 9 * * *', $$
  select public.publish_wrapped_if_season_over('mlb', extract(year from now())::integer);
  select public.publish_wrapped_if_season_over('nfl', extract(year from now() - interval '2 months')::integer);
$$);
