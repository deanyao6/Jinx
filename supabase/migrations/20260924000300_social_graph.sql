-- Social v2, prompt 1: the social graph (docs/prompts/social/01, section 3).
--
-- follows and blocks already exist and are kept as they are. This adds follower counts and
-- creator fields to profiles, the one genuinely new moderation table (mutes), and widens
-- reports to the new kinds of content and an action taken (00_repo_reality.md, R6).

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column is_creator boolean not null default false,
  add column creator_note text check (creator_note is null or char_length(creator_note) <= 280),
  add column followers_count integer not null default 0 check (followers_count >= 0),
  add column following_count integer not null default 0 check (following_count >= 0),
  -- Section 5 of the brief: existing attendances never become posts, because backfilling
  -- months of logs into followers' feeds would be spam. This is the line: attendances created
  -- or confirmed before it made no post. Every profile that existed at this migration gets the
  -- migration's time; a new one gets its own creation time.
  add column posts_backfilled_at timestamptz not null default now();

comment on column public.profiles.posts_backfilled_at is
  'Attendances created or confirmed before this moment never generate posts (social brief 01, section 5).';
comment on column public.profiles.is_creator is 'Superfan account shown in Discover. Set by the service role only.';

-- Counts, creator status and the backfill line are the server's. A signed-in user updating their
-- own profile row (which RLS allows) cannot change them: the old values are put back. Trigger
-- functions that maintain them run as the table owner, so they pass.
create or replace function public.profiles_keep_server_columns()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.is_creator := old.is_creator;
    new.creator_note := old.creator_note;
    new.followers_count := old.followers_count;
    new.following_count := old.following_count;
    new.posts_backfilled_at := old.posts_backfilled_at;
  end if;
  return new;
end;
$$;

create trigger profiles_keep_server_columns before update on public.profiles
  for each row execute function public.profiles_keep_server_columns();

-- ---------------------------------------------------------------------------
-- Follow counters: an active follow counts, a request does not.
-- ---------------------------------------------------------------------------

create or replace function public.follows_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_was boolean := tg_op in ('UPDATE', 'DELETE') and old.status = 'active';
  v_is boolean := tg_op in ('INSERT', 'UPDATE') and new.status = 'active';
begin
  if v_was and not v_is then
    update public.profiles set following_count = greatest(following_count - 1, 0) where id = old.follower_id;
    update public.profiles set followers_count = greatest(followers_count - 1, 0) where id = old.followee_id;
  elsif v_is and not v_was then
    update public.profiles set following_count = following_count + 1 where id = new.follower_id;
    update public.profiles set followers_count = followers_count + 1 where id = new.followee_id;
  end if;
  return null;
end;
$$;

create trigger follows_count after insert or update of status or delete on public.follows
  for each row execute function public.follows_count();

update public.profiles p
set followers_count = coalesce((select count(*) from public.follows f where f.followee_id = p.id and f.status = 'active'), 0),
    following_count = coalesce((select count(*) from public.follows f where f.follower_id = p.id and f.status = 'active'), 0);

-- ---------------------------------------------------------------------------
-- mutes: hide someone's posts and comments from yourself without telling them or unfollowing.
-- ---------------------------------------------------------------------------

create table public.mutes (
  user_id uuid not null references public.profiles (id) on delete cascade,
  muted_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, muted_id),
  check (user_id <> muted_id)
);
create index mutes_muted_idx on public.mutes (muted_id);
alter table public.mutes enable row level security;

-- Only the person muting knows: the muted person cannot see the row.
create policy mutes_own on public.mutes for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.is_muted(p_muted uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.mutes where user_id = auth.uid() and muted_id = p_muted);
$$;

-- ---------------------------------------------------------------------------
-- reports: the new kinds of content, and what was done about a report.
-- ---------------------------------------------------------------------------

alter table public.reports drop constraint reports_target_type_check;
alter table public.reports add constraint reports_target_type_check check (target_type in (
  'user', 'attendance', 'feed_event', 'person', 'attendance_photo',
  'post', 'comment', 'reaction', 'community'
));
alter table public.reports
  add column action text check (action in ('none', 'removed', 'warned', 'suspended', 'banned'));
comment on column public.reports.action is 'What moderation did, set with resolved_at (docs/moderation.md).';
