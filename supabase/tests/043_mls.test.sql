begin;
create extension if not exists pgtap with schema extensions;
select plan(20);
select is((select count(*)::int from public.teams where sport_id='mls' and active),30,'30 MLS clubs');
select is((select count(*)::int from public.teams t join public.team_colors c on c.team_id=t.id where t.sport_id='mls'),30,'all clubs have palettes');
select is((select count(*)::int from public.teams where sport_id='mls' and home_venue_id is null),0,'all clubs have a home venue');
select is((select home_venue_id from public.teams where provider='espn_mls' and provider_team_id='9726'),(select id from public.venues where key='lumen-field'),'Seattle reuses the NFL venue');
select is(public.venue_noun('mls',true),'stadiums','MLS venue noun');
select is((select title from public.bucket_lists where slug='mls-all-venues'),'Every MLS stadium','MLS bucket list title');

insert into auth.users(id,email) values ('a1410000-0000-4000-8000-000000000001','mls-test@example.com');
insert into public.games(id,sport_id,season,season_key,season_label,game_type,scheduled_start,home_team_id,away_team_id,status,home_score,away_score,winner_team_id,is_tie,decision_method,home_shootout_score,away_shootout_score,provider,provider_game_id)
select 'a1410000-0000-4000-8000-000000000002','mls',2022,'mls:2022','2022','postseason','2022-11-05T20:00Z',h.id,a.id,'final',3,3,h.id,false,'shootout',3,0,'mls_test','cup'
from public.teams h,public.teams a where h.provider='espn_mls' and h.provider_team_id='18966' and a.provider='espn_mls' and a.provider_team_id='10739';
insert into public.user_teams(user_id,team_id) select 'a1410000-0000-4000-8000-000000000001',home_team_id from public.games where provider='mls_test';
insert into public.attendances(user_id,game_id,source) values ('a1410000-0000-4000-8000-000000000001','a1410000-0000-4000-8000-000000000002','manual');
select is((select result from public.user_game_results('a1410000-0000-4000-8000-000000000001')),'win','shootout victory counts as a personal win');
select is((select home_score+away_score from public.games where provider='mls_test'),6,'shootout kicks are not goals');
select throws_ok($$update public.games set home_shootout_score=-1 where provider='mls_test'$$,'23514',null,'negative shootout scores rejected');
select throws_ok($$update public.games set winner_team_id=away_team_id where provider='mls_test'$$,'23514',null,'winner must match shootout result');
select throws_ok($$update public.games set away_shootout_score=null where provider='mls_test'$$,'23514',null,'partial shootouts rejected');
select throws_ok($$update public.games set season_key=null where provider='mls_test'$$,'23514',null,'stable season identity required');
update public.games set decision_method='aggregate_shootout',home_score=0,away_score=1,winner_team_id=away_team_id where provider='mls_test';
select is((select result from public.user_game_results('a1410000-0000-4000-8000-000000000001')),'loss','series shootout winner can lose the individual match');
select throws_ok($$update public.games set winner_team_id=home_team_id where provider='mls_test'$$,'23514',null,'series penalties cannot override match winner');
update public.games set home_score=1,away_score=1,winner_team_id=null,is_tie=true where provider='mls_test';
select is((select result from public.user_game_results('a1410000-0000-4000-8000-000000000001')),'tie','series penalties preserve an individual match draw');
update public.games set home_score=0,away_score=0,home_shootout_score=null,away_shootout_score=null,winner_team_id=null,is_tie=true,decision_method='regulation' where provider='mls_test';
select is((select result from public.user_game_results('a1410000-0000-4000-8000-000000000001')),'tie','scoreless draw counts as tie in shared record storage');

set local role authenticated;
select set_config('request.jwt.claim.sub','a1410000-0000-4000-8000-000000000001',true);
select is((select count(*)::int from public.teams where sport_id='mls' and active),30,'authenticated user reads reference data');
select throws_ok($$insert into public.sports(id,name) values('mls_test','x')$$,'42501',null,'authenticated user cannot write reference data');
select is(public.make_pledge('a1410000-0000-4000-8000-000000000002',(select home_team_id from public.games where provider='mls_test'))->>'reason','sport_not_supported','MLS neutral picks cannot fall back to 50 percent');
select is((select count(*)::int from public.attendances where game_id='a1410000-0000-4000-8000-000000000002'),1,'MLS attendance visible to its owner');
reset role;
select * from finish();
rollback;
