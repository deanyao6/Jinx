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
  whose detail already exists, which is every game in `mlb-sync`'s rolling three-day window, so a
  queue-driven worker would never have built their stories. `games_needing_relive` asks the
  question directly: attended, final, detailed, no story. `games.relive_checked_at` stops a game
  with no published win probability being refetched forever; recent games are retried for two
  weeks because both providers publish it late.
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
