-- Social v2, prompt 1: reactions, the front-and-back photo taken at a moment in a game
-- (docs/prompts/social/01, section 3). Prompt 3 builds the capture and the prompts; this is
-- the shape. The emoji table that had this name is `feed_reactions` since 20260924000100.
--
-- Visibility, in words (section 4): a reaction follows its post. A reaction with no post is
-- private to its author, who still sees it pinned to the moment in Relive.

create table public.reaction_prompts (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  -- 'checkin': the scheduled late-game prompt to everyone checked in. 'event': a big play.
  kind text not null check (kind in ('checkin', 'event')),
  event_id uuid references public.game_events (id) on delete set null,
  fired_at timestamptz not null default now(),
  window_seconds integer not null check (window_seconds between 30 and 3600),
  audience text not null default 'all' check (audience in ('home', 'away', 'all')),
  significance numeric check (significance is null or significance >= 0),
  label text not null check (char_length(label) between 1 and 120),
  check (kind = 'event' or event_id is null)
);
create index reaction_prompts_game_idx on public.reaction_prompts (game_id, fired_at);
alter table public.reaction_prompts enable row level security;

-- Prompts are about a game, not a person: any signed-in fan may read them; only the server
-- fires one.
create policy reaction_prompts_select on public.reaction_prompts for select to authenticated using (true);

create table public.reactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  game_id uuid not null references public.games (id) on delete cascade,
  prompt_id uuid references public.reaction_prompts (id) on delete set null,
  attendance_id uuid not null references public.attendances (id) on delete cascade,
  back_path text not null,
  front_path text not null,
  captured_at timestamptz not null default now(),
  -- Seconds after the prompt fired; how late the capture was. Null without a prompt.
  late_seconds integer check (late_seconds is null or late_seconds >= 0),
  -- The point on the win probability line it belongs to (game_wp_timeline.seq), for Relive.
  wp_seq integer,
  period_label text,
  visibility text not null default 'followers' check (visibility in ('followers', 'public', 'private')),
  post_id uuid references public.posts (id) on delete set null
);
create index reactions_game_idx on public.reactions (game_id, captured_at);
create index reactions_user_idx on public.reactions (user_id, captured_at desc);
alter table public.reactions enable row level security;

alter table public.posts
  add constraint posts_reaction_id_fkey foreign key (reaction_id) references public.reactions (id) on delete cascade;
create unique index posts_one_per_reaction on public.posts (reaction_id) where reaction_id is not null and deleted_at is null;

create policy reactions_select on public.reactions for select to authenticated
  using (user_id = auth.uid() or (post_id is not null and public.can_view_post(post_id)));

-- Your own reaction, at a game you are logged at.
create policy reactions_insert on public.reactions for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.attendances a
      where a.id = attendance_id and a.user_id = auth.uid() and a.game_id = reactions.game_id
    )
  );

create policy reactions_update on public.reactions for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy reactions_delete on public.reactions for delete to authenticated
  using (user_id = auth.uid());

-- The capture itself is fixed once taken; the owner may change who sees it and attach it to a
-- post of their own.
create or replace function public.reactions_keep_capture()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.captured_at := now();
    else
      new.id := old.id;
      new.user_id := old.user_id;
      new.game_id := old.game_id;
      new.prompt_id := old.prompt_id;
      new.attendance_id := old.attendance_id;
      new.back_path := old.back_path;
      new.front_path := old.front_path;
      new.captured_at := old.captured_at;
      new.late_seconds := old.late_seconds;
    end if;
    if new.post_id is not null and public.post_author(new.post_id) is distinct from new.user_id then
      raise exception 'a reaction can only be attached to its author''s post' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

create trigger reactions_keep_capture before insert or update on public.reactions
  for each row execute function public.reactions_keep_capture();

-- A reaction post has to be about the author's own reaction.
drop policy posts_insert on public.posts;
create policy posts_insert on public.posts for insert to authenticated
  with check (
    author_id = auth.uid()
    and (attendance_id is null or exists (
      select 1 from public.attendances a where a.id = attendance_id and a.user_id = auth.uid()
    ))
    and (reaction_id is null or exists (
      select 1 from public.reactions r where r.id = reaction_id and r.user_id = auth.uid()
    ))
  );

-- The data export carries a fan's reactions under the key the emoji used to have.
do $$
declare
  v_def text;
  v_anchor text := $f$'feed_reactions', (select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) from public.feed_reactions r where r.user_id = auth.uid())$f$;
begin
  select pg_get_functiondef('public.export_my_data'::regproc) into v_def;
  if position(v_anchor in v_def) = 0 then
    raise exception 'export_my_data(): the feed_reactions entry from 20260924000100 is missing';
  end if;
  execute replace(v_def, v_anchor, v_anchor || $f$,
    'reactions', (select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) from public.reactions r where r.user_id = auth.uid())$f$);
end;
$$;
