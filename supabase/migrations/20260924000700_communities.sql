-- Social v2, prompt 1: communities and their leaderboards (docs/prompts/social/01, sections 3
-- and 4). Prompt 4 seeds one official community per team in all four sports (00, R3) and
-- builds the screens and the leaderboard job; this is the shape and the rules.
--
-- Visibility, in words (section 4):
--   Membership is public. A community post is a post, so it is seen by whoever can see the post,
--   and a private community (none at launch) also requires membership. Leaderboards are read by
--   members only. Nobody writes a leaderboard row but the server.

create table public.communities (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 60),
  name text not null check (char_length(name) between 1 and 80),
  kind text not null check (kind in ('team', 'venue', 'school', 'custom')),
  team_id uuid references public.teams (id) on delete cascade,
  venue_id uuid references public.venues (id) on delete cascade,
  description text check (description is null or char_length(description) <= 500),
  is_official boolean not null default true,
  -- None at launch. A private community shows its posts to members only.
  is_private boolean not null default false,
  owner_id uuid references public.profiles (id) on delete set null,
  member_count integer not null default 0 check (member_count >= 0),
  created_at timestamptz not null default now(),
  check (kind <> 'team' or team_id is not null),
  check (kind <> 'venue' or venue_id is not null)
);
create unique index communities_one_per_team on public.communities (team_id) where kind = 'team' and is_official;
create unique index communities_one_per_venue on public.communities (venue_id) where kind = 'venue' and is_official;
alter table public.communities enable row level security;

create table public.community_members (
  community_id uuid not null references public.communities (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('member', 'moderator', 'owner')),
  joined_at timestamptz not null default now(),
  primary key (community_id, user_id)
);
create index community_members_user_idx on public.community_members (user_id);
alter table public.community_members enable row level security;

create table public.community_posts (
  community_id uuid not null references public.communities (id) on delete cascade,
  post_id uuid not null references public.posts (id) on delete cascade,
  primary key (community_id, post_id)
);
create index community_posts_post_idx on public.community_posts (post_id);
alter table public.community_posts enable row level security;

-- Materialized, recomputed on game finals by prompt 4's job. `season` is part of the key, so it
-- cannot be null: for period 'season' it is the season, for 'month' it is yyyymm (202609), for
-- 'all' it is 0.
create table public.leaderboard_stats (
  user_id uuid not null references public.profiles (id) on delete cascade,
  community_id uuid not null references public.communities (id) on delete cascade,
  period text not null check (period in ('season', 'month', 'all')),
  season integer not null default 0,
  stat_key text not null check (char_length(stat_key) between 1 and 60),
  value numeric not null,
  verified_only boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (user_id, community_id, period, season, stat_key),
  check ((period = 'all') = (season = 0))
);
create index leaderboard_stats_board_idx on public.leaderboard_stats (community_id, period, season, stat_key, value desc);
alter table public.leaderboard_stats enable row level security;

create or replace function public.is_community_member(p_community_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.community_members where community_id = p_community_id and user_id = auth.uid()
  );
$$;

-- communities: everyone signed in reads them; the server makes the official ones.
create policy communities_select on public.communities for select to authenticated using (true);

-- members: public, minus anyone blocked either way. You join and leave yourself, as a member;
-- roles above member are the server's to give.
create policy community_members_select on public.community_members for select to authenticated
  using (user_id = auth.uid() or not public.is_blocked_between(auth.uid(), user_id));
create policy community_members_insert on public.community_members for insert to authenticated
  with check (
    user_id = auth.uid()
    and role = 'member'
    and exists (select 1 from public.communities c where c.id = community_id and not c.is_private)
  );
create policy community_members_delete on public.community_members for delete to authenticated
  using (user_id = auth.uid());

create or replace function public.community_members_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.communities set member_count = member_count + 1 where id = new.community_id;
  else
    update public.communities set member_count = greatest(member_count - 1, 0) where id = old.community_id;
  end if;
  return null;
end;
$$;

create trigger community_members_count after insert or delete on public.community_members
  for each row execute function public.community_members_count();

-- community posts: seen with the post; a private community also needs membership. A member
-- files their own post into a community, and takes it out again.
create policy community_posts_select on public.community_posts for select to authenticated
  using (
    public.can_view_post(post_id)
    and (
      public.is_community_member(community_id)
      or not exists (select 1 from public.communities c where c.id = community_id and c.is_private)
    )
  );
create policy community_posts_insert on public.community_posts for insert to authenticated
  with check (public.post_author(post_id) = auth.uid() and public.is_community_member(community_id));
create policy community_posts_delete on public.community_posts for delete to authenticated
  using (public.post_author(post_id) = auth.uid());

-- leaderboards: members read them; there is no write policy, so only the service role writes.
create policy leaderboard_stats_select on public.leaderboard_stats for select to authenticated
  using (public.is_community_member(community_id));
