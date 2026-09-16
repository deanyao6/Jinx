# APPNAME (working title)

A passport for sports fans: every game you attend becomes part of a living record. iOS first, MLB + NFL in v1.

**The full product and engineering spec is [SPEC.md](SPEC.md). Read it before changing anything.** The UI reference mockup is [docs/turnstile-ui.html](docs/turnstile-ui.html) (styling is placeholder; structure and hierarchy are the reference).

## Where things stand (2026-09-16)

All ten milestones in SPEC.md Section 12 are implemented. Per-milestone detail and every decision
that refines the spec are in [docs/progress.md](docs/progress.md). Read that before assuming
anything is unbuilt.

- **The app runs in the iOS Simulator.** `npm run ios`. Read [docs/simulator.md](docs/simulator.md)
  first: this machine has no Apple developer certificate, so the plain `expo run:ios` cannot work,
  and two Metro settings are pinned for reasons that are not guessable.
- **Naming is in flux.** The code still says `APPNAME` / `appname` everywhere, including the bundle
  ID. The GitHub repo and the Supabase project have been renamed to **Jinx**. The rename inside the
  app has not happened. Do not start one unless asked; it touches `app.json` and needs a rebuild.
- **Local backend is the one to develop against.** Supabase on ports 54421-54427, loaded with
  74,951 MLB and 7,289 NFL games. Sign in with "Continue with email", any address, and read the
  code from Mailpit at http://127.0.0.1:54424. Nothing is emailed anywhere.
- **The hosted Supabase project is linked but empty**: 0 of 15 migrations applied, no function
  secrets. GitHub Actions secrets are set, so the two scheduled workflows will run and fail until
  the schema is pushed. [docs/deploy.md](docs/deploy.md) has the accounts, costs and steps.
- **Sign in with Apple and ticket parsing cannot be tested here.** The first needs an Apple Services
  ID in Supabase, the second needs `ANTHROPIC_API_KEY`. Neither is set.
- **The repo is public** at `deanyao6/Jinx`. No secrets are tracked; keep it that way.

## Docs
| File | What it holds |
|---|---|
| [SPEC.md](SPEC.md) | The product and engineering spec. Authoritative |
| [docs/progress.md](docs/progress.md) | Milestone status and decisions that differ from the spec |
| [docs/simulator.md](docs/simulator.md) | Running the app locally, and why the build is non-standard |
| [docs/deploy.md](docs/deploy.md) | Accounts, real costs, and the deployment steps |
| [docs/verification.md](docs/verification.md) | VERIFY items from the spec checked against live sources |
| [docs/elo-backtest.md](docs/elo-backtest.md) | Elo tuning evidence |
| [docs/attribution.md](docs/attribution.md), [privacy.md](docs/privacy.md), [terms.md](docs/terms.md), [moderation.md](docs/moderation.md) | User-facing legal and policy copy |

## Ground rules (from the spec)
- `APPNAME` / `appname` is a placeholder name. Keep it find-and-replaceable. Bundle ID `com.deanyao.appname`.
- Hobby project: $0 data sources, Supabase free tier, minimal moving parts.
- Non-goals: betting or wagering, ticket marketplace, live chat, team or league logos and marks.
- Never call MLB Stats API or the Anthropic API from the client. Never ship service-role or Anthropic keys in the app bundle.
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
npm run functions:test      # Deno tests for Edge Functions (syncs packages/core into _shared first)
npm run functions:check     # Deno typecheck of every Edge Function
python3 seed/scripts/build_seed_sql.py   # regenerate supabase/seed.sql from seed/*.json
npx tsx ingest/src/mlb/backfill.ts --from 2000 --to 2026   # MLB schedules + finals (needs SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)
npx tsx ingest/src/mlb/detail.ts --pending                 # MLB details for attended games
npx tsx ingest/src/nfl/run.ts --from 2000 --to 2026        # NFL schedules, play-by-play, appearances
npx tsx ingest/src/elo/run.ts --sport mlb                  # Elo ratings + frozen win probabilities
```

## Conventions
- Domain rules live in `packages/core` as pure functions with unit tests, mirrored in SQL where records are computed server-side.
- Provider data goes through the `SportsDataProvider` adapter. Canonical IDs are internal UUIDs; provider IDs live in `provider` / `provider_game_id` columns.
- Verified facts about external APIs (field names, column names, licenses) live in `docs/verification.md`. Update it whenever a VERIFY item from the spec is checked.
- Every RLS policy has a test in `supabase/tests`.
