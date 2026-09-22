begin;
select plan(5);
select is((select city from public.venues where key = 'mls-espn-7474'), 'Frisco', 'Toyota Stadium city is independently verified');
select is((select state from public.venues where key = 'mls-espn-7474'), 'TX', 'Toyota Stadium state');
select is((select tz from public.venues where key = 'mls-espn-7474'), 'America/Chicago', 'Toyota Stadium local dates use Central time');
select is((select tz from public.venues where key = 'lumen-field'), 'America/Los_Angeles', 'MLS shared Seattle venue retains local dates');
select is((select tz from public.venues where key = 'gillette-stadium'), 'America/New_York', 'MLS shared New England venue retains local dates');
select * from finish();
rollback;
