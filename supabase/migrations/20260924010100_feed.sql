-- Social v2, prompt 2, sections 2 to 4: the feed, kudos, comments, creators and Discover
-- (docs/prompts/social/02).
--
-- Ranking is reverse chronological inside each segment, by design: no algorithm.
--   Following: published posts by people I follow, and my own, minus anyone I muted, minus
--              anyone blocked either way, minus posts whose visibility leaves me out.
--   Discover:  posts by creators I do not follow about my teams, then posts in communities
--              I joined (by people I do not follow), plus two lists of people: creators and
--              fans at my games.
-- Pages are keyed on (published_at, id), so a post arriving at the top never shifts a page
-- that is already loaded.
--
-- Counts are per viewer: a kudos or a comment from someone blocked either way is not
-- counted, so a block is invisible everywhere, including in a number.

-- ---------------------------------------------------------------------------
-- Rate limits: one table of recent actions, one check, a friendly error.
-- ---------------------------------------------------------------------------

create table public.rate_events (
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null,
  at timestamptz not null default now()
);
create index rate_events_idx on public.rate_events (user_id, kind, at desc);
alter table public.rate_events enable row level security;
-- No policy: nobody reads or writes this but the triggers below.

-- Raises SQLSTATE JX429 ("rate_limited") when this user already did `p_kind` `p_max` times in
-- `p_window`. The app turns the code into "Slow down" copy; it is never a crash. Only signed-in
-- users are limited: the server's own writes (auto-post, system posts) are not.
create or replace function public.rate_limit(p_kind text, p_max integer, p_window interval)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then return; end if;
  if (select count(*) from public.rate_events where user_id = v_user and kind = p_kind and at > now() - p_window) >= p_max then
    raise exception 'rate_limited: %', p_kind using errcode = 'JX429',
      hint = 'Slow down a little and try again in a few minutes.';
  end if;
  insert into public.rate_events (user_id, kind) values (v_user, p_kind);
  -- Keep the table small: anything older than a day never matters.
  delete from public.rate_events where user_id = v_user and kind = p_kind and at < now() - interval '1 day';
end;
$$;

revoke all on function public.rate_limit(text, integer, interval) from public, anon;
grant execute on function public.rate_limit(text, integer, interval) to authenticated;

-- The limits, in one place (docs/moderation.md quotes them). This trigger runs as the caller
-- on purpose: `current_user` is then 'authenticated' for a fan's own write and the owner for a
-- write the server makes inside a security definer function, which is never limited.
create or replace function public.rate_limit_trigger()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon') then return new; end if;
  case tg_table_name
    when 'posts' then perform public.rate_limit('post', 20, interval '1 hour');
    when 'comments' then perform public.rate_limit('comment', 20, interval '10 minutes');
    when 'kudos' then perform public.rate_limit('kudos', 120, interval '1 hour');
    when 'follows' then perform public.rate_limit('follow', 150, interval '1 hour');
    when 'reports' then perform public.rate_limit('report', 10, interval '1 hour');
  end case;
  return new;
end;
$$;

create trigger posts_rate_limit before insert on public.posts for each row execute function public.rate_limit_trigger();
create trigger comments_rate_limit before insert on public.comments for each row execute function public.rate_limit_trigger();
create trigger kudos_rate_limit before insert on public.kudos for each row execute function public.rate_limit_trigger();
create trigger follows_rate_limit before insert on public.follows for each row execute function public.rate_limit_trigger();
create trigger reports_rate_limit before insert on public.reports for each row execute function public.rate_limit_trigger();

-- ---------------------------------------------------------------------------
-- Kudos: never on your own post, and the author hears about them in one line.
-- ---------------------------------------------------------------------------

drop policy kudos_insert on public.kudos;
create policy kudos_insert on public.kudos for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.can_view_post(post_id)
    and public.post_author(post_id) <> auth.uid()
  );

-- "Maya and 3 others gave kudos." One notification per post until it is read or pushed, then a
-- fresh one. A kudos from someone the author blocked (or who blocked them) says nothing.
create or replace function public.kudos_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author uuid := public.post_author(new.post_id);
  v_name text;
  v_others integer;
  v_body text;
  v_existing uuid;
begin
  if v_author is null or v_author = new.user_id or public.is_blocked_between(v_author, new.user_id) then
    return null;
  end if;
  select coalesce(nullif(display_name, ''), handle) into v_name from public.profiles where id = new.user_id;
  select count(*) - 1 into v_others from public.kudos k
  where k.post_id = new.post_id and not public.is_blocked_between(v_author, k.user_id);
  v_body := v_name || case
    when v_others <= 0 then ' gave kudos.'
    when v_others = 1 then ' and 1 other gave kudos.'
    else ' and ' || v_others || ' others gave kudos.'
  end;
  select id into v_existing from public.notifications
  where user_id = v_author and kind = 'kudos' and data ->> 'post_id' = new.post_id::text
    and sent_at is null and read_at is null
  order by created_at desc limit 1;
  if v_existing is not null then
    update public.notifications set body = v_body, created_at = now(),
      data = data || jsonb_build_object('user_id', new.user_id, 'count', v_others + 1)
    where id = v_existing;
  else
    insert into public.notifications (user_id, kind, title, body, data)
    values (v_author, 'kudos', 'Kudos', v_body,
            jsonb_build_object('post_id', new.post_id, 'user_id', new.user_id, 'count', v_others + 1));
  end if;
  return null;
end;
$$;

create trigger kudos_notify after insert on public.kudos for each row execute function public.kudos_notify();

-- ---------------------------------------------------------------------------
-- Comments: 500 characters, and the post's author is told.
-- ---------------------------------------------------------------------------

alter table public.comments add constraint comments_body_500 check (char_length(body) <= 500);

create or replace function public.comments_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author uuid := public.post_author(new.post_id);
  v_name text;
begin
  if v_author is null or v_author = new.author_id or public.is_blocked_between(v_author, new.author_id) then
    return null;
  end if;
  select coalesce(nullif(display_name, ''), handle) into v_name from public.profiles where id = new.author_id;
  insert into public.notifications (user_id, kind, title, body, data)
  values (v_author, 'comment', 'New comment',
          v_name || ': ' || left(new.body, 120) || case when char_length(new.body) > 120 then '...' else '' end,
          jsonb_build_object('post_id', new.post_id, 'comment_id', new.id, 'user_id', new.author_id));
  return null;
end;
$$;

create trigger comments_notify after insert on public.comments for each row execute function public.comments_notify();

-- ---------------------------------------------------------------------------
-- A post as a card: everything the feed, the post page and the demo need, in one row.
-- ---------------------------------------------------------------------------

create type public.post_card_row as (
  id uuid,
  kind text,
  author_id uuid,
  author_handle text,
  author_display_name text,
  author_avatar_path text,
  author_is_creator boolean,
  caption text,
  visibility text,
  created_at timestamptz,
  published_at timestamptz,
  publish_at timestamptz,
  auto_posted boolean,
  payload jsonb,
  game jsonb,
  result text,
  kudos_count integer,
  my_kudos boolean,
  comment_count integer,
  photos text[],
  reactions jsonb,
  companions jsonb,
  community jsonb
);

create or replace function public.post_cards(p_ids uuid[])
returns setof public.post_card_row
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.kind, p.author_id, a.handle, a.display_name, a.avatar_path, a.is_creator,
         p.caption, p.visibility, p.created_at, p.published_at, p.publish_at, p.auto_posted, p.payload,
         case when g.id is null then null else jsonb_build_object(
           'id', g.id, 'sport_id', g.sport_id, 'status', g.status,
           'scheduled_start', g.scheduled_start,
           'home_team_id', g.home_team_id, 'away_team_id', g.away_team_id,
           'home_name', ht.nickname, 'away_name', awt.nickname,
           'home_abbr', ht.abbreviation, 'away_abbr', awt.abbreviation,
           'home_score', g.home_score, 'away_score', g.away_score,
           'winner_team_id', g.winner_team_id, 'is_tie', g.is_tie,
           'venue_name', v.name, 'venue_tz', v.tz
         ) end,
         case
           when att.rooting_team_id is null or g.status <> 'final' then null
           when g.winner_team_id = att.rooting_team_id then 'win'
           when g.winner_team_id is not null then 'loss'
           when g.is_tie then 'tie'
         end,
         (select count(*)::integer from public.kudos k
           where k.post_id = p.id and not public.is_blocked_between(auth.uid(), k.user_id)),
         exists (select 1 from public.kudos k where k.post_id = p.id and k.user_id = auth.uid()),
         (select count(*)::integer from public.comments c
           where c.post_id = p.id and c.deleted_at is null
             and not public.is_blocked_between(auth.uid(), c.author_id)),
         coalesce((select array_agg(ph.storage_path order by ph.ordinal) from public.post_photos ph where ph.post_id = p.id), '{}'),
         coalesce((
           select jsonb_agg(jsonb_build_object(
             'id', r.id, 'back_path', r.back_path, 'front_path', r.front_path,
             'period_label', r.period_label, 'late_seconds', r.late_seconds, 'captured_at', r.captured_at
           ) order by r.captured_at)
           from public.reactions r
           where r.id = p.reaction_id or (p.kind = 'game' and r.post_id = p.id)
         ), '[]'::jsonb),
         -- Confirmed companions only: a pending tag is nobody's business until it is accepted.
         coalesce((
           select jsonb_agg(jsonb_build_object(
             'name', coalesce(nullif(lp.display_name, ''), pe.display_name),
             'handle', case when lp.id is not null and public.can_view_profile(lp.id) then lp.handle end
           ) order by pe.display_name)
           from public.attendance_companions ac
           join public.people pe on pe.id = ac.person_id
           left join public.profiles lp on lp.id = pe.linked_user_id
           where ac.attendance_id = p.attendance_id and ac.status = 'confirmed'
             and (lp.id is null or not public.is_blocked_between(auth.uid(), lp.id))
         ), '[]'::jsonb),
         (select jsonb_build_object('slug', cm.slug, 'name', cm.name)
            from public.community_posts cp join public.communities cm on cm.id = cp.community_id
            where cp.post_id = p.id order by cm.name limit 1)
  from unnest(p_ids) with ordinality as ids(id, ord)
  join public.posts p on p.id = ids.id
  join public.profiles a on a.id = p.author_id
  left join public.attendances att on att.id = p.attendance_id
  left join public.games g on g.id = p.game_id
  left join public.teams ht on ht.id = g.home_team_id
  left join public.teams awt on awt.id = g.away_team_id
  left join public.venues v on v.id = g.venue_id
  where public.can_view_post(p.id)
  order by ids.ord;
$$;

revoke all on function public.post_cards(uuid[]) from public, anon;
grant execute on function public.post_cards(uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- The feed
-- ---------------------------------------------------------------------------

create or replace function public.feed_posts(
  p_segment text default 'following',
  p_before_at timestamptz default null,
  p_before_id uuid default null,
  p_limit integer default 20
)
returns setof public.post_card_row
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_ids uuid[];
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 50);
begin
  if v_me is null then return; end if;
  if p_segment = 'following' then
    select array_agg(x.id order by x.published_at desc, x.id desc) into v_ids from (
      select p.id, p.published_at from public.posts p
      where p.published_at is not null and p.deleted_at is null
        and (p.author_id = v_me or public.follows_active(v_me, p.author_id))
        and not public.is_muted(p.author_id)
        and (p_before_at is null or (p.published_at, p.id) < (p_before_at, coalesce(p_before_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)))
        and public.can_view_post(p.id)
      order by p.published_at desc, p.id desc
      limit v_limit
    ) x;
  elsif p_segment = 'discover' then
    -- Never someone I follow (they are in Following) and never me.
    select array_agg(x.id order by x.published_at desc, x.id desc) into v_ids from (
      select p.id, p.published_at from public.posts p
      join public.profiles a on a.id = p.author_id
      where p.published_at is not null and p.deleted_at is null
        and p.author_id <> v_me
        and not public.follows_active(v_me, p.author_id)
        and not public.is_muted(p.author_id)
        and (p_before_at is null or (p.published_at, p.id) < (p_before_at, coalesce(p_before_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)))
        and (
          -- A creator posting about one of my teams.
          (a.is_creator and exists (
            select 1 from public.games g join public.user_teams ut
              on ut.team_id in (g.home_team_id, g.away_team_id) and ut.user_id = v_me
            where g.id = p.game_id))
          -- A post in a community I joined.
          or exists (
            select 1 from public.community_posts cp
            join public.community_members m on m.community_id = cp.community_id and m.user_id = v_me
            where cp.post_id = p.id)
        )
        and public.can_view_post(p.id)
      order by p.published_at desc, p.id desc
      limit v_limit
    ) x;
  else
    raise exception 'unknown segment %', p_segment using errcode = 'invalid_parameter_value';
  end if;
  if v_ids is null then return; end if;
  return query select * from public.post_cards(v_ids);
end;
$$;

revoke all on function public.feed_posts(text, timestamptz, uuid, integer) from public, anon;
grant execute on function public.feed_posts(text, timestamptz, uuid, integer) to authenticated;

-- One post, for its own page. Muting hides someone from the feed, not from here.
create or replace function public.post_card(p_post_id uuid)
returns setof public.post_card_row
language sql
stable
security definer
set search_path = public
as $$
  select * from public.post_cards(array[p_post_id]);
$$;

revoke all on function public.post_card(uuid) from public, anon;
grant execute on function public.post_card(uuid) to authenticated;

-- A person's own posts, for their profile.
create or replace function public.profile_posts(
  p_user_id uuid,
  p_before_at timestamptz default null,
  p_before_id uuid default null,
  p_limit integer default 20
)
returns setof public.post_card_row
language sql
stable
security definer
set search_path = public
as $$
  select * from public.post_cards((
    select array_agg(x.id order by x.published_at desc, x.id desc) from (
      select p.id, p.published_at from public.posts p
      where p.author_id = p_user_id and p.published_at is not null and p.deleted_at is null
        and (p_before_at is null or (p.published_at, p.id) < (p_before_at, coalesce(p_before_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)))
        and public.can_view_post(p.id)
      order by p.published_at desc, p.id desc
      limit least(greatest(coalesce(p_limit, 20), 1), 50)
    ) x
  ));
$$;

revoke all on function public.profile_posts(uuid, timestamptz, uuid, integer) from public, anon;
grant execute on function public.profile_posts(uuid, timestamptz, uuid, integer) to authenticated;

-- The thread on a post: flat, oldest first, newest last. Blocked either way and muted people
-- are left out; `can_delete` is true for the comment's author and the post's author.
create or replace function public.post_comments(p_post_id uuid)
returns table (
  id uuid,
  author_id uuid,
  author_handle text,
  author_display_name text,
  author_avatar_path text,
  body text,
  created_at timestamptz,
  can_delete boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.author_id, a.handle, a.display_name, a.avatar_path, c.body, c.created_at,
         c.author_id = auth.uid() or public.post_author(c.post_id) = auth.uid()
  from public.comments c
  join public.profiles a on a.id = c.author_id
  where c.post_id = p_post_id
    and c.deleted_at is null
    and public.can_view_post(c.post_id)
    and not public.is_blocked_between(auth.uid(), c.author_id)
    and (c.author_id = auth.uid() or not public.is_muted(c.author_id))
  order by c.created_at, c.id;
$$;

revoke all on function public.post_comments(uuid) from public, anon;
grant execute on function public.post_comments(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Creators, ranked once a day
-- ---------------------------------------------------------------------------

-- `profiles.is_creator` is set by hand (supabase/scripts/creator.sql). This table is the daily
-- ranking input: one row per creator and favorite team (team null for a creator with none).
create table public.creator_rankings (
  creator_id uuid not null references public.profiles (id) on delete cascade,
  team_id uuid references public.teams (id) on delete cascade,
  followers integer not null,
  last_post_at timestamptz,
  refreshed_at timestamptz not null default now()
);
create unique index creator_rankings_key on public.creator_rankings (creator_id, coalesce(team_id, '00000000-0000-0000-0000-000000000000'::uuid));
alter table public.creator_rankings enable row level security;
-- Read through discover_people() only.

create or replace function public.refresh_creator_rankings()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows integer;
begin
  delete from public.creator_rankings;
  insert into public.creator_rankings (creator_id, team_id, followers, last_post_at)
  select pr.id, ut.team_id, pr.followers_count,
         (select max(p.published_at) from public.posts p
           where p.author_id = pr.id and p.deleted_at is null and p.published_at is not null and p.visibility <> 'private')
  from public.profiles pr
  left join public.user_teams ut on ut.user_id = pr.id
  where pr.is_creator;
  get diagnostics v_rows = row_count;
  return v_rows;
end;
$$;

revoke all on function public.refresh_creator_rankings() from public, anon, authenticated;
select cron.schedule('creator-rankings', '15 10 * * *', $$select public.refresh_creator_rankings()$$);

-- Discover's two lists of people.
--   creator:  shares a favorite team with me first, then by followers, then by who posted last.
--             Ten at most, from yesterday's ranking.
--   fan:      logged a game I logged. Not a mutual (they are in Following already), not someone
--             who switched off overlap, and only people whose profile I may see.
create or replace function public.discover_people()
returns table (
  section text,
  user_id uuid,
  handle text,
  display_name text,
  avatar_path text,
  is_creator boolean,
  creator_note text,
  followers_count integer,
  shared_teams integer,
  shared_games integer,
  last_shared_game jsonb,
  following boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with me as (select auth.uid() as id),
  creators as (
    select cr.creator_id,
           count(*) filter (where cr.team_id in (select team_id from public.user_teams where user_id = (select id from me)))::integer as shared,
           max(cr.followers) as followers,
           max(cr.last_post_at) as last_post_at
    from public.creator_rankings cr
    where cr.creator_id <> (select id from me)
      and not public.follows_active((select id from me), cr.creator_id)
      and public.can_view_user(cr.creator_id)
    group by cr.creator_id
    order by shared desc, followers desc, last_post_at desc nulls last
    limit 10
  ),
  fans as (
    select other.user_id, count(*)::integer as shared, max(g.scheduled_start) as last_start,
           (array_agg(g.id order by g.scheduled_start desc))[1] as last_game_id
    from public.attendances mine
    join public.attendances other on other.game_id = mine.game_id and other.user_id <> mine.user_id and other.status = 'attended'
    join public.games g on g.id = mine.game_id
    join public.profiles op on op.id = other.user_id
    where mine.user_id = (select id from me) and mine.status = 'attended'
      and op.show_on_overlap
      and not (public.follows_active((select id from me), other.user_id) and public.follows_active(other.user_id, (select id from me)))
      and public.can_view_user(other.user_id)
    group by other.user_id
    order by count(*) desc, max(g.scheduled_start) desc
    limit 10
  )
  select 'creator', pr.id, pr.handle, pr.display_name, pr.avatar_path, pr.is_creator, pr.creator_note, pr.followers_count,
         c.shared, null::integer, null::jsonb, false
  from creators c join public.profiles pr on pr.id = c.creator_id
  union all
  select 'fan', pr.id, pr.handle, pr.display_name, pr.avatar_path, pr.is_creator, pr.creator_note, pr.followers_count,
         null::integer, f.shared,
         (select jsonb_build_object('id', g.id, 'scheduled_start', g.scheduled_start, 'home_name', ht.nickname, 'away_name', awt.nickname, 'venue_name', v.name)
            from public.games g join public.teams ht on ht.id = g.home_team_id join public.teams awt on awt.id = g.away_team_id
            left join public.venues v on v.id = g.venue_id where g.id = f.last_game_id),
         public.follows_active((select id from me), pr.id)
  from fans f join public.profiles pr on pr.id = f.user_id;
$$;

revoke all on function public.discover_people() from public, anon;
grant execute on function public.discover_people() to authenticated;
