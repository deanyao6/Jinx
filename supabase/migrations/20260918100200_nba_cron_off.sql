-- nba-sync and nba-live cannot run from Supabase (found 2026-09-18, docs/verification.md):
-- from the Edge runtime cdn.nba.com answers 403, stats.nba.com never answers, and ESPN's
-- site API answers 403 too, while every one of them answers Node on a laptop and the GitHub
-- runner. A scheduled call that fails every 15 minutes is noise in net._http_response and
-- proves nothing, so the two rows come off. The daily GitHub job (.github/workflows/daily-jobs.yml)
-- is the NBA's path: schedule refresh, detail for logged games, rosters, Elo and Relive, once
-- a day, the way the NFL already works. The functions stay deployed for the day a route exists.
select cron.unschedule('nba-sync');
select cron.unschedule('nba-live');
