-- NBA and MLS superstar honors (migration 20260923001000): the new kinds exist and rank under
-- the MVP, and a player with one of them is a superstar for three seasons, named by the
-- biggest honor. Numbered 023 (046 to 049 are this wave's others, 050 on another session's).
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

select is((select count(*)::int from public.honor_kinds where sport_id = 'nba'), 8, 'eight NBA honor kinds');
select is((select count(*)::int from public.honor_kinds where sport_id = 'mls'), 6, 'six MLS honor kinds');
select is((select honor from public.honor_kinds where sport_id = 'nba' order by rank limit 1), 'mvp', 'the NBA MVP outranks everything');
select is((select rank from public.honor_kinds where sport_id = 'nba' and honor = 'all_nba_1st') < (select rank from public.honor_kinds where sport_id = 'nba' and honor = 'roy'), true,
  'first-team All-NBA outranks Rookie of the Year');

insert into public.players (id, sport_id, provider, provider_player_id, full_name)
values ('00000000-0000-0000-0000-0000000000e1', 'mls', 'test', 'star-1', 'Test Striker')
on conflict do nothing;
insert into public.player_honors (player_id, season, honor, source) values
  ('00000000-0000-0000-0000-0000000000e1', 2023, 'best_xi', 'test'),
  ('00000000-0000-0000-0000-0000000000e1', 2024, 'golden_boot', 'test');

select is(public.is_superstar('00000000-0000-0000-0000-0000000000e1', 2024), true, 'a Golden Boot makes a superstar');
select is(public.is_superstar('00000000-0000-0000-0000-0000000000e1', 2027), true, 'still one three seasons on');
select is(public.is_superstar('00000000-0000-0000-0000-0000000000e1', 2028), false, 'not four');
select is((select honor from public.superstar_honor('00000000-0000-0000-0000-0000000000e1', 2025)), 'golden_boot', 'the Golden Boot outranks the Best XI');

select * from finish();
rollback;
