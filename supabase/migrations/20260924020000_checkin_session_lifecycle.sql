-- Social v2, prompt 3 (docs/prompts/social/03_reactions.md, section 1; 00_repo_reality.md R4):
-- the check-in session's lifecycle. Prompt 1 made `checkins` a session; nothing ended one.
--
--   A session ends, whichever comes first: the final plus 30 minutes; "I have left"; six hours
--   after it started with no final. (Geofence exit waits on background monitoring, which is
--   designed in docs/CHECKIN.md and not shipped.) On end: prompts stop, and the app offers the
--   post-game composer.
--
--   Presence: mutual follows see "Also here" while the owner allows (`checkins.visibility`,
--   defaulted from a new profile switch), never precise location, only "here" plus the section
--   when seats are shared.
--
--   Two switches for prompts: `profiles.reaction_prompts` (the global "no reaction prompts")
--   and `checkins.prompts_muted` (the per-game "not tonight").

alter table public.profiles
  add column reaction_prompts boolean not null default true,
  add column checkin_visibility text not null default 'mutuals'
    check (checkin_visibility in ('mutuals', 'off'));
comment on column public.profiles.reaction_prompts is 'The global "no reaction prompts" switch (03, section 7).';
comment on column public.profiles.checkin_visibility is 'What a new check-in defaults to: "Show that I am checked in".';

alter table public.checkins add column prompts_muted boolean not null default false;
comment on column public.checkins.prompts_muted is 'The per-game "not tonight": no reaction prompts for this session.';

-- check_in: the same proof and window; a new session takes the profile's visibility default,
-- and checking in again after leaving reopens it with prompts on again.
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
  v_visibility text;
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

  select coalesce(checkin_visibility, 'mutuals') into v_visibility from public.profiles where id = v_uid;

  insert into public.checkins (user_id, game_id, started_at, distance_m, accuracy_m, attendance_id, visibility)
  values (v_uid, p_game_id, v_now, p_distance_m, p_accuracy_m, v_att_id, coalesce(v_visibility, 'mutuals'))
  on conflict (user_id, game_id) do update
    set started_at = excluded.started_at, distance_m = excluded.distance_m, accuracy_m = excluded.accuracy_m,
        attendance_id = excluded.attendance_id, ended_at = null, end_reason = null, prompts_muted = false;

  return jsonb_build_object('ok', true, 'attendance_id', v_att_id) || public.game_context(p_game_id);
end;
$function$;

-- "I have left": the owner ends the session. Nothing else is a reason a fan can give.
create or replace function public.end_checkin(p_game_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not signed in' using errcode = 'insufficient_privilege'; end if;
  update public.checkins
    set ended_at = now(), end_reason = 'left'
    where user_id = v_uid and game_id = p_game_id and ended_at is null;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_checked_in');
  end if;
  return jsonb_build_object('ok', true) || public.game_context(p_game_id);
end;
$$;
revoke all on function public.end_checkin(uuid) from public, anon;
grant execute on function public.end_checkin(uuid) to authenticated;

-- "Not tonight": no prompts for this session. Reversible.
create or replace function public.mute_checkin_prompts(p_game_id uuid, p_muted boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not signed in' using errcode = 'insufficient_privilege'; end if;
  update public.checkins set prompts_muted = p_muted where user_id = v_uid and game_id = p_game_id;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_checked_in');
  end if;
  return jsonb_build_object('ok', true) || public.game_context(p_game_id);
end;
$$;
revoke all on function public.mute_checkin_prompts(uuid, boolean) from public, anon;
grant execute on function public.mute_checkin_prompts(uuid, boolean) to authenticated;

-- The two ends nobody presses: the final plus 30 minutes, and six hours with no final. Runs
-- from pg_cron every five minutes as plain SQL, so trap 3 (an Edge Function call that reports
-- success while calling nothing) does not apply. Returns how many it closed.
create or replace function public.close_stale_checkins(p_now timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_final integer := 0;
  v_timeout integer := 0;
begin
  update public.checkins c
    set ended_at = g.final_at + interval '30 minutes', end_reason = 'final'
    from public.games g
    where g.id = c.game_id and c.ended_at is null
      and g.final_at is not null and g.final_at + interval '30 minutes' <= p_now
      -- A session opened after the final (checking in on the way out) still gets its half hour.
      and g.final_at + interval '30 minutes' >= c.started_at;
  get diagnostics v_final = row_count;
  update public.checkins c
    set ended_at = c.started_at + interval '6 hours', end_reason = 'timeout'
    from public.games g
    where g.id = c.game_id and c.ended_at is null
      and c.started_at + interval '6 hours' <= p_now
      and (g.final_at is null or g.final_at + interval '30 minutes' > p_now);
  get diagnostics v_timeout = row_count;
  -- A session that outlived a final it started after: end it now rather than never.
  update public.checkins c
    set ended_at = p_now, end_reason = 'final'
    from public.games g
    where g.id = c.game_id and c.ended_at is null
      and g.final_at is not null and g.final_at + interval '30 minutes' <= p_now;
  return v_final + v_timeout;
end;
$$;
revoke all on function public.close_stale_checkins(timestamptz) from public, anon, authenticated;

select cron.schedule('close-stale-checkins', '*/5 * * * *', $$select public.close_stale_checkins()$$);

-- Also here: mutual follows with an open session at this game who let mutuals see it, plus the
-- section when they share seats. Only for a fan who is checked in there right now.
create or replace function public.also_here(p_game_id uuid)
returns table (user_id uuid, handle text, display_name text, avatar_path text, section text)
language sql
stable
security definer
set search_path = public
as $$
  select pr.id, pr.handle, pr.display_name, pr.avatar_path,
         case when pr.share_seats then s.section else null end
  from public.checkins c
  join public.profiles pr on pr.id = c.user_id
  left join public.attendance_seats s on s.attendance_id = c.attendance_id
  where auth.uid() is not null
    and c.game_id = p_game_id
    and c.ended_at is null
    and c.visibility = 'mutuals'
    and c.user_id <> auth.uid()
    and exists (select 1 from public.checkins me where me.user_id = auth.uid() and me.game_id = p_game_id and me.ended_at is null)
    and not public.is_blocked_between(auth.uid(), c.user_id)
    and public.is_mutual(auth.uid(), c.user_id)
  order by pr.display_name nulls last, pr.handle;
$$;
revoke all on function public.also_here(uuid) from public, anon;
grant execute on function public.also_here(uuid) to authenticated;

-- game_context: the session object also says whether prompts are muted for it.
do $$
declare
  v_def text;
  v_anchor text := $f$'open', v_checkin.ended_at is null, 'visibility', v_checkin.visibility)$f$;
begin
  select pg_get_functiondef('public.game_context'::regproc) into v_def;
  if position(v_anchor in v_def) = 0 then
    raise exception 'game_context(): the checkin object from 20260924000200 is not where it was expected';
  end if;
  execute replace(v_def, v_anchor, $f$'open', v_checkin.ended_at is null, 'visibility', v_checkin.visibility, 'prompts_muted', v_checkin.prompts_muted)$f$);
end;
$$;
