-- Curated division lists were all titled "<division> ballparks", NFL divisions included
-- ("AFC East ballparks"). The wording was built in rebuild_curated_bucket_lists(), not in the
-- seed JSON, so the fix is here: the function picks the word from the sport, and the rows that
-- are already seeded are retitled in place.
--
-- The UPDATE is by slug, which the function builds as '<sport>-division-<division>'. Descriptions
-- ("Every home venue in the AFC East.") were already sport-neutral and are left alone. Joined
-- lists keep their progress: ids and definitions do not change.

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

  -- Each division's venues. Only baseball plays in ballparks; every other sport gets "stadiums".
  for r in select distinct sport_id, division from public.teams where active and division is not null and home_venue_id is not null loop
    insert into public.bucket_lists (slug, title, description, is_curated, definition)
    select r.sport_id || '-division-' || lower(regexp_replace(r.division, '[^a-zA-Z0-9]+', '-', 'g')),
           r.division || case r.sport_id when 'mlb' then ' ballparks' else ' stadiums' end,
           'Every home venue in the ' || r.division || '.', true,
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

update public.bucket_lists
   set title = regexp_replace(title, ' ballparks$', ' stadiums')
 where is_curated
   and slug like '%-division-%'
   and slug not like 'mlb-division-%'
   and title like '% ballparks';
