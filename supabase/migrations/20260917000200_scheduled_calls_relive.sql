-- Scheduled calls that actually arrive, and game stories that build without a human.
--
-- Three things were wrong, all found on the hosted project on 2026-09-17:
--
--   1. pg_cron reported every job as succeeded while calling nothing. call_edge_function sent only
--      `Authorization: Bearer <service role key>`. Projects on Supabase's new API key format inject
--      a SUPABASE_SERVICE_ROLE_KEY into the function runtime that never equals the legacy JWT in
--      vault, so authorizeInternal refused every call (docs/verification.md). The gateway still
--      wants a JWT, and the function wants CRON_SECRET, so a scheduled call now sends both.
--   2. Nothing drained detail_queue, and nothing built Relive for any sport (SPEC.md 4.7, 6.19).
--      The workers live in mlb-sync and the nightly NFL job; this migration gives them the
--      queries they read.
--   3. Storylines were never scheduled (SPEC.md 6.18), and a walk-up check-in at a neutral game
--      had none at all, because only games marked "going" were ever generated.

-- ---------------------------------------------------------------------------
-- 1. call_edge_function sends x-cron-secret as well as the bearer token
-- ---------------------------------------------------------------------------
-- Vault secrets, set once per project:
--   select vault.create_secret('https://<ref>.supabase.co', 'project_url');
--   select vault.create_secret('<legacy service role JWT>', 'service_role_key');
--   select vault.create_secret('<CRON_SECRET>', 'cron_secret');
-- cron_secret is optional so a project on the legacy key format keeps working without it.
create or replace function public.call_edge_function(p_name text, p_body jsonb default '{}'::jsonb)
returns bigint
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_url text;
  v_key text;
  v_secret text;
  v_headers jsonb;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'service_role_key';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'cron_secret';
  if v_url is null or v_key is null then
    -- A warning, not a notice: cron.job_run_details records this run as succeeded either way, and
    -- a notice is invisible in the Postgres log at the default level. This must be findable.
    raise warning 'call_edge_function(%): vault secrets project_url / service_role_key not set, nothing was called', p_name;
    return null;
  end if;
  v_headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key);
  if v_secret is not null then
    v_headers := v_headers || jsonb_build_object('x-cron-secret', v_secret);
  end if;
  return net.http_post(
    url := v_url || '/functions/v1/' || p_name,
    headers := v_headers,
    body := p_body,
    timeout_milliseconds := 120000
  );
end;
$$;

revoke all on function public.call_edge_function(text, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. The detail queue and Relive, read by the workers
-- ---------------------------------------------------------------------------
-- When the Relive worker last looked at a game. Null means never. A game whose provider publishes
-- no win probability is looked at once and then left alone, instead of being refetched every run.
alter table public.games add column if not exists relive_checked_at timestamptz;

-- A row that keeps failing stops being retried. Eight attempts at one every 15 minutes is two
-- hours, which outlasts a provider blip; after that last_error says why and a person can look.
create or replace function public.detail_queue_pending(p_provider text, p_limit integer default 50)
returns table (game_id uuid, provider_game_id text, reason text, attempts integer)
language sql
stable
security definer
set search_path = public
as $$
  select q.game_id, g.provider_game_id, q.reason, q.attempts
  from public.detail_queue q
  join public.games g on g.id = q.game_id
  where q.done_at is null
    and q.attempts < 8
    and g.provider = p_provider
    and g.status = 'final'
  order by q.requested_at
  limit p_limit;
$$;

-- Closes every open queue row whose game now has detail, whichever path ingested it. NFL detail
-- arrives in bulk from season files, not per queued game, so nothing else would ever close those.
create or replace function public.detail_queue_settle()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.detail_queue q
     set done_at = now(), last_error = null
    from public.games g
   where g.id = q.game_id
     and q.done_at is null
     and q.reason <> 'refresh'
     and g.detail_ingested_at is not null;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Attended, final, detailed games with no story yet. Driven by attendances rather than by the
-- queue on purpose: enqueue_game_detail skips a game whose detail already exists, which is every
-- game in mlb-sync's rolling window, so a queue-driven worker would never build their stories.
-- Recent games are retried for two weeks because both providers publish win probability late.
create or replace function public.games_needing_relive(p_provider text, p_limit integer default 50)
returns table (
  game_id uuid, provider_game_id text, season integer,
  home_score integer, away_score integer, home_name text, away_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select g.id, g.provider_game_id, g.season, g.home_score, g.away_score, ht.name, at.name
  from public.games g
  join public.teams ht on ht.id = g.home_team_id
  join public.teams at on at.id = g.away_team_id
  where g.provider = p_provider
    and g.status = 'final'
    and g.detail_ingested_at is not null
    and (g.relive_checked_at is null or g.scheduled_start > now() - interval '14 days')
    and exists (select 1 from public.attendances a where a.game_id = g.id and a.status = 'attended')
    and not exists (select 1 from public.game_story_steps s where s.game_id = g.id)
  order by g.scheduled_start desc
  limit p_limit;
$$;

revoke all on function public.detail_queue_pending(text, integer) from public, anon, authenticated;
revoke all on function public.detail_queue_settle() from public, anon, authenticated;
revoke all on function public.games_needing_relive(text, integer) from public, anon, authenticated;
grant execute on function public.detail_queue_pending(text, integer) to service_role;
grant execute on function public.detail_queue_settle() to service_role;
grant execute on function public.games_needing_relive(text, integer) to service_role;

-- ---------------------------------------------------------------------------
-- 3. Storylines on a schedule, and on a walk-up check-in (SPEC.md 6.18)
-- ---------------------------------------------------------------------------
-- Is anyone going to a game that starts in this window? The cron jobs ask first, so a day with
-- no such game makes no HTTP call and spends nothing.
create or replace function public.going_game_starts_between(p_from interval, p_to interval)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.attendances a
    join public.games g on g.id = a.game_id
    where a.status = 'going'
      and g.status = 'scheduled'
      and g.scheduled_start >= now() + p_from
      and g.scheduled_start < now() + p_to
  );
$$;
revoke all on function public.going_game_starts_between(interval, interval) from public, anon, authenticated;

-- The morning of: 12:00 UTC is 8am Eastern and 5am Pacific, and 20 hours reaches the latest
-- West Coast first pitch of that day.
select cron.schedule('storylines-morning', '0 12 * * *',
  $$select public.call_edge_function('storylines', '{"upcoming_hours": 20}'::jsonb)
    where public.going_game_starts_between(interval '0', interval '20 hours')$$);

-- The refresh an hour before. Every 30 minutes, for games starting 60 to 90 minutes from now, so
-- each game is refreshed exactly once however odd its start time is.
select cron.schedule('storylines-refresh', '*/30 * * * *',
  $$select public.call_edge_function('storylines', '{"from_hours": 1, "upcoming_hours": 1.5}'::jsonb)
    where public.going_game_starts_between(interval '60 minutes', interval '90 minutes')$$);

-- Someone who checks in without ever marking the game as "going" still lands on Pick a side.
-- Generate for that game there and then, unless it already has storylines.
create or replace function public.storylines_on_checkin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.storylines s where s.game_id = new.game_id) then
    perform public.call_edge_function('storylines', jsonb_build_object('game_ids', jsonb_build_array(new.game_id)));
  end if;
  return new;
exception when others then
  -- A check-in must never fail because storylines could not be requested.
  raise warning 'storylines_on_checkin(%): %', new.game_id, sqlerrm;
  return new;
end;
$$;

drop trigger if exists checkins_request_storylines on public.checkins;
create trigger checkins_request_storylines
  after insert on public.checkins
  for each row execute function public.storylines_on_checkin();
