-- Social v2, prompt 2, section 1: how a post comes to exist (docs/prompts/social/02).
--
-- Three ways in:
--   1. A game post. With auto-post on, the server drafts one 15 minutes after the game goes
--      final and publishes it at 30, so the fan has a 15-minute window to edit or drop it
--      (the banner in Games). With auto-post off, or for a game logged long after it ended,
--      the game waits in Games with "Post this", which publishes at once.
--   2. A reaction post, made by prompt 3 when a reaction is posted.
--   3. A system post (stamp, milestone, goal, Wrapped), made from the same `feed_events` the
--      v1 feed reads, so no rule that awards a stamp or a milestone is written twice. Each kind
--      can be muted in settings.
--
-- `feed_events` stays. It is the server's event log: builds 4 and 5 read it through `feed()`,
-- the data export carries it, and pledge and famous-game events have no post kind. The v2 app
-- reads posts only.
--
-- A draft is a post with `published_at` null. Only its author sees it.

-- ---------------------------------------------------------------------------
-- Settings: auto-post, the default audience, and which system posts to make.
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column auto_post boolean not null default true,
  add column post_visibility text not null default 'followers'
    check (post_visibility in ('followers', 'public', 'private')),
  add column muted_post_kinds text[] not null default '{}'
    check (muted_post_kinds <@ array['stamp', 'milestone', 'goal', 'wrapped']::text[]);

comment on column public.profiles.auto_post is
  'Draft a game post 15 minutes after a logged game goes final, publish it at 30 (social brief 02, section 1).';
comment on column public.profiles.muted_post_kinds is
  'System post kinds this fan does not want made for them.';

-- ---------------------------------------------------------------------------
-- Posts: drafts, and the subject of a system post.
-- ---------------------------------------------------------------------------

alter table public.posts
  add column published_at timestamptz,
  -- When an auto-post draft goes up by itself. Null for everything else.
  add column publish_at timestamptz,
  -- What a system post is about: the venue of a stamp, the count of a milestone, the goal,
  -- the Wrapped. Written by the server only.
  add column payload jsonb not null default '{}'::jsonb;

update public.posts set published_at = created_at where published_at is null;
-- Published unless a writer says otherwise: only the auto-post tick and an accepted companion
-- tag write a draft, and they set this to null on purpose.
alter table public.posts alter column published_at set default now();

create index posts_published_idx on public.posts (published_at desc, id desc)
  where deleted_at is null and published_at is not null;
create index posts_author_published_idx on public.posts (author_id, published_at desc, id desc)
  where deleted_at is null and published_at is not null;
create index posts_drafts_idx on public.posts (publish_at) where published_at is null and deleted_at is null;

-- A draft is its author's alone.
create or replace function public.can_view_post(p_post_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.posts p
    join public.profiles a on a.id = p.author_id
    where p.id = p_post_id
      and auth.uid() is not null
      and (
        p.author_id = auth.uid()
        or (
          p.deleted_at is null
          and p.published_at is not null
          and not public.is_blocked_between(auth.uid(), p.author_id)
          and (
            (p.visibility = 'public' and not a.is_private)
            or (p.visibility in ('followers', 'public') and public.follows_active(auth.uid(), p.author_id))
          )
        )
      )
  );
$$;

-- A post a client writes goes up at once; drafts are the server's. The subject, author, time,
-- counters, payload and publishing columns are the server's once written.
create or replace function public.posts_keep_server_columns()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.kudos_count := 0;
      new.comment_count := 0;
      new.auto_posted := false;
      new.created_at := now();
      new.published_at := now();
      new.publish_at := null;
      new.payload := '{}'::jsonb;
    else
      new.id := old.id;
      new.author_id := old.author_id;
      new.kind := old.kind;
      new.attendance_id := old.attendance_id;
      new.reaction_id := old.reaction_id;
      new.game_id := old.game_id;
      new.auto_posted := old.auto_posted;
      new.created_at := old.created_at;
      new.kudos_count := old.kudos_count;
      new.comment_count := old.comment_count;
      new.published_at := old.published_at;
      new.publish_at := old.publish_at;
      new.payload := old.payload;
    end if;
  end if;
  return new;
end;
$$;

-- A client writes game and reaction posts; stamps, milestones, goals and Wrapped are the
-- server's. Redefined from 20260924000500 with the kind added.
drop policy posts_insert on public.posts;
create policy posts_insert on public.posts for insert to authenticated
  with check (
    author_id = auth.uid()
    and kind in ('game', 'reaction')
    and (attendance_id is null or exists (
      select 1 from public.attendances a where a.id = attendance_id and a.user_id = auth.uid()
    ))
    and (reaction_id is null or exists (
      select 1 from public.reactions r where r.id = reaction_id and r.user_id = auth.uid()
    ))
  );

-- A game post's game is its attendance's game, whoever wrote it.
create or replace function public.posts_fill_game()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.attendance_id is not null then
    select game_id into new.game_id from public.attendances where id = new.attendance_id;
  elsif new.reaction_id is not null then
    select game_id into new.game_id from public.reactions where id = new.reaction_id;
  end if;
  return new;
end;
$$;

create trigger posts_fill_game before insert on public.posts
  for each row execute function public.posts_fill_game();

-- "Post now" from the edit banner: publish my own draft early.
create or replace function public.publish_my_draft(p_post_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.posts set published_at = now(), publish_at = null
  where id = p_post_id and author_id = auth.uid() and published_at is null and deleted_at is null;
$$;

revoke all on function public.publish_my_draft(uuid) from public, anon;
grant execute on function public.publish_my_draft(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Auto-post
-- ---------------------------------------------------------------------------

-- One row per fan and game, written the moment a draft is made, so an auto-post fires once:
-- deleting the draft, deleting the post later, or unlogging and relogging the game never
-- makes a second one.
create table public.auto_post_runs (
  user_id uuid not null references public.profiles (id) on delete cascade,
  game_id uuid not null references public.games (id) on delete cascade,
  attendance_id uuid,
  post_id uuid,
  drafted_at timestamptz not null default now(),
  -- 'drafted' until the tick publishes it or the fan turns auto-post off.
  outcome text not null default 'drafted' check (outcome in ('drafted', 'published', 'cancelled')),
  primary key (user_id, game_id)
);
alter table public.auto_post_runs enable row level security;
create policy auto_post_runs_own on public.auto_post_runs for select to authenticated using (user_id = auth.uid());

-- When a game ended, as well as anyone knows: the exact final, else the start plus the
-- recorded length, else three hours after the start.
create or replace function public.game_ended_at(p_game public.games)
returns timestamptz
language sql
immutable
as $$
  select coalesce(
    p_game.final_at,
    p_game.scheduled_start + make_interval(mins => p_game.duration_minutes),
    p_game.scheduled_start + interval '3 hours'
  );
$$;

-- The auto-post window for one attendance: drafted 15 minutes after the final (or 15 minutes
-- after a log that came later), published 15 minutes after that. A game logged more than two
-- days after it ended is history, not news, and waits for "Post this" instead: that is what
-- keeps a fan's onboarding backfill out of their followers' feeds.
create or replace view public.auto_post_candidates
with (security_invoker = true)
as
select a.id as attendance_id,
       a.user_id,
       a.game_id,
       greatest(public.game_ended_at(g) + interval '15 minutes', a.created_at) as draft_at,
       greatest(public.game_ended_at(g) + interval '30 minutes', a.created_at + interval '15 minutes') as publish_at,
       pr.post_visibility
from public.attendances a
join public.games g on g.id = a.game_id
join public.profiles pr on pr.id = a.user_id
where a.status = 'attended'
  and g.status = 'final'
  and pr.auto_post
  and a.created_at >= pr.posts_backfilled_at
  and a.created_at <= public.game_ended_at(g) + interval '2 days'
  and not exists (select 1 from public.auto_post_runs r where r.user_id = a.user_id and r.game_id = a.game_id)
  and not exists (select 1 from public.posts p where p.attendance_id = a.id and p.deleted_at is null);

revoke all on public.auto_post_candidates from public, anon, authenticated;

-- Every five minutes: draft what is due, then publish what has sat out its window.
create or replace function public.auto_post_tick(p_now timestamptz default now())
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_drafted integer := 0;
  v_published integer := 0;
  r record;
  v_post uuid;
begin
  for r in select * from public.auto_post_candidates c where c.draft_at <= p_now loop
    insert into public.auto_post_runs (user_id, game_id, attendance_id, drafted_at)
    values (r.user_id, r.game_id, r.attendance_id, p_now)
    on conflict do nothing;
    if not found then continue; end if;
    insert into public.posts (author_id, kind, attendance_id, visibility, auto_posted, created_at, publish_at, published_at)
    values (r.user_id, 'game', r.attendance_id, r.post_visibility, true, p_now, greatest(r.publish_at, p_now), null)
    returning id into v_post;
    update public.auto_post_runs set post_id = v_post where user_id = r.user_id and game_id = r.game_id;
    v_drafted := v_drafted + 1;
  end loop;

  with due as (
    update public.posts p set published_at = p_now, publish_at = null
    where p.published_at is null and p.deleted_at is null and p.auto_posted and p.publish_at <= p_now
    returning p.id
  )
  update public.auto_post_runs run set outcome = 'published'
  from due where run.post_id = due.id;
  get diagnostics v_published = row_count;

  return jsonb_build_object('drafted', v_drafted, 'published', v_published);
end;
$$;

revoke all on function public.auto_post_tick(timestamptz) from public, anon, authenticated;

select cron.schedule('auto-post', '*/5 * * * *', $$select public.auto_post_tick()$$);

-- Turning auto-post off inside the window cancels the draft. The game then waits in Games with
-- "Post this", and the run row keeps it from ever auto-posting again.
create or replace function public.profiles_auto_post_off()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.auto_post and not new.auto_post then
    update public.auto_post_runs r set outcome = 'cancelled'
    where r.user_id = new.id and r.outcome = 'drafted';
    delete from public.posts p
    where p.author_id = new.id and p.auto_posted and p.published_at is null;
  end if;
  return null;
end;
$$;

create trigger profiles_auto_post_off after update of auto_post on public.profiles
  for each row execute function public.profiles_auto_post_off();

-- What the Games tab needs about my own posts: drafts in their window, and games waiting for
-- "Post this".
create or replace function public.my_post_states()
returns table (
  attendance_id uuid,
  game_id uuid,
  post_id uuid,
  state text,          -- 'draft', 'posted' or 'unposted'
  publish_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select a.id, a.game_id, p.id,
         case when p.id is null then 'unposted' when p.published_at is null then 'draft' else 'posted' end,
         p.publish_at
  from public.attendances a
  join public.games g on g.id = a.game_id
  left join public.posts p on p.attendance_id = a.id and p.deleted_at is null
  where a.user_id = auth.uid() and a.status = 'attended' and g.status = 'final';
$$;

revoke all on function public.my_post_states() from public, anon;
grant execute on function public.my_post_states() to authenticated;

-- ---------------------------------------------------------------------------
-- System posts, made from the feed events that already mark these moments.
-- ---------------------------------------------------------------------------

-- A stamp or a milestone from a game more than a week old is backfill (onboarding's past
-- games, an import), not news, and makes no post. Goals and Wrapped are always now.
create or replace function public.feed_events_to_posts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kind text := case new.type
    when 'new_stamp' then 'stamp'
    when 'milestone' then 'milestone'
    when 'goal_completed' then 'goal'
    when 'wrapped_published' then 'wrapped'
  end;
  v_profile public.profiles;
  v_start timestamptz;
begin
  if v_kind is null then return null; end if;
  select * into v_profile from public.profiles where id = new.actor_user_id;
  if v_profile.id is null or v_kind = any (v_profile.muted_post_kinds) then return null; end if;
  if v_kind in ('stamp', 'milestone') then
    select scheduled_start into v_start from public.games where id = new.game_id;
    if v_start is null or v_start < now() - interval '7 days' then return null; end if;
  end if;
  insert into public.posts (author_id, kind, game_id, visibility, created_at, published_at, payload)
  values (
    new.actor_user_id, v_kind, new.game_id,
    case when new.visibility = 'private' then 'private' else v_profile.post_visibility end,
    new.created_at, new.created_at, new.payload
  );
  return null;
end;
$$;

create trigger feed_events_to_posts after insert on public.feed_events
  for each row execute function public.feed_events_to_posts();

-- ---------------------------------------------------------------------------
-- Post photos: a private bucket, read through signed URLs by whoever can see the post.
-- Paths are {author id}/{post id}/{ordinal}.jpg.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('post-photos', 'post-photos', false, 15728640, array['image/jpeg', 'image/png', 'image/heic', 'image/webp'])
on conflict (id) do nothing;

create policy post_photos_owner_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'post-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy post_photos_owner_delete on storage.objects for delete to authenticated
  using (bucket_id = 'post-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy post_photos_object_select on storage.objects for select to authenticated
  using (
    bucket_id = 'post-photos'
    and exists (
      select 1 from public.post_photos ph
      where ph.storage_path = storage.objects.name and public.can_view_post(ph.post_id)
    )
  );

