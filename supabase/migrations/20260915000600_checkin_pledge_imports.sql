-- Check-in, pledges, pledge validation, ticket import confirmation (SPEC.md 6.3-6.5, 7.2-7.3).

alter table public.games
  add column pledge_lock_at timestamptz,
  add column pledge_lock_reliable boolean;

-- ---------------------------------------------------------------------------
-- Game context for the check-in / pledge screen
-- ---------------------------------------------------------------------------
create or replace function public.estimated_pledge_lock(p_sport text, p_start timestamptz)
returns timestamptz
language sql
immutable
as $$
  select case when p_sport = 'nfl' then p_start + interval '12 minutes' else p_start + interval '30 minutes' end;
$$;

create or replace function public.game_context(p_game_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  g record;
  v_uid uuid := auth.uid();
  v_root record;
  v_home_fav boolean;
  v_away_fav boolean;
  v_prob numeric;
  v_checkin record;
  v_pledge record;
  v_att record;
begin
  if v_uid is null then raise exception 'not signed in' using errcode = 'insufficient_privilege'; end if;
  select gm.*, ht.franchise_id home_fr, at.franchise_id away_fr, ht.name home_name, at.name away_name,
         v.name venue_name, v.geofence_m, v.lat venue_lat, v.lng venue_lng
    into g
  from public.games gm
  join public.teams ht on ht.id = gm.home_team_id
  join public.teams at on at.id = gm.away_team_id
  left join public.venues v on v.id = gm.venue_id
  where gm.id = p_game_id;
  if not found then return null; end if;
  v_home_fav := exists (select 1 from public.user_teams ut join public.teams t on t.id = ut.team_id where ut.user_id = v_uid and t.franchise_id = g.home_fr);
  v_away_fav := exists (select 1 from public.user_teams ut join public.teams t on t.id = ut.team_id where ut.user_id = v_uid and t.franchise_id = g.away_fr);
  select home_win_prob into v_prob from public.game_win_prob where game_id = p_game_id;
  select * into v_checkin from public.checkins where user_id = v_uid and game_id = p_game_id;
  select * into v_pledge from public.pledges where user_id = v_uid and game_id = p_game_id;
  select * into v_att from public.attendances where user_id = v_uid and game_id = p_game_id;
  return jsonb_build_object(
    'game_id', g.id,
    'sport_id', g.sport_id,
    'status', g.status,
    'scheduled_start', g.scheduled_start,
    'final_at', g.final_at,
    'home', jsonb_build_object('team_id', g.home_team_id, 'name', g.home_name, 'favorite', v_home_fav, 'win_prob', v_prob),
    'away', jsonb_build_object('team_id', g.away_team_id, 'name', g.away_name, 'favorite', v_away_fav, 'win_prob', case when v_prob is null then null else 1 - v_prob end),
    'venue', jsonb_build_object('venue_id', g.venue_id, 'name', g.venue_name, 'geofence_m', g.geofence_m, 'lat', g.venue_lat, 'lng', g.venue_lng),
    'neutral_for_user', not v_home_fav and not v_away_fav,
    'both_favorites', v_home_fav and v_away_fav,
    'check_in_opens_at', g.scheduled_start - interval '3 hours',
    'check_in_closes_at', coalesce(g.final_at + interval '1 hour', g.scheduled_start + interval '6 hours'),
    'estimated_lock_at', public.estimated_pledge_lock(g.sport_id, g.scheduled_start),
    'checked_in_at', v_checkin.checked_in_at,
    'attendance', case when v_att.id is null then null else jsonb_build_object('id', v_att.id, 'status', v_att.status, 'verified', v_att.verified, 'rooting_team_id', v_att.rooting_team_id, 'rooting_basis', v_att.rooting_basis) end,
    'pledge', case when v_pledge.id is null then null else jsonb_build_object('team_id', v_pledge.team_id, 'pledged_at', v_pledge.pledged_at, 'status', v_pledge.status, 'result', v_pledge.result, 'win_prob_at_pledge', v_pledge.win_prob_at_pledge, 'void_reason', v_pledge.void_reason) end
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Check-in (SPEC 6.3). The client computes distance to the venue; coordinates never reach the server.
-- ---------------------------------------------------------------------------
create or replace function public.check_in(p_game_id uuid, p_distance_m integer, p_accuracy_m integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  g record;
  v_now timestamptz := now();
  v_att_id uuid;
begin
  if v_uid is null then raise exception 'not signed in' using errcode = 'insufficient_privilege'; end if;
  if p_distance_m is null or p_accuracy_m is null or p_distance_m < 0 or p_accuracy_m < 0 then
    raise exception 'bad location' using errcode = 'check_violation';
  end if;
  select gm.*, v.geofence_m into g from public.games gm left join public.venues v on v.id = gm.venue_id where gm.id = p_game_id;
  if not found then raise exception 'unknown game' using errcode = 'no_data_found'; end if;
  if g.status in ('postponed', 'cancelled') then
    return jsonb_build_object('ok', false, 'reason', 'not_playing');
  end if;
  if v_now < g.scheduled_start - interval '3 hours' or v_now > coalesce(g.final_at + interval '1 hour', g.scheduled_start + interval '6 hours') then
    return jsonb_build_object('ok', false, 'reason', 'outside_window');
  end if;
  if g.geofence_m is null then
    return jsonb_build_object('ok', false, 'reason', 'venue_unknown');
  end if;
  if p_distance_m > g.geofence_m + least(p_accuracy_m, 200) then
    return jsonb_build_object('ok', false, 'reason', 'too_far', 'distance_m', p_distance_m, 'geofence_m', g.geofence_m);
  end if;

  insert into public.checkins (user_id, game_id, checked_in_at, distance_m, accuracy_m)
  values (v_uid, p_game_id, v_now, p_distance_m, p_accuracy_m)
  on conflict (user_id, game_id) do update set checked_in_at = excluded.checked_in_at, distance_m = excluded.distance_m, accuracy_m = excluded.accuracy_m;

  insert into public.attendances (user_id, game_id, source, status, verified, verified_via)
  values (v_uid, p_game_id, 'checkin', case when g.status = 'final' then 'attended' else 'attended' end, true, 'checkin')
  on conflict (user_id, game_id) do update set verified = true, verified_via = coalesce(public.attendances.verified_via, 'checkin'), status = 'attended'
  returning id into v_att_id;

  return jsonb_build_object('ok', true, 'attendance_id', v_att_id) || public.game_context(p_game_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Pledge (SPEC 6.4). Requires a check-in and a neutral game; provisional until validated.
-- ---------------------------------------------------------------------------
create or replace function public.make_pledge(p_game_id uuid, p_team_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  g record;
  v_prob numeric;
  v_team_prob numeric;
  v_home_fav boolean;
  v_away_fav boolean;
  v_existing record;
begin
  if v_uid is null then raise exception 'not signed in' using errcode = 'insufficient_privilege'; end if;
  select gm.*, ht.franchise_id home_fr, at.franchise_id away_fr into g
  from public.games gm join public.teams ht on ht.id = gm.home_team_id join public.teams at on at.id = gm.away_team_id
  where gm.id = p_game_id;
  if not found then raise exception 'unknown game' using errcode = 'no_data_found'; end if;
  if p_team_id not in (g.home_team_id, g.away_team_id) then raise exception 'team not in game' using errcode = 'check_violation'; end if;
  if not exists (select 1 from public.checkins where user_id = v_uid and game_id = p_game_id) then
    return jsonb_build_object('ok', false, 'reason', 'not_checked_in');
  end if;
  v_home_fav := exists (select 1 from public.user_teams ut join public.teams t on t.id = ut.team_id where ut.user_id = v_uid and t.franchise_id = g.home_fr);
  v_away_fav := exists (select 1 from public.user_teams ut join public.teams t on t.id = ut.team_id where ut.user_id = v_uid and t.franchise_id = g.away_fr);
  if v_home_fav or v_away_fav then
    return jsonb_build_object('ok', false, 'reason', 'not_neutral');
  end if;
  if g.status = 'final' or now() > g.scheduled_start + interval '6 hours' then
    return jsonb_build_object('ok', false, 'reason', 'game_over');
  end if;
  select * into v_existing from public.pledges where user_id = v_uid and game_id = p_game_id;
  if v_existing.id is not null and v_existing.status <> 'provisional' then
    return jsonb_build_object('ok', false, 'reason', 'already_validated');
  end if;
  select home_win_prob into v_prob from public.game_win_prob where game_id = p_game_id;
  v_team_prob := case when v_prob is null then 0.5 when p_team_id = g.home_team_id then v_prob else 1 - v_prob end;

  insert into public.pledges (user_id, game_id, team_id, pledged_at, win_prob_at_pledge, estimated_lock_at, status)
  values (v_uid, p_game_id, p_team_id, now(), v_team_prob, public.estimated_pledge_lock(g.sport_id, g.scheduled_start), 'provisional')
  on conflict (user_id, game_id) do update
    set team_id = excluded.team_id, pledged_at = excluded.pledged_at, win_prob_at_pledge = excluded.win_prob_at_pledge, status = 'provisional', void_reason = null, result = null;

  return jsonb_build_object('ok', true) || public.game_context(p_game_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Pledge validation after the game's detail is ingested (SPEC 6.5).
-- ---------------------------------------------------------------------------
create or replace function public.validate_pledges_for_game(p_game_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  g record;
  p record;
  v_status text;
  v_reason text;
  v_result text;
  v_count integer := 0;
  v_team_name text;
  v_stats jsonb;
begin
  select * into g from public.games where id = p_game_id;
  if not found or g.status <> 'final' or g.home_score is null or g.away_score is null then return 0; end if;
  for p in select * from public.pledges where game_id = p_game_id and status = 'provisional' loop
    if g.pledge_lock_at is null or coalesce(g.pledge_lock_reliable, false) = false then
      v_status := 'valid'; v_reason := 'unreliable_timestamps';
    elsif p.pledged_at <= g.pledge_lock_at + interval '60 seconds' then
      v_status := 'valid'; v_reason := null;
    else
      v_status := 'void'; v_reason := 'after_lock';
    end if;
    v_result := case
      when g.home_score = g.away_score then 'tie'
      when (p.team_id = g.home_team_id) = (g.home_score > g.away_score) then 'win'
      else 'loss' end;
    update public.pledges set status = v_status, void_reason = v_reason, result = v_result, validated_at = now() where id = p.id;
    v_count := v_count + 1;

    select name into v_team_name from public.teams where id = p.team_id;
    if v_status = 'valid' then
      perform public.recompute_rooting_for_user(p.user_id);
      perform public.refresh_user_stats(p.user_id);
      select payload into v_stats from public.user_stats_cache where user_id = p.user_id;
      insert into public.feed_events (actor_user_id, type, game_id, payload)
      values (p.user_id, case when v_result = 'win' then 'pledge_won' else 'pledge_lost' end, p_game_id,
              jsonb_build_object('team_id', p.team_id, 'team_name', v_team_name, 'result', v_result, 'win_prob', p.win_prob_at_pledge));
      insert into public.notifications (user_id, kind, title, body, data)
      values (p.user_id, 'pledge_result',
              case v_result when 'win' then 'Your pledge won' when 'loss' then 'Your pledge lost' else 'Your pledge tied' end,
              format('Your pledge to the %s %s. Pledge record %s–%s, %s vs expected.', v_team_name,
                     case v_result when 'win' then 'won' when 'loss' then 'lost' else 'tied' end,
                     v_stats -> 'pledge' -> 'record' ->> 'wins', v_stats -> 'pledge' -> 'record' ->> 'losses',
                     to_char((v_stats -> 'pledge' ->> 'vs_expected')::numeric, 'FMS0.0')),
              jsonb_build_object('game_id', p_game_id, 'result', v_result));
    else
      insert into public.notifications (user_id, kind, title, body, data)
      values (p.user_id, 'pledge_void', 'Pledge did not count',
              'Your pledge was made after the first score, so it doesn''t count.',
              jsonb_build_object('game_id', p_game_id));
    end if;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.validate_pledges_for_game(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Ticket imports: confirm / discard (SPEC 7.2.5)
-- ---------------------------------------------------------------------------
-- Internal: used by the client wrapper below and by the inbound-email function (service role).
create or replace function public.confirm_ticket_import_for(p_user uuid, p_import_id uuid, p_game_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := p_user;
  imp record;
  g record;
  v_att_id uuid;
  parsed jsonb;
begin
  select * into imp from public.ticket_imports where id = p_import_id and user_id = v_uid;
  if not found then raise exception 'import not found' using errcode = 'no_data_found'; end if;
  select * into g from public.games where id = p_game_id;
  if not found then raise exception 'unknown game' using errcode = 'no_data_found'; end if;
  parsed := coalesce(imp.parsed, '{}'::jsonb);

  insert into public.attendances (user_id, game_id, source, status, verified, verified_via)
  values (v_uid, p_game_id, imp.source, case when g.status = 'final' then 'attended' else 'going' end, true, imp.source)
  on conflict (user_id, game_id) do update set verified = true, verified_via = coalesce(public.attendances.verified_via, excluded.verified_via)
  returning id into v_att_id;

  if nullif(parsed ->> 'section', '') is not null or nullif(parsed ->> 'row', '') is not null or nullif(parsed ->> 'seat', '') is not null or (parsed ->> 'price') is not null then
    insert into public.attendance_seats (attendance_id, section, row, seat, price_cents)
    values (v_att_id, nullif(parsed ->> 'section', ''), nullif(parsed ->> 'row', ''), nullif(parsed ->> 'seat', ''),
            case when (parsed ->> 'price') ~ '^[0-9.]+$' then round((parsed ->> 'price')::numeric * 100)::integer else null end)
    on conflict (attendance_id) do update set section = coalesce(public.attendance_seats.section, excluded.section),
      row = coalesce(public.attendance_seats.row, excluded.row), seat = coalesce(public.attendance_seats.seat, excluded.seat),
      price_cents = coalesce(public.attendance_seats.price_cents, excluded.price_cents);
  end if;

  update public.ticket_imports set status = 'matched', matched_attendance_id = v_att_id, resolved_at = now() where id = p_import_id;
  return jsonb_build_object('attendance_id', v_att_id, 'status', case when g.status = 'final' then 'attended' else 'going' end);
end;
$$;

revoke all on function public.confirm_ticket_import_for(uuid, uuid, uuid) from public, anon, authenticated;

create or replace function public.confirm_ticket_import(p_import_id uuid, p_game_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode = 'insufficient_privilege'; end if;
  return public.confirm_ticket_import_for(auth.uid(), p_import_id, p_game_id);
end;
$$;

create or replace function public.discard_ticket_import(p_import_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.ticket_imports set status = 'discarded', resolved_at = now()
  where id = p_import_id and user_id = auth.uid();
$$;

-- Rotate the forwarding address token (SPEC 7.3).
create or replace function public.rotate_inbound_token()
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_token text := encode(gen_random_bytes(9), 'hex');
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode = 'insufficient_privilege'; end if;
  insert into public.inbound_addresses (user_id, token, rotated_at) values (auth.uid(), v_token, now())
  on conflict (user_id) do update set token = excluded.token, rotated_at = now();
  return v_token;
end;
$$;
