-- The server's poll bookkeeping (migration 20260924020200) is the service role's alone.
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

insert into auth.users (id, email) values ('b8300000-0000-4000-8000-0000000000a1', 'ps-a@test');
insert into public.teams (id, sport_id, name, city, abbreviation, provider, provider_team_id, franchise_id) values
  ('00000000-0000-0000-0000-00000083a001', 'mlb', 'Poll Home', 'Home', 'PHM', 'test', 'ps-t1', 'ps-f1'),
  ('00000000-0000-0000-0000-00000083a002', 'mlb', 'Poll Away', 'Away', 'PAW', 'test', 'ps-t2', 'ps-f2');
insert into public.games (id, sport_id, season, game_type, scheduled_start, home_team_id, away_team_id, status, provider, provider_game_id)
values ('00000000-0000-0000-0000-00000083c001', 'mlb', 2026, 'regular', now(), '00000000-0000-0000-0000-00000083a001', '00000000-0000-0000-0000-00000083a002', 'live', 'test', 'ps-g1');
insert into public.reaction_poll_state (game_id, last_at_bat) values ('00000000-0000-0000-0000-00000083c001', 12);

select has_table('public', 'reaction_poll_state', 'the table exists');
set local role authenticated;
set local request.jwt.claims to '{"sub":"b8300000-0000-4000-8000-0000000000a1","role":"authenticated"}';
select is((select count(*)::int from public.reaction_poll_state), 0, 'a fan reads none of it');
select throws_ok(
  $$insert into public.reaction_poll_state (game_id, last_at_bat) values ('00000000-0000-0000-0000-00000083c001', 1)$$,
  '42501', null, 'nor writes it');
reset role;
select is((select last_at_bat from public.reaction_poll_state where game_id = '00000000-0000-0000-0000-00000083c001'), 12, 'the service role does');

select * from finish();
rollback;
