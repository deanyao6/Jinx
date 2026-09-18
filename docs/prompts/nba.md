# Build brief: the NBA, end to end

Written 2026-09-17 for a fresh Claude Code session on this repo. The goal is one long session
that lands 80 to 90 percent of NBA support in one go, so Dean can react to a working app the next
day rather than to a plan. Where this file says "decided", Dean decided it in conversation; do not
reopen it. Where it says VERIFY, the fact was not checked and must be, against the live source,
before code depends on it. Where it says "recommended", pick it unless the data says otherwise,
and list the choice in the report.

**Read first, in this order:** `STATE.md`, `CLAUDE.md`, `SPEC.md` (all of section 4, 5.1, 6.4 to
6.8, 6.19, 8.2, 8.5, 12 M1 and M5), `docs/subpage-style.md`, `docs/verification.md`,
`docs/elo-backtest.md`, `docs/simulator.md`. STATE.md section 7 lists the traps that cost previous
sessions hours; every one applies here.

**Another session is working on this repo at the same time**, building `docs/prompts/famous-games.md`
(famous games, superstars, personal badges). Rules of the road: `git pull --rebase` before you
start and before every push; never overwrite a file changed by a commit you did not make (rebase
and merge by hand instead); use migration timestamps starting `20260918` and pgTAP test numbers
from `040` so nothing collides; leave `famous_games`, `player_honors`, `player_moves`,
`player_firsts` and their app code alone, but DO add the NBA row to every sport-keyed table that
session creates if it lands before you finish (it is written to be keyed by `sport_id`).

Standing rules of the repo, all of which apply:

- Commit and push to `main` after each verified step. Do not sit on finished work.
- Verify against the real thing before reporting anything done: live API responses snapshotted
  into fixtures, the local database, the simulator via deep links
  (`xcrun simctl openurl booted jinx:///...`; taps cannot be scripted, see STATE.md trap 9).
- "Accepted" is not "correct": read every number you show against the database and the source.
- No em dash in UI copy (a test enforces it). No emojis. Reference icon set only. American
  spelling in UI copy. Sentence case.
- Never `supabase db reset` locally (82,240 games are loaded). `npx supabase migration up --local`
  (add `--include-all` if it refuses). `npm run db:types` after schema changes.
- Hosted rollout is pre-approved in `.claude/settings.json`: `db push`, then function deploys,
  then ingest scripts, each proven by reading the hosted database. Never delete Dean's hosted
  user (provider `apple`). Hosted holds games from 2016 on; local holds 2000 on.
- $0 data. No paid feeds. No team or league logos or marks anywhere.

---

## 1. What "done" looks like

A Jinx fan who follows the Lakers can: pick the Lakers (and Lakers players) at sign-up, see an
arena stamp in purple and gold, log a game at Crypto.com Arena by search or ticket screenshot,
check in there and pick a side at a neutral game with a working lock, open the game page and see
a scoreboard in both teams' colours, the Scoring section, moments and players seen, Relive the
game with a win probability line, get storylines before tip-off, have their Elo-based pledge
scored, see NBA rows in superlatives and goals, get an NBA Wrapped, and have the easter eggs
behave sensibly at an arena. Every sport-keyed table in the code has an `nba` row, and every
piece of UI copy says "arena" where it said "stadium".

---

## 2. Decisions already made

- **Venue nouns are per sport** (Dean, 2026-09-17): baseball is a ballpark, football a stadium,
  basketball an arena. A mixed set of venues is "venues". One table, `VENUE_NOUN` keyed by
  `sport_id`, used everywhere the word appears: stamps ("3 arenas"), bucket lists ("Every NBA
  arena", division lists say "arenas"), goals templates, superlatives, empty states, onboarding
  copy, the guide. Grep for `stadium`, `stadiums`, `ballpark`, `ballparks` across
  `apps/mobile/src`, `supabase/migrations` (the curated bucket list function), `seed/` and
  `packages/core/src` and route each through the table. The stamps page already picks a word
  when every venue is one sport; extend that rule rather than replacing it.
- **Everything keyed by sport, in one place per concern.** The tables that exist today and must
  each gain an `nba` row: `packages/core/src/elo.ts` (Elo parameters), `packages/core/src/pledge.ts`
  (lock rules and true-lock validation), `packages/core/src/scoring.ts` (scoring kinds and the
  note copy), `packages/core/src/highlights.ts` (the official highlights link), the moment
  detectors (`packages/core/src/providers/{mlb,nfl}/moments.ts`; NBA gets its own file),
  `apps/mobile/src/features/eggs/live.ts` (`EGG_SPORTS`: late-game period and the signature
  break), `apps/mobile/src/features/eggs/stamps.ts` (`RARE_MOMENTS`), `features/passport/format.ts`
  (comeback wording per sport), `features/goals/builder.ts`, `features/plan/gameDay.ts`,
  `features/checkin/lock.ts` and `features/checkin/reference/PickASideLive.tsx`,
  `features/passport/ui/MomentTrophies.tsx` (the catalogue), `features/venues/shapes.ts` (the
  default shape by sport), `features/imports/grouping.ts`, `packages/core/src/matcher.ts`,
  `supabase/functions/parse-ticket/index.ts` (the sport enum and the prompt),
  `supabase/functions/_shared/ticket.ts`, and the `sports` table check constraint in
  `supabase/migrations/20260915000100_reference_data.sql` (`check (id in ('mlb', 'nfl'))`: add
  `nba` by migration). `packages/core/src/types.ts` has `export type Sport = 'mlb' | 'nfl'`.
  Grep for `'mlb' | 'nfl'` and `in ('mlb', 'nfl')` and fix every one.
- **The build is on-demand detail** (SPEC 4.7): schedules and finals for every game, detail only
  for games someone logged, through `detail_queue`. The NBA follows that exactly.
- **Provider adapter**: implement `SportsDataProvider` (`packages/core/src/types.ts`) for the NBA
  with `fetchTeams`, `fetchSchedule`, `fetchGameDetail`, `fetchLiveState`, `fetchRoster`.
  Provider ids live in `provider` / `provider_game_id` columns; canonical ids are UUIDs.

---

## 3. Data sources (all $0, all VERIFY before building)

Verify each by fetching a real response for one recent game, one team and one season, saving it
under `ingest/fixtures/nba/` with the date in the file name, and recording the endpoint, the
headers needed, the fields used and the observed rate limits in `docs/verification.md`. Do not
write a parser against a shape you have not seen.

1. **NBA CDN static JSON** (what nba.com's own pages read; no browser spoofing believed
   necessary). Believed endpoints, all VERIFY:
   - Schedule for the whole season: `https://cdn.nba.com/static/json/staticData/scheduleLeagueV2_1.json`
     (game id, date and time, home and away team ids and tricodes, arena name and city, game
     status). Note the season it covers and whether past seasons are reachable at all from here.
   - Today's scoreboard: `https://cdn.nba.com/static/json/liveData/scoreboard/todaysScoreboard_00.json`
     (live status, period, game clock, scores). This is the live-state source for check-in.
   - Box score: `https://cdn.nba.com/static/json/liveData/boxscore/boxscore_{gameId}.json`
     (players with minutes, points, rebounds, assists; arena; attendance; officials).
   - Play-by-play: `https://cdn.nba.com/static/json/liveData/playbyplay/playbyplay_{gameId}.json`
     (period, clock, action type, scoring flag, score after, player, description).
   Check how far back liveData files exist (they may only cover recent seasons).
2. **stats.nba.com** (unofficial, undocumented, blocks non-browser clients, rate-limited, stricter
   terms). Needed for history the CDN does not carry. Believed endpoints, all VERIFY:
   - `https://stats.nba.com/stats/scheduleleaguev2?Season=2016-17&LeagueID=00` or the older
     `leaguegamefinder` / `leaguegamelog` for finals by season.
   - `boxscoretraditionalv3?GameID=`, `playbyplayv3?GameID=`, `winprobabilitypbp?GameID=`
     (a per-play home win probability, which is what Relive's line needs; if it exists the
     `game_wp_timeline` path is direct, otherwise compute a simple state-based model as SPEC
     4.3b allows, documented like `docs/elo-backtest.md`).
   - `commonteamroster?TeamID=&Season=` for rosters, `commonallplayers` for ids and names.
   Required request headers (VERIFY): a browser `User-Agent`, `Referer: https://www.nba.com/`,
   `Origin: https://www.nba.com`, `Accept: application/json`. Throttle to roughly one request per
   second with backoff on 429 and 5xx; cache every response on disk under `ingest/.cache/nba/`
   the way `ingest/src/nfl/assets.ts` caches nflverse files, so reruns and backfills never
   refetch.
3. **Licensing**: the same posture as the MLB source (SPEC 4.2): fine for a hobby app and a
   TestFlight group, to be revisited before any public App Store launch. Write that into
   `docs/verification.md` and `docs/attribution.md` (attribution copy for the NBA data, worded
   without league marks).

Game id and season facts to VERIFY: NBA game ids look like `0022400001` where the third digit
is the game type (001 preseason, 002 regular season, 003 all-star, 004 playoffs, 005 play-in,
believed) and `24` is the season start year. The app's `games.season` is an integer: use the
season's START year (2024 for 2024-25), and add the NBA rule to Wrapped's "which season is
current" logic (`features/wrapped`: NFL already treats January and February as the previous
season; the NBA runs October to June). Game times are published in Eastern or UTC (VERIFY) and
must be stored as UTC in `scheduled_start`.

---

## 4. Reference data and seeds

- **Teams**: `seed/nba_teams.json` in the shape of `seed/nfl_teams.json` (`abbr`, `city`, `name`,
  `franchise`, `active`, `first`, `last`, `aliases`, `home_venue_key`), 30 active teams plus the
  relocations and renames inside 2000 to 2026 as separate rows on one `franchise` (Seattle to
  OKC, New Jersey to Brooklyn, Vancouver to Memphis, Charlotte Hornets / Bobcats naming, New
  Orleans Hornets to Pelicans; VERIFY each year). Provider ids from the NBA team id (VERIFY the
  numeric ids, e.g. Lakers 1610612747).
- **Venues**: `seed/nba_venues.json` in the shape of `seed/nfl_venues.json`: all 29 current
  arenas (two teams share Crypto.com Arena) plus the former arenas that hosted games since 2000
  (Oracle Arena, the Palace of Auburn Hills, Amway Center's predecessor, KeyArena, Bradley
  Center, the Meadowlands, Charlotte Coliseum, the Alamodome's predecessor, and so on; VERIFY
  each with opened and closed years). Coordinates, `geofence_m` (arenas are smaller than
  stadiums: recommended 250), `sports: ['nba']`, `provider_ids.nba_arena_id` (VERIFY the CDN
  arena id field), aliases for naming-rights changes, `home_teams`. Fill elevations with
  `seed/scripts/fill_elevations.py` (it is resumable and writes `seed/venue_elevations.json`;
  Denver's Ball Arena will pass the altitude superlative's 1,000 ft bar, which is the point).
  International and neutral-site games (London, Mexico City, Paris, Abu Dhabi, the in-season
  tournament final in Las Vegas) need venue rows too or the schedule upsert must tolerate an
  unknown venue the way the MLB one does; check `packages/core/src/ingest/writer.ts`.
- **Team colours**: 30 palettes in `seed/team_colors.json`, `source: 'hand_tuned'`, following
  the rules in that file's `_comment` (fill the same in both themes, hand-tuned dark accents,
  4.5:1 on both screens). Run `python3 seed/scripts/check_team_colors.py` and `npm run
  seed:colors:check` until clean. Near-black fills (Spurs, Nets) are handled at runtime by the
  luminance rule in `apps/mobile/src/theme/ThemeProvider.tsx`; still give them a readable dark
  accent.
- **Venue shape**: add an `arena` placeholder shape to the set (`ballparkA`, `dodger`, `wrigley`,
  `oracle`, `bowl`, `canopy`, `colonnade` today). The shapes are drawn in `design/reference.html`
  and generated into the app by `npm run build:design` (read `scripts/` to see how): add the new
  symbol to the reference's shape set without touching the existing ones, so `npm run parity`
  is unaffected, then regenerate. `features/venues/shapes.ts` maps sport to a default shape:
  `nba` gets `arena`. Draw it in the same 64×64 stroke style: an oval bowl with a court
  rectangle and centre circle, no marks.
- **Aliases**: team aliases (nicknames, old names, "Sixers", "Cavs", "T-Wolves", "Blazers") for
  ticket parsing and search.
- **Seed pipeline**: `seed/scripts/build_seed_sql.py` (and `seed/scripts/venues.py`) merge the
  sport files; add the NBA files. Because local and hosted are already seeded, the migration that
  adds the `nba` sport must also insert the NBA teams, venues, aliases and colours (generate the
  statements from the JSON; the earlier migrations `20260917000600` and `20260917000500` show
  the pattern of a migration carrying seed updates), and the curated bucket lists function
  (`rebuild_curated_bucket_lists()` in `20260915000900_goals_bucket_lists.sql`, replaced in
  `20260917000500`) must produce "Every NBA arena", the six divisions, and NBA achievement lists
  (see a buzzer-beater, see an overtime game, see a 50-point game).

---

## 5. Ingest

Mirror `ingest/src/mlb/` (client, provider, backfill, detail, relive, rosters) as `ingest/src/nba/`,
with the client in `packages/core/src/ingest/nbaClient.ts` and the parsers in
`packages/core/src/providers/nba/` so Edge Functions can share them (`npm run functions:sync`
copies `packages/core/src` into the functions).

- `backfill.ts --from 2000 --to 2026 [--force]`: schedules and finals per season, resumable
  through `ingest_progress` like the MLB one, idempotent upserts through `upsertGames`. Locally
  run the full range; on hosted run `--from 2016`. About 1,230 regular-season games a season
  plus playoffs; report the row count and the database size after (`docs/progress.md` records
  M1's size bar).
- `detail.ts --pending` and the queue drain: box score to `game_appearances` ("appeared" = any
  minutes or any stat line), play-by-play to `game_scoring_timeline` with `kind` and the scorer
  (every NBA score names the scorer; kinds: `three`, `two` (with `dunk`, `layup`, `jumper` where
  the action type says), `free_throw`, and `and_one` when a free throw follows a made basket by
  the same player: fold free throws into the preceding basket's row for display exactly as the
  NFL folds the PAT, keep every row in the table), context (attendance, duration if published),
  moments (section 6), `game_wp_timeline` if the win probability endpoint exists. Recheck
  once about 12 hours after the final like MLB.
- `relive.ts --attended [--rebuild]`: story steps. An NBA game has 90 to 120 scoring plays,
  far more than the one-step-per-score rule in SPEC 6.19 can carry at 1.7 s a step.
  Recommended: pregame step; a step for every lead change and tie; every score in the last three
  minutes of regulation and all of overtime; the end of each period; capped at about 40 steps,
  and always the final. Document the rule in `packages/core/src/ingest/relive.ts` next to the
  others and keep it a per-sport table.
- `rosters.ts`: current rosters for the picker (`team_rosters`, see `20260917000900`).
- Live: generalise `supabase/functions/mlb-live` into a sport-keyed live sync, or add `nba-live`
  on the same schedule (every 60 s while anyone is checked in). `game_live_state` has `inning`
  and `inning_state` columns: for the NBA store the period in `inning` and the clock in
  `inning_state` ("Q4 2:31"), or add nullable `period` and `clock` columns by migration and make
  the app read whichever is present. Say which in the report.
- Elo: `ingest/src/elo/run.ts --sport nba`. Parameters in `packages/core/src/elo.ts`:
  recommended starting point K = 20, home advantage 100, season regression 1/4 toward 1500, no
  margin multiplier (VERIFY by backtest); print log loss across 2016 to 2025 and record the
  chosen values in `docs/elo-backtest.md` like the other two sports. Freeze `game_win_prob`
  before tip-off.
- Storylines: the facts builder (`packages/core/src/storylines/facts.ts`) is sport-neutral over
  results; check `hasSomethingToSay` and the significance rules (postseason, season opener, home
  opener) work with the NBA schedule (82 games, play-in, in-season tournament) and that the
  validator's team-name rules cope with "76ers" and "Trail Blazers".
- Jobs: `.github/workflows/daily-jobs.yml` gets the NBA schedule refresh, pending detail,
  rosters and Elo; the scheduled Edge Function path handles the queue every 15 minutes if
  `mlb-sync` is generalised, otherwise add `nba-sync` on the same cron with a migration for
  `cron.schedule` (see `20260917000200_scheduled_calls_relive.sql` for how calls are made and
  proven through `net._http_response`). Add every new command to `CLAUDE.md`.

---

## 6. Rules per sport (all in code as tables with tests)

- **Pledge lock** (SPEC 6.4 defines MLB and NFL only). Recommended for the NBA: lock at the end
  of the first quarter, with no first-score rule (a first basket comes within seconds and would
  make picking impossible). Estimate without live data: tip-off plus 30 minutes. True-lock
  validation from play-by-play: the wall-clock time of the last play of the first period; keep
  the 60 s grace and the "missing timestamps stay valid" rule. Add the NBA cases to
  `packages/core/src/pledge.test.ts` (pledge before Q1 ends, after, missing timestamps).
- **Check-in window**: unchanged (3 h before to 1 h after final).
- **Moments** (`packages/core/src/providers/nba/moments.ts`): overtime game; buzzer-beater
  (game-winning or tying field goal with 1.0 s or less on the clock at the end of the fourth
  quarter or an overtime); 50-point game; triple-double; a 20-point comeback win (from the
  scoring timeline, like the NFL 14-point rule); a 20-rebound or 20-assist game. Each a pure
  detector with fixture tests. Rare (gold stamp) moments for `RARE_MOMENTS`: buzzer-beater,
  50-point game, quadruple-double, an overtime win.
- **Superlatives**: the SQL computes them from context columns, so they work once detail has
  attendance and duration; add "Highest-scoring game" wording that is sport-aware if the copy
  says runs or points anywhere.
- **Goals and bucket lists**: templates that say "ballparks" or "stadiums" go through
  `VENUE_NOUN`; the `hr_ballparks` template is MLB-only and stays so; add an NBA equivalent
  ("See a 3-pointer in 5 arenas" is silly; "See a buzzer-beater" and "Visit 5 arenas" are not).
- **Easter eggs** (`EGG_SPORTS` in `features/eggs/live.ts`): `nba` row with `liveFeed: true`
  once the live sync exists, late from the fourth quarter, signature break = halftime, confetti
  pieces = a basketball, a sneaker, a towel (drawn in the reference stroke style, no marks).
  The rally cap and stretch confetti then work at arenas.
- **Scoring section and Relive copy**: "Three, Stephen Curry", "And-one, LeBron James",
  "Free throws, Joel Embiid (2 of 2)", "Dunk, Anthony Edwards". `scoringWhen` gives "Q3 4:12"
  and "OT 1:03".
- **Records, rooting, companions, feed**: sport-neutral already; add NBA cases to
  `packages/core/src/records.test.ts` for a tie (NBA games cannot tie; assert the parser never
  emits one).

---

## 7. App

- Onboarding and Settings > Favorites: the league picker lists the NBA; team tiles and rows work
  from the seed; the players prompt lists NBA rosters.
- Search and manual logging: NBA games appear with the arena; doubleheaders do not exist.
- Ticket import: `parse-ticket`'s schema and prompt accept `nba`; the matcher's fixture suite
  (`packages/core/src/matcher.test.ts`) gains at least 6 NBA ticket strings (Ticketmaster,
  SeatGeek, StubHub styles, a naming-rights alias, a nickname-only team).
- Game page, Scoring, Moments, Players seen, Relive, Pick a side, storylines, Wrapped, goals,
  bucket lists, stamps, map: each opened on the simulator for a real logged NBA game and
  screenshotted; put the screenshots under `docs/evidence/nba/` and cite them in
  `docs/progress.md`.
- Copy: every `stadium`/`ballpark` string routed through `VENUE_NOUN`; the copy test still
  passes; `docs/interactions.md` updated for anything new.
- Demo mode and `npm run parity` are untouched (the reference has no NBA screens).

---

## 8. Order of work and checkpoints (commit and push at each)

1. VERIFY every data source in section 3 with real fetches; fixtures and `docs/verification.md`.
   Stop and report if the schedule history or play-by-play is not obtainable for free: that
   changes the plan and Dean should decide.
2. Seeds (teams, venues, colours, aliases, shape) and the migration adding the sport plus its
   seed rows and constraint changes; pgTAP from `040`; `npm run db:test`; `npm run db:types`.
3. Client, provider, parsers with fixture tests; `npm test` in `packages/core`.
4. Backfill 2000 to 2026 locally; report counts and database size.
5. Queue drain and detail for a logged NBA game (log one for the local user with handle
   `deanyao6` by inserting an attendance; the trigger queues it), Relive, moments; check every
   number on the game page against the box score.
6. Live sync, pledge lock, Elo with the backtest, storylines for an upcoming NBA game.
7. Rules tables: eggs, scoring copy, goals, bucket lists, venue nouns; the copy sweep.
8. Simulator pass with screenshots; `npm test`, `npm run typecheck`, `npm run lint`,
   `npm run db:test`, `npm run functions:test`, `npm run functions:check`.
9. Hosted: `db push`, deploy the changed functions, backfill `--from 2016`, rosters, Elo; prove
   each by reading hosted. Update `STATE.md` (sections 3 and 5 especially: what works, what
   needs Dean, what is unverified), `docs/progress.md`, `docs/deploy.md` (jobs and costs),
   `CLAUDE.md` (commands, the "MLB + NFL in v1" line).

Expect to stop short of 100 percent. What matters is that each committed step is verified, the
report says exactly what was seen working and what was not, and nothing claims more than it is.

---

## 9. Report back

Short. For each data source: the endpoint, whether it worked, the limits seen. Row counts and
database size after backfill. The Elo backtest numbers. Which recommended choices you took
(lock rule, Relive step rule, live-state columns, geofence radius). What is unverified on a
device. What needs Dean (seed values he should eyeball such as colours, anything licensing).
Every VERIFY resolved with what was found.
