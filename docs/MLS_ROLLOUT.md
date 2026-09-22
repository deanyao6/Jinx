# MLS rollout plan and resumable handoff

Last handoff: 2026-09-22. **MLS schema/reference data and parse-ticket deployed to hosted; simulator running at hosted sign-in; full 2016–2026 backfill complete. No TestFlight release.**

## Resume instructions

Read this file, `STATE.md`, `CLAUDE.md`, and `SPEC.md`, then inspect `git status` and the actual
diff before continuing. The MLS work is being published on branch `MLS`; inspect git status for any later local edits.
Do not restart the integration or reset the database. Preserve the pre-existing README.md and
package-lock.json changes. Do not print keys or commit `.env` files.

User approved the MLS implementation plan with “roll this out.” The first release is teams,
schedules, results, favorites, attendance logging and Passport. Advanced live state, rosters,
player details, Relive, and draw-aware predictions are deferred and should be visibly unavailable.
The user subsequently asked for this durable handoff so the session can be killed and resumed.

## Hosted rollout (2026-09-22)

User explicitly requested MLS deployment and simulator startup. CLI is authenticated and linked
only to Jinx `vekdufflzklfxljqufbq`. Applied five MLS migrations through
`20260922000100_mls_preserve_venue_timezones.sql`; deployed only `parse-ticket` after functions sync.
Recovered hosted migration `20260918110000_venue_timezones_and_search.sql` is now applied locally.
The new forward migration restores verified shared-venue zones cleared by the original MLS
upsert. The same recovered coordinate-derived mapping is in `seed/venue_timezones.json`, and
the seed merger applies it to missing zones. Local SQL suite: **371 assertions/21 files pass**.

Hosted 2016–2026 backfill is complete: **4,962 matches, 4,817 finals**, zero finals without
a venue. Twelve cancelled/postponed entries have no venue. The current-season import has:
**30 teams, 510 matches in 2026, 387 finals**, verified by hosted SQL. Simulator Metro is launched with hosted public URL/anon-key environment
overrides; the local `.env` is unchanged. Keys are fetched via CLI into child process memory,
never printed. No user attendance or favorites are changed for validation.

The local Colima `jinx` VM was temporarily stopped to free simulator memory and subsequently
restarted at the user’s request. Mailpit was verified at http://127.0.0.1:54424.

Simulator verification: Jinx loaded successfully after restarting Metro with two workers and
stopping the local VM. It is on the hosted sign-in screen; user login is needed to continue
the favorites/search/logging journey. Metro is left running on port 8081.

The GitHub workflow is included on branch `MLS` but ingestion remains gated and untested on GitHub. Venue reconciliation and full app journey
checks below remain release work; this is a hosted backend + development simulator rollout.

## Latest continuation (2026-09-21)

- Applied `20260921000100_mls_aggregate_shootouts.sql` locally without a reset. The prior
  telemetry permissions blocker is cleared. Database tests passed 366 assertions in 20 files.
- Captured 15 stripped historical responses in `ingest/fixtures/mls/historical.json` and
  verified additional ESPN playoff slugs: `final`, `semifinals---{eastern,western}-conf`,
  conference `play-in-round`, singular `final`, and `wild-card`. Unknown formats still fail.
- Completed local 2016–2026 import: **4,962 rows**. Forced the entire import again; sorted
  provider-ID/game-UUID and attendance-ID/game-UUID hashes stayed identical. No attendance
  was added to the user's account. Per-year counts are in `docs/evidence/mls/local-rollout.md`.
- 2026 refreshed to 387 finals and 123 scheduled matches. There were 13 missing venues:
  12 cancelled/postponed entries and one played match. Added a sourced parser correction for
  Union–Toronto on 2022-10-09 (ESPN 623627), Subaru Park. Refreshed and verified: all finals have venue rows; 12 non-final rows lack one.
- Applied new `20260921000200_mls_toyota_city.sql` locally; Toyota Stadium's city/state/timezone
  are Frisco/TX/America/Chicago, based on the club address. Curated seed updated and regenerated.
- Fixed explicit-winner propagation into Passport record replay, curse-breaker celebrations,
  rare stamps, log-sheet scoreboard, share winner highlighting, and Relive personal results.
- Added MLS favorite-picker/roster exclusion tests, matcher and Edge Function schema tests.
  Direct MLS roster, Relive and Wrapped routes show unavailable states. Versioned the persisted
  team-list query key so pre-MLS catalogs cannot stay cached for the release.
- Added `.github/workflows/mls-ingest.yml`: manual mode defaults to a read-only ESPN probe;
  scheduled/writing jobs require repository variable `MLS_INGEST_ENABLED=true`. This variable
  has NOT been enabled. Laptop probe passed (30 teams, 74 September 2026 league matches).
  GitHub runtime has NOT been tested. No workflow has been pushed or dispatched.
- Core now passes 332 tests; ingest passes 38; Edge Function tests pass all 21, including
  inbound email (the prior socket blocker is gone). Final typecheck, lint, formatting and palette audit pass. Mobile: 894 tests/90 suites pass;
  database: 369 assertions/21 files pass with both new migrations. Functions typecheck passes.
  The SQL run initially timed out under simulator/test load; retry after stopping the simulator passed.
  Mobile reported an open-handle warning after passing and subsequently exited.
- Simulator launched with the existing local account. League picker shows MLS, but fresh data
  did not load reliably under system load. Full test-account journey and light/dark screenshots
  remain unverified; no account favorites or attendance were changed.
- Hosted CLI is logged out. User asked the agent to connect it; `supabase login --agent no
  --output-format text` started the browser flow. Chrome shows the Supabase sign-in page and
  the user has been asked to sign in. No credential was printed and no hosted writes occurred.
  After authentication, link only `vekdufflzklfxljqufbq`, inspect remote migrations, and continue
  scoped rollout only after the remaining local data/UI checks.

### Remaining release blockers

1. Venue audit: many timezones/coordinates remain unknown, and history revealed duplicate
   physical venues under multiple ESPN IDs (Sporting Park/Children's Mercy Park, Red Bull
   Arena/Sports Illustrated Stadium, and Nissan Stadium). Reconcile aliases/IDs and preserve
   attendance and bucket-list references before claiming complete stadium support.
2. Verify test-account favorites → search → log → Passport in light/dark mode and remaining
   neutral-pick/draw/shootout UI cases. No modifications to the user's own account.
3. Hosted authentication/link are verified. Reconcile the recovered migration locally,
   preserve shared-venue timezones, test GitHub ESPN access, then
   scoped migrations/ticket deployment/backfill and app release. Public data licensing review
   remains a launch requirement. Do not run generic hosted-rollout.sh blindly.

## Scope and decisions

- Current 30 MLS clubs, regular season and MLS Cup playoffs; target history 2016–2026.
- Exclude other cups, friendlies, MLS NEXT Pro, All-Star exhibitions. The 2020 MLS Is Back
  knockout tournament needs explicit exclusion; group-stage matches labeled regular season count.
- Provider: server-side ESPN `https://site.api.espn.com/apis/site/v2/sports/soccer/usa.1/`.
  No new dependency or API key. Access works from this laptop. GitHub/hosted access is unverified.
  Public availability does not establish permission for public redistribution: licensing review
  remains required before public launch, consistent with the repo's existing NBA/ESPN posture.
- Keep goals separate from shootout kicks. Proposed/default personal record rule is shootout
  winner = win for a single-match playoff, with separate penalties display. An async question
  was sent to the user asking whether they prefer a draw instead; **no answer received yet**.
  Current code implements the recommended win/loss rule. Reconcile any answer before rollout.
- Historical two-leg playoffs must distinguish match outcome from aggregate/series advancement.
  Implemented and tested; see the latest continuation above.
- MLS neutral pledges are disabled in SQL and UI: no fabricated 50% probabilities.
- `season_key` / `season_label` added. Parser deliberately refuses 2027+ until provider metadata
  distinguishes the short 2027 transition season from 2027–28. Do not silently infer that mapping.
- Shared stadiums reuse existing venue keys/coordinates. New stadiums currently have null
  coordinates; attendance/stamps work but geofenced check-in and map locations do not.
  Do not fabricate coordinates. Verify/curate them before claiming full stadium support.

## Completed and verified

- [x] Read repository instructions, current state, spec, relevant ingestion/UI/SQL code.
- [x] Baseline core: 299 tests; ingest: 38 tests; mobile: 886 tests / 90 suites.
  Default parallel mobile test run timed out under load. `--runInBand` passed in ~19 seconds.
- [x] Verified ESPN teams endpoint: 30 current clubs, numeric team IDs and colors.
- [x] Verified monthly scoreboard endpoint `scoreboard?dates=YYYYMM&limit=1000`.
  A whole-year date range returned HTTP 400; do not use it.
- [x] Verified the 2022 MLS Cup final (`655997`): 3–3 goals, LAFC 3–0 on penalties.
- [x] Added `MlsProvider`, parser, fixture tests, TTL disk cache, throttling, bounded HTTP retries.
- [x] Added team, venue, alias, palette reference seeds; merged shared venues into existing keys.
- [x] Added migration `20260919000100_mls.sql` with schema/reference rows, personal-record
  settlement, and RPC pledge guard. Applied locally, no reset.
- [x] Added `20260919000200_mls_bucket_lists.sql`. Applied locally.
- [x] Added search filter, favorite-team league entry, ticket schema/parser acceptance,
  MLS venue nouns/goals, separate shootout detail display, and unsupported-feature notices.
- [x] Added explicit-winner support to core records and wired attendance list/share consumers.
- [x] Disabled MLS roster prompts when adding favorites and during onboarding.
- [x] Imported **510 2026 MLS regular-season matches** locally, all resolving to a venue row.
  ESPN supplied 511 entries; the extra one was an All-Star exhibition (`401864004`).
  Current import reported 373 finals at the time of its cached snapshot; refresh before final report.
- [x] Palette audit: all 125 palettes pass except the existing authoritative SF reference warning.
- [x] Database tests after first two migrations: **363 assertions in 20 files passed**, including
  17 MLS checks covering seed coverage, shared venue, draws/shootouts, constraints, RLS and pledge guard.
- [x] Regenerated `apps/mobile/src/lib/database.types.ts` from local DB successfully with
  `npm run db:types` (needed escalation for Supabase telemetry write).

## Current work and immediate next steps

### 1. Finish historical parser semantics before continuing backfill

`node scripts/mls-local.mjs --from 2016 --to 2025` stopped safely at March 2016:
`Unknown MLS season type: regular-season-2016`. January/February progress rows are done;
no 2016 matches imported. The 2026 import is complete.

Verified historical season slugs:

- 2016 March: `regular-season-2016`.
- 2016 October: `knockout---eastern-conf`, `knockout---western-conf`,
  `semi-finals---eastern-conf`, `semi-finals---western-conf`.
- 2016 November additionally: `finals---eastern-conf`, `finals---western-conf`.
- 2019 October: `eastern-conference-playoffs---first-round`, corresponding western form,
  both conferences' `---semifinals` and `---finals`.
- 2023 November: `eastern-conference-playoffs---round-one`, corresponding western form,
  and `---semifinals`.
- 2020 July: `regular-season`, `mls-is-back---round-of-16`,
  `mls-is-back---quarterfinals`, `all-star-game`. Exclude the non-league tournament/exhibition
  formats explicitly, not unknown teams wholesale. Unknown formats should still fail loudly.

**Important new fixture:** `scoreboard?dates=201611&limit=1000`, event `468040`:

```json
{
  "season": {"year":2016,"type":6726,"slug":"semi-finals---western-conf"},
  "competition": {
    "leg":{"value":2,"displayValue":"2nd Leg"},
    "status":{"type":{"name":"STATUS_FINAL_PEN","state":"post","completed":true}},
    "notes":[{"text":"2nd Leg - Tied on aggregate - Colorado Rapids advance 3-1 on penalties"}],
    "competitors":[
      {"homeAway":"home","team":{"id":"184"},"score":"1","aggregateScore":1,"shootoutScore":3,"winner":true,"advance":true},
      {"homeAway":"away","team":{"id":"187"},"score":"0","aggregateScore":1,"shootoutScore":1,"winner":false,"advance":false}
    ]
  }
}
```

Original finding (now fixed): the parser and DB constraint required equal on-field scores for every shootout. That was
wrong for two-leg series. Add an explicit shootout scope/series result (or equivalent), preserve
the individual match result, and test a match loss with aggregate advancement, not just this win.
Add a NEW migration because the first two migrations already ran locally. Do not rewrite the
applied history and pretend it was applied. Single-match shootout behavior must remain unchanged.

`isMlsLeagueEvent` currently excludes team ID `9817` (MLS All-Stars); extend with verified
competition exclusions. Save stripped historical fixtures (no articles/logos/betting payloads).
Then rerun core tests, migrate locally, run pgTAP, and resume historical backfill.

### 2. Complete app integration and safety audit

- [x] Run typecheck after the latest edits; passed again on 2026-09-21 after the aggregate-shootout changes.
- [ ] Check all score-derived results (Passport rows, share, game detail, social, Relive helpers)
  for correct shootout results. `gameResult` now supports optional `winnerTeamId`.
- [ ] Add mobile tests for MLS favorite picker, skipped roster prompts, disabled neutral picks,
  draw/shootout display, and explicit-winner share/list records.
- [x] Add MLS matcher/ticket tests. Ticket support is code-only, not deployed.
- [ ] Audit unsupported Wrapped/Relive/Plan routes and copy. Wrapped deliberately has no MLS
  entry yet; do not expose it with incorrect 2027 season bookkeeping. No MLS Relive steps exist.
- [ ] Current draw storage/display follows shared W–L–T. Soccer-specific “draw” wording can be
  improved without reordering existing records or changing other sports.
- [ ] Verify new venue coordinates, timezone/city fields and names; generated data includes
  provider city mistakes (e.g. Toyota Stadium's city) and stale naming-rights names.
- [x] `ingest/src/mls/reference.ts` initially generated seed files directly. It must be changed
  to emit review drafts into `.cache` or protect curated files: rerunning it now would overwrite
  the manually added team cities/historical aliases. Its fixtures writer is useful but needs
  historical additions. `seed/mls_colors.json` is manually tuned and separately loaded by seeds.
- [x] Seed generator summary includes all 125 palettes.

### 3. Verify and operationalize

- [ ] After historical backfill, report per-year counts/statuses, unresolved venues, DB size,
  and compare representative games/season totals against independent official MLS sources.
- [x] Verify rerunning import changes no counts/IDs and preserves attendance references.
- [x] Add a scheduled/manual GitHub workflow, gated until runtime access and schema are verified.
  Do not deploy a Supabase cron that cannot reach ESPN. `mls-ingest.yml` is saved locally and gated.
- [ ] Run `npm run typecheck`, `npm run lint`, core/ingest tests, mobile tests `--runInBand`,
  `npm run db:test`, `npm run functions:test`, `npm run functions:check`, palette audit, formatting.
  `functions:sync` copies core into gitignored function shared code; use the existing command.
- [ ] Verify simulator favorites → search → log → Passport with a test account and inspect
  light/dark screenshots. Do not add fake attendance to the user's own account without consent.
- [ ] Update STATE.md, docs/progress.md, docs/verification.md, attribution/deploy docs and CLAUDE.md
  with actual evidence and limitations. Preserve existing user changes to README.
- [ ] Inspect diff for unintended edits and credentials before committing/publishing.

## Local commands and environment

Workspace: `/Users/arjunchatha/code/Jinx`. Expo app + shared core + ingest npm workspaces.
Local Supabase uses Docker context `colima-jinx`, project_id `name_tbd` (do NOT rename).
API `http://127.0.0.1:54421`, DB port 54422, Mailpit `http://127.0.0.1:54424`.
No reset needed. `scripts/mls-local.mjs` reads local keys through `supabase status` and passes
them to the child process without printing them, and refuses non-local API URLs.

```bash
npx --no-install supabase migration up --local
node scripts/mls-local.mjs --from 2026 --to 2026
node scripts/mls-local.mjs --from 2016 --to 2025
npm run test --workspace @jinx/core
npm run test --workspace @jinx/ingest
npm run test --workspace @jinx/mobile -- --runInBand
npm run typecheck
npm run lint
npm run db:test
npm run db:types
npm run functions:test
npm run functions:check
python3 seed/scripts/check_team_colors.py
python3 seed/scripts/build_seed_sql.py
```

Sandbox may block network/Docker access or Supabase writing its telemetry under the home directory.
Request normal escalation when it fails; do not work around permissions. Node22+ is required.
ESPN fetched successfully using plain Node fetch, no browser impersonation required.
MLS responses cache under gitignored `ingest/.cache/mls`; schedules expire after one hour.
Importer skips completed historical years unless `--force`, refreshes current-year progress.

Simulator previously ran with Metro on port 8081. Check actual processes before restarting:
`REACT_NATIVE_PACKAGER_HOSTNAME=127.0.0.1 npm run start --workspace @jinx/mobile -- --port 8081`.
Use `npm run ios` and read docs/simulator.md if rebuild needed. No new native dependency was added.

## Hosted rollout blocker

Read-only `bash scripts/check-setup.sh` was run with network permission:

- Local app environment present.
- **No `supabase/.temp/project-ref` linked in this checkout.**
- Hosted ingest URL/service key absent from the current shell.
- GitHub repository secret names `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` exist.
- Cloudflare email worker still has its pre-existing placeholder; unrelated to MLS.

Do not claim hosted deployment. Target Jinx is `vekdufflzklfxljqufbq` per STATE.md; confirm
access/link to that exact project before writes. Read docs/ACCOUNTS.md and docs/deploy.md.
The generic hosted-rollout.sh also rotates secrets/deploys unrelated functions; do not run it
blindly for this scoped change. Only MLS migrations, changed ticket function(s), MLS backfill,
and required app release should be considered after validation. Never touch SalusLink.
User login/password/2FA, if required, must be performed by the user; never ask for keys in chat.

## Authoritative research

- https://www.mlssoccer.com/about/competition-guidelines
- https://www.mlssoccer.com/news/mls-to-align-calendar-with-top-leagues-around-world
- ESPN endpoints above were fetched directly; fields and anomalies are recorded in this handoff.

The application does not continue running implementation work after the Codex session is killed.
The files and local database persist; a new session can read this handoff and resume safely.
