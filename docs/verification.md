# Verified external facts

Every item marked **VERIFY** in [SPEC.md](../SPEC.md) is checked here against the live source. Update this file when re-verifying. Date of last check: 2026-09-15.

## Anthropic API (SPEC 3, ticket parsing)
- Model ID for the small vision-capable model is `claude-haiku-4-5`. Do not append a date suffix. (Source: bundled Claude API skill, models table.)
- Haiku 4.5 supports structured outputs via `output_config.format` and `client.messages.parse()` with `zodOutputFormat`. Use that instead of "retry on invalid JSON" as the primary path; keep one retry as a fallback.
- Image input: `{ type: "image", source: { type: "base64", media_type: "image/png" | "image/jpeg" | ..., data } }`. PDF input: `{ type: "document", source: { type: "base64", media_type: "application/pdf", data } }`, placed before the text block. Base64 must contain no newlines.
- Errors: catch `Anthropic.RateLimitError`, `Anthropic.BadRequestError`, then `Anthropic.APIError`.
- Edge Functions import the SDK as `npm:@anthropic-ai/sdk@0.125.0` (see `supabase/functions/deno.json`). Deno's minimum-dependency-age policy refuses versions published in the last 24 hours, so bump the pin a day after a release.

## MLB Stats API (SPEC 4.2)
Base `https://statsapi.mlb.com/api/`. No key. Checked against 2024 season data.

### Schedule `v1/schedule?sportId=1&startDate=&endDate=` (or `&season=2024&gameType=R,F,D,L,W,S`)
Per game object:
- `gamePk` (int), `gameGuid`, `gameType` (`R` regular, `S` spring, `F` wild card, `D` division, `L` LCS, `W` World Series), `season` (string), `gameDate` (ISO UTC), `officialDate` (local YYYY-MM-DD).
- `status.abstractGameState` (`Preview` | `Live` | `Final`), `status.detailedState` (`Scheduled`, `Pre-Game`, `Warmup`, `In Progress`, `Final`, `Game Over`, `Completed Early`, `Postponed`, `Cancelled`, `Suspended`, `Delayed`...), `status.codedGameState`, `status.statusCode`, `status.reason` (e.g. `Rain`), `status.startTimeTBD`.
- `teams.home.team.{id,name}`, `teams.home.score`, `teams.home.isWinner`; same for `away`.
- `venue.{id,name}`; `isTie` (bool); `doubleHeader` (`N` none, `Y` traditional single-admission, `S` split); `gameNumber` (1 or 2).
- Postponements: `rescheduleDate` (ISO), `rescheduleGameDate` (YYYY-MM-DD) on the postponed row; `rescheduledFrom` (gamePk) and `rescheduledFromDate` on the makeup row. Suspended: `resumeDate`, `resumeGameDate`, `resumedFrom`, `resumedFromDate`.
- 2024 season counts: 2984 games; 2922 Final, 36 Postponed, 19 Cancelled, 7 Completed Early; 30 DH `Y` and 31 DH `S`; 41 ties (all spring training).
- Neutral sites appear with a normal home team but a non-home venue (Gocheok Sky Dome 5150, London Stadium 5381, Rickwood Field). Treat venue not equal to home team's home venue as neutral for Elo home advantage.

### Game feed `v1.1/game/{gamePk}/feed/live`
- `gameData.datetime.dateTime` (ISO UTC), `gameData.datetime.officialDate`.
- `gameData.status` (same shape as schedule).
- `gameData.venue.{id,name,location.defaultCoordinates.{latitude,longitude},timeZone.id}`.
- `gameData.weather.{condition,temp,wind}` where `temp` is a string of degrees F (e.g. `"81"`). Absent for some games.
- `gameData.gameInfo.{attendance,firstPitch,gameDurationMinutes}`.
- `liveData.linescore.{currentInning,inningState,inningHalf,isTopInning,scheduledInnings,innings[],teams.home.runs,teams.away.runs,outs}`. `inningState` is `Top` | `Middle` | `Bottom` | `End`. `innings[]` has `num`, `home.runs`, `away.runs`, `home.hits`, `away.hits`.
- `liveData.boxscore.teams.{home,away}.players` is a map `ID{personId}` -> `{person.{id,fullName}, position, stats.{batting,pitching,fielding}, gameStatus, allPositions?, battingOrder?}`. Also `batters[]`, `pitchers[]`, `bench[]`, `bullpen[]`, `battingOrder[]` arrays of person IDs. **Appeared** = person ID in `batters` or `pitchers` (those arrays list only players who took part; `bench` and `bullpen` are non-participants). Cross-checked on 746419: 16 batters + 4 pitchers of 28 rostered.
- `liveData.plays.allPlays[]` each with `about.{atBatIndex,halfInning ('top'|'bottom'),inning,startTime,endTime,isComplete,isScoringPlay}`, `result.{type,event,eventType,description,rbi,awayScore,homeScore,isOut}`, `count.outs`, `runners[]`, `playEvents[]`, `playEndTime`. `liveData.plays.scoringPlays[]` is a list of atBatIndex values. `liveData.plays.playsByInning[]`.
- Event types seen: `field_out`, `single`, `double`, `triple`, `home_run`, `walk`, `strikeout`, `sac_fly`, `grounded_into_double_play`, etc. Home runs carry `result.eventType === 'home_run'`; grand slam = home run with `rbi === 4`.
- `liveData.decisions.{winner,loser,save}` with `person` refs.
- Timestamps are present on every play for modern games (2024 checked). Older seasons (pre-2008 roughly) may lack `startTime`; the parser treats missing timestamps as "unreliable" so pledges stay valid (SPEC 6.5.3).

### Teams and venues
- `v1/teams?sportId=1&season=YYYY` returns 30 teams with `id`, `name`, `abbreviation`, `teamName`, `locationName`, `franchiseName`, `clubName`, `shortName`, `venue.{id,name}`, `league`, `division`, `firstYearOfPlay`, `active`. Team IDs are stable across relocations and renames (Expos 120 -> Nationals 120; Florida Marlins 146 -> Miami Marlins 146), so MLB `id` serves as `franchise_id`.
- `v1/venues?sportId=1&season=YYYY&hydrate=location,timezone` returns venues with `location.defaultCoordinates` and `timeZone.id`. 62 venues for 2024 including spring and neutral sites.
- License: personal, non-commercial use per MLB terms; commercial use requires MLBAM permission. OK for TestFlight development; revisit before public launch.

## nflverse (SPEC 4.3)
All release assets at `https://github.com/nflverse/nflverse-data/releases/download/{tag}/{file}`. Repository license is **CC-BY-4.0** (attribution required; fine for public use with attribution).

- **Schedules**: tag `schedules`, file `games.csv` (single file, all seasons from 1999). Columns: `game_id` (e.g. `2024_01_BAL_KC`), `season`, `game_type` (`REG`, `WC`, `DIV`, `CON`, `SB`, and `PRE` absent), `week`, `gameday` (YYYY-MM-DD), `weekday`, `gametime` (HH:MM Eastern, may be empty for old seasons), `away_team`, `away_score`, `home_team`, `home_score`, `location` (`Home` | `Neutral`), `result` (home minus away), `total`, `overtime` (0/1), `old_game_id`, `gsis`, `espn`, `pfr`, `roof` (`outdoors`,`dome`,`closed`,`open`), `surface`, `temp` (F, empty for domes), `wind`, `stadium_id`, `stadium`, plus betting lines (ignored). Scores are empty for unplayed games. 2024 season: 285 games (272 regular + 13 postseason). No preseason games in nflverse.
- games.csv `gametime` quirk: 2000-2005 seasons list the weekly primetime game as `09:00` (12-hour clock for 9 PM ET). The core parser maps `09:00` to `21:00` for seasons up to 2005.
- **Play-by-play**: tag `pbp`, file `play_by_play_{season}.parquet` (~20 MB per season, 372 columns). Relevant columns: `game_id`, `play_id`, `order_sequence`, `qtr` (1..5, 5 = OT), `time` (game clock `MM:SS`), `quarter_seconds_remaining`, `game_seconds_remaining`, `game_half`, `time_of_day` (**ISO 8601 UTC string with `Z`, e.g. `2024-09-06T00:44:42.100Z`**; null on ~3% of rows, mostly `GAME`/`END QUARTER`/`END GAME` marker rows), `start_time` (local kickoff text, avoid), `desc`, `sp` (1 = scoring play), `play_type` (`kickoff`,`run`,`pass`,`punt`,`field_goal`,`extra_point`,`no_play`,`qb_kneel`,`qb_spike`), `total_home_score`, `total_away_score` (score **after** the play), `td_team`, `touchdown`, `pass_touchdown`, `rush_touchdown`, `return_touchdown`, `return_team`, `interception`, `fumble`, `fumble_lost`, `safety`, `field_goal_result` (`made`|`missed`|`blocked`), `kick_distance`, `punt_attempt`, `kickoff_attempt`, `extra_point_attempt`, `two_point_attempt`, `home_team`, `away_team`, `home_score`, `away_score` (final), `result`, `season_type`, `week`, `game_date`, `stadium`, `weather`, `temp`, `roof`.
  - Also used by the parser: `posteam` / `defteam` (team abbreviations; verified on 2024 data: on kickoffs `posteam` is the **receiving** team, on punts it is the **punting** team; null on `GAME`/`END QUARTER`/`END GAME` marker rows) and `return_team` (the returning team on kicks). A muffed punt recovered in the end zone by the kicking team carries `punt_attempt == 1`, `fumble == 1` and `return_touchdown == 1`, so the kick-return-TD rule below must exclude `fumble == 1`.
  - Pick-six = `interception == 1 && return_touchdown == 1`; fumble return TD = `fumble == 1 && return_touchdown == 1 && interception == 0`; kick/punt return TD = `(kickoff_attempt == 1 || punt_attempt == 1) && return_touchdown == 1`.
  - Regular season pbp is published nightly during the season (nflverse automation runs several times daily on game days).
  - `time_of_day` availability by season is unknown before 2011; the ingest job records the null ratio per game and marks a game's timeline `unreliable` when scoring plays lack timestamps.
- **Appearances**: tag `snap_counts`, file `snap_counts_{season}.parquet` (2012+): `game_id`, `pfr_game_id`, `player`, `pfr_player_id`, `position`, `team`, `opponent`, `offense_snaps`, `defense_snaps`, `st_snaps`. Appeared = any of the three snaps > 0. Note the player key is `pfr_player_id`, mapped to `gsis_id` via tag `players` file `players.parquet` (`gsis_id`, `pfr_id`, `display_name`, `position`). For 2000-2011, fall back to tag `stats_player` file `stats_player_week_{season}.parquet` (weekly stat lines, keyed by `player_id` = gsis id) and tag `weekly_rosters` file `roster_weekly_{season}.parquet` (2002+, `gsis_id`, `full_name`, `team`, `week`, `status`), treating a stat line as an appearance.
- **Players**: tag `players`, `players.parquet`: `gsis_id`, `display_name`, `position`, `pfr_id`, `esb_id`, `latest_team`.
- **Verified 2026-09-15 while building `ingest/src/nfl` (TypeScript pipeline; every asset is also published as `.csv.gz`, which is what the pipeline uses):**
  - GitHub release downloads redirect to `objects.githubusercontent.com` and return an `ETag`, so `If-None-Match` caching works (304 on unchanged assets).
  - `time_of_day` in pbp: absent for 2000, a bare `HH:MM:SS` clock with no date/timezone for 2001-2002 (about 78% of rows), ISO 8601 UTC from 2003 on. The pipeline keeps only ISO values; bare clocks become null, so 2000-2002 timelines are all `unreliable` and 2003-2020 are partly reliable (131-245 of 267 games per season), 2021+ fully reliable.
  - `snap_counts_2012` exists in every format but is a header-only stub (csv.gz 103 bytes, csv 154 bytes, parquet 4.5 KB). Usable snap counts start in **2013**; 2012 uses the weekly-stats fallback.
  - `stats_player_week_{season}.csv.gz` exists for every season 2000+ and already carries `game_id`, `team`, `opponent_team`, `season_type`, `week` (`player_id` = gsis id). `team`/`opponent_team` use the **current** franchise abbreviation even historically (LV, LA, LAC for the 2005 Raiders, Rams, Chargers) while `games.csv` keeps OAK, STL, SD; resolve through the game's home/away pair.
  - `games.csv` team abbreviations for 2000+ are exactly the 35 in the seed (ARI ATL BAL BUF CAR CHI CIN CLE DAL DEN DET GB HOU IND JAX KC LA LAC LV MIA MIN NE NO NYG NYJ OAK PHI PIT SD SEA SF STL TB TEN WAS) and all 65 `stadium_id` values resolve via `provider_ids.nflverse_stadium_ids`; no row 2000+ has an empty `stadium_id`.
  - `games.csv` `gametime` quirk: 2000-2005 list 17 games per season at `09:00` (one per week: Monday/Thursday night games), i.e. 9 PM Eastern written on a 12-hour clock. The parser currently treats them as 09:00 ET, so those ~102 kickoffs are 12 hours early; `final_at` from pbp is correct (e.g. 2005_01_OAK_NE ends 04:32 UTC).
  - No preseason and no cancelled games (2022 has 284 games: the BUF-CIN game is absent). Postseason weeks are numbered continuously (2005: WC 18, DIV 19, CON 20, SB 21).

## Tooling on this machine
- Node 25.9, npm 11.12, Supabase CLI 2.117 via npx, Docker 28.3 running, Deno 2.9.6 (installed 2026-09-15 via Homebrew), Python 3 with pandas 2.3.3 and pyarrow 20, EAS CLI present.
- Expo SDK 57 (React Native 0.86, React 19.2, TypeScript 6.0).
- No full Xcode installed (Command Line Tools only), so the iOS simulator is unavailable here. Simulator and device checks need Xcode from the App Store.

## MLB per-play win probability (SPEC 4.3b) — VERIFIED 2026-09-16

`GET https://statsapi.mlb.com/api/v1/game/{gamePk}/winProbability` returns one entry per
plate appearance. Checked against gamePk 823191 (Tigers at Giants, 2026-08-08, final 5–2):
74 entries, 896 KB.

Per entry:
- `homeTeamWinProbability` and `awayTeamWinProbability` are **percentages**, not fractions
  (42.4, not 0.424). `game_wp_timeline.home_wp` is `numeric(6,5)` between 0 and 1, so divide
  by 100 on the way in.
- `about.inning` (integer), `about.halfInning` (`'top'` | `'bottom'`), `about.startTime` (ISO)
  map to `period`, `half` and `occurred_at`.
- `result.rbi > 0` identifies the scoring plays. For 823191 that is exactly 5, matching the
  5 rows already in `game_scoring_timeline`.
- The series ends at `100.0` for the winner, so the final point needs no special case.
- **Each entry is the full play object** from `liveData.plays.allPlays`, plus the probability
  fields (checked 2026-09-17 on gamePk 775300: keys `result`, `about`, `count`, `matchup`,
  `runners`, `playEvents`, `credits`, `flags`, `playEndTime`, `atBatIndex`, and the four
  probability fields). So `result.eventType`, `matchup.batter.{id,fullName}` and `runners[]`
  are there, and a Relive step names its scorer by the same rule as the timeline
  (`packages/core/src/scoring.ts`). The repo's `winprob_*.json` fixtures are trimmed to
  `about`, `result` and `homeTeamWinProbability`, so they carry no batter.
- A run that comes home mid-plate-appearance (wild pitch, passed ball, balk, steal of home)
  is not in `result`: it is the runner in `runners[]` with `details.isScoringEvent = true`
  and `movement.end = 'score'`, whose `details.eventType` names the event (`wild_pitch`,
  `passed_ball`, ...). Fixtures 745164 (Carpenter strikeout, Burleson scores on a wild pitch)
  and 745844 (Canha walk, Urshela scores on a wild pitch) show it.

This settles the open question in SPEC 4.3b for MLB: **no state-based model is needed.** The
spec's fallback ("build a state-based model, or scoring-play-only steps with no line") applies
only if this endpoint is unavailable for a given game, which should be treated as a missing
timeline rather than a reason to estimate one.

NFL keeps using nflverse's own per-play `home_wp` column, as recorded above.

## NFL per-play win probability (SPEC 4.3b) — VERIFIED 2026-09-16

`play_by_play_{season}.csv.gz` (nflverse `pbp` release) carries win probability inline, so
NFL needs no extra download. Checked against `2025_13_CHI_PHI` (Bears at Eagles, Lincoln
Financial Field, 2025-11-28, final 24–15): 181 plays.

Per play:
- `home_wp` is the home team's probability as a **fraction** (0.537572950124741), unlike the
  MLB feed's percentages. It goes into `game_wp_timeline.home_wp` unscaled.
- `def_wp`, `away_wp`, `home_wp_post`, `vegas_home_wp` are also present. `home_wp` is the
  one used, because it is the pre-snap state and matches the MLB series' meaning.
- `sp = 1` marks a scoring play. For 2025_13_CHI_PHI that is 10 plays, and each carries the
  post-play score in `total_home_score` / `total_away_score`, so scores are read rather than
  accumulated.
- `desc` is the play description ("(1:35) (Shotgun) 4-D.Swift right guard for 3 yards,
  TOUCHDOWN.") and is what a story step shows, verbatim. No text is generated.
- An extra point is its own scoring play, so a touchdown and the kick after it are two
  steps. That matches what the scoreboard did and is left alone.
- `qtr` is 1–4 with 5+ for overtime; marker rows (END QUARTER, timeouts) have an empty
  `home_wp` and are dropped rather than interpolated.

`ingest/src/nfl/relive.ts` writes both tables from this. The column had to be added to
`toPbpRow` and `NflversePbpRow`: the parser read ~40 pbp columns and `home_wp` was not one
of them, which is why NFL games had no Relive story at all.

## Venue shapes (SPEC 8.5) — corrected 2026-09-16

`venue_shapes` shipped **empty**: no migration, seed or ingest ever wrote a row. Every
lookup missed and fell through to a hardcoded `'ballparkA'`, so all 224 venues — Lincoln
Financial Field, Soldier Field, SoFi — drew the reference's baseball diamond.

`seed/scripts/build_seed_sql.py` now assigns one of the reference's seven shapes per venue
and `supabase/seed.sql` carries the 224 rows. The rule is sport first (a venue that has ever
hosted MLB gets a ballpark shape, an NFL-only venue gets a football one), then a named list
for the distinctive ones. The seven the reference itself draws all agree: Citizens Bank
`ballparkA`, Fenway `wrigley`, Oracle `oracle`, Dodger `dodger`, Lincoln Financial `bowl`,
MetLife `bowl`, SoFi `canopy`, Soldier Field `colonnade`.

These remain stylized placeholders, not traced footprints; `source` is `'placeholder'` and
SPEC 8.5's OSM tracing pass still applies.

## Scoring-play attribution (SPEC 6.7) — added 2026-09-16

"Players seen" names who did something and counts the rest, which needs a per-game source of
"this person scored". One source did not cover both sports:

- **MLB**: `game_events` already carries the batter on a `home_run`, and every one of Dean's
  five MLB games has them (Ohtani, Devers, Marsh…). The win-probability feed's scoring
  entries carry only prose — "Rafael Devers homers (24) on a fly ball to center field" — with
  no player id anywhere on the entry, so nothing is parsed out of it.
- **NFL**: `game_events` holds only the RARE moments, and an ordinary touchdown is not one.
  Before this, **8,406 of 8,597 `game_events` rows had a null player, and every one of them
  was NFL** — `playEvent` in `providers/nfl/moments.ts` hardcoded `providerPlayerId: null`.

Two changes:

1. `NflPlay` now carries `scorerProviderId` / `scorerName`, from the pbp's `td_player_id`
   falling back to `kicker_player_id`. `td_player_id` is set for rushing, receiving, pick
   six, fumble return and kick return touchdowns alike, so one column covers every case.
   The four moment types that belong to one player (`pick_six`, `fumble_return_td`,
   `kick_return_td`, `long_field_goal`) are attributed; `safety`, `overtime` and
   `comeback_14` stay unattributed, because they are the team's and not a person's.
2. `game_story_steps` gained `scorer_player_id` / `scorer_name` (migration
   `20260916000200`). Every NFL scoring play fills them; MLB leaves them null.

The ids are gsis ids, the same key `game_appearances` uses, so a scorer resolves to the same
`players` row as the lineup. Verified on 2025_13_CHI_PHI: 10 of 12 story steps carry a
scorer and all 10 resolved — Swift, Santos, Elliott, Brown, Monangai, Kmet.

Existing `game_events` rows are NOT backfilled. Attribution applies as games are ingested;
re-running `ingest/src/nfl/run.ts` for a season rewrites that season's moments with players.

## Storylines against ground truth (SPEC 6.18) — VERIFIED 2026-09-17

Run on the hosted project with `claude-haiku-4-5`, then every stored sentence read against the
`games` table. "Accepted by the validator" was not treated as "correct": the validator checks that
each number exists in the facts, not which field it came from, so the output was checked by hand.

Games: 2025 World Series Game 7 (Dodgers at Blue Jays, series 3-3) and Phillies at Mets on
2026-09-17 and 2026-09-18.

Final output, all five correct:

| Game | Storyline | Checked against |
|---|---|---|
| WS G7 | Dodgers and Blue Jays are tied 3-3 in their postseason series. | Six prior postseason finals between them |
| WS G7 | Blue Jays are 54-27 at home this season as they host the Dodgers, whom they lost to 1-3 most recently. | 81 regular-season home games |
| WS G7 | Dodgers visit Toronto riding 8 wins in last 10 games, having won 2 of 3 meetings this season. | The three August 2025 games: won 5-1, won 9-1, lost 4-5 |
| PHI at NYM | Mets host Phillies after winning 6-1 in their last meeting, but sit on a 4-game losing streak at home where they are 34-43. | Streak -4, home 34-43 |
| PHI at NYM | Phillies visit Mets after losing 6-1 in their last meeting. | Last meeting 1-6 |

What the first runs got wrong, and where each was fixed:

- **Records included the postseason** (`facts.ts`). "105-73 record" for the 2025 Dodgers was 93-69
  plus 12-4. Every digit was a real fact, so validation could not catch it.
- **Nine MLB teams could not be named** (`validate.ts`). Their `city` is not the start of their
  name: Mets/Flushing, Yankees/Bronx, Rays/St. Petersburg, Rangers/Arlington, Angels/Anaheim,
  Twins/Minneapolis, Rockies/Denver, D-backs/Phoenix, Athletics/Sacramento. Fixed by passing
  `teams.nickname` rather than deriving it.
- **"Last 10" was rejected for stating 10.** `lastTen` implies it.
- **"A 1-game winning streak."** A streak is only a fact at two or more.

Known soft spots, deliberately left: the validator guarantees numbers, team names, invented proper
nouns and a list of unsupportable claims (clinch, standings, injuries, history, "first time"). It
does not judge implication or tone. "Looking to bounce back" was written for a team that had won
its last game, because it lost its last meeting with this opponent; true, and slightly misleading.
Score order is asked for in the prompt ("6-1", not "1-6") but not enforced.

## Supabase new key format breaks internal auth — FOUND 2026-09-17

This project was created with Supabase's new API key format. The Edge Function runtime injects
`SUPABASE_SERVICE_ROLE_KEY` in that format, so it never string-equals the legacy JWT that
`call_edge_function` sends from vault. `authorizeInternal` in `_shared/db.ts` therefore refused
**every** internal call: `evaluate-goals`, `send-push`, `mlb-sync`, `cleanup-imports`, and
`storylines`. It had not surfaced only because nothing was deployed or scheduled.

`CRON_SECRET` is the fix that does not depend on key format, and `authorizeInternal` already
accepted it. It is now set on the hosted project. Two things follow:

1. The Supabase **gateway** still requires a valid JWT before a request reaches the function, so a
   caller sends both: `Authorization: Bearer <legacy service role JWT>` for the gateway and
   `x-cron-secret: <CRON_SECRET>` for the function. The secret alone gets
   `UNAUTHORIZED_NO_AUTH_HEADER`.
2. `call_edge_function` in `20260915000300_cron.sql` sends only the bearer token. Before any cron
   job is scheduled on the hosted project it needs to send `x-cron-secret` too, read from vault
   like the key. Not done yet.

## Official highlights have a per-game page in both leagues (SPEC 6.19) — VERIFIED 2026-09-17

Relive's highlights row opened `https://www.mlb.com/video` for every game, NFL games included,
because "guessing a per-game deep link would 404". It does not have to guess. Requested with curl,
following redirects:

| URL | Result |
|---|---|
| `https://www.mlb.com/gameday/823191/final/video` | 200, lands on `/gameday/tigers-vs-giants/2026/08/07/823191/final/video` |
| `https://www.mlb.com/gameday/718780/final/video` | 200 |
| `https://www.mlb.com/gameday/999999999/final/video` | **404** |
| `https://www.nfl.com/games/bears-at-eagles-2025-reg-13` | 200 |
| `https://www.nfl.com/games/chiefs-at-eagles-2024-post-4` | 200 (Super Bowl LIX; nflverse week 22) |
| `https://www.nfl.com/games/nobody-at-eagles-2025-reg-13` | **404** |

The 404s matter as much as the 200s: they show these are pages about one game and not a catch-all
that answers anything. MLB needs only the gamePk. NFL needs both nicknames, the season, and the
week, which is the second field of the nflverse id (`2025_13_CHI_PHI`). Playoff weeks restart at
`post-1`: nflverse week minus 18 since the season grew to 18 weeks in 2021, minus 17 before.
`packages/core/src/highlights.ts` falls back to the league hub when any piece is missing, and for
preseason, which was not checked.

nfl.com files a game under the name the team had that season, and `teams.nickname` is today's
name. Washington is the only franchise whose nickname changed since 2000, and it changed twice:

| URL | Result |
|---|---|
| `https://www.nfl.com/games/commanders-at-eagles-2019-reg-1` | **404** |
| `https://www.nfl.com/games/redskins-at-eagles-2019-reg-1` | 200 |
| `https://www.nfl.com/games/football-team-at-eagles-2020-reg-17` | 200 |
| `https://www.nfl.com/games/washington-at-eagles-2020-reg-17` | **404** |

`nflNicknameInSeason` maps it: Redskins through 2019, Football Team for 2020 and 2021.

Not checked: seasons before 2016, which the hosted project does not hold, and preseason.

## Relive dropped runs that carried no RBI — FOUND AND FIXED 2026-09-17

`buildStorySteps` kept a plate appearance as a scoring step only when `result.rbi` was non-zero.
A run that comes home on a double play, an error, a wild pitch or a balk has no RBI. Braves at
Nationals, 2023-03-30 (gamePk 718780), final 7-2: the run on a 4th-inning double play and the run
on a 9th-inning throwing error were both missing, so the story read 3-1, then 4-2, and ended at
6-2.

It was found the way docs/verification.md says to look: the generated story was read against the
box score, not just accepted because it was written without an error. Steps are now keyed on the
score changing between entries. `ingest/src/verify/relive.ts` compares a story with the scoring
plays in the game feed, a different endpoint from the one the story is built from, and that game
is one of its ten. Stories built before the fix are wrong in the same way until
`npx tsx ingest/src/mlb/relive.ts --rebuild` is run against the database that holds them.

## Venue elevations (highest altitude superlative) — FETCHED 2026-09-17

`venues.elevation_ft` is filled by `seed/scripts/fill_elevations.py` into
`seed/venue_elevations.json`, never from memory:

| Where | Source | Call |
|---|---|---|
| USA, Puerto Rico | USGS Elevation Point Query Service (3DEP), free, no key | `https://epqs.nationalmap.gov/v1/json?x=<lng>&y=<lat>&units=Feet&wkid=4326`, field `value` |
| Everywhere else | Open-Elevation (SRTM), free, no key, metres x 3.280839895 | `https://api.open-elevation.com/api/v1/lookup?locations=<lat>,<lng>`, field `results[0].elevation` |

182 of 224 venues resolved (164 USGS, 18 Open-Elevation). The other 42 have no coordinates in the
seed, all spring training, minor league and one-off international parks, so they have no
elevation and can never be a "highest altitude" row. Two of those would matter if anyone logs a
game there: Security Service Field in Colorado Springs and the El Paso park.

Read against well-known values: Coors Field 5,180 ft, Empower Field at Mile High 5,195, Mile High
Stadium 5,210, Chase Field 1,085, State Farm Stadium 1,079, Truist Park 965, Oracle Park 13,
Fenway Park 8, Estadio Banorte (Mexico City) 7,503. Coors reads a little under the 5,200 usually
quoted because the point is the ground at the seeded coordinates, not the purple row of seats at
5,280. The Oakland Coliseum reads -17, which is right: its field is below sea level.

The superlative only appears from 1,000 ft, so of current big league homes it can name Denver,
Phoenix and Glendale; Atlanta's 965 ft is just under on purpose.

The script is resumable and rewrites the file after every answer. Its first run lost 181 answers
to a rebound dict and the file was rebuilt from that run's own log of fetched values, not from a
second guess; a rerun now fetches nothing.

## Current rosters (favourite-player picker) — VERIFIED 2026-09-17

`team_rosters` (migration `20260917000900`) holds each team's current roster; `team_roster` reads
the latest season present for the team and adds anyone the caller has seen appear for it. Both
sources checked live on 2026-09-17, one real response snapshotted per sport, and the loaded
Phillies (both) compared row for row against a fresh fetch afterwards: 34 of 34 and 77 of 77
matched on id, position, jersey and status.

### MLB `v1/teams/{teamId}/roster?rosterType=40Man`
- No season parameter needed; it is today's roster. `rosterType=active` gives the 26 (28 from
  September 1: 840 rows across 30 teams), `40Man` gives those plus the injured lists and players
  optioned to the minors (1,120 rows, 39 to 56 per team).
- Per entry: `person.{id,fullName,link}`, `jerseyNumber` (string; empty for 32 of 1,120,
  mostly new arrivals), `position.{code,name,type,abbreviation}` (abbreviation is `P`, `C`,
  `1B`, `2B`, `3B`, `SS`, `LF`, `CF`, `RF`, `DH`), `status.{code,description}`,
  `parentTeamId`, and `note` on 246 rows (an injury description).
- Status codes seen across all 30 teams: `A` Active 840, `RM` Reassigned to Minors 260,
  `D60` 172, `D15` 52, `D10` 40, `D7` 1, `NYR` Not Yet Reported 1. The parser keeps `A` and
  `D\d+` (a fan wants to follow a star on the 60-day IL) and drops `RM` and `NYR`, which gave
  1,105 rows for 2026.
- Fixture: `ingest/fixtures/mlb/roster_143_PHI_40man_2026-09-17.json` (45 rows: 28 A, 5 D60,
  1 D15, 10 RM, 1 NYR).
- Ingest: `npx tsx ingest/src/mlb/rosters.ts`, one request per active team through `MlbClient`
  (250 ms apart), daily in `daily-jobs.yml` after the schedule refresh.

### nflverse tag `weekly_rosters`, file `roster_weekly_{season}.csv.gz`
- One row per player per week. Columns: `season, team, position, depth_chart_position,
  jersey_number, status, full_name, first_name, last_name, birth_date, height, weight,
  college, gsis_id, espn_id, sportradar_id, yahoo_id, rotowire_id, pff_id, pfr_id,
  fantasy_data_id, sleeper_id, years_exp, headshot_url, ngs_position, week, game_type,
  status_description_abbr, football_name, esb_id, gsis_it_id, smart_id, entry_year,
  rookie_year, draft_club, draft_number`.
- `team` is the current franchise abbreviation (LV, LA, LAC), i.e. exactly
  `teams.provider_team_id` for the 32 active teams. `gsis_id` is the same id the appearance
  pipeline keys `players` by; 2 of 5,484 rows in 2026 have none (one practice-squad player).
- The 2026 file had weeks 1 and 2 (REG) on 2026-09-17, so the file is updated during the week
  after a game weekend. The 2025 file runs through week 22 (SB), so the previous season's last
  week is a sensible roster until the new file appears; the script falls back to it on a 404.
- `status` vocabulary (2025 full season): `ACT` 27,377, `DEV` practice squad 8,783, `RES`
  reserve/IR 5,763, `INA` inactive 3,593, `CUT` 951, `RET` 361, `EXE` exempt 7, `TRD` 7,
  `TRC` 7. The parser keeps `ACT`, `INA`, `RES`, `DEV`, `EXE` (under contract with the team)
  and drops `CUT`, `RET`, `TRD`, `TRC`. Week 2 of 2026: 2,521 rows, 2,481 kept, 71 to 85 per
  team. No player appears twice in a week.
- The `rosters` tag (`roster_{season}.csv.gz`) is the same shape with one row per player for
  the season (2,978 rows for 2026); the weekly file is the one that says who is on the team
  this week.
- Fixture: `ingest/fixtures/nfl/roster_weekly_2026_PHI_sample.json` (174 rows: every Eagles
  row for weeks 1 and 2, five Raiders week-2 rows, and the two rows without a gsis id).
- Ingest: `npx tsx ingest/src/nfl/rosters.ts`, daily in `nfl-ingest.yml` after the detail
  pass, through the same ETag cache as the other assets.

## NBA data sources — VERIFIED 2026-09-17 (before any NBA code exists)

Checked with live fetches from Node 22 (`fetch`), the same runtime the ingest scripts use.
Fixtures in `ingest/fixtures/nba/`, each named with the date fetched.

- **curl is blocked, Node is not.** `cdn.nba.com` sits behind Akamai and answers `403 Access
  Denied` to curl with any headers; `stats.nba.com` hangs curl for 30 s. Both answer Node's
  `fetch` at once with these headers: a desktop browser `User-Agent`, `Accept: application/json,
  text/plain, */*`, `Referer: https://www.nba.com/`, `Origin: https://www.nba.com`; stats.nba.com
  also wants `x-nba-stats-origin: stats` and `x-nba-stats-token: true`. No cookies, no tokens.
  This is the plain header set nba.com's own pages send; nothing is impersonated. Do not probe
  these hosts with curl and conclude they are down.
- **CDN schedule** `https://cdn.nba.com/static/json/staticData/scheduleLeagueV2_1.json`: the
  CURRENT season only (`leagueSchedule.seasonYear` was `2026-27` on 2026-09-17: 174 dates,
  1,274 games: 67 preseason `001`, 1,206 regular `002`, 1 `006`). Per game: `gameId`,
  `gameDateTimeUTC` (ISO, UTC), `gameStatusText`, `arenaName`, `arenaCity`, `arenaState`,
  `homeTeam`/`awayTeam` with `teamId` (e.g. DET 1610612765), `teamTricode`, `score`,
  `weekNumber`, `gameLabel`, `gameSubLabel`. 4.7 MB; the fixture keeps two dates.
- **CDN live data**, per game id: `.../liveData/boxscore/boxscore_{gameId}.json` (arena,
  `attendance`, `duration` in minutes, each team's `players[]` with `personId`, `name`,
  `position`, `jerseyNum`, `starter`, `played`, and a `statistics` object with points, rebounds,
  assists, minutes and the rest) and `.../liveData/playbyplay/playbyplay_{gameId}.json`
  (`game.actions[]`: `actionNumber`, `period`, `clock` as ISO duration `PT11M43.00S`,
  `timeActual` wall clock in UTC, `actionType` in {period, jumpball, 3pt, 2pt, freethrow,
  rebound, turnover, steal, block, foul, timeout, substitution, game}, `subType`, `personId`,
  `teamTricode`, `scoreHome`, `scoreAway`, `shotResult`, `isFieldGoal`, `description`).
  Present for 2024-25 (538 actions for 0022400001, BOS 116 ATL 117, attendance 19,156,
  133 minutes); `403` for 2016-17, so it covers recent seasons only. `todaysScoreboard_00.json`
  is the live scoreboard (period, clock, scores).
- **stats.nba.com history** (all answered in 0.2 to 1.3 s; six sequential calls in 1.5 s):
  `leaguegamelog?Counter=0&Direction=ASC&LeagueID=00&PlayerOrTeam=T&Season=2016-17&SeasonType=Regular%20Season&Sorter=DATE`
  gives one row per team per game (2,460 rows for 2016-17, 2,378 for 2000-01; `SeasonType=Playoffs`
  gives 164 for 2023-24) with `GAME_ID`, `GAME_DATE`, `MATCHUP` ("LAC @ UTA"), `WL`, `PTS` and
  box totals: the schedule-and-finals source for every season since 2000. Note there is no
  start time in it; use the CDN for the current season's times and, for history, the date
  (times for old games are not needed by anything in the app).
  `playbyplayv3?GameID=...&StartPeriod=0&EndPeriod=14` works back to 2000 (454 actions for
  0020000001) with `clock`, `period`, `personId`, `playerName`, `scoreHome`, `scoreAway`,
  `isFieldGoal`, `shotResult`, `description`, but NO wall-clock time (only the CDN has
  `timeActual`). `boxscoretraditionalv3?GameID=...&StartPeriod=0&EndPeriod=14&StartRange=0&EndRange=0&RangeType=0`
  works back to 2000 (`boxScoreTraditional.homeTeam.players`, 13 rows for 0021600001).
  `commonteamroster?TeamID=1610612755&Season=2025-26` gives the roster (17 rows: `PLAYER`,
  `NUM`, `POSITION`, `PLAYER_ID`, `EXP`, `HOW_ACQUIRED`).
  **`winprobabilitypbp` is dead**: `500` for every `RunType` tried.
- **ESPN site API** (no headers needed): `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=YYYYMMDD`
  (events with venue, attendance, scores, `STATUS_FINAL`) and `.../summary?event={id}`
  (`boxscore`, `gameInfo` with venue and attendance, `plays[]` with `scoringPlay`, `scoreValue`,
  `awayScore`/`homeScore`, `period`, `clock`, `participants`, and `winprobability[]` of
  `{homeWinPercentage, playId}` per play: 439 points for 401705733 on 2025-04-10, EMPTY for the
  2016 game 400899375). ESPN ids differ from NBA ids; match by date and teams.
- **Game ids**: `00` + type + season start year two digits + sequence. Types seen: `001`
  preseason, `002` regular season, `006` (one game, unidentified; VERIFY, likely the in-season
  tournament final or an exhibition). Playoff ids are `004` in the game log (VERIFY by reading
  the 2023-24 playoff rows in the fixture pattern).
- **Licensing**: unofficial, undocumented feeds, same posture as the MLB Stats API (SPEC 4.2):
  hobby and TestFlight use now, revisit before any public launch. ESPN's terms likewise.

### NBA: the VERIFY items resolved while building (2026-09-18)

All with real fetches from Node, fixtures under `ingest/fixtures/nba/` where the shape matters.

- **SeasonType strings** for `leaguegamelog`: `Regular Season`, `Playoffs`, `PlayIn`, `IST`,
  `Pre Season`, `All Star`. Any other spelling (`Play In`, `Play-In`, `In-Season Tournament`)
  is a 400. `PlayIn` gives ids `005` (12 rows = 6 games in 2023-24 and 2024-25). `IST` gives
  the tournament's group games (already `002`, in Regular Season) plus the one `006` row pair,
  the Cup final (2023-12-09 for 2023-24), which is the only row taken from it.
- **Game type `006` is the in-season tournament final**: the CDN schedule labels
  `0062600001` "Emirates NBA Cup / Championship" at Hinkle Fieldhouse, Indianapolis, with
  `isNeutral: true`. It does not count in the standings; the app stores it as `regular` and
  neutral. Playoff ids are `004` (164 rows = 82 games in 2023-24, 168 = 84 in 2024-25).
- **Team ids and identities** from the game log itself, one row per (id, abbreviation, name)
  across every regular season 2000-01 to 2025-26: the NBA keeps one team id across a move
  or rename, so `1610612760` is SEA 2000-2007 then OKC; `1610612751` NJN 2000-2011 then BKN;
  `1610612763` VAN 2000 then MEM; `1610612740` NOH 2002-2012 (NOK "New Orleans/Oklahoma City
  Hornets" 2005-2006 on the same id) then NOP; `1610612766` CHH 2000-2001, CHA "Charlotte
  Bobcats" 2004-2013, CHA "Charlotte Hornets" 2014 on; `1610612746` "Los Angeles Clippers"
  to 2014 then "LA Clippers". Lakers are 1610612747. `commonteamyears` lists the 30 current
  ids with MIN_YEAR/MAX_YEAR and 15 defunct pre-1955 ids with no abbreviation.
  `packages/core/src/providers/nba/ids.ts` (`NBA_TEAM_ERAS`) holds the eras; a test checks
  them against `seed/nba_teams.json`.
- **Neutral-site games print `@` on both game-log rows** (Mexico City 2024-11-02 WAS-MIA,
  Paris 2025-01-23 and 01-25 IND-SAS, the Cup semifinals in Las Vegas 2024-12-14). The parser
  flags them and ESPN's `homeAway` decides the designated home side; they are stored neutral.
- **The game log has no venue, no start time.** ESPN's scoreboard accepts a whole month:
  `scoreboard?dates=YYYYMM&limit=1000` (147 events for 201610, 209 for 200011); a date
  range with a hyphen is a 400. Per event: `date` (ISO UTC), `competitions[0].venue.id`,
  `venue.fullName` (the building's CURRENT name even for 2000: "Rocket Arena", "Kaseya
  Center"), `attendance`, `neutralSite`, `competitors[].homeAway`, `team.name` (the nickname:
  "Trail Blazers", "76ers", "SuperSonics"), `season.year` (the END year: 2001 is 2000-01).
  ESPN ids differ from NBA ids (ESPN files the 2000 Charlotte Hornets under id 3, today's
  Pelicans), so games are matched by Eastern date plus the two nicknames' last word. 158
  distinct ESPN venues appear 2000-2026; `seed/nba_venues.json` carries the 30 current
  arenas, every former home arena, and the neutral, international and preseason venues with
  five or more games (71 rows, plus the Alamodome shared with the NFL seed). Games ESPN
  has no venue for (Reunion Arena 2000-01, the Compaq Center 2000-03, the Pyramid 2001-04,
  GM Place 2000-01, the Alamodome 2000-02) take the home team's arena of that season from
  `home_by_season` in the venue seed. After the backfill every non-preseason game has a
  venue; 114 preseason exhibitions at one-off sites have none.
- **CDN liveData coverage**: `boxscore_{id}.json` and `playbyplay_{id}.json` answer 200 for
  2019-20 on (`0021900001`: 680 actions, `timeActual` present, attendance 20,787, duration
  170) and 403 for 2018-19 and earlier. `todaysScoreboard_00.json` has `scoreboard.gameDate`
  and `games[]` with `gameStatus` (1 scheduled, 2 live, 3 final), `gameStatusText` ("Q2 5:31",
  "Halftime", "End of 1st Qtr", "Final"), `period`, `gameClock` (ISO duration), team scores.
  The CDN schedule has no arena id, only `arenaName`/`arenaCity`/`arenaState`; the boxscore
  has `arena.arenaId`. Arena names resolve through venue aliases.
- **stats.nba.com history**: `boxscoresummaryv2?GameID=` works back to 2000 and carries
  `GameInfo` (ATTENDANCE, GAME_TIME "2:22"), `LineScore` (PTS per team) and
  `GameSummary.GAME_STATUS_ID`, so an old game's context columns are real. `playbyplayv3`
  prints `"0"` for both scores on a missed free throw and other non-scoring rows; the parser
  never lets a score go backwards. Its period markers carry a wall clock only as text in the
  description ("End of 1st Period (8:03 PM EST)", labelled EST in October), not used.
- **ESPN `summary?event=` win probability** exists from 2017-18 on (479 points for
  400974437 on 2017-10-17; 497 for 2018-10-16; 577 for 2019-10-22) and is empty for 2016-17.
  Its `plays[]` carry `wallclock` from 2017 on. The in-game model in
  `packages/core/src/providers/nba/winprob.ts` covers what ESPN lacks.
- **nba.com game pages**: `https://www.nba.com/game/{gameId}` answers 200 for real ids
  (`0021600001`, `0022400001`) and redirects (303 to `/games`) for a made-up one, so it is a
  page about the game. Used as the official highlights link.
- **No NBA host is reachable from Supabase Edge Functions** (2026-09-18, a throwaway probe
  function deployed and deleted the same minute): `cdn.nba.com` 403, `stats.nba.com` hangs
  past 12 s, and ESPN's `site.api.espn.com` 403 as well, all with the same headers Node sends
  successfully from this machine. Local Deno gets 403 from the CDN too, so part of it is the
  client and part is the datacenter egress. `nba-sync` and `nba-live` are deployed but
  unscheduled (migration 20260918100200); the daily GitHub job is the NBA's path, and whether
  GitHub's runners are allowed through is recorded in docs/progress.md from the run itself.
- **Coordinates** for the arenas came from OpenStreetMap Nominatim (queried 2026-09-18, one
  request a second, `seed/nba_venues.json` `coords_source`), except Moda Center and The
  Palace of Auburn Hills, which Nominatim could not place and which carry their Wikipedia
  infobox coordinates. Elevations from USGS EPQS through `fill_elevations.py` (70 of 71;
  Accor Arena, in Paris, is outside USGS coverage and Open-Elevation returned nothing).

## Famous games, superstars and personal badges — VERIFIED 2026-09-17/18

Every VERIFY item in `docs/prompts/famous-games.md`, checked against the live source. Real
responses are saved in `ingest/fixtures/mlb/` and parsed by `ingest/src/famous/famous.test.ts`.

### MLB awards `v1/awards` and `v1/awards/{awardId}/recipients?season=YYYY`
- `v1/awards` lists 682 awards. The ones used: `ALMVP`, `NLMVP`, `ALCY`, `NLCY`, `ALROY`,
  `NLROY`, `ALAS`, `NLAS` (the All-Star rosters). `MLBCY`, `MLBROY`, `WSMVP`, `ASMVP` and the
  club awards exist too and are not used.
- A recipients row is `{ id, name, date, season, team: { id }, player: { id, nameFirstLast,
  primaryPosition } }`. `season` is a string. 2024: one AL MVP (Aaron Judge, 592450), 37 AL
  All-Stars. Fixtures: `awards_ALMVP_recipients_2024.json`, `awards_ALAS_recipients_2024.json`.
- **No voting placements.** There is no top-five field anywhere in the API, so the MLB bar is
  winners plus All-Stars, not "top 5 in the voting".
- An award with no recipients that season answers **404**, not an empty list: `ALAS` for 2020
  (no All-Star Game) and this season's MVP before November. `ingest/src/mlb/honors.ts` treats a
  404 as none. Loaded 1997 to 2026: 2,282 rows. Harper: ROY 2012, MVP 2015 and 2021, All-Star
  2012-13, 2015-18, 2022, 2024, 2026.

### MLB people `v1/people?personIds=a,b,c` and `v1/people/search?names=&sportIds=1`
- The debut field is **`mlbDebutDate`** (`2012-04-28` for Harper, 547180). Batched ids work; the
  script asks 100 at a time. 2,203 of 2,220 local MLB players have one; the rest have not
  debuted. Fixture: `people_547180_661395_660271.json`.
- The search endpoint returns every match: "Will Smith" is two players (669257 C, 519293 P),
  "José Ramírez" two (608070, 542432). Names that need an id are refused, never guessed.

### MLB transactions `v1/transactions?teamId=&startDate=&endDate=`
- Row: `{ id, person: { id, fullName }, toTeam: { id, name }, fromTeam?, date, effectiveDate,
  typeCode, typeDesc, description }`. A trade is one row per player moved, each carrying the
  team he went TO, and it appears in both teams' lists.
- Phillies, 2025, rows whose `toTeam` is 143: SC 108, SFA 97, ASG 81, NUM 53, CU 32, TR 19,
  SGN 19, DES 14, DFA 13, SE 9, CLW 5, REL 2, R5M 2, RTN 1, R5 1. A join is `TR`, `SFA`, `SGN`,
  `CLW`, `R5`, `PUR`. `CU` (recalled) and `SE` (contract selected) are left out: they move a
  player already in the organization and would make every call-up "first days". `ASG` is a
  minor league or rehab assignment and names a minor league `toTeam` (1410, Lehigh Valley).
- Jhoan Duran: `TR` to 143 on 2025-07-30. Fixture: `transactions_143_PHI_2025-07-25_2025-08-05.json`.
- Loaded 2016-01-01 to 2026-09-17, one request per team per calendar year: 36,256 joins.

### nflverse: no awards anywhere
- Release tags (2026-09-17): trades, teams, schedules, stats_team, stats_player, ftn_charting,
  espn_data, weekly_rosters, players_components, players, pbp_participation, officials, misc,
  test, draft_picks, contracts, snap_counts, rosters, player_stats, pfr_advstats, pbp,
  nextgen_stats, injuries, depth_charts, combine. None is awards.
- `players.csv` has no Pro Bowl or All-Pro column (it has `rookie_season`, `last_season`,
  `draft_year`). `misc/pfr_rosters.csv` has none either and stops at 2022.
- So `seed/nfl_awards.json` is kept by hand: 107 rows for 2023-2025. Sources, per season:
  first-team All-Pro from Wikipedia's "2023/2024/2025 All-Pro Team" (AP first team only); MVP and
  the rest of the top five from NFL.com and ESPN: 2023 Jackson, then Prescott, McCaffrey, Purdy,
  Allen; 2024 Allen, then Jackson, Barkley, Burrow, Goff; 2025 Stafford, then the other
  finalists Maye, McCaffrey, Allen, Lawrence (only Maye's second place is published in order;
  the AP's five finalists are the top five). Each row carries its URL.
- **No Pro Bowl.** Dean, 2026-09-18: "dont include pro bowl, only all pro teams". The first
  load had 335 Pro Bowl rows (originals and replacements, from Wikipedia's Pro Bowl Games pages);
  `20260918100100_no_pro_bowl.sql` removes them and the `pro_bowl` honor kind.
- Names resolved to gsis ids through `players.csv`. Five needed a hand choice: Lamar Jackson
  (QB 00-0034796, not the CB), Josh Allen of Jacksonville (00-0035642, now "Josh Hines-Allen"),
  Connor McGovern of Buffalo (00-0035679), Byron Murphy the CB (00-0035236), Byron Young of the
  Rams (00-0039137).

### nflverse weekly rosters before 2024 are plain `.csv`
- `weekly_rosters` carries `roster_weekly_{season}.csv.gz` only from 2024. 2002-2023 are
  `.csv` (and parquet, qs, rds) with no `.gz`. `ingest/src/nfl/moves.ts` asks for `.csv.gz`
  and falls back to `.csv`. (`ingest/src/nfl/rosters.ts` only reads the current season, so it
  never met this.)
- A join is the first week a player is on a team's roster (ACT, INA, RES, DEV, EXE) that is not
  last week's team, across seasons. The file writes the CURRENT abbreviation (LV) for every
  season, so the team row is picked by franchise and season (OAK in 2019). Checked against
  2024-25 examples: Saquon Barkley PHI 2024-08-30 (roster week 1), A.J. Brown PHI 2022-09-02,
  Tom Brady TB 2020-09-04. 17,101 joins 2016-2026.

### nflverse play-by-play: first touchdowns
- `td_player_id` on a play with `touchdown = 1` is the scorer, the same column the scoring
  timeline uses. It names who reached the end zone, so a quarterback's "first touchdown" is his
  first rushing or receiving one, not his first touchdown pass.
- Floor: 2000, the first season read. A player whose `rookie_season` is before 2000 gets no
  first, because he may have scored before the data begins. 3,096 firsts. Checked: DeVonta
  Smith 2021_01_PHI_ATL (the curated game), Saquon Barkley 2018_01_JAX_NYG, Jalen Hurts
  2020_15_PHI_ARI, Cooper DeJean 2024_22_KC_PHI (the Super Bowl LIX pick six), Tom Brady
  2001_19_OAK_NE.

### The schedule rule, on local data
- "Last postseason game, and each finalist's last postseason game before it against anyone
  else" gives exactly three rows for every complete postseason 2000-2025, both sports: 156 rows,
  no season with a different count. MLB 2024: ALCS Game 5 NYY 5 at CLE 2, NLCS Game 6 NYM 5 at
  LAD 10, World Series Game 5 LAD 7 at NYY 6. NFL 2024: WAS 23 at PHI 55, BUF 29 at KC 32,
  KC 22 at PHI 40.

### The curated list against the games table
- All 21 entries resolve to exactly one game by local date. Two needed fixing against the data,
  not the brief: Super Bowl LVII is stored with the **Eagles as home** (KC 38 at PHI 35), and
  Judge's 62nd was **game 1** of a doubleheader at Texas (the 5–4 win) and needs `game_number`.
- Local date: `games.scheduled_start` is UTC, so matching reads the venue's `tz`. 56 of 224
  venues have none (most NFL parks); those are read in Eastern time, which gives the right day
  for every start between 9 am and 11 pm ET. World Series Game 3 2022, Brady's last game and
  Freeman's slam all match.

## Venue timezones, and the search bugs they hid — FOUND AND FIXED 2026-09-18

Found by Dean trying to search for an NBA game the day the NBA landed.

- **`venues.tz` was null for 126 of 295 venues.** Only the MLB venues had one, because the MLB
  Stats API publishes it; `seed/nfl_venues.json` and `seed/nba_venues.json` carry no `tz` field
  at all, so 56 of 65 NFL venues and 70 of 71 NBA venues had none.
- **Everything that asks for a game's local date was therefore falling back.** `search_games`
  compared the UTC date, and `game_local_date()` (the famous-game matcher, migration
  `20260918000100`) fell back to America/New_York. A 7:30 pm tip-off in Los Angeles is 03:30 UTC
  the NEXT day, so it filed itself under the wrong date. Measured on local: **7,773 MLB games
  since 2016** had a UTC date different from their local date, and most NBA games did. A fan
  searching the date they were there got the previous evening's games.
- **Fixed** by `seed/scripts/fill_timezones.py`, which resolves every venue from its coordinates
  with `timezonefinder` (offline OpenStreetMap boundaries, `pip install timezonefinder`) into
  `seed/venue_timezones.json`, and migration `20260918110000`, which carries the 253 resolved
  zones into `venues.tz`. `seed/scripts/build_seed_sql.py` now writes the column too.
  Sanity checks (`--check`): Chase Field and Footprint Center get America/Phoenix, which does not
  keep daylight time; Rogers Centre America/Toronto; Ball Arena America/Denver. Zone counts:
  90 America/New_York, 63 America/Chicago, 36 America/Los_Angeles, 14 America/Phoenix, 8
  America/Denver, plus London, Mexico City, Tokyo, Seoul, Sao Paulo, Melbourne and others for
  international games. 42 venues are unresolved because the seed has no coordinates for them;
  they are spring training and minor league parks, 23 of which carry 1,000 games between them,
  and they keep the America/New_York fallback.
- **A second bug in the same search.** A four-digit token matched `games.season` only. For MLB
  and NFL the season is the calendar year of nearly every game, so that reads naturally, but the
  NBA season is its START year: a fan who went to a Lakers game in January 2026 typed
  "lakers 2026" and got the 2026-27 season. A year token now matches the season OR the calendar
  year the game was played in.
- **And it was slow.** The token test ran a correlated alias lookup for every one of the 118,831
  games: 2.2 s on local, 3.1 s on hosted. The first token is now resolved once into the team and
  venue ids it allows, narrowing the candidates through `games_home_team_idx`,
  `games_away_team_idx` and `games_venue_idx` before the full test runs. Every token still has to
  match, so the narrowing cannot change the answer; proven by diffing 21 query shapes against the
  old function on local, all identical. Local 2.2 s to 0.12 s; hosted 3.1 s to 0.9 s and 2.6 s to
  0.15 s. An earlier attempt that put the per-token arrays in a plain CTE made it 74 s, because
  the planner re-evaluated them per row; `as materialized` is what makes it fast.
- Regression test: `supabase/tests/041_search_local_date.test.sql`, 8 assertions.
