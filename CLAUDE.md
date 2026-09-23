# Jinx

> **Read [STATE.md](STATE.md) before anything else.** It says what is true right now: what works,
> what is half done, what is switched off on purpose, what only Dean can do, and the traps that
> cost previous sessions hours. This file is layout, commands and conventions.

A passport for sports fans: every game you attend becomes part of a living record. iOS first; MLB, NFL, NBA and MLS.

**The full product and engineering spec is [SPEC.md](SPEC.md). Read it before changing anything.**
`design/reference.html` is the single visual source of truth; `docs/turnstile-ui.html` is the older
concept mockup, kept for structure only. `CLAUDE_CODE_PROMPT.md` was the kickoff brief and is
history now: where it disagrees with STATE.md, STATE.md is right.

## MLS (merged 2026-09-22)

Arjun's branch `MLS` brought a fourth sport: 30 clubs, palettes, stadiums, 2016 on schedules and
results, favorites, attendance logging, Passport and ticket parsing. It is on hosted (five
migrations, 4,962 matches) and merged to main. Rosters, Relive, Wrapped, live state and Pick a
side are deliberately unavailable for MLS until a draw-aware model exists. Read
[docs/MLS_ROLLOUT.md](docs/MLS_ROLLOUT.md) for the handoff and its limits, and STATE.md for what
is still missing (most MLS-only stadiums have no coordinates or timezone yet).

## Where things stand (2026-09-17)

**Jinx is on TestFlight with a live backend.** Build 4 was submitted on 2026-09-17. All ten
milestones in SPEC.md Section 12 are implemented; [docs/progress.md](docs/progress.md) checks each
against its own "Done when" and names the evidence. [STATE.md](STATE.md) has the current picture
of all three environments. Highlights that change how you work:

- **The app runs in the iOS Simulator.** `npm run ios`. Read [docs/simulator.md](docs/simulator.md)
  first: this machine has no Apple developer certificate, so the plain `expo run:ios` cannot work,
  and two Metro settings are pinned for reasons that are not guessable.
- **Develop against local Supabase**, ports 54421-54427, loaded with 82,240 games from 2000 on.
  Sign in with "Continue with email", any address, and read the code from Mailpit at
  http://127.0.0.1:54424. Nothing is emailed anywhere from local.
- **The repo folder is `~/Desktop/Jinx`**, renamed from `name_tbd` on 2026-09-17, but
  `supabase/config.toml` keeps `project_id = "name_tbd"` on purpose: it names the local Docker
  volumes, and changing it would orphan the loaded database.
- **The presentation layer is the reference design system.** Tokens, 19 static Archivo instances,
  36 generated icons, 7 stadium shapes, 65 team palettes and a `TeamTheme` provider live under
  `src/theme/reference/` and `src/components/reference/`. `npm run parity` compares screens against
  `design/reference.html`. The older `src/theme/tokens.ts` still serves screens outside the
  reference and derives its colours from it. Those screens follow
  [docs/subpage-style.md](docs/subpage-style.md): `useTheme().accent` is the team in scope (the
  person's own team by default, a game's side under a `TeamTheme`), cards have no outlines, and
  headings use the condensed heavy cut.
- **The hosted project is `vekdufflzklfxljqufbq`**, holding every migration, the seed data, games
  from 2016 on, and eight of nine Edge Functions. `bash scripts/hosted-rollout.sh` deploys and
  verifies it. Ticket parsing and storylines work; inbound email waits on a domain.
- **The EAS project is `@deanyao/jinx`** (`ea474a72-1186-4600-90e1-8dffcdbcafa2`). Never run
  `eas init`: it rewrites the slug and injects Android permissions.
- **The repo is public** at `deanyao6/Jinx`. No secrets are tracked; keep it that way.

## Reactions (social v2, prompt 3, branch `social-v2-reactions`, 2026-09-23)

The BeReal mechanic for live games. The rules are pure in `packages/core/src/reactions/`
(windows, whitelists, the significance gate, caps, the crowd signal, the NFL relabel); the
database enforces them in `fire_reaction_prompt()`; MLB fires from `mlb-live`, the NBA, MLS
and NFL from the checked-in phone (`features/reactions/`). The NFL reads ESPN's free scoreboard
from the phone (`features/live/feeds.ts`). Sessions: `docs/CHECKIN.md`. Every rule is keyed by
`sport_id`; add a row, never a branch on the sport.

## Docs
| File | What it holds |
|---|---|
| [SPEC.md](SPEC.md) | The product and engineering spec. Authoritative |
| [docs/progress.md](docs/progress.md) | Milestone status and decisions that differ from the spec |
| [docs/simulator.md](docs/simulator.md) | Running the app locally, and why the build is non-standard |
| [docs/subpage-style.md](docs/subpage-style.md) | The design rules and shared kit for every screen outside the reference |
| [docs/deploy.md](docs/deploy.md) | Accounts, real costs, and the deployment steps |
| [docs/verification.md](docs/verification.md) | VERIFY items from the spec checked against live sources |
| [docs/elo-backtest.md](docs/elo-backtest.md) | Elo tuning evidence |
| [docs/attribution.md](docs/attribution.md), [privacy.md](docs/privacy.md), [terms.md](docs/terms.md), [moderation.md](docs/moderation.md) | User-facing legal and policy copy |

## Copy
- **Never use an em dash in UI copy.** Dean's rule, 2026-09-16. En dashes in scores and
  records (`31 – 17`, `24–15`) are correct and stay. `apps/mobile/src/features/games/__tests__/copy.test.ts`
  scans `apps/mobile/src` and `packages/core/src` and fails on one, so the rule holds by itself.

## Ground rules (from the spec)
- The app is **Jinx**. Bundle ID `com.deanyao.jinx`, URL scheme `jinx://`, workspace scope `@jinx/*`.
- Hobby project: $0 data sources, Supabase free tier, minimal moving parts.
- Non-goals: betting or wagering, ticket marketplace, live chat, team or league logos and marks.
- Never call the MLB Stats API or the Anthropic API from the client. Never ship service-role or Anthropic keys in the app bundle.
- **The app may read free public live feeds directly** (Dean, 2026-09-22): the NBA CDN
  (`cdn.nba.com` scoreboard and boxscore) and ESPN's soccer summary for MLS, from
  `apps/mobile/src/features/live/feeds.ts`, keyless, polled only while a fan is checked in or on a
  game page with a game under way, never writing to the database. MLB stays server-side
  (`mlb-live` writes `game_live_state`). Any other provider, and anything with a key, stays server-side.
- Never store raw device coordinates. Store distance and accuracy only.
- Build milestone by milestone (SPEC.md Section 12). Do not start the next milestone with failing tests.
- When the spec is ambiguous or seems wrong in practice, stop and ask instead of guessing.

## Layout
```
apps/mobile/      Expo app (expo-router, TypeScript strict, TanStack Query, Zustand)
packages/core/    Pure TypeScript domain rules (records, rooting, Elo, moments, matcher, goals). No I/O.
supabase/         Migrations (plain SQL), Edge Functions (Deno), SQL/pgTAP tests, seed data
ingest/           MLB adapter + backfill scripts, NFL nflverse pipeline, all TypeScript + GitHub Actions
seed/             Hand-curated venues, teams, aliases, curated bucket lists
docs/             Spec attachments, verification notes, ADRs
```

## Commands
```
npm install                 # workspaces: apps/mobile, packages/core, ingest
npm run ios                 # build + launch in the iOS Simulator (read docs/simulator.md first)
bash scripts/check-setup.sh # which external credentials are in place, and what is missing
npm test                    # all unit tests (core, ingest, mobile)
npm run typecheck           # tsc across workspaces
npm run lint
npx supabase start          # local Postgres + auth + storage (needs Docker). Ports are 54421-54427 on this machine.
npx supabase db reset       # apply migrations + seed (wipes local data: rerun ingest afterwards)
npx supabase migration up --local   # apply new migrations without wiping data
npm run db:test             # pgTAP tests against the local database
npm run db:types            # regenerate apps/mobile/src/lib/database.types.ts
npm run parity              # visual parity: reference shots, app shots, diff, contact sheets
npm run parity:selftest     # prove the parity harness end to end; measures the safe-area inset
npm run build:design        # regenerate icons and stadium shapes from design/reference.html
npm run fonts               # regenerate the static Archivo instances (fontTools)
node scripts/design/build-team-fills.mjs  # regenerate the welcome wall's team fill map from the palette seeds
npm run seed:colors:check   # validate the 65 team palettes and their contrast
npm run functions:test      # Deno tests for Edge Functions (syncs packages/core into _shared first)
npm run functions:check     # Deno typecheck of every Edge Function
bash scripts/hosted-rollout.sh            # apply the backend to hosted and prove it (not run by an agent; see docs/deploy.md)
node scripts/verify-privacy-functions.mjs # cleanup-imports + delete-account really delete (throwaway user)
node scripts/verify-user-journeys.mjs     # M2, M3, M6, M7, M8 done-whens as real users through RLS
npx tsx ingest/src/verify/relive.ts       # M8.5: 5 MLB + 5 NFL stories against an independent source
npx tsx ingest/src/mlb/relive.ts --rebuild # regenerate every MLB story after a change to how steps are built
python3 seed/scripts/fill_timezones.py   # resolve every venue's IANA zone from its coordinates (needs timezonefinder)
python3 seed/scripts/build_seed_sql.py   # regenerate supabase/seed.sql from seed/*.json
python3 seed/scripts/fill_elevations.py  # venue elevations (USGS, Open-Elevation) into seed/venue_elevations.json; resumable
python3 seed/scripts/check_team_colors.py # audit team_colors.json: coverage, verbatim reference rows, WCAG contrast
npx tsx ingest/src/mlb/backfill.ts --from 2000 --to 2026   # MLB schedules + finals (needs SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)
npx tsx ingest/src/mlb/detail.ts --pending                 # MLB details for attended games
npx tsx ingest/src/mlb/rosters.ts                          # MLB current rosters (40-man, active + injured) into team_rosters
npx tsx ingest/src/nfl/run.ts --seasons 2026 --queued      # NFL schedules; detail only for the games games_wanting_detail names (--force rebuilds whole seasons)
npx tsx ingest/src/nfl/rosters.ts                          # NFL current rosters (latest nflverse week) into team_rosters
npx tsx ingest/src/mlb/relive.ts --attended                 # MLB win probability + story steps
npx tsx ingest/src/nfl/relive.ts --attended                # NFL ditto, from the nflverse play-by-play
# storylines: an Edge Function, not a script; see docs/deploy.md for the curl
npx tsx ingest/src/elo/run.ts --sport mlb                  # Elo ratings + frozen win probabilities (--sport nfl, --sport nba)
npx tsx ingest/src/elo/sweep.ts --sport nba                # Elo parameter grid, log loss over 2016 on (docs/elo-backtest.md)
npx tsx ingest/src/nba/backfill.ts --from 2000 --to 2026   # NBA schedules + finals (game log + ESPN; the CDN for the current season)
npx tsx ingest/src/nba/detail.ts --pending                 # NBA details for attended games; --queue drains detail_queue like nba-sync
npx tsx ingest/src/nba/rosters.ts                          # NBA current rosters into team_rosters
npx tsx ingest/src/nba/relive.ts --attended                # NBA win probability (ESPN, or the state model) + story steps
npx tsx ingest/src/nba/fit_wp.ts                           # refit the NBA in-game model (docs/elo-backtest.md)
node scripts/mls-local.mjs --from 2016 --to 2026          # MLS schedules + results into the LOCAL database (reads keys from supabase status)
npx tsx ingest/src/mls/backfill.ts --from 2026 --to 2026   # same against whatever SUPABASE_URL points at; --force re-reads finals
npx tsx ingest/src/mls/probe.ts                            # can this machine reach ESPN's MLS scoreboard at all
npx tsx ingest/src/mls/finals.ts --attended --recent 14   # exact final_at from ESPN's summary wall clocks for attended and recent matches
npx tsx ingest/src/mls/rosters.ts                          # MLS current rosters (ESPN) into team_rosters
npx tsx ingest/src/mls/detail.ts --queue                   # MLS detail + Relive from ESPN's summary for queued matches (--events ids, --attended)
npx tsx ingest/src/elo/run.ts --sport mls                  # the three-outcome Elo: home, draw, away (docs/elo-backtest.md)
npx tsx ingest/src/famous/curated.ts [--check]             # famous games: seed/famous_games.json by local date (refuses on 0 or 2+ matches), then the championship rows
npx tsx ingest/src/famous/franchise.ts [--check]           # curated superstars from seed/franchise_players.json (refuses on an ambiguous name)
npx tsx ingest/src/mlb/honors.ts [--from 1997 --to 2026]   # MLB MVP, Cy Young, ROY winners and All-Stars into player_honors
npx tsx ingest/src/mlb/debuts.ts                           # MLB debut dates (people endpoint, 100 a request)
npx tsx ingest/src/mlb/moves.ts [--from 2016-01-01]        # MLB joins from the transactions feed (default: last 30 days)
npx tsx ingest/src/nfl/honors.ts                           # NFL honors from the hand-kept seed/nfl_awards.json
npx tsx ingest/src/nba/honors.ts                           # NBA honors (MVP top five, All-NBA teams, ROY, Finals MVP) from seed/nba_awards.json
npx tsx ingest/src/mls/honors.ts                           # MLS honors (MVP and finalists, Best XI, Golden Boot, ROY, Cup MVP) from seed/mls_awards.json
npx tsx ingest/src/nfl/moves.ts [--from 2016 --to 2026]    # NFL joins from the weekly rosters
npx tsx ingest/src/nfl/firsts.ts [--from 2000 --to 2026]   # NFL first touchdowns (play-by-play) and rookie seasons
npx tsx ingest/src/nfl/relabel.ts [--game 2026_03_ATL_GB]  # rewrite coarse live NFL reaction prompts to the real play (nightly, after relive)
```

## Conventions
- Domain rules live in `packages/core` as pure functions with unit tests, mirrored in SQL where records are computed server-side.
- Provider data goes through the `SportsDataProvider` adapter. Canonical IDs are internal UUIDs; provider IDs live in `provider` / `provider_game_id` columns.
- Verified facts about external APIs (field names, column names, licenses) live in `docs/verification.md`. Update it whenever a VERIFY item from the spec is checked.
- Every RLS policy has a test in `supabase/tests`, storage.objects policies included (`011`).
- Every route needs a way in. `apps/mobile/src/features/navigation/__tests__/reachability.test.ts`
  fails when a screen loses its last link; a route that needs none is allowlisted there with a reason.
- Judge a scheduled job by `net._http_response`, never by `cron.job_run_details`, which says
  "succeeded" for a job that called nothing.
- Short team names come from `teams.nickname` (`shortTeamName`), never from stripping the city:
  the Mets play in Flushing.
