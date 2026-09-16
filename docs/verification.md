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

This settles the open question in SPEC 4.3b for MLB: **no state-based model is needed.** The
spec's fallback ("build a state-based model, or scoring-play-only steps with no line") applies
only if this endpoint is unavailable for a given game, which should be treated as a missing
timeline rather than a reason to estimate one.

NFL keeps using nflverse's own per-play `home_wp` column, as recorded above.
