-- Goals and bucket lists (SPEC.md 6.13, 6.14, 8.7). Predicates are evaluated by packages/core
-- (in the app for display and in the evaluate-goals Edge Function for completion side effects).

alter table public.teams add column division text, add column home_venue_id uuid references public.venues (id);
alter table public.bucket_lists add column slug text unique;
alter table public.user_bucket_lists add column progress jsonb not null default '{}'::jsonb;

-- The GoalGame shape consumed by core's evaluateGoal, for one user.
create or replace function public.goal_games(p_user uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'gameId', u.game_id,
    'sport', u.sport_id,
    'scheduledStart', u.scheduled_start,
    'year', extract(year from (u.scheduled_start at time zone 'America/New_York'))::integer,
    'venueId', u.venue_id,
    'homeTeamId', u.home_team_id,
    'awayTeamId', u.away_team_id,
    'homeFranchiseId', ht.franchise_id,
    'awayFranchiseId', at.franchise_id,
    'rootingTeamId', u.rooting_team_id,
    'rootingFranchiseId', rt.franchise_id,
    'rootingBasis', u.rooting_basis,
    'result', u.result,
    'events', (select coalesce(jsonb_agg(distinct e.type), '[]'::jsonb) from public.game_events e where e.game_id = u.game_id),
    'companions', (select coalesce(jsonb_agg(ac.person_id), '[]'::jsonb) from public.attendance_companions ac where ac.attendance_id = u.attendance_id),
    'isNewVenue', u.venue_id is not null and not exists (
      select 1 from public.user_game_results(p_user) x
      where x.venue_id = u.venue_id and x.counted
        and (x.scheduled_start < u.scheduled_start or (x.scheduled_start = u.scheduled_start and x.attendance_id < u.attendance_id))),
    'pledge', (select jsonb_build_object('status', p.status, 'winProbAtPledge', p.win_prob_at_pledge) from public.pledges p where p.user_id = p_user and p.game_id = u.game_id),
    'isFinal', u.counted
  ) order by u.scheduled_start), '[]'::jsonb)
  from public.user_game_results(p_user) u
  join public.teams ht on ht.id = u.home_team_id
  join public.teams at on at.id = u.away_team_id
  left join public.teams rt on rt.id = u.rooting_team_id
  where auth.uid() is null or public.can_view_user(p_user);
$$;

-- Goal completion side effects.
create or replace function public.goals_after_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.completed_at is not null and old.completed_at is null then
    insert into public.feed_events (actor_user_id, type, payload)
    values (new.user_id, 'goal_completed', jsonb_build_object('goal_id', new.id, 'title', new.title, 'year', new.year));
    insert into public.notifications (user_id, kind, title, body, data)
    values (new.user_id, 'goal_completed', 'Goal completed', new.title, jsonb_build_object('goal_id', new.id));
  end if;
  return null;
end;
$$;
create trigger goals_completion after update of completed_at on public.goals for each row execute function public.goals_after_update();

-- Client: record evaluated progress (own goals only; the evaluator runs in the app or the Edge Function).
create or replace function public.set_goal_progress(p_goal_id uuid, p_progress jsonb, p_completed boolean)
returns void
language sql
security definer
set search_path = public
as $$
  update public.goals
  set progress = coalesce(p_progress, '{}'::jsonb),
      completed_at = case when p_completed then coalesce(completed_at, now()) else null end
  where id = p_goal_id and user_id = auth.uid();
$$;

create or replace function public.set_bucket_list_progress(p_bucket_list_id uuid, p_progress jsonb)
returns void
language sql
security definer
set search_path = public
as $$
  update public.user_bucket_lists set progress = coalesce(p_progress, '{}'::jsonb)
  where bucket_list_id = p_bucket_list_id and user_id = auth.uid();
$$;

-- Games attended last year, for suggestions (SPEC 6.13).
create or replace function public.games_in_year(p_year integer)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer from public.user_game_results(auth.uid()) u
  where u.counted and extract(year from (u.scheduled_start at time zone 'America/New_York')) = p_year;
$$;

-- Called from process_game_final: evaluate goals for affected users via the Edge Function.
create or replace function public.evaluate_goals_for_users(p_users uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_users is null or array_length(p_users, 1) is null then return; end if;
  if exists (select 1 from public.goals where user_id = any(p_users) and completed_at is null)
     or exists (select 1 from public.user_bucket_lists where user_id = any(p_users)) then
    perform public.call_edge_function('evaluate-goals', jsonb_build_object('user_ids', to_jsonb(p_users)));
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Curated bucket lists (SPEC 6.14). Rebuilt from the seeded teams/venues; idempotent by slug.
-- ---------------------------------------------------------------------------
create or replace function public.rebuild_curated_bucket_lists()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  -- All current ballparks / stadiums (home venues of active teams).
  for r in select id as sport_id, case id when 'mlb' then 'All 30 MLB ballparks' else 'Every NFL stadium' end as title from public.sports loop
    insert into public.bucket_lists (slug, title, description, is_curated, definition)
    select r.sport_id || '-all-venues', r.title,
           'Every current home venue in the league.', true,
           jsonb_build_object('type', 'distinct_venues', 'target', count(distinct t.home_venue_id),
                              'filter', jsonb_build_object('venue_ids', jsonb_agg(distinct t.home_venue_id)))
    from public.teams t where t.sport_id = r.sport_id and t.active and t.home_venue_id is not null
    having count(distinct t.home_venue_id) > 0
    on conflict (slug) do update set title = excluded.title, definition = excluded.definition;
  end loop;

  -- Each division's venues.
  for r in select distinct sport_id, division from public.teams where active and division is not null and home_venue_id is not null loop
    insert into public.bucket_lists (slug, title, description, is_curated, definition)
    select r.sport_id || '-division-' || lower(regexp_replace(r.division, '[^a-zA-Z0-9]+', '-', 'g')),
           r.division || ' ballparks', 'Every home venue in the ' || r.division || '.', true,
           jsonb_build_object('type', 'distinct_venues', 'target', count(distinct t.home_venue_id),
                              'filter', jsonb_build_object('venue_ids', jsonb_agg(distinct t.home_venue_id)))
    from public.teams t where t.sport_id = r.sport_id and t.division = r.division and t.active and t.home_venue_id is not null
    on conflict (slug) do update set title = excluded.title, definition = excluded.definition;
  end loop;

  -- Achievement lists.
  insert into public.bucket_lists (slug, title, description, is_curated, definition) values
    ('see-a-walk-off', 'See a walk-off', 'Be there when the home team wins it in their last at-bat.', true, '{"type":"exists","filter":{"event":"walk_off"}}'),
    ('see-a-no-hitter', 'See a no-hitter', 'One of the rarest things in baseball.', true, '{"type":"exists","filter":{"event":"no_hitter"}}'),
    ('see-a-grand-slam', 'See a grand slam', 'Bases loaded, gone.', true, '{"type":"exists","filter":{"event":"grand_slam"}}'),
    ('see-extra-innings', 'See extra innings', 'Free baseball.', true, '{"type":"exists","filter":{"event":"extra_innings"}}'),
    ('see-overtime', 'See an overtime game', 'Sixty minutes was not enough.', true, '{"type":"exists","filter":{"event":"overtime"}}'),
    ('see-a-pick-six', 'See a pick-six', 'An interception returned for a touchdown.', true, '{"type":"exists","filter":{"event":"pick_six"}}'),
    ('see-a-comeback', 'See a 14-point comeback', 'Your side, down two scores, wins.', true, '{"type":"exists","filter":{"event":"comeback_14","result":"win"}}'),
    ('win-ten-pledges', 'Win 10 pledges', 'Pick the right side ten times at neutral games.', true, '{"type":"count","target":10,"filter":{"rooting_basis":"pledge","result":"win"}}')
  on conflict (slug) do update set title = excluded.title, description = excluded.description, definition = excluded.definition;
end;
$$;

revoke all on function public.rebuild_curated_bucket_lists() from public, anon, authenticated;
revoke all on function public.evaluate_goals_for_users(uuid[]) from public, anon, authenticated;
