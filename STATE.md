# Where Jinx stands

**Read this first, then `SPEC.md`.** It is the one file that says what is true right now: what
works, what is half done, what is deliberately switched off, and what only Dean can do. Anyone
picking the project up, person or agent, should be able to start from here and nothing else.

Last verified: **2026-09-17, 22:05 PDT**; famous games **2026-09-18, 00:20 PDT**; the NBA **2026-09-18, 01:10 PDT**; venue timezones and search **2026-09-18, 09:40 PDT**; the MLS merge **2026-09-22**, by running the commands quoted, not by reading commits.
Keep it that way: when you change what is true, change this file in the same commit.

---

## 1. What Jinx is

A passport for sports fans: every game you attend becomes part of a living record. iOS only,
MLB, NFL, (from 2026-09-18) the NBA and (from 2026-09-22) MLS, v1 in TestFlight. `SPEC.md` is the product and engineering spec and it is
authoritative. `design/reference.html` is the single visual source of truth.

Hobby project, near-zero running cost: $0 data sources, Supabase free tier, Anthropic Haiku
server-side only. Non-goals: betting, ticket marketplace, live chat, team or league logos.

---

## 2. Getting from a clone to a running app

```bash
npm install                  # workspaces: apps/mobile, packages/core, ingest
bash scripts/check-setup.sh  # says which credentials are missing
npx supabase start           # local Postgres, auth, storage. Docker required. Ports 54421-54427
npx supabase db reset        # migrations + seed. WIPES local data, so not while data is loaded
npm run ios                  # read docs/simulator.md first: this build is not standard
npm test && npm run typecheck && npm run lint && npm run db:test
```

Sign in locally with "Continue with email", any address, and read the code from Mailpit at
http://127.0.0.1:54424. Nothing is emailed anywhere from local.

The repo folder is `~/Desktop/Jinx` on Dean's machine. `supabase/config.toml` keeps
`project_id = "name_tbd"` on purpose: it names the local Docker volumes, and changing it would
orphan a loaded database.

---

## 3. The three environments, and what is in each

| | What it is | State |
|---|---|---|
| **local** | Supabase on ports 54421-54427 | 118,831 games, 2000 onward (82,240 MLB + NFL, 36,591 NBA), plus 4,962 MLS 2016 onward. Every migration. Where you develop |
| **hosted** | Supabase `vekdufflzklfxljqufbq` | What Dean's phone talks to. Games 2016 onward, his choice, 14,826 of them NBA and 4,962 MLS. All 36 migrations as of 2026-09-22, search v2's four included |
| **TestFlight** | EAS `@deanyao/jinx` | Build 4 submitted 2026-09-17, waiting on Apple processing |

**Hosted, as verified today:**

- **Ten of eleven Edge Functions are deployed**: `storylines`, `parse-ticket`, `cleanup-imports`,
  `delete-account`, `mlb-sync`, `mlb-live`, `nba-sync`, `nba-live`, `send-push`, `evaluate-goals`.
  `inbound-email` stays undeployed until ticket forwarding is set up on `jinxsports.fans`
  (section 5). **`nba-sync` and `nba-live` are deployed but not scheduled**: Supabase's egress
  cannot reach cdn.nba.com, stats.nba.com or ESPN (a probe function answered 403, hang, 403 on
  2026-09-18; `net._http_response` id 68 is nba-sync's 500). The NBA's data path is the daily
  GitHub job, which reaches the CDN but not stats.nba.com, and this laptop for rosters and
  pre-2019 detail (`docs/deploy.md`). There is no live NBA state, so Pick a side at an NBA
  game counts down to tip-off plus 30 minutes like the NFL's estimate.
- **Scheduled jobs really run.** Nine `cron.job` rows, and `net._http_response` shows nine 200s in
  the last six hours. The one 404 is from before the deploy finished.
  **Judge a scheduled call by `net._http_response`, never by `cron.job_run_details`**: it reported
  success for weeks while calling nothing.
- Vault holds `project_url`, `service_role_key` (the legacy JWT) and `cron_secret`.
- Queues are empty: no Relive stories owed for either sport, one open `detail_queue` row.
- **MLB detail is fetched only for logged games** (SPEC 4.7). `detail_queue` is the one way in:
  `mlb-sync` drains it every 15 minutes, and the daily GitHub job is the net under it. A final
  nobody logged keeps its score and nothing else: game 824464 went final on hosted after the
  deploy, and the scheduled runs at 19:15 and 19:30 UTC left it with a score and no detail. The
  40 recent finals detailed before this was fixed on 2026-09-17 still carry theirs; nothing
  removes it. **The daily GitHub job's half of the fix runs from `main`**, so it only holds once
  the change is pushed.
- **A storyline refresh replaces each sentence in place** and keeps the old one when the model
  fails, unless today's facts no longer support it. `docs/progress.md` has the evidence for both.

`bash scripts/hosted-rollout.sh` does the whole hosted sequence and verifies each step; `verify`
as its argument runs only the read-only half. It is safe to rerun.

**Builds so far: 4 of the 15 EAS builds a month**, all iOS production. 1 errored (the Sentry
plugin), 2 and 3 finished, 4 was submitted to TestFlight on 2026-09-17.

```bash
cd apps/mobile
eas build --platform ios --profile production
eas submit --platform ios --latest    # needs Dean's Apple login and 2FA
```

---

## 4. What is done, and how that was proven

`docs/progress.md` is the milestone-by-milestone record: every row names the command that was run
and what it printed. **"The code exists" is not evidence** there, and should not be here.

Short version: M0, M1 (bar one number), M2, M3, M5, M6, M7, M8, M8.5 are met. M4 is half met and
cannot finish without a domain. M9 is half met: one device only. M0.5 waits on Dean's approval of
screenshots. M10 is the friend test and has not happened.

Two scripts do most of the proving, and both work as real signed-in users so RLS is in the loop:

```bash
node scripts/verify-user-journeys.mjs        # 23 checks across M2, M3, M6, M7, M8
node scripts/verify-privacy-functions.mjs    # 15 checks: deletion and image retention
npx tsx ingest/src/verify/relive.ts          # 10 real games against independent sources
```

---

## 5. What is left

**Needs Dean, and only Dean:**

1. **Ticket forwarding on the domain.** Email sign-in is done: the domain is `jinxsports.fans`
   (Cloudflare), verified in Resend with SPF, DKIM and DMARC, and hosted auth sends through
   `smtp.resend.com` as `noreply@jinxsports.fans`. On 2026-09-17 Dean received a 6-digit code in
   his inbox from the hosted project. `EXPO_PUBLIC_EMAIL_SIGN_IN=1` is set in the EAS production
   environment, so "Continue with email" appears from build 5 on. The Resend API key lives only
   in the Supabase dashboard.
   **Ticket forwarding still waits**: Cloudflare Email Routing, the worker in
   `infra/cloudflare-email-worker/`, deploying `inbound-email`, and
   `EXPO_PUBLIC_INBOUND_EMAIL_DOMAIN=in.jinxsports.fans`. That is what blocks M4's "real
   forwarded confirmation".
2. **Sentry account and DSN** for crash reporting (M10). Until then keep
   `SENTRY_DISABLE_AUTO_UPLOAD=true` on EAS, or builds fail.
3. **App Store Connect:** privacy details, and the external TestFlight group.
4. **Approve the M0.5 screenshots.** `npm run parity` generates them. Do not self-certify this.
5. **`eas submit`** needs his Apple login and 2FA. An App Store Connect API key would automate it.
   Build 5 was submitted on 2026-09-22 and is waiting on Apple.
6. **Design assets.** `docs/design-assets-to-replace.md` is the inventory; there are no drafts
   of replacements. Dean is taking it to Figma or an image model. The app icon is still the
   Expo default and the splash is blank.
7. **Sentry** (a free account, then the DSN, org and project slugs and an auth token) and
   **ticket forwarding** (Email Routing on Cloudflare, `wrangler login` once): the exact steps
   are in `docs/prompts/next-wave.md` section H.

**The next wave is briefed (2026-09-22).** Dean answered a 25-point list of everything deferred;
`docs/prompts/next-wave.md` is the build brief for a fresh session: the sign-out bug (signing
out does not return to the welcome screen; **fixed 2026-09-22**, see below), MLS stadium coordinates, preseason games removed,
`final_at`, NFL detail only for logged games, handshakes in the export, the app reading free
live feeds directly (a rule change), players seen reworked to superstars with good games,
superstars for the NBA and MLS, the MLS second wave with draws voiding pledges, palettes
cross-checked against an open source, light mode, and the unwalked journeys. Arjun is on search
at the same time. **The MLS daily job is on**: `MLS_INGEST_ENABLED` was set after the probe run
reached ESPN from GitHub in 36 s.

**Search finds the right game now (2026-09-18).** Dean searched for an NBA game and it did not
work. Three bugs, all fixed and on hosted (migration `20260918110000`, test `041`, the detail in
`docs/verification.md`): `venues.tz` was null for 126 of 295 venues, so search and the
famous-game matcher used the UTC date and filed a west coast evening game under the next day
(7,773 MLB games since 2016 and most of the NBA); a year token matched `games.season` only, so
"lakers 2026" returned the 2026-27 season instead of a January 2026 game; and search took 2.2 s
on local and 3.1 s on hosted, now 0.12 s and 0.15 s. `seed/scripts/fill_timezones.py` resolves a
zone from each venue's coordinates and needs `pip install timezonefinder`. The 42 venues with no
coordinates (spring training and minor league parks) are gone with the preseason games as of
2026-09-22; two remain (Fort Bragg Field, Walmart Park).

**Search v2 is merged (2026-09-22), off by default.** Arjun's `search-improvements`: a shared
search screen with My games / All games, league and date filters, grouped team and venue
suggestions, visible typo corrections ("philies" offers Phillies), ambiguity choices (Giants
asks MLB or NFL), matchups ("Eagles at Cowboys" fixes the sides), calendar-year dates at the
venue, and cursor pagination. Additive: `search_games_v2` and `search_entities_v2` (migrations
`20260922000200` to `000500`, `pg_trgm` and `unaccent`, normalized alias columns kept by
triggers), a core interpreter in `packages/core/src/search.ts`, the screen under
`features/games/search/`. **v1 (`search_games`) is untouched and is what every build uses until
`EXPO_PUBLIC_SEARCH_V2=1` is set in the EAS environment** and a build carries it. The four
migrations are on hosted since 2026-09-22 (pushed at the merge; v1 answered 50 rows for
"phillies 2025" afterwards), so the flag is the only step left, and it is Dean's call. Plan: `docs/SEARCH_PLAN.md`; evidence and rollout steps:
`docs/evidence/search/README.md` (a read-only backtest of 13 query shapes and a 543-row
pagination walk against independent SQL). Not yet: seen on a device, hosted latency, and the
same 38 MLS stadiums without a timezone (the timezone test now audits MLB, NFL and NBA only).

**MLS is merged and on hosted (2026-09-22).** Arjun built it on branch `MLS` with an agent and
rolled it out to hosted himself before the merge: five migrations (`20260919000100` to
`20260922000100`), 30 clubs with palettes, 37 stadiums, 4,962 matches 2016 onward with 4,817
finals, ticket parsing that knows the sport, and `parse-ticket` redeployed. Handoff and limits:
`docs/MLS_ROLLOUT.md`; evidence: `docs/evidence/mls/`; SQL tests `043` and `044` (renumbered
at the merge because `041` was already the search test). In the app: league picker, favorites,
schedules, results, logging, Passport, stamps, bucket list, share cards. A shootout is stored
apart from goals (`decision_method`, `home_shootout_score`, `away_shootout_score`,
`winner_team_id`), and `gameResult` honours an explicit winner, so a 3–3 match won on
penalties is a win. **Deliberately unavailable for MLS** until a draw-aware model exists:
Elo and win probability, Pick a side (`make_pledge` answers `sport_not_supported`), live state,
rosters and favorite players, Relive, Wrapped. The game screen says so.

Not done, and known:

- **Every MLS venue has coordinates and a timezone (2026-09-22).** 39 stadiums were placed
  from OpenStreetMap Nominatim, cross-checked against Wikipedia (Q2 Stadium and RFK Stadium
  from Wikipedia alone), zones from timezonefinder, elevations from USGS and, for the four
  Canadian stadiums, Natural Resources Canada. Migration `20260923000200`, test `047`, the
  per-stadium sources in `docs/verification.md`. Two ESPN id pairs are one building
  (Children's Mercy Park/Sporting Park, Sports Illustrated Stadium/Red Bull Arena) and stay
  two rows with one coordinate; folding them is a separate job.
- **MLS results refresh daily from GitHub** (08:45 UTC, `mls-ingest.yml`) since 2026-09-22,
  when the probe proved the runner reaches ESPN and `MLS_INGEST_ENABLED` was set. The hand-run
  `sync` (run 35787322042) read all twelve months of 2026 from ESPN in 2m35s and its finals
  summed to the 387 hosted already held. Judge the scheduled runs by the workflow log and by
  the hosted 2026 final count moving after match days, not by `net._http_response`
  (no Edge Function is involved).
- **The 30 MLS palettes** (`seed/mls_colors.json`) were tuned to the contrast rule, not to
  Dean's eye.
- **Not seen on a device.** Arjun's session reached the league picker on the simulator against
  hosted and stopped at sign-in. The MLS journey (favorite, search, log, stamp, share) has not
  been walked, and it is only in build 5.
- **Local matches hosted**: `node scripts/mls-local.mjs --from 2016 --to 2026` ran at the merge
  and loaded 4,962 matches, 4,817 finals, none without a venue, the same numbers as hosted.

**The NBA is built and verified on local and rolled out to hosted (2026-09-18).** Brief:
`docs/prompts/nba.md`; evidence: the NBA table in `docs/progress.md` and `docs/evidence/nba/`;
facts: the NBA sections of `docs/verification.md`. Two rows of the brief's bar are not met and
cannot be from Supabase: the 15-minute queue drain and live state (above). Not looked at yet:
Pick a side at a real NBA game (none is played until October 2026), the log sheet's NBA search
on a device, light mode. What needs Dean: eyeball the 30 palettes in `seed/team_colors.json`
(hand-tuned to the contrast rule, not to his eye); decide whether the app may read the CDN
scoreboard itself for live NBA state (the rule today keeps every provider server-side); the
NBA and ESPN attribution in `docs/attribution.md` before any public launch.

**Famous games, superstars and personal badges are built and verified on local (2026-09-18).
Their three migrations reached hosted with the NBA's `db push` on 2026-09-18, and the daily
GitHub job has since run the ingest: on 2026-09-22 hosted holds 159 famous games, 436 honors,
101 franchise players and 1,165 player moves.** Brief: `docs/prompts/famous-games.md`; evidence: `docs/progress.md` and
`docs/evidence/famous/`; facts: `docs/verification.md`. Three migrations (`20260918000100`,
`20260918000200`, `20260918100100`), nine ingest scripts wired into the daily workflows. What needs Dean:

1. **The hosted rollout is done by the daily job.** To rerun by hand, in order, verifying each
   by reading hosted:
   ```bash
   set -a; . /tmp/hosted.env; set +a
   npx tsx ingest/src/mlb/honors.ts --from 2013 --to 2026
   npx tsx ingest/src/mlb/debuts.ts
   npx tsx ingest/src/mlb/moves.ts --from 2016-01-01
   npx tsx ingest/src/nfl/honors.ts
   npx tsx ingest/src/nfl/moves.ts --from 2016
   npx tsx ingest/src/nfl/firsts.ts --from 2000
   npx tsx ingest/src/famous/franchise.ts
   npx tsx ingest/src/famous/curated.ts
   ```
   No Edge Function changed behaviour, so no function deploy is needed.
2. **Edit `seed/franchise_players.json`.** It is an agent's first draft: ten transcendent names
   and one to three per team per era. Rerun `ingest/src/famous/franchise.ts` after.
3. **Skim `seed/nfl_awards.json`.** 107 rows for 2023-2025 from public record (sources in
   `docs/verification.md`): MVP, MVP top five and first-team All-Pro. No Pro Bowl, by Dean's call.
4. **See it in the app.** The screens are only in the next build.

The NBA is next, from
`docs/prompts/nba.md`, in another session; venue nouns are per sport (ballpark, stadium, arena).
Keep every new rule keyed by `sport_id`.

**Sign out returns to the welcome screen (fixed 2026-09-22).** Dean reported on build 4 that
signing out left the app where it was. Cause: the root navigator guards its screens with
`Stack.Protected`, but a route it did not name is still added, unguarded, and `settings`,
`guide` and `relive` were never named; and a folder without a `_layout.tsx` is not one route
but one per file (`guide/[venueId]`), which a guard naming `guide` never matches. Now every
signed-in route is named in `features/navigation/RootStack.tsx`, the three folders have a
layout, and `rootStack.test.tsx` flips a session to null from settings, guide, relive, a game
page, favorites and onboarding and asserts the router is on `/welcome` with only `(auth)` in
the stack. Seen on the simulator: `docs/evidence/sign-out/`.

**Only regular season and postseason games exist (2026-09-22, Dean's decision 13).** 11,703
spring-training and NBA preseason games left local and 5,649 left hosted, nobody had logged
one on hosted, and a check constraint on `games.game_type` keeps them out; the MLB and NBA
ingests no longer ask for them, and the ticket and famous-game matchers treat any other type
as absent. The 40 spring-training and exhibition parks that never had a coordinate went with
them, which closes the "42 venues unresolved" item: the two venues still without coordinates
(Fort Bragg Field, Walmart Park) each hosted one real regular-season game. Migration
`20260923000100`, test `046`, `docs/verification.md`.

**Known wrong, not yet fixed:**

- **The local database is 254 MB** against M1's 150 MB bar (278 MB before the preseason games
  went on 2026-09-22), because NFL detail is stored for every game rather than logged ones.
  Under the 300 MB target and the 500 MB free-tier cap. Hosted is 115 MB.
- **The sub page restyle has not been approved by Dean yet.** He asked for it on 2026-09-17: one
  style on every page, far more team colour, fewer outlines, better type ratios. All 46 screens
  outside the reference were restyled that day against `docs/subpage-style.md`, which is now the
  rulebook for any screen that is not in `design/reference.html`. Verified on the simulator in
  dark mode: game detail, log sheet, stamps, goals, bucket lists, settings, favorites, Wrapped,
  another person's profile. **Not yet looked at on a device or simulator:** light mode, the
  signed-out screens (welcome, email, code, onboarding), and the screens that need data the local
  account lacks (a bucket list with progress, notifications, companions, imports with matches).
- **Hosted matches local as of 2026-09-18 05:00 UTC.** Dean applied migrations `20260917000500`
  to `001000`, deployed `delete-account` and `mlb-sync`, loaded 3,586 roster rows and rescored
  the attended games. `.claude/settings.json` now pre-approves the hosted push, function deploys
  and the ingest scripts, so an agent can do the next rollout itself: `db push` first, functions
  second, scripts third, and verify each by reading the hosted database (STATE.md section 3).
- **Easter eggs are built and unseen by Dean.** Eight, each behind a flag in
  `apps/mobile/src/features/eggs/flags.ts`: worn stamps, golden stamps, record rewind, curse
  breaker, rally cap, stretch confetti, certified jinx, secret handshake. Settings > About has a
  dev-only "Easter eggs" row that plays each one. The NFL halves of rally cap and stretch
  confetti are written and cannot fire until live NFL data exists (`EGG_SPORTS.nfl.liveFeed`).
  `export_my_data()` does not include handshakes yet.
- **Build 5 needs a fresh native build**, not an update: `expo-sensors` was added for the rally
  cap's shake, and the camera and photo permission strings changed for profile pictures.
- **`support@example.com` is the support address in the app**, and the privacy text still carries
  a "Replace Jinx with the final name" line and "(draft)" titles. Fix before external TestFlight.
- **`games.final_at` is never filled** on hosted (0 of 2,734 finals this season). Check-in falls
  back to six hours after the start, so nothing breaks, but the column is dead.
---

## 6. Rules that are not negotiable

- **No em dashes in UI copy.** Dean's rule. En dashes in scores and records are correct and stay.
  `apps/mobile/src/features/games/__tests__/copy.test.ts` fails on one.
- Never call the MLB Stats API or the Anthropic API from the client. Never ship a service-role or
  Anthropic key in the app bundle.
- Never store raw device coordinates. Distance and accuracy only.
- **The repo is public.** No secrets tracked, ever. Hosted service JWT and `CRON_SECRET` live in
  `/tmp/hosted.env` (mode 600) on Dean's machine. `.claude/settings.json` pre-approves the hosted
  deploy commands (Dean, 2026-09-17); it lists command patterns only, never secrets.
- Never delete Dean's hosted user (the one whose provider is `apple`). Destructive hosted
  operations, `db reset` included, need his explicit yes. Deploying functions, applying migrations
  and setting secrets that v1 needs are ordinary work.
- Every RLS policy and constraint gets a pgTAP test. Do not start a milestone with failing tests.
- When the spec is ambiguous or seems wrong in practice, ask rather than guess.

---

## 7. Traps, each of which cost a previous session real time

1. **`apps/mobile/.env` never reaches an EAS build.** It is gitignored and EAS uploads the git
   tree. Build config lives in `eas env:list production`. A build without those values installs
   and then crashes on launch.
2. **The Sentry config plugin fails EAS builds** without `SENTRY_DISABLE_AUTO_UPLOAD=true`.
3. **New Supabase key format.** The injected `SUPABASE_SERVICE_ROLE_KEY` is not the legacy JWT, so
   `authorizeInternal` refuses it. Internal calls send **both**
   `Authorization: Bearer <legacy service JWT>` and `x-cron-secret`. Get the JWT with
   `npx supabase projects api-keys --project-ref vekdufflzklfxljqufbq`.
4. **PostgREST returns at most 1000 rows.** Filter on the server; "fetch then filter" silently
   dropped a real game once.
5. **The query cache is persisted.** Never cache an empty "not ingested yet" answer for long.
   `features/relive/queries.ts` has the pattern.
6. **Do not run `eas init`.** It rewrote the slug and injected Android permissions including
   RECORD_AUDIO. The project is `@deanyao/jinx` (`ea474a72-1186-4600-90e1-8dffcdbcafa2`).
7. **`MinimalDb` has no `.or()`.** Split into two queries and merge; the ingest pipeline is typed
   against that interface.
8. **Writing the backslash-u escape for an em dash into a file can land a literal em dash**, which the copy test then
   flags. Use `String.fromCharCode(0x2014)`.
9. **Simulator: no accessibility permission, so no scripted taps.** Verify with deep links
   (`xcrun simctl openurl booted jinx:///route`) and tests. A deep link to the screen already open
   does not remount it; terminate and relaunch to see fresh data. Animations have a way in too:
   `jinx:///you/eggs?play=<flag key>` (add `&sport=nfl` for the confetti) shows one easter egg and
   starts it, so frames can be screenshotted. Open `jinx:///you/about` between two of them.
   Sign out and in without a tap (development builds only, 2026-09-22): any route with
   `?signOut=1` signs out (`jinx:///settings?signOut=1`), and
   `jinx:///welcome?token_hash=<hash>` signs in, where the hash is `hashed_token` from local
   GoTrue's `POST /auth/v1/admin/generate_link` (`{"type":"magiclink","email":...}`, service
   role key as `apikey` and bearer).
10. **The Supabase CLI prints query JSON two ways**: a bare array in a terminal, `{"rows": [...]}`
    when it detects an agent. Handle both, or a script written by one breaks for a person.
11. **"Accepted" is not "correct".** The storylines validator accepted "105-73" for the 2025
    Dodgers: every digit real, added across regular season and postseason. Read model and data
    output against the database, every time.
12. **Hosted auth settings are not in the repo.** `supabase/config.toml` only configures local. A
    fresh hosted project emails an 8-digit code inside a "Sign in" link template, and the app's
    code screen takes exactly 6 digits, so sign-in is impossible until the dashboard matches local:
    OTP length 6, and the body of `supabase/templates/magic_link.html` pasted into both the Magic
    link and Confirm sign up templates. The templates cannot be edited until custom SMTP is saved.
13. **Renaming or moving the repo folder breaks the iOS build.** `ios/Pods` and `ios/build` bake
    in absolute paths. Fix: `rm -rf apps/mobile/ios/build`, then `pod install` in `apps/mobile/ios`
    with `LANG=en_US.UTF-8` set (CocoaPods crashes without a UTF-8 locale), then `npm run ios`.
14. **`npm run ios` does not run `pod install`.** After adding a package with native code, run
    `LANG=en_US.UTF-8 pod install` in `apps/mobile/ios` first, or the app builds without the module.
    And never run two `npm run ios` at once: they fight over the build database and one fails.

---

## 8. Where everything is

| File | What it holds |
|---|---|
| `SPEC.md` | The product and engineering spec. Authoritative |
| `CLAUDE.md` | Layout, commands, conventions |
| `docs/progress.md` | Milestone status, with the evidence for each |
| `docs/interactions.md` | Every control and what it should do |
| `docs/subpage-style.md` | The design rules for every screen outside the reference, and the shared kit |
| `docs/verification.md` | External facts checked against live sources, and bugs found that way |
| `docs/deploy.md` | Accounts, costs, the TestFlight runbook, environment variables |
| `docs/simulator.md` | Running locally, and why the build is non-standard |
| `docs/elo-backtest.md` | Elo tuning evidence |
| `docs/evidence/` | Screenshots quoted by `docs/progress.md` |
| `scripts/hosted-rollout.sh` | The hosted deploy, verified step by step |
