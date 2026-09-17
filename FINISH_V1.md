# Finish Jinx v1

> **Status, end of the 2026-09-17 finishing session.** Sections 2.1 and 2.2 are built, tested and
> proven on the **local** stack. **Nothing was applied to hosted**: that session's permission mode
> refused every operation against the hosted project, reads included, so section 1's hosted
> findings below are still exactly true. The next step is one command, run by Dean or by a session
> allowed to: `bash scripts/hosted-rollout.sh`. Then one `eas build` and a submit.
> Per-milestone evidence, and what is honestly not met, is in `docs/progress.md`.

**Your job: take Jinx from "installed on TestFlight" to "v1 as the spec defines it", verified.**

Written 2026-09-17 by the session that shipped TestFlight builds 1-3, for the session finishing v1.
Dean wants this done. Work through it without stopping for approval on ordinary engineering, and
stop only for the items in "Blocked on Dean". This repo is public: never commit a secret.

---

## 0. Read first, in this order

1. `CLAUDE.md` (loaded automatically). Ground rules, layout, commands.
2. `SPEC.md` **Section 12** (milestones, each with a "Done when"). **That is the definition of v1.**
   Section 2 lists the v1 scope; Section 13 is the later-phases roadmap and is **not** v1.
3. This file.
4. `docs/deploy.md` (bottom: TestFlight runbook, storylines, environment variables).
5. `docs/verification.md` (bottom: storylines against ground truth; the key-format auth bug).
6. `docs/interactions.md` (every control and what it should do).

Memories in `~/.claude/projects/-Users-deanyao-Desktop-name-tbd/memory/` load automatically; two
are standing rules: no em dashes in UI copy, and verify the real artifact before reporting ready.

---

## 1. Where things actually stand (verified 2026-09-17, not taken from commit messages)

**Working, on Dean's phone:** TestFlight build 2 installed; Sign in with Apple works; onboarding,
favorites (teams and players, Settings > Favorites), manual logging, Passport, Games, Relive for
his two logged games, Players seen, stadium silhouettes. Build 3 (Plan tab + storylines on game
detail) is built on EAS and **not submitted**.

**Hosted Supabase `vekdufflzklfxljqufbq`:** all migrations applied; seed data; MLB + NFL games
2016-2026 (Dean chose the range; local holds 2000+). Function secrets set: `ANTHROPIC_API_KEY`,
`CRON_SECRET`. Dean's real account is the user whose provider is `apple`. **Never delete it.**

**Deployed Edge Functions: 2 of 9.** `storylines` and `parse-ticket`, both verified end to end.
Not deployed: `cleanup-imports`, `delete-account`, `mlb-sync`, `mlb-live`, `send-push`,
`evaluate-goals`, `inbound-email`.

**pg_cron is firing on hosted, reporting success, and doing nothing.** Seven jobs are active:
`mlb-sync` (15 min), `mlb-live` (1 min), `send-push` (2 min), `cleanup-imports-daily`,
`wrapped-daily`, `game-day-reminders`, `housekeeping-daily`. **`cron.job_run_details` shows them
all as `succeeded`. Do not trust that.** The vault is empty (no `project_url`, no
`service_role_key`), and `call_edge_function` handles missing secrets by raising a notice and
returning, so the job "succeeds" without calling anything. Most target functions are not deployed
either, and trap 3 would stop them even if they were. Judge a scheduled call by
`net._http_response`, never by the cron status.

**Domain logic that already exists and is tested** (do not rebuild it): pledge lock and validation
for every M5 scenario in `packages/core/src/pledge.test.ts` (MLB scoreless 1st, first run, NFL
first score, 10:00 mark, missing timestamps); storylines facts, significance and validator
(`packages/core/src/storylines/`); data export (`export_my_data`, `features/account/queries.ts`).

---

## 2. The work, in order

Backend first. **None of section 2.1 needs an app build**: server changes reach the build already
installed. Section 2.2 does, and all of it should ship as **one** build.

### 2.1 Backend (no build)

1. **`cleanup-imports`: deploy, and prove it deletes.** SPEC: ticket images private, deleted after
   7 days (`TICKET_IMAGE_RETENTION_DAYS`). `parse-ticket` is live and accepting uploads, so this
   is a live privacy gap. Test with a throwaway user and a backdated `ticket_imports` row.
2. **`delete-account`: deploy, and prove it deletes.** Apple requires it, and the button is on
   Dean's phone now. Throwaway user only; confirm the auth user and their rows are gone.
3. **Make scheduled calls actually authenticate** (trap 3). New migration: `call_edge_function`
   sends `x-cron-secret` from vault as well as the bearer JWT. Set vault secrets on hosted
   (`project_url`, `service_role_key` as the **legacy JWT**, `cron_secret`). Prove one scheduled
   run succeeds by reading `net._http_response`, not by assuming.
4. **Deploy and confirm the scheduled functions:** `mlb-sync`, `mlb-live`, `send-push`,
   `evaluate-goals`. Add schedules for `storylines` per SPEC 6.18: the morning of each game, and a
   refresh one hour before start (`{"upcoming_hours": N}`; see `docs/deploy.md`).
5. **Game detail and Relive must happen without a human** (SPEC 4.7). Today nothing drains
   `detail_queue`; `.github/workflows/daily-jobs.yml` runs MLB detail once a day, and **nothing**
   builds Relive steps (`ingest/src/mlb/relive.ts`, `ingest/src/nfl/relive.ts`) for any sport.
   A newly logged game never gets a story. Wire relive into the scheduled path for both sports.
6. **Confirm both scheduled GitHub workflows pass** (`gh run list`). They failed on 2026-09-16,
   before the schema existed. The Elo job in `daily-jobs.yml` fills `game_win_prob`, which
   Pick a side needs.

### 2.2 App (one build, at the end)

1. **Sign out.** Dean reported it: there is no way to sign out. `useSignOut()` exists in
   `features/auth/hooks.ts`; its only caller is `app/(tabs)/legacy-you.tsx`, which nothing links to
   since the reference tab bar replaced the old tabs. Add it to Settings.
2. **Audit the three unreachable legacy tabs** (`legacy-you.tsx`, `legacy-passport.tsx`,
   `legacy-friends.tsx`) for any other action that has no entry point now. Sign out was found by a
   user; do not wait for the next one.
3. **Sign in with Apple only** (SPEC 2, item 1). Hide "Continue with email" on `(auth)/welcome.tsx`:
   there is no email sender, so on TestFlight it is a dead end. Keep auth extensible.
4. **Pick a side on real data** (M5, SPEC 6.4, 8.8.3). The screen renders the empty repository.
   Wire it from a check-in at a neutral game: pledge via `make_pledge`, the lock countdown, win
   probabilities, and storylines with source labels (`features/storylines/queries.ts` has the read
   path and ordering). The lock logic is done and tested; this is the screen and the flow.
5. **Relive, the rest of M8.5.** Photo and video upload to `attendance_photos` with visibility
   (TODO in `ReliveScreen.tsx`); the fans-at-this-game feed, honouring privacy and blocks; the
   official highlights link per game and per sport (it opens MLB's site for everything today).
   Done-when: plays correctly for 5 real MLB and 5 real NFL games including extra innings and
   overtime.
6. **Forwarding email UI** (`you/forwarding.tsx`) must be hidden until a domain exists (M4 says
   behind a flag). Check whether it is.
7. Remaining TODOs: `grep -rn TODO apps/mobile/src` (Relive and Plan share cards, guide visit count).

### 2.3 Prove each milestone

For every milestone M0-M10, check its "Done when" and record evidence in `docs/progress.md`:
the command run, the query, the screenshot. **"The code exists" is not evidence.** The last session
found the data repository had never been mounted, after the overnight log said it was.
M10's bar is the real test: a friend with no context installs, onboards, imports a ticket and
checks in, without help.

---

## 3. Blocked on Dean: batch these into one message, and keep working on everything else

- **`eas submit`** needs his Apple login and 2FA (no App Store Connect API key exists). Either he
  runs it, or he creates an ASC API key so submits can be automated. `eas build` needs nothing.
- **Domain + Resend**: email one-time codes and forwarding. M4's done-when needs "a real forwarded
  confirmation"; it cannot pass without this.
- **Sentry**: account and DSN (M10 crash reporting). Until then keep `SENTRY_DISABLE_AUTO_UPLOAD`.
- **App Store Connect**: privacy details, external TestFlight group (M10).
- **M0.5 done-when** is Dean's approval of screenshots. Ask; do not self-certify.
- **Open question:** does a neutral game with no pick count toward "games attended" and nothing
  else? His record showed 0-0 with 1 game attended.
- **Not in the spec, so ask before doing:** rebuilding the non-reference screens (settings,
  onboarding, auth, goals, map) to reference layouts. They already use the reference palette and
  Archivo; SPEC 8.8 lists the reference screens, which are all built. Also: using favorite players
  on the Passport ("seen Harper 9 times"). Favorites were Dean's addition, not the spec's.

Destructive changes to hosted (dropping data, `db reset`, deleting any real user) always need his
explicit yes. Deploying functions, applying new migrations and setting secrets that v1 needs are
the job.

---

## 4. Traps that each cost the last session real time

1. **`apps/mobile/.env` never reaches an EAS build.** It is gitignored; EAS uploads the git tree.
   Build config lives in `eas env:list production`. Editing `.env` before a build does nothing, and
   a build without the values installs and then crashes on launch.
2. **The Sentry config plugin fails EAS builds** without `SENTRY_DISABLE_AUTO_UPLOAD=true`
   (set on EAS production and preview).
3. **New Supabase key format.** The runtime-injected `SUPABASE_SERVICE_ROLE_KEY` never equals the
   legacy JWT, so `authorizeInternal` refuses the service key. Internal calls must send
   `x-cron-secret`. The gateway still demands a JWT first, so send **both**:
   `Authorization: Bearer <legacy service JWT>` and `x-cron-secret: <CRON_SECRET>`.
   Get the JWT with `npx supabase projects api-keys --project-ref vekdufflzklfxljqufbq`. The last
   session kept `CRON_SECRET` in `/tmp/hosted.env` (mode 600); if that is gone, rotate it with
   `npx supabase secrets set CRON_SECRET=$(openssl rand -hex 32)` and update vault.
4. **PostgREST returns at most 1000 rows.** Filter on the server. "Fetch, then filter in memory"
   silently dropped Dean's NFL game once.
5. **The query cache is persisted.** Never cache an empty "not ingested yet" answer for long:
   Relive vanished for a day on a game opened before its story existed. `features/relive/queries.ts`
   has the pattern.
6. **Do not run `eas init`.** It rewrote the slug to `appname-monorepo` and injected Android
   permissions including `RECORD_AUDIO`. The project is `@deanyao/jinx`
   (`ea474a72-1186-4600-90e1-8dffcdbcafa2`).
7. **`MinimalDb` has no `.or()`.** Split into two queries and merge; do not widen the interface, the
   ingest pipeline is typed against it.
8. **Writing the escape backslash-u-2014 into a file can land a literal em dash**, which the copy
   test then flags. It happened again while this very line was being written.
   Use `String.fromCharCode(0x2014)`.
9. **Simulator:** no accessibility permission, so no scripted taps. Verify with deep links
   (`xcrun simctl openurl ... jinx:///route`) and tests. A deep link to the screen already open does
   **not** remount it or refetch; terminate and relaunch the app to see fresh data.
10. **"Accepted" is not "correct".** The storylines validator accepted "105-73 record" for the 2025
    Dodgers: every digit was a real fact, added across regular season and postseason. Read model
    and data output against the database, every time.

---

## 5. How to work

- **Keep going.** Do not end a turn to wait for approval on ordinary work. When one item is done,
  start the next. End only when everything left is in section 3, or when v1 is proven.
- **Verify, then report.** Before calling anything done, exercise the real thing: invoke the
  deployed function, query the table, open the screen. Say plainly what was verified and how.
- **Tests with every change.** `npm run typecheck`, `npm test`, `npm run db:test`,
  `npm run functions:check`, `npm run lint`, `npx prettier --check .` all green before each commit.
  Every RLS policy and constraint gets a pgTAP test.
- **Commit and push as you go**, with messages that say what was wrong and why, not just what
  changed. `git -c http.postBuffer=157286400 push` if a push fails with HTTP 400.
- **One app build**, at the end of section 2.2. Backend work never waits for a build.
- **Finish with a report** for Dean: what is proven done per milestone, what is blocked on him (as
  one list), and anything you found that is wrong but out of scope.
