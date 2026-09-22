-- ESPN numbers venues per sport (migration 20260923000300): soccer ids live under
-- espn_soccer_venue_ids, so id 10660 can be Gillette Stadium in soccer and Accor Arena in
-- basketball without an MLS match landing in Paris.
begin;
select plan(5);

select is((select provider_ids->'espn_soccer_venue_ids' from public.venues where key = 'gillette-stadium'), '["10660"]'::jsonb,
  'Gillette Stadium carries its soccer id under the soccer key');
select ok((select not (provider_ids ? 'espn_venue_ids') from public.venues where key = 'gillette-stadium'),
  'and no basketball id');
select is((select provider_ids->'espn_venue_ids' from public.venues where key = 'accor-arena'), '["6271", "10660"]'::jsonb,
  'Accor Arena keeps its basketball ids');
select is((select count(*) from public.games g join public.venues v on v.id = g.venue_id where g.sport_id = 'mls' and v.key = 'accor-arena'), 0::bigint,
  'no MLS match is in Paris');
select is((select count(*) from public.venues where key like 'mls-espn-%' and provider_ids ? 'espn_venue_ids'), 0::bigint,
  'no MLS-only venue carries a basketball id');

select * from finish();
rollback;
