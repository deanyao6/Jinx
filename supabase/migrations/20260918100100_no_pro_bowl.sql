-- The NFL superstar bar is MVP, the MVP top five and first-team All-Pro. Not the Pro Bowl:
-- Dean, 2026-09-18, "dont include pro bowl, only all pro teams". About 110 players a season
-- made it a list of the good, not the great. MLB All-Stars are unchanged.
delete from public.player_honors h
using public.players p
where p.id = h.player_id and p.sport_id = 'nfl' and h.honor = 'pro_bowl';

delete from public.honor_kinds where sport_id = 'nfl' and honor = 'pro_bowl';

-- Players seen reads stars live, but the famous counts in every cached payload do not depend on
-- honors; recompute anyway so nothing cached predates the change.
select public.refresh_all_user_stats();
