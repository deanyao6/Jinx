-- Favourite players, and the roster query the picker needs (SPEC.md 5.1, 6.9).
--
-- Teams have been favouritable since M1 via `user_teams`. Players had no equivalent, so a fan
-- could say "I follow the Phillies" but not "I follow Bryce Harper", and nothing in the app could
-- tell them they had seen him nine times.
--
-- `user_players` deliberately mirrors `user_teams` exactly, down to the policy names and the
-- visibility rule: a favourite player is as public as a favourite team, which is to say it follows
-- `can_view_user` and a private account keeps it to themselves.

create table public.user_players (
  user_id uuid not null references public.profiles (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, player_id)
);

-- "Who else follows this player", and the profile's own list.
create index user_players_player_idx on public.user_players (player_id);

alter table public.user_players enable row level security;

create policy user_players_select on public.user_players
  for select to authenticated using (public.can_view_user(user_id));

create policy user_players_write on public.user_players
  to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Team rosters.
--
-- `players` carries no team: a player moves, and the truth is per game, which is what
-- `game_appearances` records. A team's roster is therefore derived, and "derived" here means
-- "everyone who has ever appeared for them", which is the right set for this app — the picker
-- exists so a fan can follow someone they might have SEEN, including a player who has since left.
--
-- Ordered by appearances descending so the regulars come first and a one-game call-up comes last.
-- That is the closest thing to "star player" this database can honestly produce; see the note in
-- apps/mobile/src/features/games/notable.ts.
-- ---------------------------------------------------------------------------

-- game_appearances is keyed (game_id, player_id) with a separate player index, so a query by team
-- had no index at all and scanned all 552k rows.
create index game_appearances_team_player_idx on public.game_appearances (team_id, player_id);

-- `seen_by_you` is the point of the whole picker: how many games YOU were at that this player
-- appeared in. It is what makes "follow Bryce Harper" mean something rather than being a bookmark.
-- Counted from the caller's own attendances, so it is zero for everyone else's.
create or replace function public.team_roster(
  p_team_id uuid,
  p_query text default null,
  p_limit int default 200
)
returns table (id uuid, full_name text, appearances bigint, seen_by_you bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select
    p.id,
    p.full_name,
    count(*) as appearances,
    count(*) filter (where a.user_id is not null) as seen_by_you
  from public.game_appearances ga
  join public.players p on p.id = ga.player_id
  left join public.attendances a
    on a.game_id = ga.game_id
   and a.user_id = auth.uid()
   and a.status = 'attended'
  where ga.team_id = p_team_id
    and (p_query is null or p_query = '' or p.full_name ilike '%' || p_query || '%')
  group by p.id, p.full_name
  -- Players you have actually seen first, then the regulars. A fan opening their own team's
  -- roster should find the people they were in the building for at the top.
  order by count(*) filter (where a.user_id is not null) desc, count(*) desc, p.full_name
  limit least(greatest(coalesce(p_limit, 200), 1), 500);
$$;

comment on function public.team_roster is
  'Everyone who has ever appeared for a team, with how often the caller saw them. Ordered by seen-by-you then appearances. Feeds the favourite-player picker (league then team then player).';

grant execute on function public.team_roster(uuid, text, int) to authenticated;
