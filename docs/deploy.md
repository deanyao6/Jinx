# Deploying APPNAME

## One-time setup

1. **Supabase project** (free tier). Note the project ref, anon key, and service role key.
   ```
   npx supabase link --project-ref <ref>
   npx supabase db push                       # applies supabase/migrations
   psql "$PROD_DB_URL" -f supabase/seed.sql   # teams, venues, aliases, curated lists (idempotent)
   ```
2. **Vault secrets** used by pg_cron to call Edge Functions (run once in the SQL editor):
   ```sql
   select vault.create_secret('https://<ref>.supabase.co', 'project_url');
   select vault.create_secret('<service-role-key>', 'service_role_key');
   ```
3. **Edge Function secrets**:
   ```
   npx supabase secrets set ANTHROPIC_API_KEY=... INBOUND_EMAIL_SECRET=... CRON_SECRET=... EXPO_ACCESS_TOKEN=...
   npm run functions:deploy
   ```
   Functions: `mlb-sync` (every 15 min), `mlb-live` (every minute while someone is checked in), `parse-ticket`, `inbound-email`, `evaluate-goals`, `send-push` (every 2 min), `cleanup-imports` (daily), `delete-account`.
4. **Auth**: enable Sign in with Apple (Services ID + key) and email OTP in the Supabase dashboard. Set the site URL to `appname://` and add it to redirect URLs.
5. **Initial data** (from a laptop, a few minutes):
   ```
   export SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=...
   npx tsx ingest/src/mlb/backfill.ts --from 2000 --to $(date +%Y)
   npx tsx ingest/src/nfl/run.ts --from 2000 --to $(date +%Y)
   npx tsx ingest/src/elo/run.ts --sport mlb && npx tsx ingest/src/elo/run.ts --sport nfl
   ```
6. **GitHub Actions secrets**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` for `nfl-ingest.yml` (daily in season) and `daily-jobs.yml`.
7. **Inbound email**: follow `infra/cloudflare-email-worker/README.md`. Set `EXPO_PUBLIC_INBOUND_EMAIL_DOMAIN` in the app env to `in.<domain>`.
8. **EAS**: `cd apps/mobile && eas init` (links the Expo project id into app.json), then `eas build --profile production --platform ios` and `eas submit --platform ios`. Set `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_INBOUND_EMAIL_DOMAIN` as EAS environment variables.

## Before public App Store release
- Resolve MLB Stats API licensing (SPEC 4.2): personal use is fine for TestFlight; a public listing needs MLBAM permission or a commercial provider behind `SportsDataProvider`.
- nflverse data is CC-BY-4.0: keep the attribution screen.
- Fill in the App Privacy nutrition label from the privacy manifest in `apps/mobile/app.json`.
