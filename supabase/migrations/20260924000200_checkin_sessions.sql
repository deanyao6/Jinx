-- Social v2, prompt 1 (docs/prompts/social/00_repo_reality.md, ruling R4).
--
-- A check-in becomes a session rather than a moment: it starts when the geofence proof passes
-- and ends at the final, when the fan says they have left, on a timeout or on leaving the
-- geofence. The brief asked for a new `checkin_sessions` table; the ruling is to extend
-- `checkins` instead, because Pick a side already locks against it and two tables would be two
-- answers to "is this fan at the game". Nothing ends a session yet: prompt 3 builds that. Until
-- then every row is an open session, which is exactly what a check-in meant before.
--
-- `checked_in_at` becomes `started_at`. The app reads `game_context().checked_in_at`, which
-- builds 4 and 5 depend on, so that key stays and now carries `started_at`, beside a new
-- `checkin` object that says whether the session is still open.

alter table public.checkins rename column checked_in_at to started_at;

alter table public.checkins
  add column ended_at timestamptz,
  add column end_reason text,
  add column attendance_id uuid references public.attendances (id) on delete set null,
  add column visibility text not null default 'mutuals',
  add constraint checkins_end_reason_check
    check (end_reason in ('final', 'left', 'timeout', 'geofence_exit')),
  -- An ended session says why; an open one has no reason.
  add constraint checkins_end_consistent
    check ((ended_at is null) = (end_reason is null)),
  add constraint checkins_ended_after_start check (ended_at is null or ended_at >= started_at),
  -- 'mutuals': mutual follows can see you are here (the only audience a check-in ever had).
  -- 'off': nobody but you, the switch in settings the prototype asks for.
  add constraint checkins_visibility_check check (visibility in ('mutuals', 'off'));

comment on column public.checkins.started_at is 'When the geofence proof passed. Was checked_in_at until 20260924000200.';
comment on column public.checkins.ended_at is 'Null while the session is open.';
comment on column public.checkins.attendance_id is 'The attendance the check-in created or verified.';

create index checkins_open_idx on public.checkins (game_id) where ended_at is null;

-- The attendance each existing check-in verified.
update public.checkins c
set attendance_id = a.id
from public.attendances a
where a.user_id = c.user_id and a.game_id = c.game_id and c.attendance_id is null;

-- Mutual follows see a check-in only while its owner lets them.
drop policy checkins_select on public.checkins;
create policy checkins_select on public.checkins for select to authenticated
  using (user_id = auth.uid() or (visibility = 'mutuals' and public.is_mutual(auth.uid(), user_id)));

-- The owner may end a session, hide it, or say they have left; nobody else writes one, and the
-- proof itself (distance, accuracy, start) is not theirs to rewrite.
create policy checkins_update on public.checkins for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.checkins_keep_proof()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.id := old.id;
    new.user_id := old.user_id;
    new.game_id := old.game_id;
    new.started_at := old.started_at;
    new.distance_m := old.distance_m;
    new.accuracy_m := old.accuracy_m;
    new.attendance_id := old.attendance_id;
  end if;
  return new;
end;
$$;

create trigger checkins_keep_proof before update on public.checkins
  for each row execute function public.checkins_keep_proof();

-- check_in: the same proof and window as before; it now links the attendance and reopens a
-- session that had ended, since checking in again means being back.
create or replace function public.check_in(p_game_id uuid, p_distance_m integer, p_accuracy_m integer)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
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

  insert into public.attendances (user_id, game_id, source, status, verified, verified_via)
  values (v_uid, p_game_id, 'checkin', 'attended', true, 'checkin')
  on conflict (user_id, game_id) do update set verified = true, verified_via = coalesce(public.attendances.verified_via, 'checkin'), status = 'attended'
  returning id into v_att_id;

  insert into public.checkins (user_id, game_id, started_at, distance_m, accuracy_m, attendance_id)
  values (v_uid, p_game_id, v_now, p_distance_m, p_accuracy_m, v_att_id)
  on conflict (user_id, game_id) do update
    set started_at = excluded.started_at, distance_m = excluded.distance_m, accuracy_m = excluded.accuracy_m,
        attendance_id = excluded.attendance_id, ended_at = null, end_reason = null;

  return jsonb_build_object('ok', true, 'attendance_id', v_att_id) || public.game_context(p_game_id);
end;
$function$;

-- game_context: `checked_in_at` keeps its name for the builds in the field; `checkin` is the
-- session.
do $$
declare
  v_def text;
begin
  select pg_get_functiondef('public.game_context'::regproc) into v_def;
  if position($f$'checked_in_at', v_checkin.checked_in_at,$f$ in v_def) = 0 then
    raise exception 'game_context(): the checked_in_at entry is not where it was expected';
  end if;
  execute replace(
    v_def,
    $f$'checked_in_at', v_checkin.checked_in_at,$f$,
    $f$'checked_in_at', v_checkin.started_at,
    'checkin', case when v_checkin.id is null then null else jsonb_build_object('started_at', v_checkin.started_at, 'ended_at', v_checkin.ended_at, 'end_reason', v_checkin.end_reason, 'open', v_checkin.ended_at is null, 'visibility', v_checkin.visibility) end,$f$
  );

  -- Pick a side exists only inside an open session (the prototype's checked-in screen).
  select pg_get_functiondef('public.make_pledge'::regproc) into v_def;
  if position('if not exists (select 1 from public.checkins where user_id = v_uid and game_id = p_game_id) then' in v_def) = 0 then
    raise exception 'make_pledge(): the check-in guard is not where it was expected';
  end if;
  execute replace(
    v_def,
    'if not exists (select 1 from public.checkins where user_id = v_uid and game_id = p_game_id) then',
    'if not exists (select 1 from public.checkins where user_id = v_uid and game_id = p_game_id and ended_at is null) then'
  );

  -- The live poll only needs games someone is at right now.
  select pg_get_functiondef('public.games_needing_live_poll'::regproc) into v_def;
  if position('join public.checkins c on c.game_id = g.id' in v_def) = 0 then
    raise exception 'games_needing_live_poll(): the check-in join is not where it was expected';
  end if;
  execute replace(v_def, 'join public.checkins c on c.game_id = g.id', 'join public.checkins c on c.game_id = g.id and c.ended_at is null');

  -- Someone who switched "being here" off is not offered as a handshake.
  select pg_get_functiondef('public.handshake_candidates'::regproc) into v_def;
  if position('and c.user_id <> auth.uid()' in v_def) = 0 then
    raise exception 'handshake_candidates(): the self filter is not where it was expected';
  end if;
  execute replace(v_def, 'and c.user_id <> auth.uid()', $f$and c.user_id <> auth.uid()
    and c.visibility = 'mutuals'$f$);
end;
$$;
