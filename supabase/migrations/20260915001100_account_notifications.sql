-- Account export, deletion support, and push notification plumbing (SPEC.md 8.9, 9, 10, 11).

-- Full data export (SPEC 9): everything the user owns, as JSON.
create or replace function public.export_my_data()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'exported_at', now(),
    'profile', (select to_jsonb(p) - 'home_lat' - 'home_lng' || jsonb_build_object('home_lat', p.home_lat, 'home_lng', p.home_lng) from public.profiles p where p.id = auth.uid()),
    'teams', (select coalesce(jsonb_agg(jsonb_build_object('team_id', t.id, 'name', t.name, 'sport_id', t.sport_id)), '[]'::jsonb) from public.user_teams ut join public.teams t on t.id = ut.team_id where ut.user_id = auth.uid()),
    'attendances', (select coalesce(jsonb_agg(jsonb_build_object(
        'attendance', to_jsonb(a), 'game', jsonb_build_object('id', g.id, 'sport_id', g.sport_id, 'scheduled_start', g.scheduled_start, 'home', ht.name, 'away', at.name, 'home_score', g.home_score, 'away_score', g.away_score, 'venue', v.name),
        'seat', (select to_jsonb(s) from public.attendance_seats s where s.attendance_id = a.id),
        'companions', (select coalesce(jsonb_agg(p.display_name), '[]'::jsonb) from public.attendance_companions ac join public.people p on p.id = ac.person_id where ac.attendance_id = a.id)
      ) order by g.scheduled_start), '[]'::jsonb)
      from public.attendances a join public.games g on g.id = a.game_id join public.teams ht on ht.id = g.home_team_id join public.teams at on at.id = g.away_team_id left join public.venues v on v.id = g.venue_id
      where a.user_id = auth.uid()),
    'people', (select coalesce(jsonb_agg(to_jsonb(p) - 'invite_token'), '[]'::jsonb) from public.people p where p.owner_user_id = auth.uid()),
    'pledges', (select coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb) from public.pledges p where p.user_id = auth.uid()),
    'checkins', (select coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb) from public.checkins c where c.user_id = auth.uid()),
    'follows', (select coalesce(jsonb_agg(jsonb_build_object('handle', pr.handle, 'status', f.status, 'since', f.created_at)), '[]'::jsonb) from public.follows f join public.profiles pr on pr.id = f.followee_id where f.follower_id = auth.uid()),
    'goals', (select coalesce(jsonb_agg(to_jsonb(g)), '[]'::jsonb) from public.goals g where g.user_id = auth.uid()),
    'bucket_lists', (select coalesce(jsonb_agg(jsonb_build_object('title', b.title, 'definition', b.definition, 'progress', ub.progress)), '[]'::jsonb) from public.user_bucket_lists ub join public.bucket_lists b on b.id = ub.bucket_list_id where ub.user_id = auth.uid()),
    'ticket_imports', (select coalesce(jsonb_agg(to_jsonb(t) - 'storage_path'), '[]'::jsonb) from public.ticket_imports t where t.user_id = auth.uid()),
    'wrapped', (select coalesce(jsonb_agg(to_jsonb(w)), '[]'::jsonb) from public.wrapped_snapshots w where w.user_id = auth.uid()),
    'stats', (select payload from public.user_stats_cache where user_id = auth.uid())
  );
$$;

-- Storage paths to remove before deleting the auth user (used by the delete-account Edge Function).
create or replace function public.my_storage_paths()
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(distinct storage_path), '{}') from public.ticket_imports where user_id = auth.uid() and storage_path is not null and image_deleted_at is null;
$$;

-- ---------------------------------------------------------------------------
-- Notifications: preferences and push delivery
-- ---------------------------------------------------------------------------
create or replace function public.notification_enabled(p_user uuid, p_kind text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select (prefs ->> p_kind)::boolean from public.notification_prefs where user_id = p_user), true);
$$;

create or replace function public.mark_notifications_read(p_ids uuid[] default null)
returns void
language sql
security definer
set search_path = public
as $$
  update public.notifications set read_at = now()
  where user_id = auth.uid() and read_at is null and (p_ids is null or id = any(p_ids));
$$;

-- Pending pushes for the send-push Edge Function: unsent, enabled by prefs, with device tokens.
create or replace function public.pending_pushes(p_limit integer default 100)
returns table (notification_id uuid, user_id uuid, kind text, title text, body text, data jsonb, tokens text[])
language sql
stable
security definer
set search_path = public
as $$
  select n.id, n.user_id, n.kind, n.title, n.body, n.data,
         (select coalesce(array_agg(d.token), '{}') from public.device_tokens d where d.user_id = n.user_id)
  from public.notifications n
  where n.sent_at is null and n.created_at > now() - interval '2 days'
    and public.notification_enabled(n.user_id, n.kind)
  order by n.created_at
  limit p_limit;
$$;
revoke all on function public.pending_pushes(integer) from public, anon, authenticated;

create or replace function public.mark_pushes_sent(p_ids uuid[])
returns void
language sql
security definer
set search_path = public
as $$
  update public.notifications set sent_at = now() where id = any(p_ids);
$$;
revoke all on function public.mark_pushes_sent(uuid[]) from public, anon, authenticated;

create or replace function public.remove_device_tokens(p_tokens text[])
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.device_tokens where token = any(p_tokens);
$$;
revoke all on function public.remove_device_tokens(text[]) from public, anon, authenticated;

select cron.schedule('send-push', '*/2 * * * *',
  $$select public.call_edge_function('send-push') where exists (select 1 from public.notifications where sent_at is null and created_at > now() - interval '2 days')$$);

-- Game-day morning reminder for Going games (SPEC 10): runs daily at 09:00 in Eastern time.
create or replace function public.game_day_reminders()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_count integer := 0;
begin
  insert into public.notifications (user_id, kind, title, body, data)
  select a.user_id, 'game_day', at.name || ' at ' || ht.name || ' today',
         'Game at ' || to_char(g.scheduled_start at time zone coalesce(v.tz, 'America/New_York'), 'FMHH12:MI AM') || '. Check in when you get there.',
         jsonb_build_object('game_id', g.id)
  from public.attendances a
  join public.games g on g.id = a.game_id
  join public.teams ht on ht.id = g.home_team_id
  join public.teams at on at.id = g.away_team_id
  left join public.venues v on v.id = g.venue_id
  where a.status = 'going' and g.status = 'scheduled'
    and (g.scheduled_start at time zone coalesce(v.tz, 'America/New_York'))::date = (now() at time zone 'America/New_York')::date
    and not exists (select 1 from public.notifications n where n.user_id = a.user_id and n.kind = 'game_day' and n.data ->> 'game_id' = g.id::text);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function public.game_day_reminders() from public, anon, authenticated;

select cron.schedule('game-day-reminders', '0 13 * * *', $$select public.game_day_reminders()$$);
