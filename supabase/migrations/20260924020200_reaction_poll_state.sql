-- Social v2, prompt 3: what mlb-live judged last minute. The MLB rules run server-side against
-- `/winProbability` (03, section 3.1) and need to know which plate appearance the previous poll
-- had already seen, so a play prompts once and a restart does not replay the game. One row per
-- game while it is polled; nobody but the service role reads or writes it.
create table public.reaction_poll_state (
  game_id uuid primary key references public.games (id) on delete cascade,
  last_at_bat integer not null default -1,
  scheduled_reported boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.reaction_poll_state enable row level security;
-- No policies: the service role bypasses RLS and is the only reader and writer.
