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

## MLS: three outcomes (2026-09-22)

A football match draws about a quarter of the time (24.9% of the 4,069 finals from 2018 to
2025 on local; home wins 48.1%, away wins 27.0%), so the binary model cannot fit it and MLS had
no probabilities at all. `runEloThreeWay` in `packages/core/src/elo.ts` keeps the Elo update
(a draw scores 0.5, the margin multiplier on the goal difference) and gives three pregame
probabilities through a Davidson draw term: with `d = elo_home + home_adv - elo_away` and
`r = 10^(d/400)`, P(home) = r / (r + 1 + v sqrt(r)), P(away) = 1 / (...), P(draw) =
v sqrt(r) / (...), so the draw is likeliest between equals and thins out as the sides diverge.

`npx tsx ingest/src/elo/sweep.ts --sport mls --score-from 2018` runs 720 combinations over
every match from 2016 (the first two seasons warm up), scored by mean three-way log loss over
the 3,911 finals from 2018 where both sides had 20 prior matches. Reference: the constant model
at the base rates scores 1.0518.

| K | home_adv | draw v | Regression | MOV | Three-way log loss 2018-2025 |
|---|---|---|---|---|---|
| 30 | 100 | 0.8 | 1/3 | yes | **1.0358** |
| 25 | 100 | 0.8 | 1/3 | yes | 1.0360 |
| 30 | 100 | 0.8 | 1/4 | yes | 1.0360 |
| 30 | 120 | 0.8 | 1/3 | yes | 1.0363 |
| 20 | 100 | 0.8 | 1/3 | yes | 1.0367 |
| 30 | 80 | 0.8 | 1/3 | yes | 1.0376 |
| 25 | 100 | 0.6 | 1/3 | yes | 1.0378 |
| 25 | 100 | 0.8 | 1/3 | no | 1.0380 |
| 10 | 40 | 1.2 | 1/3 | no | 1.0839 (the worst) |

Chosen: K = 30, home_adv = 100, v = 0.8, 1/3 to 1500, multiplier on. The floor is flat: any
K from 20 to 40 with a home edge of 100 to 120 and v = 0.8 lands within 0.002. The home edge
is large because MLS home sides win almost half their matches; v = 0.8 gives 27.6% draws
between equals, close to the league rate. Written to `game_win_prob` as `home_win_prob` and
`draw_prob` (method `elo_draw_v1`); a pledge on the away side carries 1 - home - draw.
