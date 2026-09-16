# Elo v1 backtest

Parameters live in `packages/core/src/elo.ts` (`ELO_PARAMS`). Backtest = mean log loss of the frozen pregame home win probability over final, non-tie games where both teams already had 20 rated games, processed chronologically from the 2000 season. Run with `npx tsx ingest/src/elo/run.ts --sport mlb --backtest-only`.

| Date | Sport | Games | Scored | Log loss | K | home_adv | Season regression | MOV |
|---|---|---|---|---|---|---|---|---|
| 2026-09-15 | MLB (2000-2026, regular + postseason) | 65,186 | 64,517 | 0.6806 | 4 | 24 | 1/3 to 1500 | no |
| 2026-09-15 | NFL (2000-2026, regular + postseason) | 7,289 | 6,619 | 0.6299 | 20 | 48 | 1/3 to 1505 | yes |

Reference points: always predicting 50% scores 0.6931. Published MLB Elo models land around 0.67-0.68 and NFL around 0.60-0.63, so v1 is in the expected range for a self-computed system with no roster or injury information. Spring training games are excluded from the run.

Chosen values are the spec defaults; no tuning yet. If tuning, sweep K in {3,4,5,6} and home_adv in {20,24,28} for MLB, K in {16,20,24} and home_adv in {40,48,55} for NFL, and record the grid here. Win probabilities are frozen per game (`game_win_prob`), so re-tuning only affects games that have not started.
