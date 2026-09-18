-- Real current rosters for the favourite-player picker (SPEC.md 5.1, 6.9).
--
-- Until now `team_roster` derived a "roster" from game_appearances: everyone who had ever
-- appeared for the team. That was honest when detail was fetched for every final, and it is thin
-- now that MLB detail is fetched only for logged games (2026-09-17): a team nobody has logged has
-- no roster at all, and the rest shrink to whoever played the handful of games somebody attended.
--
-- `team_rosters` is the real thing, refreshed daily by the ingest scripts:
--   MLB: the Stats API 40-man roster, kept to active players and the injured lists
--        (ingest/src/mlb/rosters.ts)
--   NFL: the latest week of the nflverse weekly roster release, kept to players under contract
--        (ingest/src/nfl/rosters.ts)
-- One row per (team, player, season); the picker reads the latest season present for the team.
-- `status` is the provider's code verbatim (MLB `A`, `D15`, `D60`; nflverse `ACT`, `RES`, `DEV`)
-- so a screen can say "injured" or "practice squad" later without another migration.

create table public.team_rosters (
  team_id uuid not null references public.teams (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  season integer not null,
  position text,
  jersey text,
  status text,
  updated_at timestamptz not null default now(),
  primary key (team_id, player_id, season)
);

-- The picker asks "latest season for this team, then every row in it".
create index team_rosters_team_season_idx on public.team_rosters (team_id, season);
-- Cascade deletes and "which teams is this player on" both walk from the player.
create index team_rosters_player_idx on public.team_rosters (player_id);

-- Reference data: readable by any authenticated user, written by the service role only, the
-- same rule as every table in 20260915000100_reference_data.sql.
alter table public.team_rosters enable row level security;
create policy team_rosters_read_authenticated on public.team_rosters
  for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- team_roster: the current roster plus everyone the caller has seen.
--
-- Same name and parameters as before, same four columns, plus `on_roster` and `position`.
-- A row is included when the player is on the team's latest roster, or when the caller has
-- attended a game the player appeared in for this team (a traded favourite stays followable).
-- A team with no roster rows at all (a relocated or defunct franchise, or a sport whose roster
-- job has not run yet) falls back to the appearance-derived list, so the picker never goes empty.
-- ---------------------------------------------------------------------------

-- The return type changes, so `create or replace` is not allowed.
drop function if exists public.team_roster(uuid, text, int);

create function public.team_roster(
  p_team_id uuid,
  p_query text default null,
  p_limit int default 200
)
returns table (
  id uuid,
  full_name text,
  appearances bigint,
  seen_by_you bigint,
  on_roster boolean,
  -- Quoted only because the parser trips on the bare keyword inside a RETURNS TABLE list; the
  -- column is the plain lower-case `position`.
  "position" text
)
language sql
stable
security invoker
set search_path = public
as $$
  with latest as (
    select max(tr.season) as season
    from public.team_rosters tr
    where tr.team_id = p_team_id
  ),
  roster as (
    select tr.player_id, tr.position
    from public.team_rosters tr, latest
    where tr.team_id = p_team_id and tr.season = latest.season
  ),
  appeared as (
    select
      ga.player_id,
      count(*) as appearances,
      count(*) filter (where a.user_id is not null) as seen_by_you
    from public.game_appearances ga
    left join public.attendances a
      on a.game_id = ga.game_id
     and a.user_id = auth.uid()
     and a.status = 'attended'
    where ga.team_id = p_team_id
    group by ga.player_id
  ),
  candidates as (
    select
      coalesce(r.player_id, ap.player_id) as player_id,
      coalesce(ap.appearances, 0) as appearances,
      coalesce(ap.seen_by_you, 0) as seen_by_you,
      (r.player_id is not null) as on_roster,
      r.position
    from roster r
    full join appeared ap on ap.player_id = r.player_id
  )
  select
    p.id,
    p.full_name,
    c.appearances,
    c.seen_by_you,
    c.on_roster,
    c.position
  from candidates c
  join public.players p on p.id = c.player_id
  where (
      c.on_roster
      or c.seen_by_you > 0
      -- No roster for this team: show everyone who ever appeared, as before.
      or not exists (select 1 from roster)
    )
    and (p_query is null or p_query = '' or p.full_name ilike '%' || p_query || '%')
  -- Players you have actually seen first, then the current roster, then the regulars.
  order by c.seen_by_you desc, c.on_roster desc, c.appearances desc, p.full_name
  limit least(greatest(coalesce(p_limit, 200), 1), 500);
$$;

comment on function public.team_roster is
  'A team''s current roster (latest season in team_rosters) plus anyone the caller has seen appear for the team, with how often the caller saw each. Falls back to everyone who ever appeared when the team has no roster rows. Ordered by seen-by-you, on-roster, appearances, name. Feeds the favourite-player picker.';

revoke all on function public.team_roster(uuid, text, int) from public, anon;
grant execute on function public.team_roster(uuid, text, int) to authenticated;
