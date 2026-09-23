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
| **hosted** | Supabase `vekdufflzklfxljqufbq` | What Dean's phone talks to. Games 2016 onward, his choice, 14,826 of them NBA and 4,962 MLS. Every migration through `20260923100000` as of 2026-09-22 22:55 UTC |
| **TestFlight** | EAS `@deanyao/jinx` | Build 4 submitted 2026-09-17, waiting on Apple processing |

**Hosted, as verified today:**

- **Eleven of twelve Edge Functions are deployed**: `storylines`, `parse-ticket`, `cleanup-imports`,
  `delete-account`, `mlb-sync`, `mlb-live`, `nba-sync`, `nba-live`, `send-push`, `evaluate-goals`,
  and since 2026-09-22 `welcome-wall`, the one public function (`GET`, no session, deployed with
  `--no-verify-jwt`; it only reads `welcome_wall_cards`).
  `inbound-email` stays undeployed until ticket forwarding is set up on `jinxsports.fans`
  (section 5). **`nba-sync` and `nba-live` are deployed but not scheduled**: Supabase's egress
  cannot reach cdn.nba.com, stats.nba.com or ESPN (a probe function answered 403, hang, 403 on
  2026-09-18; `net._http_response` id 68 is nba-sync's 500). The NBA's data path is the daily
  GitHub job, which reaches the CDN but not stats.nba.com, and this laptop for rosters and
  pre-2019 detail (`docs/deploy.md`). **Since 2026-09-22 the phone reads NBA and MLS live state
  itself** (`apps/mobile/src/features/live/feeds.ts`, Dean's decision 8): the CDN scoreboard and
  ESPN's summary answer a fetch from the device build (`docs/evidence/live/`), so Pick a side,
  the game page scoreboard, the check-in window and the two live eggs work for both;
  `nba-live` stays deployed and unscheduled as a spare.
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
6. **Design assets.** `docs/design-assets-to-replace.md` is the inventory (the welcome wall's
   entry was rewritten at the rebuild); there are no drafts
   of replacements. Dean is taking it to Figma or an image model. The app icon is still the
   Expo default and the splash is blank.
7. **Sentry** (a free account, then the DSN, org and project slugs and an auth token) and
   **ticket forwarding** (Email Routing on Cloudflare, `wrangler login` once): the exact steps
   are in `docs/prompts/next-wave.md` section H.

**Social v2, prompt 1, on branch `social-v2` only (2026-09-22, not on main, not on hosted).**
Briefs: `docs/prompts/social/`, and `00_repo_reality.md` wins where they disagree. Five tabs,
Feed, Passport, Games, Plan, Profile, each its own stack: `app/(tabs)/(<tab>)/` holds what one
tab owns and `app/(tabs)/(feed,passport,games,plan,profile)/` what every tab can push (a game,
Relive, a profile, a guide), so a game opened from the Passport comes back to the Passport. **No
path changed** (Dean, Q2): `/games/<id>`, `/u/<handle>`, `/settings`, `/relive/<id>` are what
they were; `app/+native-intent.tsx` only adds the owning tab's group to a cold link so it opens
with that tab's root under it. One tab bar drawn by the tab layout; the reference screens'
`<TabBar/>` stands down inside it and still draws for the parity harness (whose shots now have
five tabs and Upcoming first, so their scores move). Tapping the showing tab pops to its root;
tabs are not lazy, so a push into a tab never opened still has a root. Plan is the existing
feature, kept (Dean, Q1). New routes render placeholders: `/feed`, `/post/<id>`,
`/post/<id>/comments`, `/communities`, `/community/<slug>`, `/community/<slug>/leaderboard`,
`/react/<id>`, `/passport/streak/<team>`, `/passport/badges`, `/passport/favorites`. An unknown
link lands on the Passport with a toast. Tests: `features/navigation/__tests__/tabs.test.tsx`.
Screens: `docs/evidence/social/navigation/`.
**The v2 schema is on local only** (migrations `20260924000100` to `000800`, pgTAP `060` to
`067`, SPEC 5.3): the emoji table is `feed_reactions` and `reactions` is the photo table (R2);
`checkins` is a session, `checked_in_at` renamed `started_at` with `ended_at`, `end_reason`,
`attendance_id`, `visibility` (R4; `game_context` still answers `checked_in_at`, and Pick a side
needs an open session); companion tags carry a status, confirmed at once for a placeholder and
pending for a linked user (R5); posts, post photos, kudos, comments, mutes, reaction prompts,
reactions, communities, members, community posts, leaderboards, streaks, badges, counts and four
favorites, each with its RLS and counters kept by triggers. Proven by `supabase db diff`, which
applied every migration to a fresh shadow database and found no difference from local. **Before
this goes to hosted:** builds 4 and 5 write emoji to `reactions`, so on a hosted database with
these migrations their emoji taps fail (and they show pending companion tags as companions).
Ship a build carrying this branch first, or accept that. Storage buckets for post and reaction
photos are not made yet (prompts 2 and 3).

**Social v2, prompt 4 (communities, leaderboards, streaks, badges, counts, four favorites), on
branch `social-v2-communities` off `social-v2` (2026-09-23, not merged, not on hosted).** Brief:
`docs/prompts/social/04_communities_and_leaderboards.md`; `00_repo_reality.md` wins where they
disagree; design note on what shipped and what did not: `docs/COMMUNITIES.md`. Migrations
`20260924030000` to `030200`, pgTAP `090`. `goal_games()` gained the six fields badges need
(timezone, temperature, doubleheader, Opening Day, new-state, distance from home); `packages/core`
gained `streaks.ts`, `leaderboard.ts` and `badges.ts` (25 launch badges plus the eight
`features/eggs/flags.ts` eggs as `is_secret` badges, five new predicate types on the goals
evaluator, SPEC 6.13, R6). `supabase/functions/evaluate-social` computes badges and season streaks
per user, called from `process_game_final` and `attendances_after_write` the same way
`evaluate-goals` already is. Communities are seeded for real: 122 team, 114 venue, 1 school
(Caltech), across all four sports (00, R3). Screens: `/communities`, `/community/[slug]` (header,
two leaderboard previews, the member feed, join/leave/report), `/community/[slug]/leaderboard`
(stat chips scoped to the community's kind and sport, period segmented control, friends-only,
the verified-attendance notice, the viewer's row pinned when off-page), `/passport/badges`,
`/passport/favorites` (a same-screen picker over the fan's attended games), and
`/passport/streak/[teamId]`. The Passport screen gained three preview sections (streak patches,
capped at the three longest; a four-favorites preview; an earned-badges preview) in the same
place and the same `env.demo`-gated pattern `FavoritePlayers` already used, so the parity harness
is untouched. **Walked on the simulator signed in as a real user against real backend data**
(minted magic link, `docs/simulator.md`), not just typechecked: three real bugs were found and
fixed this way that `tsc` and Jest could not have caught (`Notice`'s children prop breaks on
interpolated JSX children rather than a single string, so two screens threw "Text strings must be
rendered within a `<Text>`" at runtime and showed blank; the community screen's Join/Leave/Report
buttons were unreadable, accent-colored text on an accent-colored card; a community page's
leaderboard previews queried a `(period, season)` pair the check constraint forbids and always
read "Not ranked yet"). Screenshots before and after each fix: `docs/evidence/social/communities/`.
Two migration-correctness bugs a peer session's review caught before merge (a non-idempotent
`drop constraint` and trigger create, and a `revoke` naming the wrong function signature) are
fixed and reverified from a database with the function fully dropped first, not just against
already-patched local state. Not done, and said plainly in `docs/COMMUNITIES.md`: user-created
communities (`kind='custom'` exists in the schema only), an "unofficial" self-reported
leaderboard, the streak "at risk" nudge (the pure function exists and is tested; nothing calls it
server side), and Profile's counts block (`useCounts()` and `user_counts` are real and tested;
no screen renders it).

**The welcome screen is rebuilt (2026-09-22), and its wall restocks itself weekly.**
`design/welcome-reference.html` is its source of truth; `app/(auth)/welcome.tsx` composes
`features/onboarding/ui/WelcomeArt.tsx` (the wall, scrim and copy) and `WelcomeActions.tsx`
(Apple's button, "Continue with email" under it when the build offers it, both dev-only deep
links kept). The wall is under `features/onboarding/ui/wall/`: three tilted columns, drawn twice
and moved on the UI thread by their measured stack height, gold sheen on brass seals, pulsing
moment cards, counters on one shared clock. Reduce Motion or `EXPO_PUBLIC_WELCOME_FROZEN=1` holds
everything at phase zero with the counters at 48 and 14; the parity harness has a `welcome`
screen and scores it at 10.7% (the copy sits 12pt higher than the reference to clear the home
indicator; `design/PORTING_NOTES.md` lists every substitution). Evidence: `docs/evidence/welcome/`.

The six game cards are real: migration `20260923100000` adds `welcome_wall_cards`, a SQL scorer
with its weights written in the file (postseason 100, a detected moment 45, NFL primetime 40,
same-division rivalry 35, one-score 30, overtime 30, comeback 25, high score 15, big market or
crowd 10, recency as the tiebreak), and `welcome_wall_refresh()`, which pg_cron calls directly at
13:00 UTC on Mondays and on Fridays from September to February (no Edge Function in that path, so
trap 3 does not apply). It takes the last 7 days, widens to 30 and then 365 when short, never
picks a team twice or a sport more than three times, and gives every third card the losing side.
The app fetches `GET /welcome-wall` in the background at most every six hours, validates the
shape by hand (no zod in the bundle), caches it, draws the cache on the next launch, and falls
back to the six bundled reference games when there is none, it is malformed, or it is older than
14 days. Colours come from `wall/teamFills.ts`, generated from the palette seeds by
`provider:provider_team_id` (team uuids differ between local and hosted). pgTAP `050`, five Deno
tests, 31 Jest tests. **The first real run on hosted, 2026-09-22 22:55 UTC**, picked Chiefs 33,
Colts 30 (Sunday night), Twins 5, Yankees 4, Vikings 9, Bears 3, Rays 2, Red Sox 1, Packers 20,
Jets 17 and Giants 6, Cardinals 5: three NFL, three MLB, no MLS because none of its 15 finals
scored above 55. Judge the job by the table's rows, never by `cron.job_run_details`.
Not done: frame rate on a real phone (no device; the simulator cannot say), and the fetch was
proven against the locally served function, not against hosted from a build.

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
penalties is a win. **MLS second wave, in progress (2026-09-22).** Done: a draw-aware Elo (`runEloThreeWay`,
three-way log loss 1.0358 over 3,911 matches from 2018 against 1.0518 for the base rates,
`docs/elo-backtest.md`), probabilities for every match on local and hosted (`game_win_prob`
with `draw_prob`, method `elo_draw_v1`), Pick a side at an MLS match (the pledged side's own
probability, the explainer says "Draw 27%: a draw voids the pick", the lock is the first goal or
halftime with the phone's live feed), and **a draw voids the pledge**: `void`, reason `draw`,
no result, "Drawn, no result" on the screens and in the notification, out of every count; a
shootout is a drawn match and voids too, extra time scores (migration `20260923000800`, test
`021`). Rosters and favorite players are on: `ingest/src/mls/rosters.ts` loads ESPN's `teams/{id}/roster`
(945 players across 30 clubs on local and hosted, daily in `mls-ingest.yml`), the players
prompt lists them (`docs/evidence/mls/journey/players-prompt-inter-miami.png`). **Relive and
detail are on** (`ingest/src/mls/detail.ts`, daily `--queue` in the workflow): one ESPN summary
per logged match gives the appearances with their lines, the goals with scorer and kind, the
moments (hat trick, red card, shootout, two-goal comeback), the pledge lock and the exact end,
and a story of goals, cards, substitutions, breaks and the penalties on a state-model line
(ESPN's soccer summary has no win-probability series; `packages/core/src/providers/mls/detail.ts`).
`ingest/src/verify/relive.ts` now checks 5 MLS matches against the scoreboard's `details[]`
(20 games across four sports check out). Wrapped is on for MLS (calendar year, migration
`20260923000900`, test `022`); the game screen's "not available yet" sentence is gone.
Screenshots: `docs/evidence/mls/relive/`, `docs/evidence/mls/wrapped/`. **NBA and MLS
superstars are loaded** (D.1, 2026-09-22): `seed/nba_awards.json` and `seed/mls_awards.json`
through `ingest/src/nba/honors.ts` and `ingest/src/mls/honors.ts`, honor kinds by migration
`20260923001000`, and `seed/franchise_players.json` now holds all four sports (350 rows,
`ingest/src/famous/franchise.ts` resolves NBA and MLS names too); Messi is a superstar at the
Inter Miami match, LeBron at a 2016 Cavaliers game (`docs/evidence/superstars/`).

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
- **Light mode was walked on 2026-09-22** (next-wave G.1): 50 routes under the Phillies theme
  and 50 under the Bears theme, contact sheets in `docs/evidence/light/`; the signed-out screens
  in both modes in `docs/evidence/signed-out/`; the MLS journey in `docs/evidence/mls/journey/`.
  Dev links for a scripted walk: `?themeTeam=<team id>` picks the theme, `relive/<id>?step=N`
  opens a story step. Nothing was found invisible in light; the onboarding name placeholder rendered
  letter-spaced on one launch and normally on the next, so it is transient, not a style.
- **Palettes were cross-checked on 2026-09-22** (next-wave F) against jimniels/teamcolors and
  ESPN: the fills all matched ESPN, every MLS `--t2` had been a copy of its primary and now is
  ESPN's alternate (30 rows changed, `docs/palette-diff.md`, `docs/evidence/palettes/`).
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
the stack. Seen on the simulator: `docs/evidence/sign-out/`. A second bug found the same way:
the team palettes query ran at launch, above the navigator, and on an app that starts signed
out it ran as anon, got no rows and cached that for a day, so a fan who signed in saw every
team in neutral grey until the next launch. It now waits for a session
(`after-sign-in-from-cold-start-palettes.png`).

**Only regular season and postseason games exist (2026-09-22, Dean's decision 13).** 11,703
spring-training and NBA preseason games left local and 5,649 left hosted, nobody had logged
one on hosted, and a check constraint on `games.game_type` keeps them out; the MLB and NBA
ingests no longer ask for them, and the ticket and famous-game matchers treat any other type
as absent. The 40 spring-training and exhibition parks that never had a coordinate went with
them, which closes the "42 venues unresolved" item: the two venues still without coordinates
(Fort Bragg Field, Walmart Park) each hosted one real regular-season game. Migration
`20260923000100`, test `046`, `docs/verification.md`.

**NFL detail only for logged games (2026-09-22, Dean's decision 17).** The NFL pipeline now
follows SPEC 4.7 like MLB and the NBA: `games_wanting_detail('nflverse')` names the games that
are queued (a fan logged, checked in, is going or matched a ticket), attended or famous, and
`ingest/src/nfl/run.ts` details only those, skipping a season's 20 MB play-by-play when nothing
in it is wanted, and settles the queue after. Migration `20260923000600` dropped the rest:
543,273 appearance rows, 89,290 scoring plays and 8,267 moments on local (87 of 7,289 games keep
detail), 2,756 games' worth on hosted (37 keep it; 48 famous games without detail are now on the
nightly job's list). Proven: a newly logged 2025 game was detailed by the next
run alone (1 of 285), the Relive verifier still passes all 15 games, all 90 famous NFL games keep
their stars. A game logged today gets its detail with the nightly job, as before. Test `019`.

**A first touchdown is a career first again (2026-09-23).** Dean found a badge on his own
passport saying he saw DeVonta Smith's first touchdown at Eagles at Titans; Smith is a 2021
rookie and it was his first of 2026. `ingest/src/nfl/firsts.ts` skipped only players whose
rookie season was before `PBP_FLOOR`, but the daily job reads the current season alone, so
every player's first touchdown of that season was stored as his first ever. All 112 rows on
hosted came from 2026 games and 104 were wrong; local was right because the full backfill had
run there. `canKnowFirst(rookieSeason, from)` now requires the scan to reach the rookie season,
so a one-season run records rookies and nobody else (`ingest/src/nfl/firsts.test.ts`, 5 tests).
The bad rows were deleted and the full 2000-2026 scan rerun on hosted: **3,101 firsts, none
before the player's rookie season, Smith back on `2021_01_PHI_ATL`**. The same run exposed a
second bug: the rookie-season fill read only players whose column was null, so 130 wrong values
from an old load never healed, and 30 of the 2010 draft class (Suh, Eric Berry) were stored as
2011 rookies although players.csv says 2010. It now reads every nflverse player and writes back
the ones that disagree with the file.

**Known wrong, not yet fixed:**

- **The local database is 145 MB, under M1's 150 MB bar at last (2026-09-22).** It was 278 MB
  that morning: the preseason games took it to 254 MB and NFL detail on demand (below) to 145 MB.
  Hosted was 115 MB before its NFL cleanup; autovacuum returns the space over the following days.
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
- **The data export holds everything (2026-09-22).** `export_my_data()` gained handshakes,
  favorite players, attendance photos, MLS results (decision, shootout, winner), famous games
  seen, followers, blocks, reports, reactions, notifications and preferences, device tokens,
  sign-in and forwarding emails (no OTP hashes) and inbound rejections; migration
  `20260923000400`, test `049`, on local and hosted.
- **Live state on the phone (2026-09-22).** `useLiveState(gameId, sport, enabled)` reads
  `game_live_state` for MLB and the public feeds for the NBA and MLS, every 30 s while enabled,
  backing off to five minutes on a failure, and moves the cached game's status when a feed says
  live or final. The game page shows live scores and the period ("Q3 4:12", "67'", "Top 7th"),
  the check-in window closes an hour after a feed's final, `LOCK_RULES` and `EGG_SPORTS` have
  `nba` live and an `mls` row (first goal or halftime locks; the rally cap and halftime confetti
  fire, with a soccer ball, a scarf and a whistle). **Not yet seen with a game under way**: the
  NBA is off-season and no MLS match was live during the session; the parsers are tested on
  real responses and the probe (`jinx:///you/eggs?probe=live`) proves the fetches.
- **Players seen shows superstars, for good games (2026-09-22, Dean's decision 7).** Every
  appearance of a detailed game carries its box-score line and a `good_game` flag
  (`packages/core/src/goodGame.ts`: MLB a home run, 3 RBI or 3 hits, or 7 innings with 2 or
  fewer earned runs, 10 strikeouts or a save; NFL a touchdown reached, 100 rushing or receiving
  yards, 300 passing, 2 sacks or an interception, never a kick; NBA 30 points, a triple-double,
  20 rebounds or 15 assists; MLS a goal, an assist or a goalkeeper's clean sheet), and
  `players_seen`, `game_players_seen` and the tap-through list show a player only for a good
  game and only when they are a superstar or this fan has seen them have ten. The line is stored
  for everyone, the cheaper choice since detail exists only for logged games. NFL lines come
  from nflverse's weekly stats file; MLS lines wait for MLS appearances (E.3). Seen on the
  simulator: `docs/evidence/players-seen/` (Ohtani with "MVP 2025 · 1 HR, 1 RBI, 5.0 IP, 5 K, 0
  ER"; Byard and A.J. Brown; the NBA game names nobody until NBA honors load). Hosted: Dean's
  four MLB games re-detailed (14 good games of 116 lines); his two NFL games are queued for the
  nightly refresh. Migration `20260923000700`, test `020`.
- **Easter eggs are built and unseen by Dean.** Eight, each behind a flag in
  `apps/mobile/src/features/eggs/flags.ts`: worn stamps, golden stamps, record rewind, curse
  breaker, rally cap, stretch confetti, certified jinx, secret handshake. Settings > About has a
  dev-only "Easter eggs" row that plays each one. The NFL halves of rally cap and stretch
  confetti are written and cannot fire until live NFL data exists (`EGG_SPORTS.nfl.liveFeed`).
- **Build 5 needs a fresh native build**, not an update: `expo-sensors` was added for the rally
  cap's shake, and the camera and photo permission strings changed for profile pictures.
- **`support@example.com` is the support address in the app**, and the privacy text still carries
  a "Replace Jinx with the final name" line and "(draft)" titles. Fix before external TestFlight.
- **`games.final_at` is filled (2026-09-22).** It was dead because the 15-minute schedule
  refresh wrote null over what the detail pass had written. Now: `upsertGames` leaves the column
  out when it has nothing, trigger `games_keep_final_at` never lets a schedule write replace a
  detail value, MLB schedules carry `hydrate=gameInfo` (first pitch plus duration, within two
  minutes), the NBA takes the Game End action's wall clock, MLS estimates from the display clock
  and `ingest/src/mls/finals.ts` writes ESPN's exact wall clock for attended and recent
  matches daily. Hosted after the backfill: every 2026 MLB final, all four attended MLB games
  exact, Dean's MLS match exact, all NFL; NBA finals get it when someone logs one. The game
  page's check-in button now reads it. `docs/verification.md` has the per-feed facts.
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
   role key as `apikey` and bearer). `jinx:///games/<id>?scroll=end` lands on the bottom of a
   game page (Players seen), `jinx:///relive/<id>?step=9` opens Relive on that step of the
   story, `?themeTeam=<team id>` picks the theme the app wears, and `jinx:///you/eggs?probe=live`
   runs the public live feeds. A magic-link hash is single use, and `?signOut=1` only works on a
   route the current user can reach: for a user still in onboarding use `jinx:///teams?signOut=1`.
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
