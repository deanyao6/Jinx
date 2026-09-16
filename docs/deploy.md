# Deploying Jinx

## Accounts and costs

Set these up in order. Steps 1-3 get the app onto a real iPhone. Steps 4-7 each unlock one
feature and can wait until you want that feature.

| # | Service | What it gives you | Cost | Without it |
|---|---|---|---|---|
| 1 | [Supabase](https://supabase.com) | Database, auth, storage, Edge Functions, cron | Free tier | Nothing works |
| 2 | [Apple Developer Program](https://developer.apple.com/programs/) | TestFlight, Sign in with Apple, push certificates | $99/yr | No install on a real device |
| 3 | [Expo / EAS](https://expo.dev) | Builds and App Store submission | Free (15 iOS builds/mo) | No install on a real device |
| 4 | [Resend](https://resend.com) | Delivers sign-in codes | Free (3,000/mo, 100/day) | Email sign-in capped at 2/hour |
| 5 | Domain on [Cloudflare](https://www.cloudflare.com) | Ticket forwarding address, verified sender for Resend | ~$10-12/yr | No email ticket import |
| 6 | [Anthropic](https://platform.claude.com) | Reads ticket screenshots and emails | ~$0.003 per ticket | No ticket import at all |
| 7 | [Sentry](https://sentry.io) | Crash reports | Free (5k errors/mo) | No crash reports; app still runs |

**No account or key is needed for game data.** MLB Stats API is open and unauthenticated,
nflverse is a public GitHub release, and maps use Apple Maps through `react-native-maps`, which
needs no API key. Expo push notifications are free.

**Committed spend is about $110/yr**: the Apple membership and a domain. Everything else is a
free tier or metered at fractions of a cent.

**Metered spend is Anthropic only**, and only when someone imports a ticket. Haiku 4.5 costs $1
per million input tokens and $5 per million output. A ticket image plus its prompt runs about
2,000 input and 200 output tokens, so roughly a third of a cent per ticket. A hundred tickets a
month is under $0.50.

Free-tier ceilings worth watching:

- Supabase caps the database at **500 MB**. The full backfill currently uses **188 MB**, so about
  62% is free. Growth comes from MLB game detail, which is only fetched for games someone
  attended, and from `game_appearances`, which is by far the largest table.
- Supabase **pauses a free project after 1 week of inactivity**. The scheduled jobs in this repo
  keep it awake, so leave them enabled.
- Supabase free tier allows **2 active projects** total across your account.
- Resend's free tier requires a **verified sending domain**, which is why step 5 comes with it.

---

## One-time setup

### 1. Supabase project

Create a project (free tier), then note the project ref, anon key, and service role key.

```
npx supabase link --project-ref <ref>
npx supabase db push                       # applies supabase/migrations
psql "$PROD_DB_URL" -f supabase/seed.sql   # teams, venues, aliases, curated lists (idempotent)
```

Vault secrets let pg_cron call Edge Functions. Run once in the SQL editor:

```sql
select vault.create_secret('https://<ref>.supabase.co', 'project_url');
select vault.create_secret('<service-role-key>', 'service_role_key');
```

Edge Function secrets. `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are
injected by the Supabase runtime automatically, so do not set those yourself:

```
npx supabase secrets set ANTHROPIC_API_KEY=... INBOUND_EMAIL_SECRET=... CRON_SECRET=...
npm run functions:deploy
```

Functions and their schedules: `mlb-sync` (every 15 min), `mlb-live` (every minute while someone
is checked in), `parse-ticket`, `inbound-email`, `evaluate-goals`, `send-push` (every 2 min),
`cleanup-imports` (daily), `delete-account`.

Optional function secrets: `EXPO_ACCESS_TOKEN` (only if you turn on enhanced push security in the
EAS dashboard) and `TICKET_IMAGE_RETENTION_DAYS` (defaults to 7).

### 2. Apple Developer Program

Enrol at $99/yr. You need this before any device build. It also provides the Services ID and key
for Sign in with Apple.

### 3. Auth providers

In the Supabase dashboard, enable Sign in with Apple (Services ID + key) and email OTP. Set the
site URL to `jinx://` and add it to the redirect URLs.

### 4. Email delivery (Resend)

Supabase's built-in sender allows **2 messages per hour** and carries no delivery guarantee. That
is fine for local development, where mail goes to Mailpit instead, but it will block sign-in as
soon as more than one person uses the app. Set up a real sender before TestFlight.

1. Create a Resend account and verify your domain (step 5 below).
2. Create an API key.
3. In the Supabase dashboard under Authentication > Emails, enable custom SMTP:
   host `smtp.resend.com`, port `587`, user `resend`, password the API key, sender an address on
   your verified domain.
4. Raise the auth rate limit from its default. Supabase applies a cautious 30/hour once custom
   SMTP is on; adjust it under Authentication > Rate Limits.

The equivalent settings are recorded, commented out, in `supabase/config.toml` under
`[auth.email.smtp]` if you would rather run `supabase config push`.

### 5. Domain and inbound email

Buy a domain through Cloudflare Registrar (sold at cost, roughly $10-12/yr) or move an existing
one onto Cloudflare nameservers. It serves two purposes: the verified sending domain for Resend,
and the catch-all address that receives forwarded tickets.

Then follow `infra/cloudflare-email-worker/README.md`. Note that `wrangler.toml` ships with a
placeholder `SUPABASE_FUNCTIONS_URL`; the worker will not run until you replace it with your real
project URL. Set `EXPO_PUBLIC_INBOUND_EMAIL_DOMAIN` in the app env to `in.<domain>`.

### 6. Initial data

From a laptop, a few minutes:

```
export SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=...
npx tsx ingest/src/mlb/backfill.ts --from 2000 --to $(date +%Y)
npx tsx ingest/src/nfl/run.ts --from 2000 --to $(date +%Y)
npx tsx ingest/src/elo/run.ts --sport mlb && npx tsx ingest/src/elo/run.ts --sport nfl
```

### 7. GitHub Actions secrets

`nfl-ingest.yml` (daily in season) and `daily-jobs.yml` need `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY`. `ci.yml` uses no secrets.

Copy both values from the Supabase dashboard under Project Settings > API, then add them in the
GitHub repository under Settings > Secrets and variables > Actions. Or run `gh secret set NAME`
for each, which prompts for the value so it stays out of your shell history.

The repository is public, which is fine for these two: both workflows trigger only on `schedule`
and `workflow_dispatch`, never on `pull_request`, so a fork cannot reach the secrets.

### 8. EAS

```
cd apps/mobile && eas init      # links the Expo project id into app.json
eas build --profile production --platform ios
eas submit --platform ios
```

Set `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` and
`EXPO_PUBLIC_INBOUND_EMAIL_DOMAIN` as EAS environment variables. For Sentry source maps, also set
`SENTRY_ORG`, `SENTRY_PROJECT` and `SENTRY_AUTH_TOKEN`; the config plugin in `app.json` reads them
at build time.

---

## Where each credential lives

The service role key bypasses row-level security. It reaches four places: the Edge Function
runtime (injected), GitHub Actions secrets, your laptop during ingest, and Supabase Vault. Treat
it as the most sensitive value in the project and never put it in the app bundle.

| Credential | Set where | Used by |
|---|---|---|
| `ANTHROPIC_API_KEY` | Supabase function secrets | `parse-ticket`, `inbound-email` |
| `INBOUND_EMAIL_SECRET` | Supabase function secrets **and** `wrangler secret put` | Authenticates the Cloudflare worker to `inbound-email` |
| `CRON_SECRET` | Supabase function secrets | Alternative auth for scheduled calls |
| `project_url`, `service_role_key` | Supabase Vault (SQL) | pg_cron calling Edge Functions |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | GitHub Actions secrets, local shell | Ingest jobs |
| `SUPABASE_FUNCTIONS_URL` | `infra/cloudflare-email-worker/wrangler.toml` | The worker's POST target |
| `EXPO_PUBLIC_*` | `.env` locally, EAS env vars for builds | The app bundle. Public by design |
| `SENTRY_*` | EAS secrets | Source map upload at build time |

Run `bash scripts/check-setup.sh` to see which of these are currently in place.

---

## Before public App Store release

- Resolve MLB Stats API licensing (SPEC 4.2). Personal use is fine for TestFlight; a public
  listing needs MLBAM permission or a commercial provider behind `SportsDataProvider`.
- nflverse data is CC-BY-4.0: keep the attribution screen.
- Fill in the App Privacy nutrition label from the privacy manifest in `apps/mobile/app.json`.
