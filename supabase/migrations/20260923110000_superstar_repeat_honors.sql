-- A single All-Star selection does not make a superstar (Dean, 2026-09-23).
--
-- Dean's bar was "top X in MVP voting or top Y in Cy Young or some threshold of elite in the
-- past Z years", and "top 10 in sacks could be a fluke season by some random defensive end".
-- The MLB Stats API publishes no voting placements (docs/verification.md), so the MLB bar was
-- winners plus All-Stars, and an All-Star selection alone was enough. MLB names an All-Star
-- from every club, so a weak team's best player is one; the honor does not carry the meaning
-- the bar needs. On 2026-09-22 that made Alec Bohm a superstar off one 2024 selection.
--
-- Rather than drop the honor, which would leave Dean's own Players seen with two names,
-- `honor_kinds.min_count` says how many times an honor must land inside its window to qualify.
-- All-Star is set to 2 for both sports that award it: one nod is a good season, two inside
-- three is a player a fan would call a star. Every other honor keeps 1, so an MVP, a Cy Young,
-- an All-NBA team or a Golden Boot still qualifies the first time.
--
-- The honor still shows as a caption when the player qualifies some other way; this only
-- decides who counts as a superstar. Nothing is re-ingested: `players_seen` and the famous-game
-- screens call `is_superstar` at query time.
alter table public.honor_kinds
  add column if not exists min_count integer not null default 1;
alter table public.honor_kinds drop constraint if exists honor_kinds_min_count_check;
alter table public.honor_kinds add constraint honor_kinds_min_count_check check (min_count >= 1);

comment on column public.honor_kinds.min_count is
  'How many times this honor must land inside window_seasons before it makes a superstar. 1 for a win, 2 for a selection anyone can get in a good year.';

update public.honor_kinds set min_count = 2 where honor = 'all_star';

-- The best honor a player holds for a season, or their franchise-player row when they hold
-- none. An honor whose kind needs more than one selection only counts once the player has them.
create or replace function public.superstar_honor(p_player uuid, p_season integer)
returns table (honor text, label text, season integer, season_first boolean)
language sql
stable
security definer
set search_path = public
as $$
  with qualifying as (
    select h.honor, h.season, k.label, k.rank, k.season_first
    from public.player_honors h
    join public.players p on p.id = h.player_id
    join public.honor_kinds k on k.sport_id = p.sport_id and k.honor = h.honor
    where h.player_id = p_player
      and h.season <= p_season
      and h.season >= p_season - k.window_seasons
      and (
        k.min_count <= 1
        or (
          select count(*)
          from public.player_honors h2
          join public.honor_kinds k2 on k2.sport_id = p.sport_id and k2.honor = h2.honor
          where h2.player_id = p_player
            and h2.honor = h.honor
            and h2.season <= p_season
            and h2.season >= p_season - k2.window_seasons
        ) >= k.min_count
      )
  )
  select x.honor, x.label, x.season, x.season_first
  from (
    (select q.honor, q.label, q.season, q.season_first, q.rank
     from qualifying q
     order by q.rank, q.season desc
     limit 1)
    union all
    -- A franchise player is a superstar at their club even with no honor in the window.
    (select 'franchise', 'Franchise player', p_season, false, 2147483647
     from public.franchise_players f
     where f.player_id = p_player
       and f.from_season <= p_season
       and (f.to_season is null or f.to_season >= p_season)
       and not exists (select 1 from qualifying)
     limit 1)
  ) x (honor, label, season, season_first, rank)
  order by x.rank
  limit 1
$$;
