-- Social v2, prompt 1: posts, the feed's unit, with kudos and comments (docs/prompts/social/01,
-- sections 3 and 4). Prompt 2 builds the feed on these; nothing creates a post yet.
--
-- Visibility, in words (section 4):
--   A post is visible to its author; to anyone when it is public and the author's profile is
--   public; to the author's followers when it is for followers (or public). Never to someone
--   blocked in either direction. A deleted post is the author's alone.
--   Kudos and comments inherit the post's visibility. A comment's author can delete it, and so
--   can the post's author. Counters are kept by triggers; no client writes them.
--
-- `feed_events` stays: it is the v1 feed and the app still reads it. Prompt 2 decides how the
-- two meet.

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('game', 'reaction', 'stamp', 'milestone', 'goal', 'wrapped')),
  attendance_id uuid references public.attendances (id) on delete cascade,
  reaction_id uuid,  -- references public.reactions, added with that table (20260924000500)
  game_id uuid references public.games (id) on delete cascade,
  caption text check (caption is null or char_length(caption) between 1 and 2000),
  visibility text not null default 'followers' check (visibility in ('followers', 'public', 'private')),
  auto_posted boolean not null default false,
  created_at timestamptz not null default now(),
  kudos_count integer not null default 0 check (kudos_count >= 0),
  comment_count integer not null default 0 check (comment_count >= 0),
  deleted_at timestamptz,
  -- A post points at exactly one subject: a game post at an attendance, a reaction post at a
  -- reaction, and the rest at neither (their subject is in the kind and the game).
  constraint posts_one_subject check (
    case kind
      when 'game' then attendance_id is not null and reaction_id is null
      when 'reaction' then reaction_id is not null and attendance_id is null
      else attendance_id is null and reaction_id is null
    end
  )
);
create index posts_author_idx on public.posts (author_id, created_at desc);
create index posts_created_idx on public.posts (created_at desc) where deleted_at is null;
create index posts_game_idx on public.posts (game_id) where game_id is not null;
create unique index posts_one_per_attendance on public.posts (attendance_id) where attendance_id is not null and deleted_at is null;
alter table public.posts enable row level security;

create table public.post_photos (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  storage_path text not null,
  ordinal integer not null check (ordinal between 0 and 9),
  unique (post_id, ordinal)
);
alter table public.post_photos enable row level security;

create table public.kudos (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index kudos_user_idx on public.kudos (user_id);
alter table public.kudos enable row level security;

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index comments_post_idx on public.comments (post_id, created_at);
create index comments_author_idx on public.comments (author_id);
alter table public.comments enable row level security;

-- ---------------------------------------------------------------------------
-- Who can see a post
-- ---------------------------------------------------------------------------

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
          and not public.is_blocked_between(auth.uid(), p.author_id)
          and (
            (p.visibility = 'public' and not a.is_private)
            or (p.visibility in ('followers', 'public') and public.follows_active(auth.uid(), p.author_id))
          )
        )
      )
  );
$$;

create or replace function public.post_author(p_post_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select author_id from public.posts where id = p_post_id;
$$;

-- ---------------------------------------------------------------------------
-- posts
-- ---------------------------------------------------------------------------

create policy posts_select on public.posts for select to authenticated
  using (public.can_view_post(id));

-- A post is about the author's own attendance (the reaction check is added with reactions).
create policy posts_insert on public.posts for insert to authenticated
  with check (
    author_id = auth.uid()
    and (attendance_id is null or exists (
      select 1 from public.attendances a where a.id = attendance_id and a.user_id = auth.uid()
    ))
  );

create policy posts_update on public.posts for update to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid());

create policy posts_delete on public.posts for delete to authenticated
  using (author_id = auth.uid());

-- Counters start at zero and only the triggers move them; the subject, author and time are
-- fixed once written. `auto_posted` is the server's word, never a client's.
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
    end if;
  end if;
  return new;
end;
$$;

create trigger posts_keep_server_columns before insert or update on public.posts
  for each row execute function public.posts_keep_server_columns();

-- ---------------------------------------------------------------------------
-- post_photos
-- ---------------------------------------------------------------------------

create policy post_photos_select on public.post_photos for select to authenticated
  using (public.can_view_post(post_id));
create policy post_photos_write on public.post_photos for all to authenticated
  using (public.post_author(post_id) = auth.uid())
  with check (public.post_author(post_id) = auth.uid());

-- ---------------------------------------------------------------------------
-- kudos
-- ---------------------------------------------------------------------------

create policy kudos_select on public.kudos for select to authenticated
  using (public.can_view_post(post_id) and not public.is_blocked_between(auth.uid(), user_id));
create policy kudos_insert on public.kudos for insert to authenticated
  with check (user_id = auth.uid() and public.can_view_post(post_id));
create policy kudos_delete on public.kudos for delete to authenticated
  using (user_id = auth.uid());

create or replace function public.kudos_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.posts set kudos_count = kudos_count + 1 where id = new.post_id;
  else
    update public.posts set kudos_count = greatest(kudos_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end;
$$;

create trigger kudos_count after insert or delete on public.kudos
  for each row execute function public.kudos_count();

-- ---------------------------------------------------------------------------
-- comments
-- ---------------------------------------------------------------------------

create policy comments_select on public.comments for select to authenticated
  using (
    public.can_view_post(post_id)
    and (author_id = auth.uid() or (deleted_at is null and not public.is_blocked_between(auth.uid(), author_id)))
  );
create policy comments_insert on public.comments for insert to authenticated
  with check (author_id = auth.uid() and public.can_view_post(post_id));
-- Editing and soft-deleting your own comment.
create policy comments_update on public.comments for update to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid());
-- Removing a comment: its author, or the author of the post it is on.
create policy comments_delete on public.comments for delete to authenticated
  using (author_id = auth.uid() or public.post_author(post_id) = auth.uid());

create or replace function public.comments_keep_server_columns()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.created_at := now();
      new.deleted_at := null;
    else
      new.id := old.id;
      new.post_id := old.post_id;
      new.author_id := old.author_id;
      new.created_at := old.created_at;
    end if;
  end if;
  return new;
end;
$$;

create trigger comments_keep_server_columns before insert or update on public.comments
  for each row execute function public.comments_keep_server_columns();

-- comment_count counts comments that are not deleted.
create or replace function public.comments_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before integer := case when tg_op in ('UPDATE', 'DELETE') and old.deleted_at is null then 1 else 0 end;
  v_after integer := case when tg_op in ('INSERT', 'UPDATE') and new.deleted_at is null then 1 else 0 end;
  v_post uuid := case when tg_op = 'DELETE' then old.post_id else new.post_id end;
begin
  if v_after <> v_before then
    update public.posts set comment_count = greatest(comment_count + v_after - v_before, 0) where id = v_post;
  end if;
  return null;
end;
$$;

create trigger comments_count after insert or update of deleted_at or delete on public.comments
  for each row execute function public.comments_count();
