-- `games.final_at` (next-wave B.4, Dean's decision 16): when a game really ended, which the
-- check-in window closes an hour after (coalesce(final_at + 1 h, scheduled_start + 6 h)).
--
-- Two writers fill it. A detail pass knows it exactly (MLB: the last play's end time; NBA: the
-- Game End action's wall clock; NFL: the final snap; MLS: ESPN's last key-event wall clock). A
-- schedule pass knows it roughly (MLB: first pitch plus duration; MLS: the display clock; NFL:
-- kickoff plus four hours) or not at all. Before this the schedule refresh ran every 15 minutes
-- and wrote null over what detail had written, which is why hosted had 4 of 2,734 finals filled.
-- The writer now leaves the column out when it has nothing; this trigger makes the rule hold
-- whoever writes: a row that is not a detail pass never replaces a value a detail pass set,
-- and nothing ever replaces a value with null.
create or replace function public.games_keep_final_at()
returns trigger
language plpgsql
as $$
begin
  if new.final_at is null and old.final_at is not null then
    new.final_at := old.final_at;
  elsif old.final_at is not null
    and old.detail_ingested_at is not null
    and new.detail_ingested_at is not distinct from old.detail_ingested_at then
    -- Not a detail pass (it would have stamped detail_ingested_at): keep the exact value.
    new.final_at := old.final_at;
  end if;
  return new;
end;
$$;

drop trigger if exists games_keep_final_at on public.games;
create trigger games_keep_final_at
  before update of final_at, detail_ingested_at on public.games
  for each row execute function public.games_keep_final_at();
