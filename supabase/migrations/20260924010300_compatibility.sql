-- Social v2, prompt 2, section 6: compatibility between two mutual follows
-- (docs/prompts/social/02).
--
-- One number from 0 to 100 and what drives it, computed here, cached for a day, and shown
-- only between mutuals. The formula is packages/core/src/compatibility.ts; `compatibility_score`
-- is its twin, checked on the same examples by pgTAP 074 and compatibility.test.ts.

create or replace function public.compatibility_score(
  p_teams_a integer, p_teams_b integer, p_shared_teams integer,
  p_venues_a integer, p_venues_b integer, p_shared_venues integer,
  p_shared_games integer,
  p_underdog_a numeric, p_underdog_b numeric,
  out score integer, out driver text, out driver_count integer
)
language plpgsql
immutable
as $$
declare
  v_union integer := p_teams_a + p_teams_b - p_shared_teams;
  v_teams numeric := case when v_union > 0 then p_shared_teams::numeric / v_union else 0 end;
  v_venues numeric := case when least(p_venues_a, p_venues_b) > 0
                           then p_shared_venues::numeric / (least(p_venues_a, p_venues_b) + 2) else 0 end;
  v_games numeric := 1 - exp(-p_shared_games::numeric / 3);
  v_picks numeric := case when p_underdog_a is null or p_underdog_b is null then null
                          else 1 - abs(p_underdog_a - p_underdog_b) end;
  v_total numeric := 30 * v_teams + 30 * v_venues + 25 * v_games + 15 * coalesce(v_picks, 0);
  v_weights numeric := 85 + case when v_picks is null then 0 else 15 end;
  v_best numeric := 0;
begin
  score := round(100 * v_total / v_weights);
  driver := 'none';
  -- Ties go to the earlier part, as in the TypeScript.
  if 30 * v_teams > v_best + 1e-9 then v_best := 30 * v_teams; driver := 'teams'; end if;
  if 30 * v_venues > v_best + 1e-9 then v_best := 30 * v_venues; driver := 'venues'; end if;
  if 25 * v_games > v_best + 1e-9 then v_best := 25 * v_games; driver := 'games'; end if;
  if v_picks is not null and 15 * v_picks > v_best + 1e-9 then v_best := 15 * v_picks; driver := 'picks'; end if;
  driver_count := case driver when 'teams' then p_shared_teams when 'venues' then p_shared_venues
                              when 'games' then p_shared_games else 0 end;
end;
$$;

create table public.compatibility_cache (
  user_lo uuid not null references public.profiles (id) on delete cascade,
  user_hi uuid not null references public.profiles (id) on delete cascade,
  score integer not null check (score between 0 and 100),
  driver text not null check (driver in ('teams', 'venues', 'games', 'picks', 'none')),
  driver_count integer not null,
  computed_at timestamptz not null default now(),
  primary key (user_lo, user_hi),
  check (user_lo < user_hi)
);
alter table public.compatibility_cache enable row level security;
-- Read through compatibility_with() only, which checks the pair are mutuals.

-- A neutral pick's lean: the share of this fan's pledges made on the underdog, or null with
-- fewer than three.
create or replace function public.underdog_rate(p_user uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select case when count(*) >= 3 then avg(case when win_prob_at_pledge < 0.5 then 1 else 0 end) end
  from public.pledges
  where user_id = p_user and win_prob_at_pledge is not null and status <> 'void';
$$;

revoke all on function public.underdog_rate(uuid) from public, anon, authenticated;

create or replace function public.compatibility_compute(p_a uuid, p_b uuid)
returns public.compatibility_cache
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.compatibility_cache;
  v_teams_a integer; v_teams_b integer; v_shared_teams integer;
  v_venues_a integer; v_venues_b integer; v_shared_venues integer;
  v_shared_games integer;
  r record;
begin
  select count(*) into v_teams_a from public.user_teams where user_id = p_a;
  select count(*) into v_teams_b from public.user_teams where user_id = p_b;
  select count(*) into v_shared_teams from public.user_teams a join public.user_teams b on b.team_id = a.team_id
    where a.user_id = p_a and b.user_id = p_b;
  with va as (select distinct g.venue_id from public.attendances a join public.games g on g.id = a.game_id
               where a.user_id = p_a and a.status = 'attended' and g.venue_id is not null),
       vb as (select distinct g.venue_id from public.attendances a join public.games g on g.id = a.game_id
               where a.user_id = p_b and a.status = 'attended' and g.venue_id is not null)
  select (select count(*) from va), (select count(*) from vb), (select count(*) from va join vb using (venue_id))
    into v_venues_a, v_venues_b, v_shared_venues;
  select count(*) into v_shared_games from public.attendances a join public.attendances b on b.game_id = a.game_id
    where a.user_id = p_a and b.user_id = p_b and a.status = 'attended' and b.status = 'attended';
  select * into r from public.compatibility_score(v_teams_a, v_teams_b, v_shared_teams, v_venues_a, v_venues_b,
    v_shared_venues, v_shared_games, public.underdog_rate(p_a), public.underdog_rate(p_b));
  insert into public.compatibility_cache (user_lo, user_hi, score, driver, driver_count, computed_at)
  values (least(p_a, p_b), greatest(p_a, p_b), r.score, r.driver, r.driver_count, now())
  on conflict (user_lo, user_hi) do update
    set score = excluded.score, driver = excluded.driver, driver_count = excluded.driver_count, computed_at = excluded.computed_at
  returning * into v_row;
  return v_row;
end;
$$;

revoke all on function public.compatibility_compute(uuid, uuid) from public, anon, authenticated;

-- Me and them: nothing unless we follow each other. At most a day old.
create or replace function public.compatibility_with(p_other uuid)
returns table (score integer, driver text, driver_count integer, computed_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_row public.compatibility_cache;
begin
  if v_me is null or p_other is null or v_me = p_other then return; end if;
  if not (public.follows_active(v_me, p_other) and public.follows_active(p_other, v_me)) then return; end if;
  if public.is_blocked_between(v_me, p_other) then return; end if;
  select * into v_row from public.compatibility_cache c
  where c.user_lo = least(v_me, p_other) and c.user_hi = greatest(v_me, p_other);
  if v_row.user_lo is null or v_row.computed_at < now() - interval '1 day' then
    v_row := public.compatibility_compute(v_me, p_other);
  end if;
  return query select v_row.score, v_row.driver, v_row.driver_count, v_row.computed_at;
end;
$$;

revoke all on function public.compatibility_with(uuid) from public, anon;
grant execute on function public.compatibility_with(uuid) to authenticated;

-- My record with a person who is also a user, from my own companion tags of them: the "with"
-- record on their profile. It counts what companion_records() counts for the same person (my
-- tags, pending ones included, since a declined tag is deleted), so the two never disagree.
create or replace function public.record_with_user(p_other uuid)
returns table (games integer, wins integer, losses integer, ties integer)
language sql
stable
security definer
set search_path = public
as $$
  select count(distinct u.game_id)::integer,
         count(distinct u.game_id) filter (where u.result = 'win')::integer,
         count(distinct u.game_id) filter (where u.result = 'loss')::integer,
         count(distinct u.game_id) filter (where u.result = 'tie')::integer
  from public.people p
  join public.attendance_companions ac on ac.person_id = p.id
  join public.user_game_results(auth.uid()) u on u.attendance_id = ac.attendance_id and u.counted
  where p.owner_user_id = auth.uid() and p.linked_user_id = p_other
    and not public.is_blocked_between(auth.uid(), p_other);
$$;

revoke all on function public.record_with_user(uuid) from public, anon;
grant execute on function public.record_with_user(uuid) to authenticated;
