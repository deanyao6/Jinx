-- Storylines: at most one per team, and one about the game (SPEC.md 6.18, narrowed 2026-09-17).
--
-- Dean's rule is enforced by the schema, not by the generator, so it is tested here: a retry loop,
-- a concurrent run or a future prompt change must not be able to store a second storyline for a side.
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into public.venues (id, key, name) values ('00000000-0000-0000-0000-0000000005b1', 'story-venue', 'Story Park')
on conflict (key) do nothing;
insert into public.teams (id, sport_id, name, city, abbreviation, provider, provider_team_id, franchise_id)
values ('00000000-0000-0000-0000-0000000005a1', 'mlb', 'Story Home', 'Home', 'SHM', 'test', 'story-h', 'story-fh'),
       ('00000000-0000-0000-0000-0000000005a2', 'mlb', 'Story Away', 'Away', 'SAW', 'test', 'story-a', 'story-fa')
on conflict (provider, provider_team_id) do nothing;
insert into public.games (id, sport_id, season, game_type, scheduled_start, venue_id, home_team_id, away_team_id, status, provider, provider_game_id)
values ('00000000-0000-0000-0000-0000000005c1', 'mlb', 2026, 'postseason', '2026-10-20T23:00:00Z',
        '00000000-0000-0000-0000-0000000005b1', '00000000-0000-0000-0000-0000000005a1',
        '00000000-0000-0000-0000-0000000005a2', 'scheduled', 'test', 'story-g1')
on conflict (provider, provider_game_id) do nothing;

-- One per team, and one for the game.
select lives_ok($$insert into public.storylines (game_id, team_id, text, source) values
  ('00000000-0000-0000-0000-0000000005c1', '00000000-0000-0000-0000-0000000005a1', 'Home line.', 'results'),
  ('00000000-0000-0000-0000-0000000005c1', '00000000-0000-0000-0000-0000000005a2', 'Away line.', 'results'),
  ('00000000-0000-0000-0000-0000000005c1', null, 'Tied 3-3.', 'schedule')$$,
  'a game takes one storyline per team plus one about the game');

select throws_ok($$insert into public.storylines (game_id, team_id, text, source) values
  ('00000000-0000-0000-0000-0000000005c1', '00000000-0000-0000-0000-0000000005a1', 'A second home line.', 'results')$$,
  '23505', null, 'a second storyline for the same team is refused');

-- NULLS NOT DISTINCT is what makes this one hold. Without it every null team_id is a different
-- value and a game could carry any number of significance rows.
select throws_ok($$insert into public.storylines (game_id, team_id, text, source) values
  ('00000000-0000-0000-0000-0000000005c1', null, 'A second game line.', 'schedule')$$,
  '23505', null, 'a second storyline about the game is refused');

-- A significance line is about the game, and a team line is about a team. Never crossed.
select throws_ok($$insert into public.storylines (game_id, team_id, text, source) values
  ('00000000-0000-0000-0000-0000000005c1', null, 'No team, wrong source.', 'results')$$,
  '23514', null, 'a results storyline must belong to a team');

delete from public.storylines where game_id = '00000000-0000-0000-0000-0000000005c1';
select throws_ok($$insert into public.storylines (game_id, team_id, text, source) values
  ('00000000-0000-0000-0000-0000000005c1', '00000000-0000-0000-0000-0000000005a1', 'Team, wrong source.', 'schedule')$$,
  '23514', null, 'a schedule storyline must not belong to a team');

select throws_ok($$insert into public.storylines (game_id, team_id, text, source) values
  ('00000000-0000-0000-0000-0000000005c1', '00000000-0000-0000-0000-0000000005a1', 'Made-up source.', 'news')$$,
  '23514', null, 'an unknown source is refused');

-- Replacing them, which is what a refresh an hour before the start does, still works.
select lives_ok($$
  delete from public.storylines where game_id = '00000000-0000-0000-0000-0000000005c1';
  insert into public.storylines (game_id, team_id, text, source) values
    ('00000000-0000-0000-0000-0000000005c1', '00000000-0000-0000-0000-0000000005a1', 'Refreshed.', 'results')
$$, 'a refresh can replace a game''s storylines');

select * from finish();
rollback;
