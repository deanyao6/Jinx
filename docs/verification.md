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

## MLS historical verification (2026-09-21)

ESPN monthly scoreboards were scanned from 2016 through 2026. Captured minimal fixtures in
`ingest/fixtures/mls/historical.json` cover `final`, conference semifinal spellings, play-in
rounds, wild cards and 2020 excluded tournament rounds. Unknown labels fail loudly.
Official MLS/club comparisons and counts are recorded in
[evidence/mls/local-rollout.md](evidence/mls/local-rollout.md). ESPN may omit a played venue
(Union–Toronto, 623627), misstate a city (Toyota Stadium), or use multiple IDs for the same
physical venue. A resolved venue row does not establish verified coordinates/timezone.

## MLS stadium coordinates (next-wave B.1) — SOURCED 2026-09-22

39 venues had hosted an MLS match with no coordinates in `venues` (38 of them with no timezone
either). Every one was placed from a fetched source, none from memory: OpenStreetMap Nominatim
(`search?q=<name>, <city>&format=jsonv2`, one request a second, with the User-Agent
`Jinx-fan-passport/0.1`) cross-checked against the Wikipedia article's coordinate
(`action=query&prop=coordinates`); the two sources agree within 181 m for all 37 Nominatim
placements (Maryland SoccerPlex, whose OSM object is the whole complex) and within 85 m for
all but two. Q2 Stadium and RFK Stadium could not be placed by Nominatim (four queries each)
and carry the Wikipedia coordinate alone. Raw responses were kept for the session under the
scratchpad; the chosen values are in `seed/mls_venues.json` (`coords_source`), zones in
`seed/venue_timezones.json` (timezonefinder), elevations in `seed/venue_elevations.json`
(USGS EPQS; the four Canadian stadiums from Natural Resources Canada's CDEM service,
`https://geogratis.gc.ca/services/elevation/cdem/altitude?lat=&lon=`, metres, because
Open-Elevation's TLS certificate had expired that day), and migration `20260923000200`
carries all of it to live databases. Test `047` asserts no MLS venue is without either.

**VERIFY: does ESPN's venue object carry coordinates? No.** Every `competitions[].venue` in the
March to September 2026 scoreboards (378 competitions, 35 venues) has exactly `id`,
`fullName` and `address {city, country}`; no `state`, and no field containing lat, lon, lng,
coord or geo. The core resource `v2/sports/soccer/leagues/usa.1/venues/<id>` adds `guid`,
`shortName` and `images` and still no coordinate. ESPN's site API also answers **403 to a
custom User-Agent** (it took curl's default); the ingest sends none, so nothing changes there.

Two pairs of ESPN venue ids are one building and both ids appear in 2026 fixtures:
4385/6587 (Children's Mercy Park, which OSM and Wikipedia now call Sporting Park) and
4653/9606 (Sports Illustrated Stadium, formerly Red Bull Arena). Both rows of each pair carry
the same coordinate; folding them into one venue is a separate job (attendances reference
both). Two rows had bad ESPN address data and were corrected: Bobby Dodd Stadium's city was
"North West Atlanta, Georia" with no country; Navy-Marine Corps Memorial Stadium had no
country.

| key | name | city | lat, lng | placed by | Wikipedia article | gap (m) |
|---|---|---|---|---|---|---|
| `mls-espn-4383` | Providence Park | Portland, Oregon | 45.52153, -122.69182 | Nominatim way 99615044 | Providence Park | 20 |
| `mls-espn-4653` | Sports Illustrated Stadium | Harrison, New Jersey | 40.73689, -74.15026 | Nominatim way 75692796 | Sports Illustrated Stadium | 25 |
| `mls-espn-3714` | America First Field | Sandy, Utah | 40.58296, -111.89329 | Nominatim way 109429239 | America First Field | 11 |
| `mls-espn-4061` | Subaru Park | Chester, Pennsylvania | 39.83291, -75.37847 | Nominatim way 158031721 | Subaru Park | 84 |
| `mls-espn-7474` | Toyota Stadium | Frisco | 33.15422, -96.83537 | Nominatim way 40719754 | Toyota Stadium (Texas) | 26 |
| `mls-espn-4791` | Shell Energy Stadium | Houston, Texas | 29.75203, -95.35234 | Nominatim way 261098257 | Shell Energy Stadium | 20 |
| `mls-espn-2731` | Dick's Sporting Goods Park | Commerce City, Colorado | 39.80595, -104.89192 | Nominatim way 626539832 | Dick's Sporting Goods Park | 43 |
| `mls-espn-10143` | BMO Field | Toronto | 43.63334, -79.41856 | Nominatim way 663457707 | BMO Field | 4 |
| `mls-espn-6971` | Inter&Co Stadium | Orlando, Florida | 28.54110, -81.38914 | Nominatim relation 9219427 | Inter.co Stadium | 16 |
| `mls-espn-4370` | BC Place | Vancouver | 49.27669, -123.11201 | Nominatim way 24705904 | BC Place | 5 |
| `mls-espn-4385` | Children's Mercy Park | Kansas City, Kansas | 39.12164, -94.82335 | Nominatim way 195234182 | Sporting Park | 18 |
| `mls-espn-6072` | PayPal Park | San Jose, California | 37.35131, -121.92467 | Nominatim way 329840159 | PayPal Park | 30 |
| `mls-espn-3278` | Stade Saputo | Montreal | 45.56309, -73.55264 | Nominatim way 95436479 | Saputo Stadium | 12 |
| `mls-espn-7605` | BMO Stadium | Los Angeles, California | 34.01277, -118.28334 | Nominatim relation 10070751 | BMO Stadium | 68 |
| `mls-espn-7604` | Audi Field | Washington, District of Columbia | 38.86826, -77.01261 | Nominatim way 910656537 | Audi Field | 28 |
| `mls-espn-6538` | Allianz Field | Saint Paul, Minnesota | 44.95314, -93.16469 | Nominatim way 588533245 | Allianz Field | 4 |
| `mls-espn-8674` | TQL Stadium | Cincinnati, Ohio | 39.11118, -84.52223 | Nominatim way 1445692208 | TQL Stadium | 23 |
| `mls-espn-8673` | Q2 Stadium | Austin, Texas | 30.38770, -97.71950 | Wikipedia only | Q2 Stadium |  |
| `mls-espn-8330` | Chase Stadium | Fort Lauderdale, Florida | 26.19324, -80.16068 | Nominatim way 860629662 | Inter Miami CF Stadium | 16 |
| `mls-espn-8689` | ScottsMiracle-Gro Field | Columbus, Ohio | 39.96836, -83.01666 | Nominatim way 836864820 | ScottsMiracle-Gro Field | 38 |
| `mls-espn-1417` | Historic Crew Stadium | Columbus, Ohio | 40.00947, -82.99114 | Nominatim relation 11615864 | Historic Crew Stadium | 4 |
| `mls-espn-8993` | GEODIS Park | Nashville, Tennessee | 36.13003, -86.76594 | Nominatim way 1056868015 | Geodis Park | 8 |
| `mls-espn-2266` | SeatGeek Stadium | Bridgeview, Illinois | 41.76481, -87.80619 | Nominatim way 69135226 | SeatGeek Stadium | 12 |
| `mls-espn-10421` | Energizer Park | St. Louis, Missouri | 38.63132, -90.21031 | Nominatim way 1268400174 | Energizer Park | 8 |
| `mls-espn-9195` | Snapdragon Stadium | San Diego, California | 32.78424, -117.12239 | Nominatim way 1092512810 | Snapdragon Stadium | 43 |
| `mls-espn-1418` | RFK Stadium | Washington, District of Columbia | 38.89000, -76.97190 | Wikipedia only | Robert F. Kennedy Memorial Stadium |  |
| `mls-espn-3262` | Nissan Stadium, Nashville | Nashville, Tennessee | 36.16652, -86.77131 | Nominatim way 58759639 | Nissan Stadium (Nashville) | 16 |
| `mls-espn-6738` | Nippert Stadium | Cincinnati, Ohio | 39.13112, -84.51623 | Nominatim way 35263569 | Nippert Stadium | 9 |
| `mls-espn-2242` | Camping World Stadium | Orlando, Florida | 28.53904, -81.40275 | Nominatim way 400475584 | Camping World Stadium | 17 |
| `mls-espn-10661` | Nu Stadium | Miami, Florida | 25.79245, -80.26029 | Nominatim relation 20585093 | Nu Stadium | 148 |
| `mls-espn-6587` | Sporting Park | Kansas City, Kansas | 39.12164, -94.82335 | Nominatim way 195234182 | Sporting Park | 18 |
| `mls-espn-9606` | Red Bull Arena | Harrison, New Jersey | 40.73689, -74.15026 | Nominatim way 75692796 | Sports Illustrated Stadium | 25 |
| `mls-espn-6970` | Bobby Dodd Stadium | North West Atlanta, Georia | 33.77248, -84.39296 | Nominatim way 618966004 | Bobby Dodd Stadium | 17 |
| `mls-espn-3869` | Stanford Stadium | Stanford, California | 37.43453, -122.16199 | Nominatim relation 18564360 | Stanford Stadium | 78 |
| `mls-espn-4373` | Stade Olympique (Montreal) | Montreal | 45.55780, -73.55165 | Nominatim way 108505523 | Olympic Stadium (Montreal) | 36 |
| `mls-espn-1764` | Pratt & Whitney Stadium at Rentschler Field | East Hartford, Connecticut | 41.75961, -72.61884 | Nominatim way 187066996 | Pratt & Whitney Stadium at Rentschler Field | 13 |
| `mls-espn-4087` | Rose Bowl | Pasadena, California | 34.16135, -118.16767 | Nominatim way 5208863 | Rose Bowl (stadium) | 49 |
| `mls-espn-7658` | Navy-Marine Corps Memorial Stadium | Annapolis, Maryland | 38.98476, -76.50708 | Nominatim way 38305512 | Navy–Marine Corps Memorial Stadium | 28 |
| `mls-espn-1451` | Maryland SoccerPlex | Boyds, Maryland | 39.15178, -77.31185 | Nominatim relation 14311627 | Maryland SoccerPlex | 181 |

## Preseason games removed (next-wave B.2) — 2026-09-22

Only regular season and postseason games exist in Jinx (Dean, decision 13). Before: local held
9,763 MLB spring-training and 1,940 NBA preseason games (11,703), hosted 4,875 and 774
(5,649), and no attendance, pledge or check-in on hosted pointed at one; local had 3, all on a
throwaway journey-test user, deleted by hand first. Migration `20260923000100` asserts that
count is zero, deletes the rows (with two new partial indexes on the games self-references,
without which each cascaded delete scanned all 118,831 rows), replaces the check constraint
with `game_type in ('regular', 'postseason')`, and deletes the 40 spring-training and
exhibition parks that had no coordinate and no other game (`seed/mlb_venue_overrides.json`
`drop_by_name` keeps them out of the seed). Upstream: `mapMlbGameType` returns null for `S`
and `E`, `seasonSchedule` asks for `gameType=R,F,D,L,W`, the NBA provider no longer reads
the `Pre Season` game log and `STORED_TYPES` drops `001`. The ticket matcher
(`rankCandidates` and `loadCandidates`) and the curated famous-game matcher treat any other
type as absent. `search_games` and `search_games_v2` were left alone: the constraint means no
such row can exist for them to return. Local database size 278 MB before, 254 MB after a
`vacuum full` of games and game_win_prob; hosted 115 MB before and after (autovacuum has not
run yet). Test `046`.

## The MLS daily job (next-wave B.3) — CHECKED 2026-09-22

`mls-ingest.yml` run 35787322042 (`workflow_dispatch`, `sync`, 2m35s, success) read every
month of 2026 from ESPN on GitHub's runner and reported per month `games`/`finals` of
0/0, 26/26, 48/48, 70/70, 74/74, 0/0, 36/36, 75/75, 74/58, 86/0, 21/0, 0/0, no unmapped
or new venues. The finals sum to 387, which is exactly what hosted holds for 2026, so the run
wrote nothing new: no match had gone final since the backfill. The scheduled 08:45 UTC runs
had not yet happened at the time of writing; judge them by `gh run list
--workflow=mls-ingest.yml` and by the hosted 2026 final count moving after match days
(`select count(*) from games where sport_id = 'mls' and season = 2026 and status = 'final'`).

## ESPN venue ids are per sport — FOUND AND FIXED 2026-09-22

Found while reading hosted back after the MLS coordinates: the one MLS venue without an
elevation was Accor Arena in Paris, which had 17 of New England's 2026 home matches. ESPN's
soccer scoreboard gives Gillette Stadium venue id `10660`; its basketball scoreboard gives
Accor Arena `10660` (and `6271`). `venues.provider_ids.espn_venue_ids` held both under one
key, `loadVenueMaps` built one map from it, and whichever row loaded last won: on hosted the
NBA seed's row, so every Revolution home match ingested after 2026-09-18 resolved to Paris
(local loaded in the other order and had none). Fix, migration `20260923000300`: soccer ids
live under `espn_soccer_venue_ids` (51 venues, generated from `seed/mls_venues.json`), the
writer picks the map by `venueLookup`, the MLS backfill reads and writes the new key, and the
17 matches are back at Gillette Stadium (hosted read back: 0 at Accor Arena, 17 of 2026 at
Gillette). Test `048`. The NBA's ids are untouched, so Paris games still resolve.

## When a game ended: `games.final_at` per feed (next-wave B.4) — VERIFIED 2026-09-22

Live fetches from Node, fixtures trimmed and dated `2026-09-22` under `ingest/fixtures/<sport>/`.
Why it was empty: the MLB and NBA detail parsers already wrote it, and the schedule refresh
(every 15 minutes through `mlb-sync`) upserted `final_at: null` over it; hosted had 4 of 2,734
MLB finals filled, the 4 detailed after the last refresh. `upsertGames` now leaves the column
out when a row has nothing, and trigger `games_keep_final_at` (migration `20260923000500`,
test `042`) refuses a null and refuses a non-detail write over a detail value.

- **MLB, no explicit end field.** `gameData.datetime.*` is the start; `gameDurationMinutesDelay`
  does not exist (the field is `gameInfo.delayDurationMinutes`). Exact: the last play's
  `about.endTime` (= `playEndTime`, = `metaData.timeStamp`), which `parse.ts` stores from the
  feed. Estimate for every final from the schedule with `hydrate=gameInfo`:
  `firstPitch + gameDurationMinutes`, within -0.5 to +1.5 minutes on 20 finals, plus the part of
  `delayDurationMinutes` that did not precede the first pitch (822686: an 86-minute 4th-inning
  delay the duration excludes; 824424 and 824471: pre-game delays already inside `firstPitch`).
  `mlbScheduleFinalAt`. Fixtures `feed_825031_MIA_AZ_9inn_end_time`, `feed_823655_NYY_MIN_13inn`,
  `feed_delayed_822686_824424_824471`, `schedule_2026-09-16_gameInfo`.
- **NBA CDN: no `gameEndTimeUTC`.** The boxscore's `game` keys are `gameId, gameTimeLocal,
  gameTimeUTC, gameTimeHome, gameTimeAway, gameEt, duration, gameCode, gameStatusText,
  gameStatus, regulationPeriods, period, gameClock, attendance, sellout, arena, officials,
  homeTeam, awayTeam`. `duration` counts from the tip, not `gameTimeUTC` (10 to 14 minutes
  later). Exact: the play-by-play's closing `{actionType: "game", subType: "end"}` action's
  `timeActual` (0042500405 `2026-06-14T03:29:26.5Z`, 0022400001 `2024-11-13T02:24:23.8Z`, the
  double-overtime 0022500001 `2025-10-22T02:59:51.2Z`); `nbaGameEndTime` asserts the type and
  falls back to the last stamped play. The stats.nba.com path has no wall clock: null.
  `todaysScoreboard_00.json` was empty in the off-season and its final shape is unchecked.
- **NFL:** `time_of_day` is null on the `END GAME` row in every game read; the last non-null
  stamp is the final snap (12 to 38 seconds of clock left in the three games). Kept as is:
  never late, at most minutes early; kickoff plus 4 hours when a season has no stamps.
- **MLS scoreboard: no wall clock anywhere** (`competitions[].status` is
  `{clock: 5400, displayClock: "90'+6'", period: 2, type: {...STATUS_FULL_TIME}}`; `date` is
  the scheduled kickoff; the word `wallclock` does not occur). **The summary has one:** every
  `keyEvents[]` item carries `wallclock` and `meta.lastPlayWallClock` equals the last
  (761829: kickoff `23:13:49Z` for a 23:00 schedule, End Regular Time `2026-09-21T01:15:29Z`;
  761828 `04:38:47Z`). Old matches carry re-processing timestamps instead (a 2016 match
  "ending" `2021-11-17`), so `mlsSummaryFinalAt` refuses anything outside four hours of
  kickoff. Estimate for every final from the scoreboard, `mlsScoreboardFinalAt`: kickoff plus
  13 (observed lag 11 to 14), 90, the display clock's stoppage, 3 and a 17-minute interval, more
  for extra time and a shootout: `01:09Z` against the real `01:15:29Z`. `ingest/src/mls/finals.ts`
  writes the exact time for attended and recent matches (44 on local on first run, 44 exact).
  ESPN answers 403 to a custom User-Agent; the provider sends none.

After the backfill on 2026-09-22, local: MLB 2,343 of 2,343 finals of 2026 and both attended
games exact; NBA 4 of 5 attended (0021600001 is the stats path); MLS 44; NFL all 7,033.

## NFL detail on demand (next-wave B.5) — 2026-09-22

Before: every NFL final since 2000 carried appearances, scoring plays and moments because a
season's play-by-play is one file (docs/progress.md, Decisions). Local `game_appearances` was
91 MB of the 256 MB database. The rule is now SPEC 4.7's for every sport: `games_wanting_detail`
(queued, attended or famous games without detail) drives `ingest/src/nfl/run.ts`, which skips a
season entirely when nothing in it is wanted. Migration `20260923000600` deleted the detail of
6,946 unwanted games on local (543,273 appearance rows, 89,290 scoring plays, 8,267 moments; no
Relive rows, which only attended games ever had) and 2,756 on hosted (2,793 detailed before, 37
after, 48 famous games without detail now wanting it); players rows stay (rosters, honors, moves
and firsts reference them). Local after `vacuum full`: 145 MB. Hosted reports its size once
autovacuum runs. Proof that nothing a fan can see changed: the Relive verifier's 15 games pass,
the 21 curated famous games resolve, and every attended game keeps its detail (test `019`). On 2026-09-22 at the end of the wave a `vacuum full` of games, game_appearances, game_scoring_timeline, game_events and game_win_prob on hosted (through `supabase db query --linked`) took it from 116 MB to 52 MB.

## Live feeds from the phone (next-wave C) — VERIFIED 2026-09-22

Decision 8 lets the app read free public feeds for live state. Checked from the development
build on the iPhone 17 Pro simulator through the probe on the Easter eggs page
(`jinx:///you/eggs?probe=live`, `docs/evidence/live/probe-feeds-from-device-build.png`):

| Request from React Native `fetch` | Answer |
|---|---|
| `cdn.nba.com/static/json/liveData/scoreboard/todaysScoreboard_00.json` with `Accept`, `Referer: https://www.nba.com/`, `Origin: https://www.nba.com` (React Native's own User-Agent) | 200 in 107 ms, `gameDate 2026-09-22`, 0 games (off-season) |
| `cdn.nba.com/static/json/liveData/boxscore/boxscore_0022500001.json`, same headers | 200 in 363 ms, "Final", 124-125 |
| `site.api.espn.com/apis/site/v2/sports/soccer/usa.1/summary?event=761829`, `Accept` only | 200 in 1,157 ms, `STATUS_FULL_TIME`; parsed as a 2-2 final |

So the CDN does not need a browser User-Agent from a device (it refused curl's), and ESPN,
which refuses a custom User-Agent, takes React Native's default. The feeds are
`apps/mobile/src/features/live/feeds.ts`; `parseCdnLiveState` (core) serves the NBA and the new
`parseMlsLiveState` (core) reads the summary header's `status.type`, `period`, `displayClock`
and `competitors[].score`. Not seen: a game under way (none during the session); the status
vocabulary for a live MLS match (`STATUS_FIRST_HALF`, `STATUS_HALFTIME`, `STATUS_SECOND_HALF`)
is taken from ESPN's soccer feeds generally and the parser keys on `state === 'in'` and the
word HALFTIME, so an unexpected name during play still reads as live.

## Box-score lines for "players seen" (next-wave D.2) — 2026-09-22

Where each line comes from, read against real responses in the fixtures:

- **MLB** `liveData.boxscore.teams.{home,away}.players.ID<id>.stats.batting` (`atBats`, `hits`,
  `homeRuns`, `rbi`) and `.stats.pitching` (`inningsPitched` "5.0", `outs`, `earnedRuns`,
  `strikeOuts`, `saves`); a player is a pitcher when in the team's `pitchers[]`. Tigers on
  2024-09-15: Riley Greene 2 HR, 3 RBI; Keider Montero 15 outs, 0 ER; Jason Foley the save.
- **NBA** the CDN and stats box scores' `statistics.{points, reboundsTotal, assists, steals,
  blocks}`, already parsed for the moment detectors.
- **NFL** nflverse `stats_player_week_{season}.csv.gz`: `rushing_tds + receiving_tds +
  special_teams_tds + def_tds + fumble_recovery_tds` (touchdowns reached, never a kick),
  `rushing_yards`, `receiving_yards`, `passing_yards`, `def_sacks`, `def_interceptions`. The
  file is read for every season now, whichever source the appearances came from.
- **MLS** has no appearances yet; the rule is defined and waits for E.3.

Thresholds are the brief's recommended ones, unchanged after reading the lines of the local
attended games: on the Phillies at Dodgers game of 2025-09-16 the rule names Ohtani (MVP,
homered and pitched five scoreless) and leaves out the four other home-run hitters because
none is a superstar; on Bears at Eagles 2025-11-28 it names Byard (All-Pro, an interception)
and A.J. Brown (franchise player, 2 TD, 132 yards) and leaves out D'Andre Swift's touchdown.

## MLS draws (next-wave E.1, E.2) — 2026-09-22

Base rates on local, 2018 to 2025, 4,069 finals: home wins 48.1%, draws 24.9%, away wins
27.0%. The three-outcome Elo (`docs/elo-backtest.md`) is written for every match with the
draw; the pledged side's probability is its own (an away pick carries 1 minus home minus draw,
never "one minus the other side", which would count the draw for it). A pledge at a match
that ends level on goals is void with reason `draw`, whatever the penalties decided: the brief
recommended it and it reads right against the record rule already in place (a shootout win is
a win for the *fan's own* record, `gameResult` honours the explicit winner; the *pledge* is a
prediction of the match, which drew). Dean should confirm that reading (the report asks).

## ESPN MLS rosters (next-wave E.3) — VERIFIED 2026-09-22

`https://site.api.espn.com/apis/site/v2/sports/soccer/usa.1/teams/{teamId}/roster` answers a
plain fetch for all 30 clubs (no custom User-Agent). `athletes[]` rows carry `id` (the ESPN
athlete id, stored as `players.provider_player_id` under provider `espn_mls`), `displayName`,
`fullName`, `jersey`, `position.{abbreviation, displayName}` (G, D, M, F) and `dateOfBirth`; no
status field, so every listed player is active. Fixture
`ingest/fixtures/mls/espn_roster_20232_trimmed_2026-09-22.json`. Loaded 945 players across the
30 clubs (28 to 37 each) on 2026-09-22.

## ESPN's MLS summary for detail and Relive (next-wave E.4) — VERIFIED 2026-09-22

`summary?event={id}` (same host and league path as the scoreboard) answers a plain fetch for a
2022 cup final and a 2026 league match. What it holds, checked on both: `keyEvents[]` (every
goal, card, substitution, kick-off, halftime, full time, extra-time and shootout marker, each
with `type.text`, `clock.displayValue` as "45'+2'", `period`, `scoringPlay`, `text`, the
running score and, for 2026 matches only, a `wallclock`), `rosters[]` (`homeAway`, starters
and substitutes with `athlete.id`, `position`, `subbedIn`/`subbedOut`, `stats[]`), `header`
(the shootout score and winner), `commentary[]`. **No win-probability series**: there is no
`winprobability` key on the soccer summary, unlike the NBA's, so the Relive line is a Poisson
state model (`mlsInMatchHomeWp`) calibrated so that 0-0 with the whole match ahead equals the
pregame three-way probability, and decided by the whistle (1 for a home win, 0 otherwise,
draws included, as the pledge rule reads it). Wall clocks exist from the 2024 season; a match
without them keeps `timestampsReliable` false and never punishes a pledge.

Independent check (`ingest/src/verify/relive.ts`): the story's goal sequence, the scoring
timeline and the scorer names against the scoreboard's `details[]` for five matches (the 2022
MLS Cup with extra time, a red card and a 3-0 shootout; Inter Miami 2-2 San Diego 2026-09-20;
Toronto 2-3 NYCFC 2024-05-11 with three red cards, one a second yellow; D.C. 1-6 San Jose
2025-04-06 with a hat trick; Cincinnati 2-3 NYCFC 2024-10-02). All five match on score and
scorer; the second yellow used to be stored as a moment named "Second yellow card to ...",
fixed the same day.

Official highlights: `mlssoccer.com`'s match pages are slugs (`/competitions/.../matches/...`)
that ESPN's event id cannot derive, so every MLS match opens the video hub
`https://www.mlssoccer.com/video/` (200 on 2026-09-22) with the label "Opens on MLSsoccer.com".

## MLS Wrapped (next-wave E.5) — 2026-09-22

`generate_wrapped` needed nothing sport-specific beyond the moment ranking (the MLS moment
types were unranked); `user_game_results` already counts a draw as a tie and a shootout win as
a win. The daily job publishes MLS for `extract(year from now() - interval '1 month')` so an
MLS Cup in early December still publishes in January. Test `022`: a fan with only MLS matches
gets a 2026 Wrapped, the draw sits in the record, the hat trick outranks the red card, no NBA
Wrapped. The app lists MLS among the seasons and calls them matches.

## NBA and MLS superstars (next-wave D.1) — SOURCED 2026-09-22

`seed/nba_awards.json` (286 rows, 2013-14 to 2025-26: MVP, the MVP top five, the three All-NBA
teams, Rookie of the Year, Finals MVP) and `seed/mls_awards.json` (176 rows, 2016 to 2025: the
Landon Donovan MVP and its finalists, Best XI, Golden Boot, Rookie/Young Player of the Year,
MLS Cup MVP) were built from live fetches on 2026-09-22, each row carrying its source URL.
Winners, All-NBA and Best XI from Wikipedia through the MediaWiki parse API; **the NBA MVP top
five is not on Wikipedia** (the season pages carry three finalists, and only from 2016-17), so
places two to five come from the NBA's own releases on pr.nba.com: prose for five seasons,
voting PDFs for six (403 to curl's default agent, 200 with a browser agent and a pr.nba.com
referer), and JPGs for 2024-25 and 2025-26, read visually (SGA 913, Jokić 787, Antetokounmpo
470, Tatum 311, Mitchell 74; SGA 939, Jokić 634, Wembanyama 569, Dončić 250, Cunningham 117),
worth a second pair of eyes. Finals MVP is filed under its season's start year (the 2026
Finals, Jalen Brunson, is `season: 2025`).

Ids. NBA: `commonallplayers?LeagueID=00&Season=2025-26&IsOnlyCurrentSeason=0` (5,227 players,
the stats headers as for every stats.nba.com call); all 74 honoree names matched exactly one
player whose FROM_YEAR..TO_YEAR overlaps the honor seasons, and `playercareerstats` for all 74
confirmed the Wikipedia team for all 234 Wikipedia-sourced rows (0 mismatches). MLS: ESPN's
search **VERIFY**: `https://site.api.espn.com/apis/search/v2?query=<name>&limit=5` works
(HTTP 200, `results[]` of `type: "player"` whose `contents[].uid` is `s:600~a:<athleteId>`,
sport 600 being soccer, with `subtitle` the last club and `description` the last competition;
fixture `ingest/fixtures/mls/espn_search_v2_diego_valeri_2026-09-22.json`);
`site.web.api.espn.com/apis/common/v3/search` answers `{"count":0,"items":[]}` for every
variant (fixture `espn_search_v3_empty_2026-09-22.json`). Search alone was not trusted: 15 of
53 names return several soccer athletes (Carlos Vela has two ESPN records, 76098 and 136304)
and four are spelled differently on ESPN (Riqui Puig is "Ricard Puig", Taty is "Valentín"
Castellanos), so **every one of the 92 MLS honoree names was found in an actual lineup**
(`summary?event=` `rosters[].roster[].athlete`) of that season and club. The same was done for
the 21 franchise names ESPN's search knows more than once (or not at all): each `id` in
`seed/franchise_players.json` for an MLS name was read from a lineup of the club in the
entry's first season (Puig 270611 in LA's 2022 lineup, Castellanos 252933 in NYCFC's 2018,
Löwen 189505 in St. Louis's 2023, the club's first season, so his entry starts in 2023).

`ingest/src/famous/franchise.ts` resolves NBA names through `commonallplayers` (career overlap
with the entry's seasons, like nflverse) and MLS names through the search above (soccer
athletes only; two records need the `id`). The merged file has 28 transcendent and 322 team
rows across four sports; all 350 resolve on local and hosted. Migration `20260923001000` adds
the honor kinds (NBA: MVP finalist, first- to third-team All-NBA, ranked between Finals MVP and
Rookie of the Year; MLS: MVP, MLS Cup MVP, MVP finalist, Golden Boot, Best XI, Rookie of the
Year); test `023`.

Not collected: NBA All-Stars (`honor_kinds` has the row; no rows were asked for). The
`seed/franchise_players.nba_mls.draft.json` file was merged into the main file and removed.

## Team palettes against two sources (next-wave F) — CHECKED 2026-09-22

**VERIFY, the licence.** `jimniels/teamcolors` has no LICENSE file, no `license` field in
package.json and GitHub reports none (checked 2026-09-22). Nothing was copied from it: it was
read to compare, the comparison lives in `docs/palette-diff.md`, and the values written to the
seed come from ESPN's team records (`color`, `alternateColor`), which the app already uses
under the ESPN attribution. `docs/attribution.md` says so.

**VERIFY, the coverage.** 165 teams: NFL 32, MLB 30, NBA 30, MLS 22 of 30 (no Austin,
Charlotte, Cincinnati, Inter Miami, LAFC, Nashville, San Diego, St. Louis), plus NHL and EPL.
Its README calls the NBA values official from the 2014-15 composite, the MLB values
"extracted" from logo slicks, and the MLS values approximations. It is dated: the Grizzlies'
teal, the Marlins' orange and the Hawks' volt are identities the clubs left years ago, and the
NBA rows carry a near-black `#061922` where the clubs say black. So the check was run three
ways (`seed/scripts/compare_team_colors.py`): ours, jimniels/teamcolors and ESPN's current
pair for every active team, with CIE76 ΔE to the nearest colour of each source. A palette is
changed only when **both** sources disagree with ours (a missing source does not vote); the
lead colour stays ours, since the older source lists the Yankees' red before their navy and
ESPN's `color` is not always the club's lead (the Timberwolves' official navy is ours, ESPN
says a lighter blue, the older source agrees with ours: kept).

**What it found.** Our fills already match ESPN's colour for every active team but one (the
hand-tuned rows were built from the same records). The real defect was the **MLS secondaries:
every one of the 30 MLS rows repeated its primary as `--t2`** (the badge ring and the stripe
under a scoreboard side were the fill's own colour), and the older source's coverage gaps
hid nothing because ESPN carries an alternate for all 30. 30 rows changed, 29 of them MLS
secondaries (the fill untouched), plus the Pistons', Thunder's and Spurs' secondaries to ESPN's
current alternate. The Marlins are kept on purpose: Caliente red is the club's 2019 identity,
ESPN lists black and the older source the 2012 orange. Every proposal clears 4.5:1 on both
screens by construction (`--t2` dark variants lightened along the same hue where needed) and
`python3 seed/scripts/check_team_colors.py` passes (worst hand-tuned 4.72:1 light, 5.65:1
dark). Applied to the seed, `supabase/seed.sql`, local and hosted (30 rows read back).

The changed rows (fill / light `--t2` before, the sources, the change):

| Team | Ours: fill / light --t2 | jimniels/teamcolors | ΔE to nearest (fill, --t2) | ESPN colour / alt | ΔE to ESPN (fill, --t2) | Proposed |
|---|---|---|---|---|---|---|
| FC Cincinnati (mls) | #003087 / #003087 | - | -, - | #003087 #FE5000 | 0, 133 | --t2 #FE5000 (dark #FE5000) |
| Chicago Fire FC (mls) | #7CCDEF / #12617d | #AF2626 #0A174A #8A8D8F | 34, 31 | #7CCDEF #FF0000 | 0, 129 | --t2 #FF0000 (dark #FF0000) |
| Seattle Sounders FC (mls) | #2DC84D / #16712a | #4F8A10 #11568C #212930 | 32, 23 | #2DC84D #0033A0 | 0, 120 | --t2 #0033A0 (dark #3374FF) |
| Columbus Crew (mls) | #000000 / #252525 | #000000 #FFDB00 #8A8D8F | 0, 44 | #000000 #FEDD00 | 0, 115 | --t2 #8A8D8F (dark #8A8D8F) |
| New England Revolution (mls) | #022166 / #022166 | #0A2141 #D80016 #8A8D8F | 26, 26 | #022166 #CE0E2D | 0, 98 | --t2 #CE0E2D (dark #F898A8) |
| San Jose Earthquakes (mls) | #003DA6 / #003da6 | #0051BA #000000 #B1B4B2 | 9, 73 | #003DA6 #FFFFFF | 0, 97 | --t2 #000000 (dark #C2C2C2) |
| LA Galaxy (mls) | #00235D / #00235d | #00245D #004689 #F1AA00 #FFD200 | 1, 16 | #00235D #FFFFFF | 0, 94 | --t2 #004689 (dark #8CC7FF) |
| San Diego FC (mls) | #697A7C / #4b5861 | - | -, - | #697A7C #F89E1A | 0, 92 | --t2 #F89E1A (dark #F89E1A) |
| D.C. United (mls) | #000000 / #252525 | #000000 #DD0000 | 0, 99 | #000000 #D61018 | 0, 91 | --t2 #D61018 (dark #F6898D) |
| FC Dallas (mls) | #C6093B / #c6093b | #CF0032 #07175C #8A8D8F | 8, 75 | #C6093B #001F5B | 0, 87 | --t2 #001F5B (dark #8AB2FF) |
| Red Bull New York (mls) | #BA0C2F / #ba0c2f | #D50031 #012055 #FFC800 #8A8D8F | 11, 74 | #BA0C2F #FFC72C | 0, 85 | --t2 #FFC72C (dark #FFC72C) |
| Philadelphia Union (mls) | #051F31 / #051f31 | #002D55 #5090CD #B38707 #B49759 #F4F4F4 | 16, 16 | #051F31 #E0D0A6 | 0, 82 | --t2 #E0D0A6 (dark #E0D0A6) |
| Nashville SC (mls) | #ECE83A / #5b5900 | - | -, - | #ECE83A #1F1646 | 0, 82 | --t2 #1F1646 (dark #8472D3) |
| CF Montréal (mls) | #003DA6 / #003da6 | #122089 #000000 #7A878F | 13, 68 | #003DA6 #C1C5C8 | 0, 82 | --t2 #C1C5C8 (dark #C1C5C8) |
| Real Salt Lake (mls) | #A32035 / #a32035 | #A50531 #013474 #F2D11A | 6, 76 | #A32035 #DAA900 | 0, 79 | --t2 #DAA900 (dark #DAA900) |
| Houston Dynamo FC (mls) | #FF6B00 / #a43d00 | #F36600 #2E2926 #85B7EA | 4, 66 | #FF6B00 #101820 | 0, 78 | --t2 #101820 (dark #A2B9D0) |
| St. Louis CITY SC (mls) | #EC1458 / #bd1046 | - | -, - | #EC1458 #001544 | 0, 78 | --t2 #001544 (dark #85ABFF) |
| Colorado Rapids (mls) | #8A2432 / #8a2432 | #91022D #85B7EA #8A8D8F #313F49 | 10, 53 | #8A2432 #8AB7E9 | 0, 78 | --t2 #8AB7E9 (dark #8AB7E9) |
| Toronto FC (mls) | #AA182C / #aa182c | #D80016 #313F49 #A1AAAD | 29, 29 | #AA182C #A2A9AD | 0, 74 | --t2 #A2A9AD (dark #A2A9AD) |
| Inter Miami CF (mls) | #231F20 / #231f20 | - | -, - | #231F20 #F7B5CD | 0, 73 | --t2 #F7B5CD (dark #F7B5CD) |
| Austin FC (mls) | #00B140 / #00782a | - | -, - | #00B140 #000000 | 0, 72 | --t2 #000000 (dark #969696) |
| Portland Timbers (mls) | #2C5234 / #2c5234 | #004812 #EBE72B | 18, 18 | #2C5234 #C99700 | 0, 72 | --t2 #C99700 (dark #C99700) |
| Minnesota United FC (mls) | #000000 / #252525 | #CFD4D8 #6CADDF #000000 | 0, 63 | #000000 #9BCDE4 | 0, 68 | --t2 #9BCDE4 (dark #9BCDE4) |
| LAFC (mls) | #000000 / #252525 | - | -, - | #000000 #C7A36F | 0, 63 | --t2 #C7A36F (dark #C7A36F) |
| Atlanta United FC (mls) | #9D2235 / #9d2235 | #A29061 #80000B #000000 | 16, 16 | #9D2235 #AA9767 | 0, 58 | --t2 #AA9767 (dark #AA9767) |
| Charlotte FC (mls) | #0085CA / #006da6 | - | -, - | #0085CA #000000 | 0, 58 | --t2 #000000 (dark #B8B8B8) |
| New York City FC (mls) | #9FD2FF / #175680 | #6CADDF #00285E #FD4F00 | 15, 24 | #9FD2FF #000229 | 0, 36 | --t2 #000229 (dark #9FA4FF) |
| Detroit Pistons (nba) | #C8102E / #1D42BA | #ED174C #006BB6 #0F586C | 14, 37 | #1D428A #C8102E | 0, 30 | --t2 #1D428A (dark #8DACE7) |
| Oklahoma City Thunder (nba) | #00669F / #EF6F1E | #007DC3 #F05133 #FDBB30 #002D62 | 11, 20 | #007AC1 #EF3B24 | 11, 24 | --t2 #EF3B24 (dark #EF3B24) |
| San Antonio Spurs (nba) | #000000 / #8E9BA3 | #BAC3C9 #061922 | 12, 15 | #000000 #C4CED4 | 0, 19 | --t2 #C4CED4 (dark #C4CED4) |

Before and after, the ten biggest (badge ring and the stripe under the scoreboard side):
`docs/evidence/palettes/before-after.png`, with the full pages as `before-<club>.png` and
`after-<club>.png` for Cincinnati, Chicago, Seattle, Columbus, New England, San Jose, LA
Galaxy, San Diego, D.C. and Dallas. Dean may adjust any of them in Figma; the 13 reference rows
were not touched.

## Light mode and the unwalked journeys (next-wave G) — WALKED 2026-09-22

Method: a script opens each of 50 routes by deep link on the session's simulator and shoots
it (`docs/evidence/light/<theme>-light/NN-<route>.png`), relaunching the app before the tab
roots and after the routes presented as modals, whose sheet otherwise sits over the next shot.
Two dev links made it scriptable: `?themeTeam=<team id>` picks the team the app wears (the
settings theme picker) and `relive/<id>?step=N` opens a story step. Both are `__DEV__` only.

G.1, light mode under the Phillies (red accents) and the Bears (navy): every screen readable;
chips, the text fields inside cards, toggles, badges, rings, the map, the share card and the
Wrapped story all render with the team's accent, white on the team's fill. No screen was found
where something readable in dark went invisible in light.

G.2, signed out: email and code, and the six onboarding steps as a freshly created, confirmed
user (an unconfirmed user's magic link is refused as expired), both modes. One oddity: the name
field's placeholder on the first step rendered letter-spaced ("D e a n") in both modes on that
launch and normally on a later launch; the field carries no letter spacing of its own, so it is
transient (a font-loading race is the likely cause), not a style to fix.

G.3, the MLS journey in light mode: the players prompt for Inter Miami, the game page for the
2-2 draw (Duration 2:02, the four goals, Neutral) and for the 2022 MLS Cup ("LAFC won on
penalties (0–3, away–home)"), the search screen, the log sheet, the Nu Stadium stamp, the MLS
bucket list at 1 of 30, players seen with Dreyer, Messi and Suárez, Messi's page, Relive at
full time, the 2026 MLS Wrapped preview ("1 match") and the share card.

G.4, parity: `npm run parity` on 2026-09-22 (demo mode on for the run, off again after) compared
34 shots: mean 6.55% mismatch, passport-all 4.14% light and 3.55% dark, exactly the figures of
the 2026-09-16 run, so the light-mode walk changed nothing the reference measures; the worst
is relive-mid at 21.03% light (the reference's fixture story against the app's demo story).
The sheets are in `design/parity/sheets/` (reference | app | diff), for Dean to approve.


## ESPN's NFL scoreboard from the phone (social v2, prompt 3; 00_repo_reality.md R1) — CHECKED 2026-09-23

Prompt 3 proposed a paid scores feed for live NFL; the ruling is ESPN's free scoreboard, read
by the phone like the NBA CDN and ESPN's MLS summary (decision 8). Checked from this laptop
with `curl` (ESPN takes curl's default agent), fixtures in `ingest/fixtures/nfl/`:

| Request | Answer |
|---|---|
| `site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard` (no query) | 200, 283 KB, the current week (`week.number` 3, 16 events, all `STATUS_SCHEDULED` on a Tuesday night) |
| `…/scoreboard?dates=20260920` | 200, 14 events of that Eastern date, `week.number` 2 |
| `…/scoreboard?dates=20260921` | 200, 1 event: Giants at Rams, `STATUS_FINAL`, `period` 4, `displayClock` `0:00`, scores as strings (`"28"`, `"6"`) |

Shape read by `packages/core/src/providers/nfl/live.ts`: `events[].competitions[0].status.type.{name,state,completed}`,
`status.period`, `status.displayClock`, `competitors[].{homeAway,score,team.abbreviation}`.
A game is matched by club, not by ESPN's id: an nflverse id is `2026_02_NYG_LA` and the two
abbreviations that differ are **LA → LAR** and **WAS → WSH** (every other club of the 32 spells
the same on both). So the app asks for the day of the kickoff in Eastern time (`dates=`), which
is one document a poll and never the wrong week.

**Not seen, because no game was under way on 2026-09-22/23:** the in-progress vocabulary
(`STATUS_IN_PROGRESS`, `STATUS_HALFTIME`, `STATUS_END_PERIOD`) and `competitions[0].situation`
(`lastPlay.{text,type.text}`, and `lastPlay.probability.homeWinPercentage`, which ESPN's boards
carry for other sports). The parser keys on `state === 'in'` and the words HALFTIME and
END_PERIOD, reads `situation.lastPlay` when present and never requires it, and the coarse rule
only ever prompts on a score change, so an unexpected status name still reads as live and a
missing `situation` costs nothing but the return-score case. The probe on the Easter eggs page
(`jinx:///you/eggs?probe=live`) now has three NFL rows: the 2026-09-21 board, the Giants at
Rams row through the feed, and today's board with any live game's `situation` summarised.
The first game of week 3 is Thursday 2026-09-24 at 20:15 EDT; run the probe then to fill this
in.
