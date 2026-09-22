# Build progress

Milestones from SPEC.md Section 12, each checked against its own "Done when" on 2026-09-17.

**How to read this.** "The code exists" is not evidence, and neither is a commit message: an
overnight log once said the data repository was mounted when it never had been. Every row below
names the command that was run and what it printed. Where a bar has two halves and only one could
be checked, the row says which.

**Two environments.** `local` is the Supabase stack on this machine (ports 54421-54427), loaded
with 82,240 games. `hosted` is `vekdufflzklfxljqufbq`, which Dean's phone uses. The session that
wrote this table could not touch hosted at all, so everything below was proven on local.

**The hosted rollout has since run** (`bash scripts/hosted-rollout.sh`, by Dean on 2026-09-17, and
checked afterwards). Eight of nine Edge Functions are deployed, `inbound-email` deliberately not;
vault carries `project_url`, `service_role_key` and `cron_secret`; `net._http_response` shows nine
200s in the six hours after it; no Relive stories are owed for either sport. So every row below
that says "until the rollout runs" has happened, with two exceptions that are about a person or a
domain rather than a deploy: M0.5 and the forwarded email half of M4.

| Milestone | Status | Done when | Evidence |
|---|---|---|---|
| M0 Repo and infrastructure | **met** | App boots to a tab bar in the simulator; CI green; `supabase db reset` works | `gh run list`: CI green on every push of 2026-09-17, and CI's third job runs `supabase db reset --local` then the pgTAP suite from empty on each one. App running in the iPhone 17 Pro simulator: `docs/evidence/m5-pick-a-side-local.png` shows the four-tab bar |
| M0.5 Design system and UI parity | **waiting on Dean** | Side-by-side screenshots of all screens in both themes approved by Dean | `npm run parity` produces the contact sheets. Approval is Dean's to give; it is not self-certified here |
| M1 Reference data and ingestion | **met, with one number over** | Every game 2000 to present; 20 known games correct; Elo backtest recorded; database under 150 MB | local: 82,240 games. Elo log loss and parameters in `docs/elo-backtest.md`. 20 famous games spot-checked (first pass). **Database is 226 MB locally, not under 150**: `game_appearances` alone is 90 MB, mostly NFL, whose detail arrives in bulk per season (see Decisions). It is under the 300 MB target of SPEC 4.7 and the 500 MB free-tier cap. hosted holds 2016 onward by Dean's choice |
| M2 Auth, onboarding, manual logging | **met** | New user signs up, picks teams, logs 10 past games including a doubleheader, sees them in History, cannot read another user's private data | `node scripts/verify-user-journeys.mjs`, as real signed-in users through the API so RLS is in the loop: 9 M2 checks pass, including both halves of the 2018-07-22 Phillies doubleheader and a stranger reading 0 rows of a private user's games. Sign in with Apple itself works on Dean's phone (TestFlight build 2) |
| M3 Passport | **met** | Rules 6.1-6.2 and 6.7-6.9 unit-tested for every listed edge case; passport right for a seeded user | `npm test`: `packages/core` 203 tests; `supabase/tests/003_stats` covers ties, postponed, neutral, both favorites and the relocated Rams. Journey script: passport says 8-2, the ten final scores counted by hand say 8-2; one stamp, ten visits |
| M4 Ticket imports | **half met** | 30-fixture matcher passes; a real screenshot and a real forwarded email each produce a verified attendance; images auto-delete | Matcher: 31 fixtures pass. Real screenshot: verified end to end on hosted by the TestFlight session. Auto-delete: `node scripts/verify-privacy-functions.mjs` on local, 15/15, an 8-day-old image is removed and one resolved today is kept; **on hosted `cleanup-imports` is still not deployed**, which is a live privacy gap until the rollout runs. **Forwarded email cannot pass without a domain** (blocked on Dean); its UI is now hidden until one exists |
| M5 Check-in, pick a side, storylines | **met on local** | Fixtures replayed with a fake clock prove lock and validation for six named cases | `packages/core/src/pledge.test.ts`: pledge before first run, after first run (void), MLB scoreless 1st, NFL first score before 10:00, NFL no score by 10:00, missing timestamps. `supabase/tests/004`: 14 assertions on check_in, make_pledge and validation. The screen: a real `make_pledge` call as the local user, then `docs/evidence/m5-pick-a-side-local.png`, with +0.56 = 1 minus the frozen 0.438. Storylines were verified against ground truth on hosted (docs/verification.md); their schedules exist only once the rollout runs |
| M6 Companions | **met** | Placeholder "Dad" tagged at 5 games links to a new account, which imports 3; records right for both | Journey script, 8 M6 checks: the invite reports 5 tagged games, Dad is offered 5 and imports 3, his History has exactly those 3, the fan's record with Dad is 3-2 over 5 and matches the scores, Dad's passport counts 3 |
| M7 Social | **met** | RLS tests cover private accounts, blocks, mutual-only overlap and rivalries; feed paginates | `supabase/tests/002` (24 assertions) and `005` (18). Pagination had no test: the journey script now pages the feed 4 and 4 and proves the two pages are exactly the first 8, no repeats. `010` is new and covers the reports policies, which had none |
| M8 Map, goals, bucket lists | **met** | Evaluator passes every 6.13 example; the "HR in 5 ballparks with a walk-off" goal completes on seeded data and fires a notification | `packages/core/src/goals.test.ts`. Journey script, on real ingested games through the deployed-locally `evaluate-goals` function: 4 ballparks and no walk-off reads 4 of 5 and not complete; the fifth, with a walk-off, completes it; exactly one `goal_completed` notification |
| M8.5 Relive | **met on local** | Relive plays correctly for 5 real MLB and 5 real NFL games, including extra innings and overtime | `npx tsx ingest/src/verify/relive.ts`: all 10 pass against a source the story was not built from (MLB: the game feed; NFL: `game_scoring_timeline`). Includes 2024 World Series Game 1 (10 innings) and two overtime games. One of the ten passes only since the RBI fix below. Screen with a real photo from private storage: `docs/evidence/m8.5-relive-nfl-local.png`. **On hosted nothing builds a story until the rollout runs**, and stories built before the fix need `--rebuild` (the script does both) |
| M9 Share cards and Wrapped | **half met** | Share cards correct in light and dark on small and large iPhones; Wrapped generates for a seeded user for MLB 2026 | `my_wrapped('mlb', 2026)` as the local user returns all ten cards, and they match his one 2026 game (Oracle Park stamp, 60 degrees, 144 minutes). Share templates have render tests. The game card was opened in the simulator in both themes and reads correctly: `docs/evidence/m9-share-card-dark.png`, `m9-share-card-light.png`. That is one device, an iPhone 17 Pro. The exported image is 1080x1920 whatever the phone, by construction (rendered at 360x640, captured at 3x), so what a small and a large iPhone can still differ on is the preview around it, and **nobody has looked at that on either** |
| M10 TestFlight hardening | **not met** | A friend with no context installs from TestFlight, onboards, imports a ticket and checks in, without help | This is a test with a person and it has not happened. What is ready for it: account deletion and export proven on local (15/15) and reachable again from Settings; every screen has a way in, enforced by a test; two dead ends are hidden. Still Dean's: Sentry DSN, App Store privacy details, the external TestFlight group, and submitting the build |


## The NBA (2026-09-18)

`docs/prompts/nba.md` set the bar at the same production level as MLB and NFL, row by row.
Every row below names what was run and what it printed, or the screenshot under
`docs/evidence/nba/`. **Two rows are not met**, both for the same reason, found by a probe
function and recorded in `docs/verification.md`: Supabase's Edge runtime cannot reach any NBA
host (the CDN and ESPN answer 403, stats.nba.com never answers), and GitHub's runners reach the
CDN but not stats.nba.com.

| Area | Status | Evidence |
|---|---|---|
| Schedules and finals | **met** | local: `npx tsx ingest/src/nba/backfill.ts --from 2000 --to 2026` loaded 36,591 games 2000-2026; regular-season counts per season match the game log rows halved (1,189 for 2000-01, 1,230 from 2004-05, 1,231 with the Cup final from 2023-24, 990 in the 2011-12 lockout year); every non-preseason game has a venue (114 preseason exhibitions at one-off sites do not). hosted: `--from 2016`, 14,826 games, read back by `supabase db query`. `ingest_progress` shows each season done with its counts |
| Detail on demand | **met on local** | Two games logged for the local user by inserting attendances; `npx tsx ingest/src/nba/detail.ts --queue` detailed and relived both. Read back against the box score fixture: BOS 116 ATL 117, attendance 19,156, duration 133 min, 10 and 9 appearances (the players the box marks as played), 117 scoring rows all with a kind and a scorer, Jalen Johnson's 18/13/10 triple-double detected, the pledge lock at the Period End action's wall clock (00:37:54.7Z). The stats.nba.com path (2016 game): 106 rows, LeBron's 19/11/14 triple-double, no wall clock so the pledge stays valid. The 12-hour recheck is `dueForRecheck` in nba-sync/sync.ts, shared with MLB. **The scheduled drain does not run on hosted** (see Jobs) |
| Relive | **met** | `npx tsx ingest/src/verify/relive.ts`: all 15 games check out, the 5 NBA ones against ESPN's play list (a provider the story was not built from): an overtime game (GSW 127 at HOU 121), Darius Garland's 31-footer at 0.0 and Nic Claxton's tip at the horn, the CDN path with ESPN's line (454 points) and the stats path with the model's line (108 points). Screen: `docs/evidence/nba/relive-atl-bos.png` ("Boston Celtics were 85% to win at tip-off", Tip-off / Halftime / Final, Opens on NBA.com) |
| Moments | **met** | `packages/core/src/providers/nba/nba.test.ts`: fixture tests for overtime, buzzer-beater (winning, tying, 1.5 s too late, a shot that leaves the shooter behind), 50 points, triple- and quadruple-double, 20 rebounds, 20 assists, a 20-point comeback. Five real games with known moments: the two triple-doubles above, the overtime game, the two buzzer-beaters, each detected from the feed and shown on the moments page: `docs/evidence/nba/moments.png` |
| Elo | **met** | `npx tsx ingest/src/elo/sweep.ts --sport nba` over a 150-point grid, then `run.ts --sport nba`: log loss 0.6127 over 33,012 games 2000-2026 (K 8, home 50, 1/3 to 1500, MOV on), recorded in `docs/elo-backtest.md`; 1,200 upcoming games have a frozen probability on hosted, 34,651 rows locally. The in-game model fitted on 75,804 play states (marginScale 0.10) is in the same doc |
| Check-in and Pick a side | **half met** | The lock rule is proven with a fake clock in `nba.test.ts`: a pledge 30 s after the end of Q1 is valid (grace), 2 min after is void, a game without wall-clock times stays valid; the estimate is tip-off plus 30 minutes, and a first basket does not lock it. **The live sync cannot write `game_live_state` from hosted**: cdn.nba.com refuses Supabase's egress, so `nba-live` is deployed but unscheduled and `EGG_SPORTS.nba.liveFeed` is false; the countdown falls back to the estimate, as the NFL's does |
| Storylines | **met** | The deployed `storylines` function, called with the Lakers' 2026-27 opener: three stored, accepted on attempt 1. Read against hosted's games table: "beating them 119-103 last season" is the 2026-04-10 final, LAL 119 at GSW 103; "Lakers open their 2026 regular season" is their first regular-season game, 2026-10-22. The validator no longer reads "76ers" as the number 76 |
| Tickets | **met** | `packages/core/src/matcher.test.ts`: 6 NBA ticket strings (Ticketmaster, SeatGeek with Staples Center as the alias, StubHub with Sixers and Cavs, Trail Blazers with the Rose Garden, sport unknown at Rocket Mortgage FieldHouse, abbreviations with a West Coast tip that is the next day in UTC) all match; `parse-ticket` accepts `nba` (schema and prompt) |
| Rosters and favourites | **met** | `npx tsx ingest/src/nba/rosters.ts`: 599 roster rows across 30 teams, on local and on hosted (from this machine; stats.nba.com does not answer GitHub's runners). The players prompt lists them through `team_roster`, unchanged |
| Seeds | **met** | `python3 seed/scripts/check_team_colors.py`: 95 palettes, worst hand-tuned 4.72:1 light and 5.65:1 dark; 72 arenas with coordinates (Nominatim), geofence 250 m, elevation (70 of 71 new ones; Accor Arena is outside USGS) and the `arena` shape; `npm run parity` untouched (the reference gained a shape symbol, no screen) |
| Copy | **met** | `packages/core/src/venue.ts` is the table; every venue word outside the reference screens goes through it (stamps: `docs/evidence/nba/stamps.png` says "8 venues" for a mixed set, "arenas" under the NBA filter); the copy test passes; `docs/interactions.md` has the note |
| RLS and tests | **met** | `supabase/tests/040_nba.test.sql` (22 assertions); `npm test` 299 core + 886 mobile; `npm run typecheck`, `npm run lint`, `npm run db:test` (346), `npm run functions:test` (20), `npm run functions:check` (11 functions) all pass |
| Jobs | **half met** | The daily GitHub job has the NBA steps and reaches the CDN (the schedule refresh step succeeded on run 35321695029); its roster and old-game detail steps cannot reach stats.nba.com and are allowed to fail. **No 15-minute path exists**: `nba-sync` answered 500 through pg_net (`net._http_response` id 68, "NBA 403 for cdn.nba.com"), so both NBA cron rows were removed by migration 20260918100200. Detail for a newly logged NBA game arrives with the daily job, the NFL's model |
| Hosted | **met** | `db push` (four migrations, the famous-games pair included), `functions deploy nba-sync nba-live mlb-live mlb-sync parse-ticket storylines`, backfill from 2016 (14,826 games), rosters (599), Elo (14,052 probabilities), each read back with `supabase db query` |
| Docs | **met** | STATE.md, this file, docs/deploy.md, docs/verification.md, docs/elo-backtest.md, CLAUDE.md |

## The next wave (2026-09-22)

The build brief is `docs/prompts/next-wave.md`. Each row names what was run and what it printed.

| Part | Status | Evidence |
|---|---|---|
| A.1 Sign out returns to welcome | **met** | Reproduced on the simulator (`docs/evidence/sign-out/before-settings-stays.png`), fixed in `features/navigation/RootStack.tsx` plus `_layout.tsx` files for settings, guide and relive; `rootStack.test.tsx` flips a session to null from settings, guide, relive, a game page, favorites and onboarding through expo-router's testing library and asserts `/welcome` with only `(auth)` in the stack; seen after the fix from Settings and from the guide page (`after-settings-welcome.png`, `after-guide-welcome.png`), with `auth.sessions` empty for the user after each |
| B.1 MLS stadium coordinates | **met** | 39 of 39 placed from Nominatim cross-checked against Wikipedia, none guessed (`docs/verification.md`); `psql`: 0 of 55 MLS venues without coordinates or a timezone on local; migration `20260923000200` on local and hosted; test `047` |
| B.2 Preseason games gone | **met** | Migration `20260923000100`: local 11,703 rows deleted in 4 s (after two partial indexes), hosted 5,649, both read back as 0 remaining with the check constraint in place; 40 parks gone; local 278 MB to 254 MB after vacuum; `npm test`, `db:test` (429), `functions:test` (21), `functions:check` pass |
| B.3 MLS daily job | **met, first scheduled run pending** | Run 35787322042 read all of 2026 from ESPN on the runner; its finals sum to hosted's 387; the 08:45 UTC schedule had not fired yet when written |

## What was found wrong on 2026-09-17, and fixed

Each of these was live, and none was visible from the outside.

- **pg_cron reported every hosted job as succeeded while calling nothing.** Vault was empty, so
  `call_edge_function` raised a notice and returned; and with vault filled it would still have
  been refused, because it sent only the bearer token (docs/verification.md). It now sends
  `x-cron-secret` too, and warns instead of whispering. Proven on local through pg_net:
  `net._http_response` row with status 200 from `mlb-sync`. **Judge a scheduled call by that
  table, never by `cron.job_run_details`.**
- **Nothing drained `detail_queue` and nothing scheduled built Relive**, for either sport. A newly
  logged game never got a story. `drainMlbQueue` in `packages/core` now runs inside `mlb-sync`
  every 15 minutes; the nightly NFL job ingests the seasons of queued games and then builds
  stories. Proven on local: a 2023 game logged with no detail had 84 probability points and a
  story one scheduled call later.
- **Relive dropped every run scored without an RBI.** Steps were keyed on `result.rbi`. Braves at
  Nationals, 2023-03-30, went 3-1 to 4-2 and stopped at 6-2 on a 7-2 final. Found by reading the
  generated story against the box score. Steps are now keyed on the score changing.
- **`delete-account` left files behind.** It listed one level of one bucket. It now walks every
  user bucket recursively and refuses to delete the user if storage cleanup fails.
- **Six things had no way in** after the reference tab bar replaced the old tabs: sign out,
  export my data, moments witnessed, bucket lists, follow requests, and your own public profile.
  `features/navigation/__tests__/reachability.test.ts` now fails if any route loses its last link.
- **The forwarding address told people to mail tickets to `u-...@in.example.com`**, and "Continue
  with email" waited for a code no sender would send. Both hidden behind flags that need no code
  to flip.
- **Nine MLB teams showed their full name where a short one belonged** ("New York Mets" on a
  pill): their city is not the start of their name. Short names now read `teams.nickname`.
- **Official highlights opened MLB's site for NFL games.** Both leagues have a real per-game page;
  the link now goes there.

## Decisions that differ from or refine the spec

- **NFL pipeline is TypeScript, not Python.** nflverse publishes `.csv.gz` for every asset, so the Node ingest package streams those and reuses the exact parser and moment detectors in `packages/core`. One implementation instead of two. Python remains only for the fixture extraction script.
- **MLB game details are fetched on demand.** Schedules and finals for every game 2000 to present come from one request per season. Detail (appearances, scoring timeline, moments, weather) is fetched for the rolling current-season window and for any game a user logs, since the full feed is about 0.7 MB per game and 65k games is not worth pulling for a hobby project. NFL details come in bulk because a season's play-by-play is one 20 MB file.
- **Ingestion code is shared with Edge Functions** through a minimal structural DB interface in `packages/core/src/ingest`, copied into `supabase/functions/_shared/core` by `scripts/sync-core-to-functions.sh` (gitignored, run by the `functions:*` npm scripts).
- **Seat details live in `attendance_seats`**, a separate table from `attendances`, so the "share seats" opt-in can be enforced with row level security rather than in client code.
- **Sender verification for extra forwarding emails is by sending, not OTP.** There is no outbound email service in the stack, so a user adds an address in Settings and then sends any email from it to their forwarding address; the inbound function marks it verified. The sign-in email is always allowed.
- **Goals are evaluated by the shared core evaluator** in the app (for live progress) and in the `evaluate-goals` Edge Function after game finals (for completion notifications), instead of SQL predicates.
- **"Going" entries are attendances with `status = 'going'`** that flip to `attended` when the game goes final.
- **EAS project slug is `jinx`** (id 7746f5f4-0d93-4ce4-9156-6b6bfb128f8f, owner deanyao) because `eas init` named it after the root package. Rename it on expo.dev and update `slug` in `apps/mobile/app.json` when the final app name is chosen.
- **Metro and Jest resolve `@jinx/core`'s `.js`-suffixed imports** through `apps/mobile/metro.config.js` and `apps/mobile/jest.resolver.js`, which retry `.ts`/`.tsx` for files inside packages/core only.
- **NFL 2000-2005 primetime kickoffs** are listed as `09:00` by nflverse (12-hour clock); the parser maps them to 21:00 ET.
- **Local Supabase ports** were moved to 54421 (API), 54422 (DB), 54423 (Studio), 54424 (Mailpit) because another project occupies the defaults on this machine.

- **Email OTP needs a custom magic-link template.** Supabase's default local template only sends a link, so `supabase/templates/magic_link.html` puts `{{ .Token }}` in the email and `config.toml` points at it. Takes effect after `supabase stop && supabase start`.
- **Session storage chunks through SecureStore.** Sessions can exceed the 2048-byte SecureStore limit, so `apps/mobile/src/lib/secureStorage.ts` splits values into chunks and falls back to AsyncStorage when SecureStore is unavailable.
- **Rooting side at log time uses favorites only** (`apps/mobile/src/features/attendances/rooting.ts`). Pledges arrive in M5 and are applied server-side; favorites are matched by `teams.franchise_id`.

- **Share cards are rendered at 360×640 and captured at 3x** (`apps/mobile/src/features/share`) rather than laid out at 1080×1920, so the same React Native components size text and spacing like the rest of the app. The share sheet renders the card twice: a scaled preview and an off-screen copy that `captureRef` reads. Templates carry their data in the route params as JSON, so a card can be re-opened without refetching.
- **Wrapped "preview" is decided by the calendar, not by the snapshot row.** `my_wrapped` stores a snapshot on every call, so the app cannot tell a published season from a preview by looking at `wrapped_snapshots`. The app treats the current season (NFL: January and February belong to the previous season) as a preview with a "Rebuild this preview" action, and earlier seasons as published.
- **Legal copy lives in `apps/mobile/src/features/legal/text.ts`** as verbatim copies of `docs/attribution.md`, `docs/terms.md` and `docs/privacy.md`, rendered by a Markdown-lite component. Metro cannot import `.md` files without extra config; keep the two in sync when the docs change.
- **Offline cache skips queries whose data is not JSON** (the two `Map`-valued game lookups), the check-in and imports keys, and search/handle lookups. Cache entries are keyed by user id and cleared on sign out; the cache buster is the app version.
- **Crash reporting sends the user id and nothing else about the person**: `sendDefaultPii` is off, request bodies and console breadcrumbs are dropped, and URLs are stripped of their query strings before leaving the device.
- **Relive is owed to attended games, not to queue rows.** `enqueue_game_detail` skips any game
  whose detail already exists (a friend logged it first), so a queue-driven worker would never
  build a story for the second person. `games_needing_relive` asks the
  question directly: attended, final, detailed, no story. `games.relive_checked_at` stops a game
  with no published win probability being refetched forever; recent games are retried for two
  weeks because both providers publish it late.
- **First-time MLB detail comes only from `detail_queue`** (SPEC 4.7), fixed 2026-09-17. Until
  then `mlb-sync` and the daily `detail.ts --pending` job both fetched detail for every final in
  the last three days, logged or not. Now `mlb-sync` syncs the schedule, re-fetches a logged
  game's detail once about 12 hours after it ended, and leaves first fetches to the queue drain
  that runs right after it; `--pending` asks `games_needing_detail` only. Proven on local with
  the real function: three unlogged finals stayed without detail across runs, the one then logged
  by a user had detail and a Relive story on the next run, and the correction pass re-fetched
  that game alone out of 13 that were old enough. On hosted, game 824464 went final after the
  deploy and two scheduled runs (`net._http_response` 16 and 17, both 200) left it with its 8-2
  score and no detail rows, while the 18:45 run detailed two logged games from the queue.
- **A storyline refresh settles each slot by itself and never deletes ahead of the model call**
  (`packages/core/src/storylines/refresh.ts`), fixed 2026-09-17. A new sentence is upserted over
  the old one on the slot's unique index; when the model produces nothing, the stored sentence
  stays if the validator still accepts it against today's facts and goes if it does not (a streak
  that ended in the first game of a doubleheader). Proven on hosted: a refresh of a game with two
  morning rows left the same two row ids carrying new text.
- **`storylines` finds going games by filtering `games` on the server first**, then paging through
  the going attendances for those games only, fixed 2026-09-17. Reproduced on local against real
  PostgREST with 1,102 going rows: the old single request returned 1,000 and did not contain
  tonight's game; the new selection returned it.
- **Storylines are also requested at check-in.** SPEC 6.18 schedules them for games someone marked
  as going. A walk-up check-in at a neutral game would have reached Pick a side with none, so a
  trigger on `checkins` asks for that one game, and the screen polls until they arrive.
- **The forwarding flag is the domain.** `forwardingEnabled` is true when
  `EXPO_PUBLIC_INBOUND_EMAIL_DOMAIN` is a real domain and false for the `example.com` placeholder,
  so there is nothing to remember to flip on the day the domain exists.
- **Videos open in the system player.** The app bundles no video module. Upload, visibility,
  report and block all work for a video; playing one opens its signed URL.
- **Photos upload as followers-only** (SPEC 9), although the column default is `private`. The app
  sets it explicitly; the stricter default stays as the floor for any other writer.
- **The personal line on Relive's last step is in the present tense**: "Your record with Dad is
  7-1", not "goes to 7-1". It is computed at view time from today's records, as SPEC 6.19 asks,
  so it cannot honestly claim what the record was on the night.
- **NFL detail is stored for every game, not only logged ones**, which is why the database is over
  M1's 150 MB. A season's play-by-play is one file, so ingesting all of it costs nothing extra in
  requests, and it is what makes a logged NFL game complete immediately instead of overnight.
  Trimming `game_appearances` to attended games would bring it under; that is Dean's call.

## Famous games, superstars and personal badges (2026-09-18)

Built from `docs/prompts/famous-games.md`. Local only; hosted is not rolled out yet (STATE.md 5).

| Done when | Evidence |
|---|---|
| Championship and the two games before it, from the schedule, both sports | `rebuild_schedule_famous_games()`: 156 rows, exactly 3 for every complete postseason 2000-2025. 2024 includes KC 22 at PHI 40, Super Bowl LIX |
| The curated list resolves by local date and refuses ambiguity | `npx tsx ingest/src/famous/curated.ts`: 21 of 21 entries, one game each. It refused twice before two entries were corrected against the data (Super Bowl LVII home side, Judge's doubleheader) |
| Superstars from awards, window of 3 seasons | `is_superstar` for Bryce Harper in 2025 is true, from his 2024 All-Star selection. 2,389 honor rows (2,282 MLB, 107 NFL), 101 franchise players |
| Personal badges for favourite players | pgTAP 018 fires all four rules. On real data, with Cooper DeJean favourited and Super Bowl LIX logged: rookie season and first touchdown (his pick six), count 1, 2 personal |
| Dean's three attended games | 0 famous rows, count 0: none is famous, which is the right answer |
| Feed event | Logging Super Bowl LIX wrote `famous_game` with title "Super Bowl LIX"; a row added later writes it too (pgTAP) |
| App | Simulator screens in `docs/evidence/famous/`: game page badge, famous page, Passport row, full list, Games tab mark |
| Tests | pgTAP 018 (36 checks), core `famous.test.ts` (16), ingest `famous.test.ts` (14), app famous tests (9) plus notable, copy and format additions. Full app suite: 885 of 886 pass; the one failure is `sealColors.test.ts`, caused by the concurrent NBA session's uncommitted `seed/team_colors.json` (95 palettes, the test expects 65) |

Decisions made during the build:
- **The count is games, each once**, personal badges included, as the brief says; a game with a
  famous row and a badge is one. `personal_count` counts badges.
- **"Drove in a run" is dropped for non-stars; touchdowns, field goals and moments stay.** The
  brief's rule is "home runs plus superstars" with RBIs out unless the batter is a star; nothing
  said to drop the NFL scoring lines, so they were kept.
- **A game famous two ways shows one card**, curated over schedule.
- **MLB has no voting placements**, so its bar is winners plus All-Stars.
- **The NFL bar is MVP, MVP top five and first-team All-Pro, not the Pro Bowl** (Dean, 2026-09-18).
- **NFL "first touchdown" is a touchdown scored, not thrown.**

## MLS continuation (2026-09-21, local only)

2016–2026 schedules/results are loaded locally (4,962 rows). Full forced rerun preserved game
IDs and attendance references. Historical fixtures now cover conference format variations,
MLS Is Back exclusions, single-match penalties and aggregate advancement. Explicit-winner
results propagate through Passport replay and share highlighting. See
[evidence/mls/local-rollout.md](evidence/mls/local-rollout.md) and
[MLS_ROLLOUT.md](MLS_ROLLOUT.md) for checks and blockers. This is not a hosted or app release.
