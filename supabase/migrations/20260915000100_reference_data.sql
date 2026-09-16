-- Reference data: sports, teams, venues, games, players, appearances, scoring timeline,
-- moments, Elo, and frozen pregame win probabilities (SPEC.md 5.1).
-- Readable by any authenticated user; writable only by the service role (RLS below).

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Enumerations as check constraints (kept as text so new values need no type migration)
-- ---------------------------------------------------------------------------

create table public.sports (
  id text primary key check (id in ('mlb', 'nfl')),
  name text not null
);

insert into public.sports (id, name) values ('mlb', 'Major League Baseball'), ('nfl', 'National Football League');

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  sport_id text not null references public.sports (id),
  name text not null,
  city text not null,
  abbreviation text not null,
  primary_color_hex text,
  active boolean not null default true,
  provider text not null,
  provider_team_id text not null,
  franchise_id text not null,
  unique (provider, provider_team_id)
);
create index teams_sport_idx on public.teams (sport_id);
create index teams_franchise_idx on public.teams (franchise_id);

create table public.team_aliases (
  team_id uuid not null references public.teams (id) on delete cascade,
  alias text not null,
  primary key (team_id, alias)
);
create index team_aliases_lower_idx on public.team_aliases (lower(alias));

create table public.venues (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  city text,
  state text,
  country text,
  lat double precision,
  lng double precision,
  geofence_m integer not null default 400,
  opened_year integer,
  closed_year integer,
  tz text,
  provider_ids jsonb not null default '{}'::jsonb,
  check ((lat is null and lng is null) or (lat between -90 and 90 and lng between -180 and 180))
);
create index venues_provider_ids_idx on public.venues using gin (provider_ids);

create table public.venue_aliases (
  venue_id uuid not null references public.venues (id) on delete cascade,
  alias text not null,
  primary key (venue_id, alias)
);
create index venue_aliases_lower_idx on public.venue_aliases (lower(alias));

create table public.games (
  id uuid primary key default gen_random_uuid(),
  sport_id text not null references public.sports (id),
  season integer not null,
  game_type text not null check (game_type in ('regular', 'postseason', 'preseason')),
  scheduled_start timestamptz not null,
  venue_id uuid references public.venues (id),
  home_team_id uuid not null references public.teams (id),
  away_team_id uuid not null references public.teams (id),
  status text not null check (status in ('scheduled', 'live', 'final', 'postponed', 'suspended', 'cancelled')),
  home_score integer,
  away_score integer,
  winner_team_id uuid references public.teams (id),
  is_tie boolean not null default false,
  doubleheader_number integer check (doubleheader_number in (1, 2)),
  rescheduled_from_game_id uuid references public.games (id),
  rescheduled_to_game_id uuid references public.games (id),
  is_neutral_site boolean not null default false,
  temperature_f integer,
  duration_minutes integer,
  attendance integer,
  innings_or_periods integer,
  timestamps_reliable boolean,
  provider text not null,
  provider_game_id text not null,
  final_at timestamptz,
  detail_ingested_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (provider, provider_game_id),
  check (home_team_id <> away_team_id)
);
create index games_scheduled_start_idx on public.games (scheduled_start);
create index games_sport_season_idx on public.games (sport_id, season);
create index games_home_team_idx on public.games (home_team_id, scheduled_start);
create index games_away_team_idx on public.games (away_team_id, scheduled_start);
create index games_venue_idx on public.games (venue_id);
create index games_status_idx on public.games (status) where status in ('scheduled', 'live');

create table public.players (
  id uuid primary key default gen_random_uuid(),
  sport_id text not null references public.sports (id),
  full_name text not null,
  provider text not null,
  provider_player_id text not null,
  unique (provider, provider_player_id)
);
create index players_name_idx on public.players (lower(full_name));

create table public.game_appearances (
  game_id uuid not null references public.games (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  team_id uuid not null references public.teams (id),
  primary key (game_id, player_id)
);
create index game_appearances_player_idx on public.game_appearances (player_id);

create table public.game_scoring_timeline (
  game_id uuid not null references public.games (id) on delete cascade,
  seq integer not null,
  occurred_at timestamptz,
  period integer not null,
  half text check (half in ('top', 'bottom')),
  clock text,
  home_score integer not null,
  away_score integer not null,
  scoring_side text not null check (scoring_side in ('home', 'away')),
  description text not null default '',
  primary key (game_id, seq)
);

create table public.game_events (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  type text not null,
  player_id uuid references public.players (id),
  team_id uuid references public.teams (id),
  occurred_at timestamptz,
  detail jsonb not null default '{}'::jsonb
);
create index game_events_game_idx on public.game_events (game_id);
create index game_events_type_idx on public.game_events (type);
create index game_events_player_idx on public.game_events (player_id) where player_id is not null;

create table public.team_elo (
  team_id uuid not null references public.teams (id) on delete cascade,
  as_of date not null,
  rating numeric(8, 3) not null,
  primary key (team_id, as_of)
);

create table public.game_win_prob (
  game_id uuid primary key references public.games (id) on delete cascade,
  home_win_prob numeric(6, 5) not null check (home_win_prob between 0 and 1),
  method text not null default 'elo_v1',
  computed_at timestamptz not null default now()
);

-- Resumable ingestion bookkeeping (backfill progress, per-season checkpoints).
create table public.ingest_progress (
  job text not null,
  key text not null,
  status text not null check (status in ('pending', 'running', 'done', 'failed')),
  detail jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (job, key)
);

-- ---------------------------------------------------------------------------
-- Row level security: reference data is readable by authenticated users only.
-- The service role bypasses RLS and is the only writer.
-- ---------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['sports','teams','team_aliases','venues','venue_aliases','games','players',
                           'game_appearances','game_scoring_timeline','game_events','team_elo','game_win_prob']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using (true)', t || '_read_authenticated', t);
  end loop;
end $$;

alter table public.ingest_progress enable row level security;
-- no policies: service role only

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger games_set_updated_at
  before update on public.games
  for each row execute function public.set_updated_at();

-- Latest Elo rating per team as of a date.
create or replace function public.team_elo_as_of(p_team_id uuid, p_date date)
returns numeric
language sql
stable
as $$
  select rating from public.team_elo
  where team_id = p_team_id and as_of <= p_date
  order by as_of desc
  limit 1
$$;
