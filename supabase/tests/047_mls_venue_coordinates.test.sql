-- Every venue that has hosted an MLS match has coordinates and a timezone (migration
-- 20260923000200), so search and the famous-game matcher read the local date and check-in can
-- geofence. Spot values are the sourced ones (docs/verification.md).
begin;
select plan(6);

select is((select count(*) from public.venues v where v.lat is null and exists (select 1 from public.games g where g.venue_id = v.id and g.sport_id = 'mls')), 0::bigint,
  'no MLS venue is without coordinates');
select is((select count(*) from public.venues v where v.tz is null and exists (select 1 from public.games g where g.venue_id = v.id and g.sport_id = 'mls')), 0::bigint,
  'no MLS venue is without a timezone');

select is((select tz from public.venues where key = 'mls-espn-4383'), 'America/Los_Angeles', 'Providence Park is Pacific');
select is((select tz from public.venues where key = 'mls-espn-2731'), 'America/Denver', 'Dick''s Sporting Goods Park is Mountain');
select is((select tz from public.venues where key = 'mls-espn-10143'), 'America/Toronto', 'BMO Field is Toronto');
select ok((select lat between 30.38 and 30.39 and lng between -97.72 and -97.71 from public.venues where key = 'mls-espn-8673'),
  'Q2 Stadium sits where Wikipedia puts it');

select * from finish();
rollback;
