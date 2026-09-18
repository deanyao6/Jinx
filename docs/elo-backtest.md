# Elo v1 backtest

Parameters live in `packages/core/src/elo.ts` (`ELO_PARAMS`). Backtest = mean log loss of the frozen pregame home win probability over final, non-tie games where both teams already had 20 rated games, processed chronologically from the 2000 season. Run with `npx tsx ingest/src/elo/run.ts --sport mlb --backtest-only`.

| Date | Sport | Games | Scored | Log loss | K | home_adv | Season regression | MOV |
|---|---|---|---|---|---|---|---|---|
| 2026-09-15 | MLB (2000-2026, regular + postseason) | 65,186 | 64,517 | 0.6806 | 4 | 24 | 1/3 to 1500 | no |
| 2026-09-15 | NFL (2000-2026, regular + postseason) | 7,289 | 6,619 | 0.6299 | 20 | 48 | 1/3 to 1505 | yes |
| 2026-09-18 | NBA (2000-2026, regular + play-in + playoffs + Cup final) | 34,651 | 33,012 | 0.6127 | 8 | 50 | 1/3 to 1500 | yes |

Reference points: always predicting 50% scores 0.6931. Published MLB Elo models land around 0.67-0.68 and NFL around 0.60-0.63, so v1 is in the expected range for a self-computed system with no roster or injury information. Spring training games are excluded from the run.

Chosen values are the spec defaults; no tuning yet. If tuning, sweep K in {3,4,5,6} and home_adv in {20,24,28} for MLB, K in {16,20,24} and home_adv in {40,48,55} for NFL, and record the grid here. Win probabilities are frozen per game (`game_win_prob`), so re-tuning only affects games that have not started.

## NBA tuning (2026-09-18)

The brief's starting point was K = 20, home_adv = 100, regression 1/4, no margin multiplier.
`npx tsx ingest/src/elo/sweep.ts --sport nba` runs the grid below: a full chronological pass
from 2000, log loss scored over the 2016 to 2025 seasons only (12,852 final games), so the
early seasons are warm-up rather than score. The grid (K in {6, 8, 10, 12, 14, 16, 20, 24, 28},
home_adv in {30, 40, 50, 60, 70, 80, 100, 120}, regression 1/4 and 1/3, multiplier on and off)
found:

| K | home_adv | Regression | MOV | Log loss 2016-2025 |
|---|---|---|---|---|
| 8 | 50 | 1/3 | yes | **0.6242** |
| 10 | 50 | 1/3 | yes | 0.6243 |
| 8 | 40 | 1/3 | yes | 0.6245 |
| 12 | 60 | 1/3 | yes | 0.6256 |
| 12 | 100 | 1/3 | yes | 0.6342 |
| 20 | 100 | 1/4 | no | 0.6380 (the brief's starting point) |
| 28 | 120 | 1/4 | yes | 0.6627 |

So the NBA wants a small K with the margin multiplier (a 30-point win says more than a 2-point
one) and a home edge of about 50 points, which is a 57% home win rate, close to the league's
long-run figure. Chosen: K = 8, home_adv = 50, 1/3 to 1500, multiplier on. The full-history
figure in the table above (0.6127 over 33,012 games with 20 prior games each) is lower than
the 2016-2025 slice because the 2000s had more lopsided seasons.

## NBA in-game model (2026-09-18)

ESPN's per-play win probability exists from 2017-18 on, so older games draw their Relive line
from `modelHomeWp` in `packages/core/src/providers/nba/winprob.ts`: the home side's logit is
`marginScale * margin / sqrt(secondsLeft / 2880)` plus the pregame Elo logit fading linearly
with time left. `npx tsx ingest/src/nba/fit_wp.ts` labels every play state of 160 games from
November 2018 to February 2019 (75,804 states) with who won and scores the model with the
prior fixed at 0.5:

| marginScale | Log loss |
|---|---|
| 0.08 | 0.4735 |
| **0.10** | **0.4715** |
| 0.12 | 0.4768 |
| 0.14 | 0.4872 |
| 0.20 | 0.5379 |

ESPN's own line scores 0.4321 on the same states; it knows possession and the pregame line,
which this does not. Chosen: marginScale = 0.10. The line is drawn for Relive only; nothing is
scored or paid from it.
