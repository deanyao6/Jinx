# Build brief: the next wave

Written 2026-09-22 for a fresh Claude Code session on this repo, from a 25-point list Dean
answered item by item that evening. Where this file says "decided", Dean decided it; do not
reopen it. Where it says VERIFY, the fact was not checked and must be, against the live source,
before code depends on it. Where it says "recommended", pick it unless the data says otherwise,
and list the choice in the report.

**Read first, in this order:** `STATE.md`, `CLAUDE.md`, `SPEC.md`, `docs/subpage-style.md`,
`docs/verification.md`, `docs/MLS_ROLLOUT.md`, `docs/prompts/nba.md` (for how a sport was
added end to end), `docs/elo-backtest.md`, `docs/simulator.md`. STATE.md section 7 lists the
traps that cost previous sessions hours; every one applies here.

**Another person is working on this repo at the same time.** Arjun owns game search. His
search v2 (`search_games_v2`, `search_entities_v2`, the `features/games/search/` screen, behind
`EXPO_PUBLIC_SEARCH_V2`) merged to main on 2026-09-22; `docs/SEARCH_PLAN.md` and
`docs/evidence/search/README.md` describe it. Rules of the road: `git pull --rebase` before
you start and before every push; never overwrite a file changed by a commit you did not make
(rebase and merge by hand); use migration timestamps from `20260923000100` on and pgTAP test
numbers from `046` (his took `045`); do not edit `search_games`, `search_games_v2`,
`search_entities_v2`, `packages/core/src/search.ts` or the search tests unless a task here needs
it, and then say so in the commit message. Part B.1 (stadium coordinates) and B.2 (preseason)
touch search's inputs; Dean has said a merge conflict there is acceptable.

**A third session is rebuilding the welcome screen** from `design/welcome-reference.html` and
`WELCOME_SCREEN_PROMPT.md`: it owns `app/(auth)/welcome.tsx`, `features/onboarding/ui/WelcomeArt.tsx`
and everything under `features/onboarding/ui/wall/`, plus a `welcome_wall_cards` table, a
`welcome-wall` Edge Function and a weekly cron. Do not edit those; G.2 below covers the other
signed-out screens, not welcome. Its migrations start at `20260923100000` and its pgTAP tests at
`050`, so yours (from `20260923000100` and `046`) never collide.

Standing rules of the repo, all of which apply:

- Commit and push to `main` after each verified step. Do not sit on finished work.
- Verify against the real thing before reporting anything done: live API responses snapshotted
  into fixtures, the local database, the simulator via deep links
  (`xcrun simctl openurl booted jinx:///...`; taps cannot be scripted, see STATE.md trap 9).
  Screenshot every screen you change; three restyle bugs were found only by screenshots.
- "Accepted" is not "correct": read every number you show against the database and the source.
- No em dash in UI copy (a test enforces it). No emojis. Reference icon set only. American
  spelling in UI copy. Sentence case. Venue nouns per sport (`venue_noun`).
- Never `supabase db reset` locally (118,831 games plus 4,962 MLS are loaded).
  `npx supabase migration up --local`. `npm run db:types` after schema changes.
- Hosted rollout is pre-approved in `.claude/settings.json`: `db push`, then function deploys,
  then ingest scripts, each proven by reading the hosted database. Never delete Dean's hosted
  user (provider `apple`). Hosted holds games from 2016 on; local holds 2000 on.
- $0 data. No paid feeds. No team or league logos or marks anywhere.
- Every new rule keyed by `sport_id`. Every new route needs a way in (the reachability test).

---

## Decisions Dean made on 2026-09-22 (do not reopen)

| # | Decision |
|---|---|
| 6 | The curse breaker's 30-day guard stays. |
| 7 | "Players seen" stores superstars only. A player counts as "seen" for a game when they had a good game by a per-sport box-score rule (Part D). A non-superstar earns a place only by repetition (10 or more good games seen by this fan). |
| 8 | **The app may read free public live feeds directly** (the NBA CDN, ESPN for MLS). As live as possible for every sport, as long as it costs nothing. MLB stays server-side because it already works. This amends the CLAUDE.md rule; update it. |
| 9 | Palettes: cross-check against an open-source team-colour source. Dean may also fix them in Figma. |
| 10 | `seed/franchise_players.json` is right as far as it goes (MLB and NFL). Add the NBA and MLS. |
| 12 | MLS-only stadiums get real coordinates and timezones. |
| 13 | **Only regular season and postseason games exist in Jinx for now.** Preseason and spring training go. |
| 14 | MLS second wave: all of it. A draw voids a pledge. |
| 15, 16, 17 | Handshakes in the data export, `final_at` filled, NFL detail only for logged games: all three, built. |
| 18 | Light mode: build it and Dean reacts. It follows the fan's chosen team theme like dark does. |
| 24 | NBA and ESPN attribution: add it. |
| 25 | Bug: signing out does not return to the welcome screen. |

Deferred by Dean, not for this session: App Store Connect privacy and the external group (4),
`support@example.com` and the "(draft)" privacy text (23), Pick a side at a real NBA game (20,
none until October). Ticket forwarding (2), Sentry (3) and design assets (11) are Dean's own, section H: not this session's.

---

## A. The bug first

**A.1 Sign out does not return to the welcome screen.** Reported by Dean on build 4/5. Sign out
is `useSignOut()` used from `app/settings/index.tsx:94`, `app/(tabs)/legacy-you.tsx:30`,
`app/(onboarding)/index.tsx:103` and the error splash in `app/_layout.tsx:152`. The root layout
gates on the session and does a `router.replace(pendingRoute)` at `_layout.tsx:146` for deep
links; check what it does when the session goes from present to null while a nested stack
(settings) is mounted. Expected: the `(auth)/welcome` screen, with the navigation stack cleared
so back cannot return to settings, and the query cache cleared so the next account does not see
the previous one's data for a frame. Reproduce in the simulator first, fix, screenshot, and add
a test that a session-to-null transition leaves the router on `/welcome`.

---

## B. Data and infrastructure

**B.1 Coordinates and timezones for the MLS-only stadiums (decided, 12).** On hosted, 38 of the
39 MLS-only stadiums have no `tz` and 39 have no coordinates; `seed/mls_venues.json` carries
neither (only Toyota Stadium was curated). Search and the famous-game matcher fall back to
America/New_York there, and geofenced check-in cannot work. Source the coordinates from a real
place (VERIFY: ESPN's venue objects sometimes carry an `address`; OpenStreetMap Nominatim is
free with attribution and a 1 request/second limit; Wikipedia infoboxes). Record the source per
stadium in `docs/verification.md`. Then `python3 seed/scripts/fill_timezones.py` (needs
`pip install timezonefinder`; on this machine use `/Users/deanyao/miniconda3/bin/python3`),
`build_seed_sql.py`, and a migration that updates `lat`, `lng`, `tz` and `elevation_ft`
(`fill_elevations.py`) for those rows. Extend `044_mls_venue.test.sql`'s idea: every venue with
an MLS game has a zone and coordinates. Do not guess a coordinate; if a stadium cannot be
sourced, leave it null and list it.

**B.2 Preseason and spring training go (decided, 13).** Local holds 9,763 MLB `preseason` games
and 1,940 NBA. Hosted has zero attendances on any game that is not `regular` or `postseason`
(checked 2026-09-22). Do all of: stop the backfills and syncs ingesting them (MLB
`gameType` S/E, the NBA's preseason codes, NFL has none, MLS's parser already excludes cups);
delete the existing rows on local and hosted after re-proving the zero-attendance count in the
same transaction; make `search_games`, the ticket matcher and the famous-game matcher treat
`game_type not in ('regular','postseason')` as absent in case any come back. Then the 42 MLB
spring-training and minor-league parks without coordinates have no games and can be deleted
from the seed and the database, which closes STATE.md's "42 venues unresolved" item. A pgTAP
test asserts no preseason game exists. Note the change in `docs/verification.md`.

**B.3 The MLS daily job is on (5).** `.github/workflows/mls-ingest.yml` is gated on the
repository variable `MLS_INGEST_ENABLED`. The probe run on 2026-09-22 (run 35786991281) reached
ESPN from GitHub's runner in 36 s, the variable was set the same evening, and one `sync` run was
dispatched by hand. Your job: prove it worked by reading hosted (the 2026 final count moves as
matches are played; `gh run list --workflow=mls-ingest.yml` shows the scheduled 08:45 UTC runs
going green), and if a run fails, `net._http_response` is not the place to look, the workflow
log is.

**B.4 `games.final_at` (16).** The column was meant to hold when a game ended. No ingest or sync
writes it (0 of 2,734 hosted finals this season), so check-in's "still at the game" window falls
back to start plus six hours. Fill it: MLB from the feed's game end (VERIFY the field), NFL from
the last play's timestamp or schedule data, NBA from the CDN's `gameEndTimeUTC` (VERIFY), MLS
from ESPN's status detail (VERIFY). Backfill hosted and local for logged games at least, and
have `mlb-sync` and the daily jobs write it going forward. Then the check-in window uses it.

**B.5 NFL detail only for logged games (17).** Local is 226 MB against M1's 150 MB bar because
the NFL pipeline stores `game_appearances` and play data for every game, where MLB fetches
detail only when someone logs the game (SPEC 4.7, `detail_queue`). Bring the NFL to the same
rule: keep detail for logged games and the ones famous-game matching or Relive needs, drop the
rest, and make `ingest/src/nfl/run.ts` fetch on demand through `detail_queue`. Measure before
and after with `pg_database_size`. Nothing a fan can see may change: prove it with the Relive
verifier (`npx tsx ingest/src/verify/relive.ts`) and the famous-game checks.

**B.6 Handshakes in the data export (15).** The secret-handshake easter egg writes rows that
`export_my_data()` does not include. A fan's export must contain everything Jinx holds about
them. Add them, add the row to the export test, and check nothing else added since (profile
pictures, MLS attendances, famous-game badges, pledges) is missing either.

**B.7 Attribution (24).** `docs/attribution.md` needs the NBA (cdn.nba.com, stats.nba.com) and
ESPN (NBA history, NBA win probability, MLS) lines in the same form as the MLB and nflverse
ones, and the app's About screen shows the file. No logos, no marks.

---

## C. Live state, read by the app (decided, 8)

Dean has amended the rule: **the app may read free public feeds directly for live state**. The
NBA CDN (`cdn.nba.com/static/json/liveData/scoreboard/todaysScoreboard_00.json` and the per-game
`boxscore_{gameId}.json`) and ESPN's scoreboard for MLS answer plain HTTPS from a phone. Supabase
cannot reach them, which is why NBA live state never existed (STATE.md section 3). MLB keeps its
server-side path because it works. Do not put any key in the app; these feeds need none.

Build a `LiveFeed` per sport in `apps/mobile/src/features/live/` behind the same interface the
MLB path uses, polled only while a fan is checked in or on a game page with a game under way,
with backoff, and feeding: the scoreboard on the game page, Pick a side's lock (first score for
the NBA is decided, `firstScoreLocks: false`; for MLS see E.2), the check-in window, the rally
cap and stretch-confetti eggs (`EGG_SPORTS.<sport>.liveFeed`), and `games.status` transitions in
the query cache. The server stays the source of truth for the final score: the app's feed never
writes to the database. VERIFY the CDN's headers from a device build (it works from Node with
browser headers; a fetch from React Native may differ). Update CLAUDE.md's ground rule to say
what is allowed now and what still is not (MLB Stats API, Anthropic).

---

## D. Players seen, and superstars for every sport

**D.1 Superstars for the NBA and MLS (decided, 10).** `seed/franchise_players.json` holds 10
transcendent names and 91 team rows, all MLB and NFL. Add both sports in the same shape, one to
three per team per era, plus transcendent names, from public record (Basketball Reference award
pages, MLS's own MVP and Best XI lists; VERIFY each name's years with the club). The automatic
path (`player_honors`, top-X in MVP voting, All-NBA, MLS MVP and Best XI) needs NBA and MLS
honors ingests like `ingest/src/mlb/honors.ts` and `ingest/src/nfl/honors.ts`. Dean's bar:
"they have to end up top X in MVP voting or some threshold of elite in the past Z years"; a
fluke season does not qualify. Rerun `ingest/src/famous/franchise.ts` after.

**D.2 Players seen shows superstars, for good games (decided, 7).** Today it can show a role
player ("carl jones") because any appearance counts. The rule now:

- A fan "saw" a player in a game when the player is a superstar (D.1 and `player_honors`) **and**
  had a good game by the sport's box-score rule. Recommended thresholds, the kind ESPN's
  snapshot box score shows; tune against the data and list them in the report:
  MLB batter: a home run, or 3+ RBI, or 3+ hits; MLB pitcher: 7+ innings with 2 or fewer earned
  runs, or 10+ strikeouts, or a save. NFL: a touchdown, or 100+ rushing yards, or 100+ receiving
  yards, or 300+ passing yards, or 2+ sacks, or an interception. NBA: 30+ points, or a
  triple-double, or 20+ rebounds, or 15+ assists. MLS: a goal, an assist, or a clean sheet for a
  goalkeeper.
- The niche exception: a non-superstar the fan has seen have 10 or more good games (or 10 home
  runs) earns a row too, because that is a story ("you have seen him homer ten times").
- Storage: Dean said "store superstars only". The exception needs a count for everyone, so
  either keep counting appearances for all (the detail is already fetched for logged games) and
  surface by the rule, or store only qualifying rows and recount the niche players from detail.
  Pick the cheaper one and say which.
- The superlative "seen play the most" and the tap-through list of games follow the same rule.
- Kickers: an extra point or a field goal is never a good game (Dean, 2026-09-17).

Tests in `packages/core` for every threshold, pgTAP where SQL computes it, and a screenshot of
the game page's Players seen for one game per sport.

---

## E. The MLS second wave (decided, 14)

Everything the first release turned off. Read `docs/MLS_ROLLOUT.md` for what was deferred and
why, and `packages/core/src/providers/mls/` for the parser.

**E.1 Elo with draws.** `ELO_PARAMS` excludes MLS because the binary model has no draw. Build a
three-outcome model: recommended, Elo on goal difference with a fitted draw parameter (an
ordered-logit or Davidson-style draw term on rating difference plus home advantage), tuned by
grid on 2016 to 2025 like `ingest/src/elo/sweep.ts`, scored by three-way log loss, written up in
`docs/elo-backtest.md`. Write `elo_ratings` and frozen pre-match probabilities (home, draw, away)
for every MLS game. Wire `ingest/src/elo/run.ts --sport mls`.

**E.2 Pick a side, and a draw voids the pledge (decided).** `make_pledge` currently answers
`sport_not_supported` for MLS. With E.1, a pledge at a neutral MLS match uses the three-way
probabilities; the lock rule needs deciding from the data (recommended: lock at kick-off plus
the live feed's first goal, `LOCK_RULES.mls`). When the match ends level, the pledge is **void**:
not a win, not a loss, not scored, shown as "Drawn, no result" in the pledge history and the
record, and excluded from every pledge count and superlative. SQL and core both, with tests for
regulation draws, shootout wins (the individual match is a draw, so the pledge is void even
though there is a winner on penalties: confirm with Dean in the report if that reads wrong), and
extra-time wins.

**E.3 Rosters and favorite players.** ESPN's team roster endpoint for MLS (VERIFY the path and
fields). `ingest/src/mls/rosters.ts` into `team_rosters` like the other three, the favorites
prompt on adding an MLS club, and the daily job step.

**E.4 Relive.** VERIFY whether ESPN's soccer summary carries enough (key events, commentary with
minute stamps, the win-probability series it shows on the site) to build story steps like the
NBA's. If it does, `ingest/src/mls/relive.ts --attended` with goals, cards, substitutions,
penalties and the shootout as steps, verified against an independent source for five matches
like `ingest/src/verify/relive.ts`. If it does not, say so in the report with the evidence and
leave the "not available yet" copy in place.

**E.5 Wrapped.** The MLS season is a calendar year today and a `season_key` exists for the
2027 change. Add the MLS rows to the Wrapped season tables and the sport-keyed copy, and check
a fan with only MLS attendances gets a Wrapped.

**E.6 Live.** Part C covers it; MLS is the second feed.

After all of it, the game page's "not available yet" sentence goes, and every sport-keyed table
in the code has an `mls` row (the NBA brief's checklist in `docs/prompts/nba.md` section 1 is
the list).

---

## F. Palettes (decided, 9)

125 palettes are hand-tuned to the contrast rule, not to anyone's eye: 52 MLB and NFL, 30 NBA,
30 MLS. Cross-check every one against an open-source team-colour source. Recommended:
`jimniels/teamcolors` on GitHub (VERIFY the licence permits this use and record it in
`docs/attribution.md`; VERIFY it covers all four leagues). For each team, report the source's
primary and secondary against ours, propose the change where ours is off, keep the contrast rule
(`python3 seed/scripts/check_team_colors.py` must still pass), and put the diff in a table Dean
can read in five minutes, with a simulator screenshot of the team badge and scoreboard before
and after for the ten biggest changes. Dean may then adjust in Figma; do not treat the source as
final over the reference file's 13 verbatim rows.

---

## G. Seen, not just built: light mode and the unwalked journeys

**G.1 Light mode (decided, 18).** Every screen was restyled on 2026-09-17 and verified in dark
mode only. Build light mode properly against `docs/subpage-style.md`: the accent is still the
fan's chosen team theme (the theme picker among favorite teams in settings), `accent.fill` and
`accent.solid` behave as the ThemeProvider says, cards have no outlines, and nothing that was
readable in dark is invisible in light (the Chip and TextField inside cards were once). Walk
every screen in the simulator in light mode with the Phillies theme and one dark-navy team (the
Bears), and put the contact sheets under `docs/evidence/light/` for Dean to react to.

**G.2 The signed-out screens (19).** `app/(auth)/email.tsx`, `code.tsx` (welcome belongs to the
welcome-screen session) and
`app/(onboarding)/index.tsx`, `teams.tsx`, `players.tsx`, `city.tsx`, `birthday.tsx`,
`past-games.tsx`. Restyled, never screenshotted. Both modes, under `docs/evidence/signed-out/`.

**G.3 The MLS journey (21).** On the simulator against local: favorite an MLS club, get the
players prompt (E.3), search a match, log it, see the stamp, the bucket list, the share card,
the game page with a shootout result. Screenshots under `docs/evidence/mls/journey/`.

**G.4 Parity (22).** `npm run parity` writes to `design/parity/` (`reference/`, `app/`, `diff/`,
`sheets/`). Regenerate after G.1 and leave the sheets for Dean to approve; do not self-certify.

---

## H. Dean's own list: not for this session

Dean will do these himself, later. **Do not start them, do not wait on them, and do not ask
about them in the report**; just leave the hooks they need intact.

**H.1 Ticket forwarding on `jinxsports.fans` (2).** Cloudflare Email Routing, the worker in
`infra/cloudflare-email-worker/`, `inbound-email`, `EXPO_PUBLIC_INBOUND_EMAIL_DOMAIN`. Leave the
worker, the function and `docs/deploy.md` section 5 as they are.

**H.2 Sentry (3).** `apps/mobile/src/lib/sentry.ts` initialises when `EXPO_PUBLIC_SENTRY_DSN`
is set; `SENTRY_DISABLE_AUTO_UPLOAD=true` stays on EAS until Dean brings the DSN, slugs and
token. Do not remove the flag.

**H.3 Design assets (11).** `docs/design-assets-to-replace.md` is the inventory. Keep its
drop-in contracts true if you touch an icon, seal, shape or palette, and nothing else.

**H.4 Also Dean's, later:** App Store Connect privacy and external group (4); the support
address and "(draft)" privacy text (23); Pick a side at a real NBA game in October (20).

---

## I. Definition of done, and the report

Done means, for every part above: built, tested (core, mobile, pgTAP, functions as apply),
proven on local, rolled to hosted where it is data or schema, screenshotted where it is UI, and
written into `STATE.md` (section 5 loses the item or gains the honest gap), `docs/progress.md`,
`docs/verification.md` (every VERIFY above answered with the evidence) and `CLAUDE.md` (the
amended live-feed rule, any new command). Commit and push after each part.

The report at the end, in this order: anything decided here that the data contradicted, with the evidence; every VERIFY and its
answer; the palette diff table; the screenshot folders; numbers (database size before and after
B.2 and B.5, the three-way log loss for MLS, the preseason rows deleted, the stadiums sourced
and the ones that could not be); and what was left undone and why.
