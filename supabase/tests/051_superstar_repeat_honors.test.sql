-- A single All-Star selection does not make a superstar (migration 20260923110000).
--
-- Dean's bar is "top X in MVP voting or some threshold of elite", not a selection anyone can
-- get in one good year. MLB names an All-Star from every club, so on 2026-09-22 a player with
-- one 2024 selection counted. `honor_kinds.min_count` now says how many times an honor must
-- land inside its window; All-Star needs two, everything else still qualifies the first time.
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into public.players (id, sport_id, full_name, provider, provider_player_id) values
  ('00000000-0000-0000-0000-0000000051a1', 'mlb', 'One Nod', 'test', 'super-one'),
  ('00000000-0000-0000-0000-0000000051a2', 'mlb', 'Two Nods', 'test', 'super-two'),
  ('00000000-0000-0000-0000-0000000051a3', 'mlb', 'The Winner', 'test', 'super-mvp'),
  ('00000000-0000-0000-0000-0000000051a4', 'mlb', 'Club Great', 'test', 'super-franchise'),
  ('00000000-0000-0000-0000-0000000051a5', 'nba', 'Nba One Nod', 'test', 'super-nba-one')
on conflict (provider, provider_player_id) do nothing;

insert into public.player_honors (player_id, season, honor, source) values
  ('00000000-0000-0000-0000-0000000051a1', 2024, 'all_star', 'test'),
  ('00000000-0000-0000-0000-0000000051a2', 2024, 'all_star', 'test'),
  ('00000000-0000-0000-0000-0000000051a2', 2026, 'all_star', 'test'),
  ('00000000-0000-0000-0000-0000000051a3', 2024, 'mvp', 'test'),
  -- A franchise player whose only honor is a single nod: the honor does not qualify, and the
  -- franchise row must still carry them. This is the case that broke when the old function
  -- asked "has any honor in the window" rather than "has any qualifying honor".
  ('00000000-0000-0000-0000-0000000051a4', 2024, 'all_star', 'test'),
  ('00000000-0000-0000-0000-0000000051a5', 2025, 'all_star', 'test')
on conflict do nothing;

insert into public.franchise_players (player_id, from_season, to_season, source) values
  ('00000000-0000-0000-0000-0000000051a4', 2020, null, 'test')
on conflict do nothing;

-- 1. One All-Star selection is a good season, not a superstar.
select ok(not public.is_superstar('00000000-0000-0000-0000-0000000051a1', 2026),
  'one All-Star selection does not make a superstar');

-- 2. Two inside the window does.
select ok(public.is_superstar('00000000-0000-0000-0000-0000000051a2', 2026),
  'two All-Star selections inside the window do');

-- 3. And the honor it reports is the All-Star one.
select is((select honor from public.superstar_honor('00000000-0000-0000-0000-0000000051a2', 2026)),
  'all_star', 'the repeat All-Star is named by their selection');

-- 4. A win still qualifies the first time: min_count stays 1 for every other honor.
select ok(public.is_superstar('00000000-0000-0000-0000-0000000051a3', 2024),
  'one MVP still makes a superstar');

-- 5. A franchise player is not lost because their only honor fell short.
select ok(public.is_superstar('00000000-0000-0000-0000-0000000051a4', 2026),
  'a franchise player with one All-Star nod is still a superstar');
select is((select honor from public.superstar_honor('00000000-0000-0000-0000-0000000051a4', 2026)),
  'franchise', 'and is named as a franchise player, not an All-Star');

-- 6. The window still applies: the second nod ages out by 2028 (window is 3 seasons).
select ok(not public.is_superstar('00000000-0000-0000-0000-0000000051a2', 2030),
  'selections outside the window no longer count');

-- 7. The rule is keyed by honor, so the NBA's All-Star needs two as well.
select ok(not public.is_superstar('00000000-0000-0000-0000-0000000051a5', 2026),
  'one NBA All-Star selection does not make a superstar either');

select * from finish();
rollback;
