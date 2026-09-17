# Where Jinx stands

**Read this first, then `SPEC.md`.** It is the one file that says what is true right now: what
works, what is half done, what is deliberately switched off, and what only Dean can do. Anyone
picking the project up, person or agent, should be able to start from here and nothing else.

Last verified: **2026-09-17, 12:40 PDT**, by running the commands quoted, not by reading commits.
Keep it that way: when you change what is true, change this file in the same commit.

---

## 1. What Jinx is

A passport for sports fans: every game you attend becomes part of a living record. iOS only,
MLB and NFL, v1 in TestFlight. `SPEC.md` is the product and engineering spec and it is
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
| **local** | Supabase on ports 54421-54427 | 82,240 games, 2000 onward. Every migration. Where you develop |
| **hosted** | Supabase `vekdufflzklfxljqufbq` | What Dean's phone talks to. Games 2016 onward, his choice. All 22 migrations |
| **TestFlight** | EAS `@deanyao/jinx` | Build 4 submitted 2026-09-17, waiting on Apple processing |

**Hosted, as verified today:**

- **Eight of nine Edge Functions are deployed**: `storylines`, `parse-ticket`, `cleanup-imports`,
  `delete-account`, `mlb-sync`, `mlb-live`, `send-push`, `evaluate-goals`. `inbound-email` stays
  undeployed until ticket forwarding is set up on `jinxsports.fans` (section 5).
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

**Decided by Dean, not yet built:** nothing outstanding. Favorite players on the Passport was the
last open question and shipped on 2026-09-17.

**Known wrong, not yet fixed:**

- **The local database is 226 MB** against M1's 150 MB bar, because NFL detail is stored for every
  game rather than logged ones. Under the 300 MB target and the 500 MB free-tier cap.
- **Restyling the non-reference screens** is unasked and unspec'd. SPEC 8.8 names the reference
  screens; everything else (onboarding, auth, game detail, check-in, imports, settings, map,
  goals, bucket lists, Wrapped, other profiles) uses the same tokens and components but has no
  layout to match. Ask before doing it.

---

## 6. Rules that are not negotiable

- **No em dashes in UI copy.** Dean's rule. En dashes in scores and records are correct and stay.
  `apps/mobile/src/features/games/__tests__/copy.test.ts` fails on one.
- Never call the MLB Stats API or the Anthropic API from the client. Never ship a service-role or
  Anthropic key in the app bundle.
- Never store raw device coordinates. Distance and accuracy only.
- **The repo is public.** No secrets tracked, ever. Hosted service JWT and `CRON_SECRET` live in
  `/tmp/hosted.env` (mode 600) on Dean's machine.
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
   does not remount it; terminate and relaunch to see fresh data.
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

---

## 8. Where everything is

| File | What it holds |
|---|---|
| `SPEC.md` | The product and engineering spec. Authoritative |
| `CLAUDE.md` | Layout, commands, conventions |
| `docs/progress.md` | Milestone status, with the evidence for each |
| `docs/interactions.md` | Every control and what it should do |
| `docs/verification.md` | External facts checked against live sources, and bugs found that way |
| `docs/deploy.md` | Accounts, costs, the TestFlight runbook, environment variables |
| `docs/simulator.md` | Running locally, and why the build is non-standard |
| `docs/elo-backtest.md` | Elo tuning evidence |
| `docs/evidence/` | Screenshots quoted by `docs/progress.md` |
| `scripts/hosted-rollout.sh` | The hosted deploy, verified step by step |
