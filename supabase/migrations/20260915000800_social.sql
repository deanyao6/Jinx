-- Companions linking and import (SPEC 6.10), companion records, rivalries (6.11), overlap (6.12),
-- feed (6.16), profile search and follow state (8.5, 8.10).

-- ---------------------------------------------------------------------------
-- People: invite links and linking
-- ---------------------------------------------------------------------------
create or replace function public.create_person_invite(p_person_id uuid)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_token text;
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode = 'insufficient_privilege'; end if;
  if not exists (select 1 from public.people where id = p_person_id and owner_user_id = auth.uid() and linked_user_id is null) then
    raise exception 'person not found or already linked' using errcode = 'no_data_found';
  end if;
  v_token := encode(gen_random_bytes(12), 'hex');
  update public.people set invite_token = v_token where id = p_person_id;
  return v_token;
end;
$$;

-- The invited user opens the link (signed in) and accepts: the placeholder becomes them.
create or replace function public.accept_person_invite(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  p record;
  v_games integer;
begin
  if v_uid is null then raise exception 'not signed in' using errcode = 'insufficient_privilege'; end if;
  select * into p from public.people where invite_token = p_token;
  if not found then return jsonb_build_object('ok', false, 'reason', 'invalid'); end if;
  if p.owner_user_id = v_uid then return jsonb_build_object('ok', false, 'reason', 'own_invite'); end if;
  if public.is_blocked_between(v_uid, p.owner_user_id) then return jsonb_build_object('ok', false, 'reason', 'blocked'); end if;
  if p.linked_user_id is not null and p.linked_user_id <> v_uid then return jsonb_build_object('ok', false, 'reason', 'already_linked'); end if;
  if exists (select 1 from public.people where owner_user_id = p.owner_user_id and linked_user_id = v_uid and id <> p.id) then
    -- Owner already has a linked row for this user: merge tags into it and drop the placeholder.
    update public.attendance_companions set person_id = (select id from public.people where owner_user_id = p.owner_user_id and linked_user_id = v_uid)
      where person_id = p.id
      and not exists (select 1 from public.attendance_companions x where x.attendance_id = attendance_companions.attendance_id
                      and x.person_id = (select id from public.people where owner_user_id = p.owner_user_id and linked_user_id = v_uid));
    delete from public.people where id = p.id;
  else
    update public.people set linked_user_id = v_uid, invite_token = null where id = p.id;
  end if;
  select count(*) into v_games from public.attendance_companions ac
    join public.people pp on pp.id = ac.person_id
    where pp.owner_user_id = p.owner_user_id and pp.linked_user_id = v_uid;
  insert into public.notifications (user_id, kind, title, body, data)
  select p.owner_user_id, 'person_linked', 'Companion linked', coalesce(nullif(pr.display_name, ''), pr.handle) || ' accepted your invite.', jsonb_build_object('user_id', v_uid)
  from public.profiles pr where pr.id = v_uid;
  return jsonb_build_object('ok', true, 'owner_user_id', p.owner_user_id, 'tagged_games', v_games);
end;
$$;

-- Games where an owner tagged the calling user, for the consent-based import (SPEC 6.10).
create or replace function public.tagged_games_for_me(p_owner uuid)
returns table (game_id uuid, attendance_id uuid, scheduled_start timestamptz, home_team_name text, away_team_name text, venue_name text, already_logged boolean)
language sql
stable
security definer
set search_path = public
as $$
  select g.id, a.id, g.scheduled_start, ht.name, at.name, v.name,
         exists (select 1 from public.attendances mine where mine.user_id = auth.uid() and mine.game_id = g.id)
  from public.attendance_companions ac
  join public.people p on p.id = ac.person_id and p.owner_user_id = p_owner and p.linked_user_id = auth.uid()
  join public.attendances a on a.id = ac.attendance_id and a.status = 'attended'
  join public.games g on g.id = a.game_id
  join public.teams ht on ht.id = g.home_team_id
  join public.teams at on at.id = g.away_team_id
  left join public.venues v on v.id = g.venue_id
  where auth.uid() is not null and not public.is_blocked_between(auth.uid(), p_owner)
  order by g.scheduled_start desc;
$$;

create or replace function public.import_tagged_games(p_owner uuid, p_game_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_count integer := 0;
  gid uuid;
  v_owner_person uuid;
begin
  if v_uid is null then raise exception 'not signed in' using errcode = 'insufficient_privilege'; end if;
  foreach gid in array p_game_ids loop
    if not exists (select 1 from public.tagged_games_for_me(p_owner) t where t.game_id = gid) then continue; end if;
    insert into public.attendances (user_id, game_id, source, status, verified)
    values (v_uid, gid, 'import', 'attended', false)
    on conflict (user_id, game_id) do nothing;
    if found then
      v_count := v_count + 1;
      -- Tag the owner back if the importer follows them.
      if public.follows_active(v_uid, p_owner) then
        select id into v_owner_person from public.people where owner_user_id = v_uid and linked_user_id = p_owner;
        if v_owner_person is null then
          insert into public.people (owner_user_id, display_name, linked_user_id)
          select v_uid, coalesce(nullif(pr.display_name, ''), pr.handle), p_owner from public.profiles pr where pr.id = p_owner
          returning id into v_owner_person;
        end if;
        insert into public.attendance_companions (attendance_id, person_id)
        select a.id, v_owner_person from public.attendances a where a.user_id = v_uid and a.game_id = gid
        on conflict do nothing;
      end if;
    end if;
  end loop;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Companion records (SPEC 6.2, 8.5). Own data only.
-- ---------------------------------------------------------------------------
create or replace function public.companion_records()
returns table (person_id uuid, display_name text, linked_user_id uuid, linked_handle text, games integer, wins integer, losses integer, ties integer, last_game timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.display_name, p.linked_user_id, pr.handle,
         count(u.game_id)::integer,
         count(*) filter (where u.result = 'win')::integer,
         count(*) filter (where u.result = 'loss')::integer,
         count(*) filter (where u.result = 'tie')::integer,
         max(u.scheduled_start)
  from public.people p
  left join public.profiles pr on pr.id = p.linked_user_id
  left join public.attendance_companions ac on ac.person_id = p.id
  left join public.user_game_results(auth.uid()) u on u.attendance_id = ac.attendance_id and u.counted
  where p.owner_user_id = auth.uid()
  group by p.id, pr.handle
  order by count(u.game_id) desc, p.display_name;
$$;

create or replace function public.companion_games(p_person_id uuid)
returns table (game_id uuid, scheduled_start timestamptz, result text, home_team_name text, away_team_name text, home_score integer, away_score integer, venue_name text)
language sql
stable
security definer
set search_path = public
as $$
  select u.game_id, u.scheduled_start, u.result, ht.name, at.name, u.home_score, u.away_score, v.name
  from public.people p
  join public.attendance_companions ac on ac.person_id = p.id
  join public.user_game_results(auth.uid()) u on u.attendance_id = ac.attendance_id
  join public.teams ht on ht.id = u.home_team_id
  join public.teams at on at.id = u.away_team_id
  left join public.venues v on v.id = u.venue_id
  where p.id = p_person_id and p.owner_user_id = auth.uid()
  order by u.scheduled_start desc;
$$;

-- ---------------------------------------------------------------------------
-- Rivalries (SPEC 6.11): mutual follows whose favorite franchises have met.
-- ---------------------------------------------------------------------------
create or replace function public.rivalries()
returns table (
  rival_user_id uuid, rival_handle text, rival_display_name text,
  rival_teams jsonb, my_wins integer, rival_wins integer, ties integer,
  together_my_wins integer, together_rival_wins integer,
  my_meetings_attended integer, rival_meetings_attended integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  m record;
begin
  if v_uid is null then return; end if;
  for m in
    select f.followee_id as rival from public.follows f
    where f.follower_id = v_uid and f.status = 'active' and public.is_mutual(v_uid, f.followee_id)
  loop
    -- Franchises of each user that have played each other in the games table.
    if not exists (
      select 1 from public.user_teams a join public.teams ta on ta.id = a.team_id
      join public.user_teams b on b.user_id = m.rival join public.teams tb on tb.id = b.team_id
      join public.teams ha on ha.franchise_id = ta.franchise_id join public.teams hb on hb.franchise_id = tb.franchise_id
      join public.games g on (g.home_team_id = ha.id and g.away_team_id = hb.id) or (g.home_team_id = hb.id and g.away_team_id = ha.id)
      where a.user_id = v_uid and ta.franchise_id <> tb.franchise_id
      limit 1
    ) then continue; end if;

    return query
    with mine as (select * from public.user_game_results(v_uid) where result is not null),
         theirs as (select * from public.user_game_results(m.rival) where result is not null),
         h2h as (
           select mi.game_id, mi.result as my_result, th.result as their_result,
                  (exists (select 1 from public.checkins c1 where c1.user_id = v_uid and c1.game_id = mi.game_id)
                   and exists (select 1 from public.checkins c2 where c2.user_id = m.rival and c2.game_id = mi.game_id))
                  or (exists (select 1 from public.attendance_companions ac join public.people p on p.id = ac.person_id
                              where ac.attendance_id = mi.attendance_id and p.linked_user_id = m.rival)
                      and exists (select 1 from public.attendance_companions ac join public.people p on p.id = ac.person_id
                              where ac.attendance_id = th.attendance_id and p.linked_user_id = v_uid)) as together
           from mine mi join theirs th on th.game_id = mi.game_id
           where mi.rooting_team_id <> th.rooting_team_id
         ),
         my_fr as (select distinct t.franchise_id from public.user_teams ut join public.teams t on t.id = ut.team_id where ut.user_id = v_uid),
         their_fr as (select distinct t.franchise_id from public.user_teams ut join public.teams t on t.id = ut.team_id where ut.user_id = m.rival),
         meetings as (
           select g.id from public.games g
           join public.teams ht on ht.id = g.home_team_id join public.teams at on at.id = g.away_team_id
           where (ht.franchise_id in (select franchise_id from my_fr) and at.franchise_id in (select franchise_id from their_fr))
              or (at.franchise_id in (select franchise_id from my_fr) and ht.franchise_id in (select franchise_id from their_fr))
         )
    select m.rival, pr.handle, pr.display_name,
           (select coalesce(jsonb_agg(distinct t.name), '[]'::jsonb) from public.user_teams ut join public.teams t on t.id = ut.team_id where ut.user_id = m.rival),
           (select count(*) from h2h where my_result = 'win')::integer,
           (select count(*) from h2h where their_result = 'win')::integer,
           (select count(*) from h2h where my_result = 'tie')::integer,
           (select count(*) from h2h where my_result = 'win' and together)::integer,
           (select count(*) from h2h where their_result = 'win' and together)::integer,
           (select count(*) from mine where game_id in (select id from meetings))::integer,
           (select count(*) from theirs where game_id in (select id from meetings))::integer
    from public.profiles pr where pr.id = m.rival;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Overlap (SPEC 6.12): games both mutuals logged; "before you connected" label; section gap if both share seats.
-- ---------------------------------------------------------------------------
create or replace function public.overlaps()
returns table (
  other_user_id uuid, other_handle text, other_display_name text, game_id uuid, scheduled_start timestamptz,
  home_team_name text, away_team_name text, venue_name text, before_connected boolean, section_gap integer
)
language sql
stable
security definer
set search_path = public
as $$
  with mutuals as (
    select f.followee_id as other, greatest(f.accepted_at, r.accepted_at) as connected_at
    from public.follows f join public.follows r on r.follower_id = f.followee_id and r.followee_id = f.follower_id
    where f.follower_id = auth.uid() and f.status = 'active' and r.status = 'active'
      and not public.is_blocked_between(auth.uid(), f.followee_id)
  )
  select m.other, pr.handle, pr.display_name, g.id, g.scheduled_start, ht.name, at.name, v.name,
         g.scheduled_start < m.connected_at,
         case when me.share_seats and pr.share_seats and ms.section ~ '^\d+$' and os.section ~ '^\d+$'
              then abs(ms.section::integer - os.section::integer) else null end
  from mutuals m
  join public.profiles pr on pr.id = m.other and pr.show_on_overlap
  join public.profiles me on me.id = auth.uid() and me.show_on_overlap
  join public.attendances a on a.user_id = auth.uid() and a.status = 'attended'
  join public.attendances b on b.user_id = m.other and b.game_id = a.game_id and b.status = 'attended'
  join public.games g on g.id = a.game_id
  join public.teams ht on ht.id = g.home_team_id
  join public.teams at on at.id = g.away_team_id
  left join public.venues v on v.id = g.venue_id
  left join public.attendance_seats ms on ms.attendance_id = a.id
  left join public.attendance_seats os on os.attendance_id = b.id
  order by g.scheduled_start desc;
$$;

-- Followed users who were also at a game (game detail, mutuals only).
create or replace function public.mutuals_at_game(p_game_id uuid)
returns table (user_id uuid, handle text, display_name text)
language sql
stable
security definer
set search_path = public
as $$
  select pr.id, pr.handle, pr.display_name
  from public.attendances a join public.profiles pr on pr.id = a.user_id
  where a.game_id = p_game_id and a.user_id <> auth.uid() and a.status = 'attended' and public.is_mutual(auth.uid(), a.user_id);
$$;

-- ---------------------------------------------------------------------------
-- Feed (SPEC 6.16): events from active followees and self, paginated by created_at.
-- ---------------------------------------------------------------------------
create or replace function public.feed(p_before timestamptz default null, p_limit integer default 30)
returns table (
  id uuid, actor_user_id uuid, actor_handle text, actor_display_name text, type text, game_id uuid, payload jsonb, created_at timestamptz,
  game jsonb, reactions jsonb, my_reaction text
)
language sql
stable
security definer
set search_path = public
as $$
  select e.id, e.actor_user_id, pr.handle, pr.display_name, e.type, e.game_id, e.payload, e.created_at,
         case when g.id is null then null else jsonb_build_object(
           'sport_id', g.sport_id, 'scheduled_start', g.scheduled_start, 'status', g.status,
           'home', ht.name, 'away', at.name, 'home_score', g.home_score, 'away_score', g.away_score, 'venue', v.name) end,
         coalesce((select jsonb_object_agg(r.emoji, r.n) from (select emoji, count(*) n from public.reactions where feed_event_id = e.id group by emoji) r), '{}'::jsonb),
         (select emoji from public.reactions where feed_event_id = e.id and user_id = auth.uid())
  from public.feed_events e
  join public.profiles pr on pr.id = e.actor_user_id
  left join public.games g on g.id = e.game_id
  left join public.teams ht on ht.id = g.home_team_id
  left join public.teams at on at.id = g.away_team_id
  left join public.venues v on v.id = g.venue_id
  where auth.uid() is not null
    and (e.actor_user_id = auth.uid() or (e.visibility <> 'private' and public.follows_active(auth.uid(), e.actor_user_id)))
    and not public.is_blocked_between(auth.uid(), e.actor_user_id)
    and (p_before is null or e.created_at < p_before)
  order by e.created_at desc
  limit least(greatest(coalesce(p_limit, 30), 1), 100);
$$;

-- ---------------------------------------------------------------------------
-- Profiles: search and follow state
-- ---------------------------------------------------------------------------
create or replace function public.search_profiles(p_query text, p_limit integer default 20)
returns table (id uuid, handle text, display_name text, is_private boolean, follow_status text, follows_me boolean)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.handle, p.display_name, p.is_private,
         (select status from public.follows where follower_id = auth.uid() and followee_id = p.id),
         public.follows_active(p.id, auth.uid())
  from public.profiles p
  where auth.uid() is not null and p.id <> auth.uid()
    and not public.is_blocked_between(auth.uid(), p.id)
    and (lower(p.handle) like lower(trim(p_query)) || '%' or lower(p.display_name) like '%' || lower(trim(p_query)) || '%')
  order by (lower(p.handle) = lower(trim(p_query))) desc, p.handle
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

create or replace function public.profile_view(p_handle text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case when p.id is null or not public.can_view_profile(p.id) then null else jsonb_build_object(
    'id', p.id, 'handle', p.handle, 'display_name', p.display_name, 'avatar_path', p.avatar_path, 'home_city', p.home_city,
    'is_private', p.is_private, 'is_me', p.id = auth.uid(),
    'can_view', public.can_view_user(p.id),
    'follow_status', (select status from public.follows where follower_id = auth.uid() and followee_id = p.id),
    'follows_me', public.follows_active(p.id, auth.uid()),
    'is_mutual', public.is_mutual(auth.uid(), p.id),
    'teams', (select coalesce(jsonb_agg(jsonb_build_object('team_id', t.id, 'name', t.name, 'sport_id', t.sport_id)), '[]'::jsonb) from public.user_teams ut join public.teams t on t.id = ut.team_id where ut.user_id = p.id),
    'followers', (select count(*) from public.follows where followee_id = p.id and status = 'active'),
    'following', (select count(*) from public.follows where follower_id = p.id and status = 'active'),
    'stats', case when public.can_view_user(p.id) then (select payload from public.user_stats_cache where user_id = p.id) else null end
  ) end
  from (select * from public.profiles where lower(handle) = lower(p_handle)) p;
$$;

-- Notifications for follows (SPEC 10).
create or replace function public.follows_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, kind, title, body, data)
  select new.followee_id,
         case when new.status = 'requested' then 'follow_request' else 'new_follower' end,
         case when new.status = 'requested' then 'Follow request' else 'New follower' end,
         coalesce(nullif(pr.display_name, ''), pr.handle) || case when new.status = 'requested' then ' wants to follow you.' else ' started following you.' end,
         jsonb_build_object('user_id', new.follower_id)
  from public.profiles pr where pr.id = new.follower_id;
  return null;
end;
$$;
create trigger follows_notify after insert on public.follows for each row execute function public.follows_after_insert();

-- Someone tagged you at a game (linked person).
create or replace function public.companions_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, kind, title, body, data)
  select p.linked_user_id, 'tagged', 'You were tagged at a game',
         coalesce(nullif(o.display_name, ''), o.handle) || ' tagged you at ' || at.name || ' at ' || ht.name || '.',
         jsonb_build_object('user_id', o.id, 'game_id', a.game_id)
  from public.people p
  join public.attendances a on a.id = new.attendance_id
  join public.profiles o on o.id = p.owner_user_id
  join public.games g on g.id = a.game_id
  join public.teams ht on ht.id = g.home_team_id
  join public.teams at on at.id = g.away_team_id
  where p.id = new.person_id and p.linked_user_id is not null and p.linked_user_id <> a.user_id;
  return null;
end;
$$;
create trigger companions_notify after insert on public.attendance_companions for each row execute function public.companions_after_insert();
