-- Live state for the pledge countdown (SPEC.md 6.4). Polled by the mlb-live Edge Function every
-- minute while any user is checked in; the app reads this table instead of calling MLB.

create table public.game_live_state (
  game_id uuid primary key references public.games (id) on delete cascade,
  status text not null,
  inning integer,
  inning_state text,
  home_score integer not null default 0,
  away_score integer not null default 0,
  locked boolean not null default false,
  lock_reason text,
  fetched_at timestamptz not null default now()
);
alter table public.game_live_state enable row level security;
create policy game_live_state_read on public.game_live_state for select to authenticated using (true);

-- Games that need live polling right now: MLB, someone checked in, within the live window.
create or replace function public.games_needing_live_poll()
returns table (game_id uuid, provider_game_id text, sport_id text, scheduled_start timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select distinct g.id, g.provider_game_id, g.sport_id, g.scheduled_start
  from public.games g
  join public.checkins c on c.game_id = g.id
  where g.sport_id = 'mlb'
    and g.status in ('scheduled', 'live')
    and now() between g.scheduled_start - interval '1 hour' and g.scheduled_start + interval '6 hours';
$$;
revoke all on function public.games_needing_live_poll() from public, anon, authenticated;

select cron.schedule('mlb-live', '* * * * *',
  $$select public.call_edge_function('mlb-live') where exists (select 1 from public.games_needing_live_poll())$$);

select cron.schedule('cleanup-imports-daily', '30 4 * * *', $$select public.call_edge_function('cleanup-imports')$$);
