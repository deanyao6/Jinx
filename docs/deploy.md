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
select vault.create_secret('<legacy service role JWT>', 'service_role_key');
select vault.create_secret('<CRON_SECRET>', 'cron_secret');
```

All three, and `service_role_key` must be the **legacy JWT** (`eyJ...`), not the new
`sb_secret_...` key: the gateway refuses the new format. `cron_secret` is what the functions
themselves check. With any of them missing, pg_cron still reports every job as succeeded and
nothing is called. `scripts/hosted-rollout.sh` sets all three and then proves a call arrived by
reading `net._http_response`.

Edge Function secrets. `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are
injected by the Supabase runtime automatically, so do not set those yourself:

```
npx supabase secrets set ANTHROPIC_API_KEY=... INBOUND_EMAIL_SECRET=... CRON_SECRET=...
npm run functions:deploy
```

Functions and their schedules: `mlb-sync` (every 15 min; also drains the detail queue and builds
MLB Relive stories), `mlb-live` (every minute while someone is checked in), `storylines` (12:00 UTC
for the day's games, every 30 min for games starting in 60 to 90 minutes, and on a check-in at a
game that has none), `send-push` (every 2 min), `cleanup-imports` (daily), `evaluate-goals` (after
a game goes final), `parse-ticket` and `delete-account` (called by the app), `inbound-email`
(waits for a domain).

Optional function secrets: `EXPO_ACCESS_TOKEN` (only if you turn on enhanced push security in the
EAS dashboard) and `TICKET_IMAGE_RETENTION_DAYS` (defaults to 7).

### 2. Apple Developer Program

Enrol at $99/yr. You need this before any device build, and before TestFlight. EAS creates and
manages the certificates and provisioning profiles for you the first time you build; you sign in
with the Apple ID that holds the membership when it asks.

Sign in with Apple does **not** need anything extra from the portal for this app; see step 3.

### 3. Auth providers

**Sign in with Apple needs one field, not a Services ID.** The app signs in natively:
`features/auth/apple.ts` gets an identity token from `expo-apple-authentication` and hands it to
`supabase.auth.signInWithIdToken`. That flow never leaves the device for a web redirect, so there
is no Services ID, no key, no redirect URL and no client secret to generate. Apple validates the
token against the app's own bundle ID.

In the Supabase dashboard, Authentication > Sign In / Providers > Apple:

1. Toggle **Enable Sign in with Apple** on.
2. Put `com.deanyao.jinx` in **Client IDs**. That is the bundle ID from `app.json`, and it is the
   only value required.
3. Leave Secret Key, Services ID and the redirect fields empty.

Email OTP is separate and only needed if you want the email route as well; it is gated on a real
sender (step 4), because Supabase's built-in one allows 2 messages per hour.

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

---

# TestFlight runbook

Written 2026-09-16, when the hosted project went from empty to carrying real data. Follow it in
order; each step says who has to do it, because three of them need an Apple login this machine
cannot provide.

## What is already done

| | |
|---|---|
| Hosted Supabase schema | 18 of 18 migrations applied to `vekdufflzklfxljqufbq` |
| Reference data | 65 teams, 224 venues, 65 colour palettes, 224 venue shapes |
| Games | MLB and NFL, 2016 to 2026. See "Why 2016" below |
| EAS project | `@deanyao/jinx`, `ea474a72-1186-4600-90e1-8dffcdbcafa2` |
| Release-build guard | `assertEnv()` refuses to start a release build pointing at localhost |

## Why 2016

The local database holds 2000 to 2026. Only 2016 onward was pushed, which is 33.5k of the 82k
games. It is a product decision, not a technical limit: a game logged before 2016 has nothing to
attach to. Extending the range is another `backfill` run against the hosted project, not a
re-ingest, because the local database still has every season.

## 1. Supabase auth  (Dean, 2 minutes, dashboard)

Section 3 above. Enable Apple, put `com.deanyao.jinx` in Client IDs, save. Nothing else.

Without this the app builds and installs and then cannot sign anybody in.

## 2. Environment variables  (done, but understand it)

**`apps/mobile/.env` is never part of an EAS build.** It is gitignored, EAS uploads the git
project, and so the build sees none of it. Editing `.env` before building does nothing at all;
the first build here was started without this and would have installed and then crashed on
launch, which is exactly what EAS's own line meant:

```
No environment variables with visibility "Plain text" and "Sensitive" found
for the "production" environment on EAS.
```

The values live on EAS instead, per environment, and are already set:

```
cd apps/mobile
eas env:list production
#   EXPO_PUBLIC_SUPABASE_URL=https://vekdufflzklfxljqufbq.supabase.co
#   EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon>
#   EXPO_PUBLIC_INBOUND_EMAIL_DOMAIN=in.example.com
```

plus `SENTRY_DISABLE_AUTO_UPLOAD=true`, which is not a runtime value at all. The
`@sentry/react-native` config plugin runs a source-map upload during the Xcode build and fails
the whole build when `SENTRY_ORG` and `SENTRY_PROJECT` are unset:

```
An organization ID or slug is required (provide with --org)
```

That is what killed the first build. `scripts/ios-sim.sh` has worked around it locally since the
beginning, for the same reason; EAS needed telling separately. Crash reporting is off anyway
(`EXPO_PUBLIC_SENTRY_DSN` is unset), so there are no source maps worth uploading. When Sentry is
turned on, set `SENTRY_ORG`, `SENTRY_PROJECT` and a `SENTRY_AUTH_TOKEN` secret and drop this flag.

`plaintext` visibility is correct for all of these: the `EXPO_PUBLIC_*` values are compiled into
the bundle and are public by design (SPEC.md Section 3), and the Sentry flag is a boolean.
Nothing secret may be added here.

`.env` keeps pointing at the local stack, which is what local development wants. The two no
longer interfere, so there is nothing to put back after a build.

## 3. Build  (Dean, interactive Apple login)

```
cd apps/mobile
npx eas-cli build --platform ios --profile production
```

EAS asks for the Apple ID on the membership, then creates the distribution certificate and
provisioning profile itself. Answer yes when it offers to. It does not touch anything on this
machine, and there is no local certificate to manage.

`eas.json`'s `production` profile has `autoIncrement: true`, so the build number rises on its own
and `app.json`'s `version` (0.1.0) is the one humans see.

The `channel` fields are deliberately absent from both profiles. A channel routes EAS Update
over-the-air builds, and `expo-updates` is not installed here, so naming one only gives the build
something to fail on. Add the package and the channels together when OTA updates are actually
wanted; until then a new build is the only way to ship a change, which is what we want anyway
while the UI is moving this fast.

## 4. Submit  (Dean)

```
npx eas-cli submit --platform ios --profile production
```

First submission also needs an App Store Connect app record. `eas submit` offers to create one;
the bundle ID is `com.deanyao.jinx` and the name is Jinx. Apple then takes 10 to 30 minutes to
process the build before it appears in TestFlight.

## 5. First sign-in on the phone

Sign in with Apple creates a **new** account, with its own user id. The three games logged against
`deanyao6@gmail.com` on the local stack do not follow it, because they belong to a different user
in a different database. Either log them again on the phone, which also exercises the logging
flow, or say so and they can be copied across once the new user id exists.

## Storylines

Deployed to the hosted project. Internal only, so it is called with both the legacy service role
JWT (the gateway requires one) and `CRON_SECRET` (the function requires that). See
docs/verification.md for why the service role key alone is refused on this project.

```
# One or more games, by id
curl -X POST https://vekdufflzklfxljqufbq.supabase.co/functions/v1/storylines \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "x-cron-secret: $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"game_ids":["<game id>"]}'

# Every game someone is going to that starts within the window
  -d '{"upcoming_hours":36}'
```

The response carries a `log` of every attempt, including each rejected sentence and the reason,
which is the first place to look when a game has fewer storylines than expected.

SPEC 6.18 wants a run the morning of each game and a refresh an hour before. Both are scheduled by
migration `20260917000200` (`storylines-morning`, `storylines-refresh`), each guarded so a day with
no game someone is going to makes no call at all. A third path covers the walk-up: a check-in at a
game with no storylines asks for that game there and then.

`CRON_SECRET` is set on the hosted project. Its value is not in the repo; rotate it with
`npx supabase secrets set CRON_SECRET=$(openssl rand -hex 32)`, and update anything that calls
the internal functions.

## Rolling the backend out to hosted

`bash scripts/hosted-rollout.sh` is the whole sequence, in order, and it checks its own work:

1. `supabase db push`: the migrations not yet on hosted (`20260917000200`, `20260917000300`).
2. The three vault secrets above, replaced rather than duplicated on a rerun.
3. Deploys `cleanup-imports`, `delete-account`, `mlb-sync`, `mlb-live`, `send-push`,
   `evaluate-goals`, `storylines`, `parse-ticket`.
4. `scripts/verify-privacy-functions.mjs` against hosted: a throwaway user, a backdated ticket
   import, then account deletion, with 15 checks that the rows and the files are really gone.
5. Fires `mlb-sync` through `call_edge_function` and waits for status 200 in `net._http_response`.
6. Calls the other scheduled functions once, authenticated.
7. Rebuilds MLB stories made before the RBI fix (`relive.ts --rebuild`), then builds any missing.
8. Prints the cron jobs, the last hour of pg_net responses, the open queue and any overdue ticket
   images.
9. Starts both scheduled GitHub workflows.

It never resets or drops anything, and the only user it touches is one it creates and deletes.
`bash scripts/hosted-rollout.sh verify` runs steps 4 onward only.

**It had not been run when this was written** (2026-09-17). Until it is: `cleanup-imports` is not
deployed while `parse-ticket` accepts uploads, which is a live privacy gap; the Delete account
button on TestFlight calls a function that does not exist; and no scheduled job does anything.

## Not done, and not needed for a UI look

- **`INBOUND_EMAIL_SECRET`** and the email worker. `ANTHROPIC_API_KEY` and `CRON_SECRET` are set;
  email import still needs its own secret and a domain.
- **Resend.** Email OTP is unusable on the built-in sender (2 per hour). Sign in with Apple does
  not need it.
- **Game detail on the hosted project** builds itself once the rollout above has run: MLB inside
  `mlb-sync` every 15 minutes, NFL in the nightly GitHub workflow. Before that, Relive has nothing
  to show for a newly logged game.
