# Build brief: famous games, superstars, and personal badges

Written 2026-09-17 for a fresh Claude Code session on this repo. Dean approved every decision in
this file in conversation that day; where it says "decided", do not reopen it. Where it says
VERIFY, the fact was not checked and must be, against the live source, before code depends on it.

**Read first, in this order:** `STATE.md`, `CLAUDE.md`, `SPEC.md` (sections 4, 5, 6.7, 6.8, 6.16,
6.18), `docs/subpage-style.md`, `docs/verification.md`. STATE.md section 7 lists the traps that
have each cost a session hours; every one of them applies here.

Working rules for this build, all of them standing rules of the repo:

- Commit and push to `main` after each verified step. Dean's rule; do not sit on finished work.
- Verify against the real thing before reporting anything done: the local database, real API
  responses, the simulator via deep links (`xcrun simctl openurl booted jinx:///...`). "The code
  exists" and "the test passes" are not evidence that a screen looks right or a fact is true.
- "Accepted" is not "correct": read model and data output against the database, every time.
- Never an em dash in UI copy (a test enforces it). No emojis. Reference icon set only. American
  spelling in UI copy. Sport-neutral wording, keyed by `sport_id`, so a new league adds a row.
- Never `supabase db reset` on local (82,240 games are loaded). Apply migrations with
  `npx supabase migration up --local` (add `--include-all` if it refuses).
- Hosted rollout is pre-approved in `.claude/settings.json`: `db push` first, function deploys
  second, ingest scripts third, and prove each by reading the hosted database. Never delete
  Dean's hosted user (provider `apple`).
- The build is MLB and NFL today. Design every table, rule and file so that adding the NBA later
  is a row and a provider, not a rewrite. Dean intends to add it.

---

## 1. What is being built

Three layers, one badge, one count.

1. **Famous games**: a game that is famous on its own. Three sources: automatic from the schedule
   (championships and the round before), a curated file (the approved list in section 5), and
   personal ones computed per fan from their favourite players (section 4).
2. **Superstars**: a definition of "star" from awards, so "Players seen" on a game page can show
   home runs plus stars, and so the curated layer can talk about debuts and trades.
3. **Personal badges**: "Saw Jhoan Duran's first days as a Phillie", "Saw Bryce Harper's MLB
   debut", "Saw DeVonta Smith's first touchdown". Only for a fan's favourite players, so they
   stay rare and mean something to that person.

Decided by Dean:

- A famous game is a **badge on the game** and a **count on the Passport**, not a gold stamp on
  the stadium. Gold stamps already mean "you saw something rare here".
- The Passport gets a **"Famous games" superlative** with a gold seal icon and the count.
  Tapping it opens a page listing them, grouped by league, then team, each row opening the game.
  Other people's profiles show the same count.
- **A feed event** when someone logs a famous game: "Dean was at Super Bowl LIX." Yes.
- **Superstar window Z = 3 seasons.** Bars in section 3. Curated franchise players per team.
- Personal badge wording is **"first days as a Phillie"**, not "first home game", because the
  data cannot prove which game was strictly first (section 4 explains).
- Championship and conference-title games need no curation: they come from the schedule.

---

## 2. Where things are (as of 2026-09-17)

| What | Where |
|---|---|
| Games, teams, venues, attendances, `game_appearances`, `game_scoring_timeline` (now with `kind`, `scorer_player_id`, `scorer_name`), `game_story_steps` (with `kind`) | `supabase/migrations/`, latest `20260917001000_scoring_scorers.sql` |
| Stats payload incl. superlatives, computed in SQL | `supabase/migrations/20260917000600_superlatives_v2.sql` (the latest definition of the stats function; earlier ones in `20260915000500_stats.sql`) |
| Favourite players | `user_players` table, `20260916000300_favorite_players.sql`; app hooks in `apps/mobile/src/features/players/queries.ts` |
| Current rosters (MLB 40-man from the Stats API, NFL from nflverse weekly rosters) | `team_rosters` table, `20260917000900_team_rosters.sql`; `ingest/src/mlb/rosters.ts`, `ingest/src/nfl/rosters.ts`; daily jobs in `.github/workflows/` |
| MLB client and provider | `packages/core/src/ingest/mlbClient.ts`, `mlbProvider.ts`; parsers in `packages/core/src/providers/mlb/` |
| NFL (nflverse) pipeline | `ingest/src/nfl/` (`assets.ts` downloads release files with ETag cache; `run.ts`, `appearances.ts`, `rescore.ts`, `relive.ts`) |
| Superlative rows shown on the Passport and the view-all page | `apps/mobile/src/features/passport/format.ts` (`superlativeRows`), `features/data/supabase.ts` (`toSuperlatives`, `SUPERLATIVE_ICONS`), `features/passport/reference/parts.tsx` (Passport tab, a reference screen), `app/passport/superlatives.tsx` |
| Game page | `apps/mobile/src/app/games/[gameId].tsx`; scoreboard and section pieces in `features/games/ui/` (`Scoreboard`, `SideTheme`, `ScoringSection`, `TeamBadge`) |
| "Players seen" on a game page | `apps/mobile/src/features/games/notable.ts` |
| Feed | `feed_events` table and `feed` RPC in `20260915000800_social.sql` and `20260915001300_social_gaps.sql`; the app's `features/social/copy.ts` turns a type into a sentence; `FeedEventCard` draws it |
| Post-final processing (where feed events for logging and milestones are written) | `attendances_after_write()` and `process_game_final()` in `20260915000500_stats.sql` |
| Easter eggs and the rare-moment table (a sibling idea; keep them separate) | `apps/mobile/src/features/eggs/` |
| Seeds and the seed pipeline | `seed/*.json`, `seed/scripts/build_seed_sql.py`, `seed/scripts/venues.py`, `supabase/seed.sql` |
| Verified external facts | `docs/verification.md` (append a section for every VERIFY below) |
| Design rules and shared kit | `docs/subpage-style.md`; `Card`, `SectionHeader`, `StatTile`, `PageIntro`, `IconTile`, `Row`, `EmptyState`, `PersonAvatar` |

Two data facts that shape the matcher:

- `games.scheduled_start` is UTC. A 7 pm ET game is the same UTC date; an 8 pm ET or a 5 pm PT
  game is the next UTC date. Matching a curated entry by UTC date missed the 2022 World Series
  Game 3, Tom Brady's last game and Freddie Freeman's grand slam. Match on the venue's local date
  (venues have coordinates; a timezone per venue is the honest way, else UTC date within one day
  plus both teams).
- Team abbreviations in `games` join through `teams`; relocations carry `franchise_id`. Curated
  entries name teams by abbreviation and sport; resolve through `teams` with the season in mind
  (OAK/LV, SD/LA Chargers, STL/LA Rams, WSH).

---

## 3. Superstars

Decided: a player is a superstar for a game if, in that game's season or any of the previous
three, they met an award bar. Season-leader stats alone are not enough (one big sack year is a
fluke, in Dean's words).

Bars:

- **MLB:** MVP or Cy Young winner, or top 5 in the voting if placements are available; Rookie of
  the Year winner; an All-Star selection.
- **NFL:** MVP winner or top 5 in the voting; first-team All-Pro; Pro Bowl selection.
- **Curated:** `seed/franchise_players.json`: one to three names per team per era, plus a short
  override list for the transcendent tier (Ohtani, Judge, Harper, Mahomes, Hurts, Barkley and the
  like). Dean owns this file's contents; ship a first draft for him to edit and say so.

Data, with what must be verified:

- MLB awards: the Stats API has an awards endpoint (VERIFY the exact path and shape; the
  documented family is `GET /api/v1/awards` for the award list and
  `GET /api/v1/awards/{awardId}/recipients?season=YYYY` for winners; award ids such as `ALMVP`,
  `NLMVP`, `ALCY`, `NLCY`, `ALROY`, `NLROY`, and the All-Star selections are believed to be
  there too). Snapshot real responses into `ingest/fixtures/mlb/` and record the shape in
  `docs/verification.md`. **Voting placements (top 5) are probably not in that API.** If they are
  not, the MLB bar is winners plus All-Stars, and say so in the report rather than inventing a
  source.
- NFL awards: no free structured source is known. Check the nflverse releases for any Pro Bowl or
  All-Pro flags (VERIFY; `players.csv` and the rosters carry none that we know of). Failing that,
  a hand-kept file `seed/nfl_awards.json` with season, award (`mvp`, `mvp_top5`, `all_pro_1st`,
  `pro_bowl`), player gsis id and name: about sixty rows a season. Ship it filled for the last
  three seasons from public record, with the source URL for each season noted in
  `docs/verification.md`, and flag that Dean should skim it.
- Storage: `player_honors(player_id, season, honor text, source text, primary key (player_id,
  season, honor))`, reference data, service-role write. A SQL function or view
  `is_superstar(player_id, season)` = any row within `[season-3, season]` or a curated match.
- Daily job: refresh the current season's honors (MLB automatic; NFL from the file).

App: `features/games/notable.ts` shows "Players seen" as home runs plus superstars (decided:
home runs, and superstars). Keep the "Drove in a run" rows out unless the batter is a star.

---

## 4. Personal badges (favourite players only)

All computed for the signed-in fan from their `user_players`, their attended games, and
`game_appearances` for those games (detail exists for every attended game).

| Badge | Rule | Data |
|---|---|---|
| "Saw {name}'s first days as a {Nickname}" | The fan attended a game of the player's new team within 14 days after the player joined it, and the player appeared in that game | MLB: the Stats API transactions feed (VERIFY: `GET /api/v1/transactions?teamId=&startDate=&endDate=`, fields for player id, date, type such as trade or signing or selection). NFL: the weekly rosters already ingested; the first week a player's `team` changes is the join date (verify against 2025 examples). Store `player_moves(player_id, team_id, joined_on, kind, source)` |
| "Saw {name}'s MLB debut" | The fan attended the game on the player's debut date and the player appeared | MLB people endpoint carries `mlbDebutDate` (VERIFY field name on `GET /api/v1/people/{id}`). Store on `players.debut_on` |
| "Saw {name}'s rookie season" | Player's entry year equals the game's season and the player appeared | nflverse `players.csv` has an entry or rookie year column (VERIFY the column name); MLB uses `debut_on` year |
| "Saw {name}'s first touchdown" | The fan attended the game with the player's first NFL touchdown | Computed at NFL ingest from the season play-by-play files for every game (they are downloaded already), stored as `player_firsts(player_id, kind 'first_td', game_id)`. Only for seasons the pipeline has processed; note the floor |
| MLB first home run | Not built | Not in the free data for games nobody logged. Leave out rather than guess |

Why "first days" and not "first home game": detail (appearances) exists only for logged games,
so the app cannot know whether the player appeared in an earlier, unlogged home game. Fourteen
days after the join date is what can be proven. Say this in the UI copy if a fan taps for the
explanation; do not overclaim.

Personal badges show with a "Yours" label, count in the Famous games total, and are recomputed
when favourites or attendances change (a trigger on `user_players` already refreshes the stats
cache; extend the same path).

---

## 5. The curated list, verified against the games table on 2026-09-17

Automatic (no curation): for every season since 2016, the last postseason game of the season
(championship) and the two before it (conference or league championship games) for both sports.
The query used to check them is in the session notes; the rule is "order the season's postseason
games by start, take the last three for NFL and the last one for MLB, then the two LCS clinchers
for MLB by finding the last game between each pennant winner and its opponent". VERIFY the MLB
LCS rule produces exactly two games per season on local data before trusting it.

Curated entries. Dates are the game's local date; every one below was found in the local games
table by that date, except the three marked `+1 UTC`, which were only found when allowing the
next UTC day, which is the reason for the local-date matching rule.

Eagles (NFL, PHI):

| Local date | Game | Category | Title |
|---|---|---|---|
| 2018-01-21 | MIN 7 at PHI 38 | playoff | NFC Championship, the Linc's loudest night |
| 2018-02-04 | PHI 41 at NE 33, U.S. Bank Stadium | championship | Super Bowl LII, Foles and the Philly Special |
| 2021-09-12 | PHI 32 at ATL 6 | debut | DeVonta Smith's first touchdown |
| 2023-01-29 | SF 7 at PHI 31 | playoff | NFC Championship |
| 2023-02-12 | PHI 35 at KC 38, State Farm Stadium | championship | Super Bowl LVII (a loss; still famous) |
| 2024-12-29 | DAL 7 at PHI 41 | record | Saquon Barkley's 2,000-yard game |
| 2025-01-26 | WAS 23 at PHI 55 | playoff | NFC Championship |
| 2025-02-09 | PHI 40 at KC 22, Caesars Superdome | championship | Super Bowl LIX |

Phillies (MLB, PHI):

| Local date | Game | Category | Title |
|---|---|---|---|
| 2019-03-28 | ATL 4 at PHI 10 | debut | Bryce Harper's Phillies debut (Opening Day at Citizens Bank Park; it was at home) |
| 2022-10-14 | ATL 1 at PHI 9 | playoff | NLDS Game 3, the Hoskins bat spike |
| 2022-10-23 | SD 3 at PHI 4 | playoff | NLCS Game 5, the swing of his life |
| 2022-11-01 `+1 UTC` | HOU at PHI, World Series Game 3 | record | Five home runs at Citizens Bank Park |

Around the leagues:

| Local date | Game | Category | Title |
|---|---|---|---|
| 2016-11-02 | CHC 8 at CLE 7 (stored 2016-11-03 UTC) | championship | Cubs win Game 7, 108 years |
| 2017-02-05 | NE 34 at ATL 28, NRG (stored as Reliant Stadium) | championship | Super Bowl LI, back from 28–3 |
| 2018-01-14 | NO 24 at MIN 29 | playoff | The Minneapolis Miracle |
| 2021-08-12 | NYY 8 at CWS 9 | record | The Field of Dreams game |
| 2022-01-23 | BUF 36 at KC 42 | playoff | Thirteen seconds |
| 2022-10-04 | NYY 5 at TEX 4 | record | Aaron Judge's 62nd home run |
| 2023-01-16 `+1 UTC` | DAL at TB | farewell | Tom Brady's last game |
| 2024-09-19 | LAD 20 at MIA 4 | record | Ohtani's 50/50 game |
| 2024-10-25 `+1 UTC` | NYY at LAD, World Series Game 1 | record | Freddie Freeman's walk-off grand slam |

Dean will add more for other teams; the file must make that a one-line job. Titles are UI copy:
sentence case, no em dashes, en dashes in scores.

File: `seed/famous_games.json`, one object per entry: `sport`, `local_date`, `home`, `away`
(abbreviations as in `teams`), `category` (`championship | playoff | record | debut | farewell`),
`title`, `story` (one sentence), `about` (`league | team`, and the team abbreviation when `team`).
A script resolves each to a `games.id` and refuses to build if any entry matches zero or more
than one game (doubleheaders: add `game_number`).

---

## 6. Schema

New migration(s), plain SQL, every policy and constraint with a pgTAP test in `supabase/tests`
(next numbers: 018 onward). Reference data is readable by authenticated, written by the service
role only.

- `famous_games(id uuid pk, game_id uuid references games unique per source, source text
  check in ('schedule', 'curated'), category text, title text, story text, about_team_id uuid null,
  created_at)`. Championship rows are generated by a SQL function `rebuild_schedule_famous_games()`
  run after ingest (and callable from the daily job), curated rows by the seed script; both
  idempotent.
- `player_honors(player_id, season, honor, source)`, `player_moves(player_id, team_id, joined_on,
  kind, source)`, `player_firsts(player_id, kind, game_id)`, `players.debut_on date null`.
- `is_superstar(player_id uuid, season int) returns boolean`.
- `my_famous_games()` RPC for the signed-in user: famous rows for their attended games plus the
  personal badges computed on the fly, with the game, league, team and a `personal` flag. Through
  RLS as the user; PostgREST caps at 1000 rows, so aggregate on the server.
- The stats payload gains `famous_games: { count, personal_count }` so the Passport count and
  the profile count need no extra query. Recompute in `process_game_final` and the favourites
  trigger.
- Feed: a new `feed_events.type` value `famous_game` written in `attendances_after_write()` when
  a logged game has a famous row (and when a famous row appears later for an already-logged
  game, from the rebuild function). Respect the existing visibility rules; add the sentence in
  `features/social/copy.ts` ("was at Super Bowl LIX").

Regenerate app types with `npm run db:types`. Run `npm run db:test`.

---

## 7. App

- **Game page**: a badge card near the top, under the scoreboard, in the "about" team's colours
  (`SideTheme`) or the home side's for league-wide games: gold seal icon (reuse the gold metal
  in `components/reference/Seal.tsx` at small size, or the `i-spark` icon on a gold-washed
  tile), the title, the story. Personal ones add a "Yours" kicker.
- **Game rows** (History, the record game log): a small gold mark.
- **Passport**: a "Famous games" superlative row (icon gold, value the count, context "2 personal")
  in `superlativeRows`, tapping to the new page. Demo mode fixtures must not change (`npm run
  parity` compares the Passport with `design/reference.html`).
- **New page** `app/passport/famous.tsx`, registered in `app/passport/_layout.tsx`: `PageIntro`
  (kicker "Famous games", title the count), then `SectionHeader` per league, then per team, rows
  with the gold mark, title, date and matchup, opening the game. `EmptyState` with copy that
  says what counts. The reachability test must pass (the superlative row is the way in).
- **Other profiles** (`app/u/[handle].tsx`): the count as a `StatTile` when visible under the
  existing privacy rules; no list for other people.
- **Players seen** (`features/games/notable.ts`): home runs plus superstars, with the honor that
  made them a star as the caption ("2024 All-Star", "MVP 2023").
- Every string sport-neutral; the categories and honors are tables keyed by sport.

Tests: pure rules (matcher, superstar window, each personal badge rule, the copy), RNTL for the
page and the badge card, pgTAP for schema and RLS, ingest parsers with real fixtures.

---

## 8. Ingest and jobs

- `ingest/src/mlb/honors.ts`, `ingest/src/mlb/moves.ts`, `ingest/src/mlb/debuts.ts` (batch the
  people lookups; rate-limit through `MlbClient`).
- `ingest/src/nfl/honors.ts` (from the seed file or nflverse if found), `moves.ts` (from the
  weekly rosters), `firsts.ts` (first touchdown from season play-by-play, using the scorer rule
  in `packages/core/src/scoring.ts`).
- `seed/scripts/build_famous_games.py` or a tsx script: resolves the curated file to game ids,
  writes SQL, refuses on ambiguity.
- Wire into `.github/workflows/daily-jobs.yml` and `nfl-ingest.yml`. Add commands to `CLAUDE.md`.
- Run everything against local, then paste real output in the report: the famous rows for Dean's
  three attended games (he was at CHI at PHI 2025-11-28, PHI at LAD 2025-09-17, DET at SF
  2026-08-08: none is famous, so the count should be 0 and that is the correct answer), the
  championship rows for 2024 (should include KC 22 at PHI 40 on 2025-02-09), and `is_superstar`
  for Bryce Harper in 2025 (expected true if the honors ingest works).

---

## 9. Hosted rollout, then a build

In order, each verified by reading the hosted database:

1. `npx supabase db push --linked --yes`.
2. `npm run functions:sync && npx supabase functions deploy mlb-sync --project-ref vekdufflzklfxljqufbq`
   if the shared writer changed.
3. With `/tmp/hosted.env` loaded: the new ingest scripts, then the curated seed script against
   hosted.
4. Update `STATE.md` (what is true now, what needs Dean), `docs/progress.md` (evidence),
   `docs/verification.md` (every verified fact), `docs/interactions.md` (every new control).

A TestFlight build needs Dean (`eas submit` with his Apple login); the next one must be a fresh
native build regardless, for reasons already in STATE.md.

---

## 10. Report back

Short. Files changed; every VERIFY resolved with what was found; the pasted real outputs from
section 8; what Dean should edit (the franchise players file, the NFL awards file); anything
unsure, as questions with a recommendation.
