-- Profile photos (SPEC.md 8.6, 9). `profiles.avatar_path` has existed since the first migration
-- and nothing wrote to it or drew it, so every real person had the same generated face.
--
-- Objects live in the private `avatars` bucket at `<user_id>/avatar-<timestamp>.<ext>`. A new
-- path per upload, so no cache anywhere can show yesterday's picture under today's name.
--
-- The bucket is private on purpose. A public bucket serves every object to anyone holding the
-- URL without consulting a policy, so "blocked users see nothing" (SPEC.md 9) could not hold.
-- The app reads through signed URLs, and signing one needs the select policy below to pass.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 5242880,
        array['image/jpeg', 'image/png', 'image/heic', 'image/webp'])
on conflict (id) do nothing;

-- A profile can only point at a file in its own folder. Without this a user could aim their
-- avatar_path at somebody else's object.
alter table public.profiles
  add constraint profiles_avatar_path_own_folder
  check (avatar_path is null or avatar_path like id::text || '/%');

create index if not exists profiles_avatar_path_idx on public.profiles (avatar_path)
  where avatar_path is not null;

-- Who may read an avatar object: its owner always, and anyone who may see the owner's profile
-- card (`can_view_profile`: signed in, and not blocked in either direction) while the object is
-- the owner's CURRENT avatar. A private account still shows its avatar on its card, which is what
-- the card helper already decides. An object that is no longer the current avatar (replaced or
-- removed, and the delete has not landed yet) is dark to everyone but its owner.
--
-- A security-definer function rather than a subquery in the policy, for the same reason as the
-- attendance-photos policy: a subquery on profiles would be filtered by that table's own RLS.
create or replace function public.can_view_avatar(p_object_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and (
    split_part(p_object_name, '/', 1) = auth.uid()::text
    or exists (
      select 1 from public.profiles p
      where p.avatar_path = p_object_name
        and p.id::text = split_part(p_object_name, '/', 1)
        and public.can_view_profile(p.id)
    )
  );
$$;

create policy avatars_owner_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_owner_update on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_owner_delete on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_object_select on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and public.can_view_avatar(name));

-- ---------------------------------------------------------------------------
-- The lists that draw a person now carry their avatar_path. Each function gains one column at
-- the END of its row, so nothing that reads the existing columns changes. A changed return type
-- cannot be `create or replace`d, hence the drops; the bodies are otherwise as they were.
--
-- Every path is returned through can_view_profile, so a list never hands out a path the storage
-- policy would then refuse.
-- ---------------------------------------------------------------------------

drop function if exists public.search_profiles(text, integer);
create function public.search_profiles(p_query text, p_limit integer default 20)
returns table (id uuid, handle text, display_name text, is_private boolean, follow_status text, follows_me boolean, avatar_path text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.handle, p.display_name, p.is_private,
         (select status from public.follows where follower_id = auth.uid() and followee_id = p.id),
         public.follows_active(p.id, auth.uid()),
         p.avatar_path
  from public.profiles p
  where auth.uid() is not null and p.id <> auth.uid()
    and not public.is_blocked_between(auth.uid(), p.id)
    and (lower(p.handle) like lower(trim(p_query)) || '%' or lower(p.display_name) like '%' || lower(trim(p_query)) || '%')
  order by (lower(p.handle) = lower(trim(p_query))) desc, p.handle
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

drop function if exists public.companion_records();
create function public.companion_records()
returns table (person_id uuid, display_name text, linked_user_id uuid, linked_handle text, games integer, wins integer, losses integer, ties integer, last_game timestamptz, linked_avatar_path text)
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
         max(u.scheduled_start),
         case when pr.id is not null and public.can_view_profile(pr.id) then pr.avatar_path end
  from public.people p
  left join public.profiles pr on pr.id = p.linked_user_id
  left join public.attendance_companions ac on ac.person_id = p.id
  left join public.user_game_results(auth.uid()) u on u.attendance_id = ac.attendance_id and u.counted
  where p.owner_user_id = auth.uid()
  group by p.id, pr.id, pr.handle, pr.avatar_path
  order by count(u.game_id) desc, p.display_name;
$$;

drop function if exists public.feed(timestamptz, integer);
create function public.feed(p_before timestamptz default null, p_limit integer default 30)
returns table (
  id uuid, actor_user_id uuid, actor_handle text, actor_display_name text, type text, game_id uuid, payload jsonb, created_at timestamptz,
  game jsonb, reactions jsonb, my_reaction text, actor_avatar_path text
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
         (select emoji from public.reactions where feed_event_id = e.id and user_id = auth.uid()),
         pr.avatar_path
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
