# Jinx

A passport for sports fans. Every game you attend adds to your record: wins and losses at games, the stadiums you have collected, the players and moments you witnessed, the people you were there with, and a pledged record at neutral games.

The full spec is [SPEC.md](SPEC.md). Contributor notes are in [CLAUDE.md](CLAUDE.md). Facts verified against external APIs are in [docs/verification.md](docs/verification.md).

## Getting started

Requirements: Node 22+, Docker (for local Supabase), Deno 2 (for Edge Function tests), Python 3.12 with pandas and pyarrow (NFL pipeline), Xcode for the iOS simulator.

```
npm install
npx supabase start          # local Postgres, Auth, Storage, Studio
npx supabase db reset       # migrations + seed
cp apps/mobile/.env.example apps/mobile/.env   # fill in the local anon key from `supabase status`
npm test
cd apps/mobile && npx expo start --ios
```

## Layout

| Path | What |
|---|---|
| `apps/mobile` | Expo app (expo-router, TypeScript strict, TanStack Query) |
| `packages/core` | Pure domain rules with unit tests: rooting side, records, Elo, moment detectors, ticket matcher, goal evaluator, pledge locks |
| `supabase` | SQL migrations, RLS tests (pgTAP), Edge Functions (Deno), seed |
| `ingest` | MLB Stats API adapter and backfill (TypeScript); nflverse pipeline (Python) run by GitHub Actions |
| `seed` | Hand-curated venues, teams, aliases, curated bucket lists |
| `docs` | Spec attachments and verification notes |

## Milestones

See SPEC.md Section 12. Progress is tracked in [docs/progress.md](docs/progress.md).
