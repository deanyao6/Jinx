-- NBA and MLS superstar honors (next-wave D.1). seed/nba_awards.json carries the MVP top five
-- and the three All-NBA teams; seed/mls_awards.json the Landon Donovan MVP and its finalists,
-- the Best XI, the Golden Boot, the Rookie (from 2020 the Young Player) of the Year and the
-- MLS Cup MVP. honor_kinds names each so is_superstar and superstar_honor count them, ranked
-- so the biggest honor is the one shown. Every row is keyed by sport_id.
update public.honor_kinds set rank = 7 where sport_id = 'nba' and honor = 'roy';
update public.honor_kinds set rank = 8 where sport_id = 'nba' and honor = 'all_star';
insert into public.honor_kinds (sport_id, honor, label, rank, season_first) values
  ('nba', 'mvp_top5', 'MVP finalist', 3, false),
  ('nba', 'all_nba_1st', 'First-team All-NBA', 4, true),
  ('nba', 'all_nba_2nd', 'Second-team All-NBA', 5, true),
  ('nba', 'all_nba_3rd', 'Third-team All-NBA', 6, true),
  ('mls', 'mvp', 'MVP', 1, false),
  ('mls', 'cup_mvp', 'MLS Cup MVP', 2, false),
  ('mls', 'mvp_finalist', 'MVP finalist', 3, false),
  ('mls', 'golden_boot', 'Golden Boot', 4, false),
  ('mls', 'best_xi', 'Best XI', 5, true),
  ('mls', 'roy', 'Rookie of the Year', 6, false)
on conflict (sport_id, honor) do nothing;
