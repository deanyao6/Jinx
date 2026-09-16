-- Gaps found while building the Friends tab: blocked-user names, own tags on a game, team nicknames.

alter table public.teams add column nickname text;
update public.teams set nickname = case
  when sport_id = 'nfl' then regexp_replace(name, '^.* ', '')
  else name end;

-- Names of the people I blocked (profiles RLS hides them both ways).
create or replace function public.blocked_users()
returns table (user_id uuid, handle text, display_name text, blocked_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.handle, p.display_name, b.created_at
  from public.blocks b join public.profiles p on p.id = b.blocked_id
  where b.blocker_id = auth.uid()
  order by b.created_at desc;
$$;

-- Tags of me (a person linked to my account) on other users' attendances for a game, visible even
-- when the owner's attendances are hidden, because I am allowed to remove them.
create or replace function public.my_tags_at_game(p_game_id uuid)
returns table (attendance_id uuid, person_id uuid, owner_user_id uuid, owner_handle text, owner_display_name text)
language sql
stable
security definer
set search_path = public
as $$
  select a.id, p.id, a.user_id, pr.handle, pr.display_name
  from public.attendance_companions ac
  join public.people p on p.id = ac.person_id and p.linked_user_id = auth.uid()
  join public.attendances a on a.id = ac.attendance_id and a.game_id = p_game_id and a.user_id <> auth.uid()
  join public.profiles pr on pr.id = a.user_id;
$$;

-- profile_view: distinguish blocked from unknown so the app can offer Unblock.
create or replace function public.profile_view(p_handle text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p.id is null then null
    when exists (select 1 from public.blocks where blocker_id = auth.uid() and blocked_id = p.id)
      then jsonb_build_object('id', p.id, 'handle', p.handle, 'blocked_by_me', true)
    when not public.can_view_profile(p.id) then null
    else jsonb_build_object(
      'id', p.id, 'handle', p.handle, 'display_name', p.display_name, 'avatar_path', p.avatar_path, 'home_city', p.home_city,
      'is_private', p.is_private, 'is_me', p.id = auth.uid(),
      'can_view', public.can_view_user(p.id),
      'follow_status', (select status from public.follows where follower_id = auth.uid() and followee_id = p.id),
      'follows_me', public.follows_active(p.id, auth.uid()),
      'is_mutual', public.is_mutual(auth.uid(), p.id),
      'teams', (select coalesce(jsonb_agg(jsonb_build_object('team_id', t.id, 'name', t.name, 'nickname', t.nickname, 'sport_id', t.sport_id)), '[]'::jsonb) from public.user_teams ut join public.teams t on t.id = ut.team_id where ut.user_id = p.id),
      'followers', (select count(*) from public.follows where followee_id = p.id and status = 'active'),
      'following', (select count(*) from public.follows where follower_id = p.id and status = 'active'),
      'stats', case when public.can_view_user(p.id) then (select payload from public.user_stats_cache where user_id = p.id) else null end
    ) end
  from (select * from public.profiles where lower(handle) = lower(p_handle)) p;
$$;

-- Feed game JSON gains nicknames for shorter copy.
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
           'home', ht.name, 'away', at.name, 'home_nickname', ht.nickname, 'away_nickname', at.nickname,
           'home_score', g.home_score, 'away_score', g.away_score, 'venue', v.name) end,
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
