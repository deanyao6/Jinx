begin;
select no_plan();

insert into auth.users(id,email) values
('b2430000-0000-4000-8000-000000000001','search-one@example.com'),
('b2430000-0000-4000-8000-000000000002','search-two@example.com');
insert into public.venues(id,key,name,city,tz) values
('b2430000-0000-4000-8000-000000000003','search-test-arena','Search Test Arena','Los Angeles','America/Los_Angeles');
insert into public.venue_aliases(venue_id,alias) values
('b2430000-0000-4000-8000-000000000003','Search Test Arena'),
('b2430000-0000-4000-8000-000000000003','Old Search Dome');
insert into public.games(id,sport_id,season,game_type,scheduled_start,home_team_id,away_team_id,status,home_score,away_score,venue_id,provider,provider_game_id)
select x.id::uuid,'nba',2025,'regular',x.ts::timestamptz,h.id,a.id,'final',110,102,
'b2430000-0000-4000-8000-000000000003','search_test',x.key
from public.teams h,public.teams a,(values
('b2430000-0000-4000-8000-000000000004','2026-01-01T03:30Z','local-dec31'),
('b2430000-0000-4000-8000-000000000005','2026-01-15T03:30Z','local-jan14'),
('b2430000-0000-4000-8000-000000000006','2026-01-15T03:30Z','same-time')) x(id,ts,key)
where h.name='Los Angeles Lakers' and a.name='Golden State Warriors';
insert into public.attendances(id,user_id,game_id,source) values
('b2430000-0000-4000-8000-000000000010','b2430000-0000-4000-8000-000000000001','b2430000-0000-4000-8000-000000000004','manual'),
('b2430000-0000-4000-8000-000000000011','b2430000-0000-4000-8000-000000000002','b2430000-0000-4000-8000-000000000005','manual');
insert into public.people(id,owner_user_id,display_name) values
('b2430000-0000-4000-8000-000000000012','b2430000-0000-4000-8000-000000000001','Test Dad'),
('b2430000-0000-4000-8000-000000000013','b2430000-0000-4000-8000-000000000002','Secret Sister');
insert into public.attendance_companions(attendance_id,person_id) values
('b2430000-0000-4000-8000-000000000010','b2430000-0000-4000-8000-000000000012'),
('b2430000-0000-4000-8000-000000000011','b2430000-0000-4000-8000-000000000013');

select is((select search_name from public.venue_aliases where alias='Old Search Dome'),'old search dome','alias inserts normalize automatically');
select is(public.search_normalize_v2('  Montréal / D.C. '),'montreal d c','accents and punctuation normalize');
update public.venue_aliases set alias='Former Search Dome' where alias='Old Search Dome';
select is((select search_name from public.venue_aliases where alias='Former Search Dome'),'former search dome','alias updates normalize automatically');

set local role authenticated;
select set_config('request.jwt.claim.sub','b2430000-0000-4000-8000-000000000001',true);
select ok(exists(select 1 from jsonb_array_elements(public.search_entities_v2(array['phillies'])) e where e->>'name'='Philadelphia Phillies' and e->>'tier'='0'),'exact Phillies alias');
select ok(exists(select 1 from jsonb_array_elements(public.search_entities_v2(array['philies'])) e where e->>'name'='Philadelphia Phillies' and e->>'tier'='2'),'misspelling finds Phillies');
select ok((select count(*)>=2 from jsonb_array_elements(public.search_entities_v2(array['giants'])) e where e->>'tier'='0' and e->>'kind'='team'),'Giants remains ambiguous');
select ok(not exists(select 1 from jsonb_array_elements(public.search_entities_v2(array['giants'],'mlb')) e where e->>'kind'='team' and e->>'label' not like '%MLB'),'league scopes suggestions');
select ok(not exists(select 1 from jsonb_array_elements(public.search_entities_v2(array['ph'])) e where e->>'tier'='2'),'two-character queries are not fuzzy');
select ok(exists(select 1 from jsonb_array_elements(public.search_entities_v2(array['former search dome'],'nba')) e where e->>'id'='b2430000-0000-4000-8000-000000000003'),'historical venue alias uses game league membership');
select ok(not exists(select 1 from jsonb_array_elements(public.search_entities_v2(array['former search dome'],'mls')) e where e->>'id'='b2430000-0000-4000-8000-000000000003'),'venue league filter does not invent membership');

select is(jsonb_array_length(public.search_games_v2('{"venueId":"b2430000-0000-4000-8000-000000000003","from":"2025-12-31","to":"2025-12-31"}')->'rows'),1,'venue local date includes next UTC day');
select is(jsonb_array_length(public.search_games_v2('{"venueId":"b2430000-0000-4000-8000-000000000003","from":"2026-01-01","to":"2026-12-31"}')->'rows'),2,'calendar 2026 excludes local December 31');
select is(jsonb_array_length(public.search_games_v2('{"venueId":"b2430000-0000-4000-8000-000000000003","season":2025}')->'rows'),3,'season 2025 includes January 2026');
select is(jsonb_array_length(public.search_games_v2('{"venueId":"b2430000-0000-4000-8000-000000000003","season":2026}')->'rows'),0,'season constraint is not relaxed');
select is(jsonb_array_length(public.search_games_v2('{"venueId":"b2430000-0000-4000-8000-000000000003","sport":"mls"}')->'rows'),0,'league constraint remains strict');
select is(jsonb_array_length(public.search_games_v2('{}','{}','','mine')->'rows'),1,'My games only includes owner attendance');
select is(jsonb_array_length(public.search_games_v2('{}','{}','Dad','mine','best',null,25,true)->'rows'),1,'companion text finds owner game');
select is(jsonb_array_length(public.search_games_v2('{}','{}','Secret Sister','mine','best',null,25,true)->'rows'),0,'private companion names cannot leak from another owner');
select is(jsonb_array_length(public.search_games_v2('{}','{}','102–110','mine','best',null,25,true)->'rows'),1,'score text supports either score ordering');
select throws_ok($$select public.search_games_v2('{}','{}','Dad','all','best',null,25,true)$$,'22023',null,'personal-text search cannot run across all games');
select throws_ok($$select public.search_games_v2('{}','{}','','all','best',null,10000)$$,'22023',null,'page cap enforced');
select throws_ok($$select public.search_games_v2('{"from":"2026-02-01","to":"2026-01-01"}')$$,'22023',null,'reversed dates rejected');
select throws_ok($$select public.search_games_v2('{}','{"teamIds":["b2430000-0000-4000-8000-000000000099","b2430000-0000-4000-8000-000000000099"]}')$$,'22023',null,'same team cannot fill both matchup slots');
select is(jsonb_array_length(public.search_games_v2('{"venueId":"b2430000-0000-4000-8000-000000000003"}',
jsonb_build_object('teamIds',jsonb_build_array((select id from public.teams where name='Los Angeles Lakers'),(select id from public.teams where name='Golden State Warriors'))))->'rows'),3,'both teams match opposite sides');
select is(jsonb_array_length(public.search_games_v2('{"venueId":"b2430000-0000-4000-8000-000000000003"}',
jsonb_build_object('homeId',(select id from public.teams where name='Golden State Warriors'),'awayId',(select id from public.teams where name='Los Angeles Lakers')))->'rows'),0,'home-away direction is strict');

-- Capture cursors in session-local settings, without privileges on temporary tables.
select set_config('search.test.page',public.search_games_v2('{"venueId":"b2430000-0000-4000-8000-000000000003"}','{}','','all','best',null,1)::text,true);
select is(current_setting('search.test.page')::jsonb->'rows'->0->>'id','b2430000-0000-4000-8000-000000000006','equal timestamps ordered deterministically by UUID');
select is(public.search_games_v2('{"venueId":"b2430000-0000-4000-8000-000000000003"}','{}','','all','best',current_setting('search.test.page')::jsonb->'nextCursor',1)->'rows'->0->>'id','b2430000-0000-4000-8000-000000000005','cursor includes UUID tie breaker');
select is(public.search_games_v2('{"venueId":"b2430000-0000-4000-8000-000000000003"}','{}','','all','oldest',null,1)->'rows'->0->>'id','b2430000-0000-4000-8000-000000000004','oldest sort reverses date ordering');
select throws_ok($$select public.search_games_v2('{"venueId":"b2430000-0000-4000-8000-000000000003"}','{}','changed','all','best',current_setting('search.test.page')::jsonb->'nextCursor',1)$$,'22023',null,'changed query cannot reuse cursor');
select set_config('request.jwt.claim.sub','b2430000-0000-4000-8000-000000000002',true);
select throws_ok($$select public.search_games_v2('{"venueId":"b2430000-0000-4000-8000-000000000003"}','{}','','all','best',current_setting('search.test.page')::jsonb->'nextCursor',1)$$,'22023',null,'different user cannot reuse cursor');
select is(public.search_games_v2('{}','{}','','mine')->'rows'->0->>'id','b2430000-0000-4000-8000-000000000005','second user gets their own attendance');
-- Move only transactional fixtures into the future to exercise upcoming sorting.
reset role;
update public.games set scheduled_start=now()+case when provider_game_id='local-dec31'
  then interval '1 day' else interval '2 days' end where provider='search_test';
set local role authenticated;
select is(public.search_games_v2('{"venueId":"b2430000-0000-4000-8000-000000000003","time":"upcoming"}','{}','','all','best',null,1)->'rows'->0->>'id','b2430000-0000-4000-8000-000000000004','upcoming best starts with soonest');
select is(public.search_games_v2('{"venueId":"b2430000-0000-4000-8000-000000000003","time":"upcoming"}','{}','','all','newest',null,1)->'rows'->0->>'id','b2430000-0000-4000-8000-000000000006','upcoming respects explicit newest and UUID order');
select is(public.search_games_v2('{"venueId":"b2430000-0000-4000-8000-000000000003","time":"upcoming"}','{}','','all','oldest',null,1)->'rows'->0->>'id','b2430000-0000-4000-8000-000000000004','upcoming respects explicit oldest');
set local role anon;
select throws_ok($$select public.search_games_v2()$$,'42501',null,'anonymous game search denied');
select throws_ok($$select public.search_entities_v2(array['giants'])$$,'42501',null,'anonymous entity search denied');
reset role;
select * from finish();
rollback;
