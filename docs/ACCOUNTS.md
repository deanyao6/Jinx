# Jinx accounts and access

This file lists every external account Jinx uses, the non-secret identifiers Claude Code needs, and how Claude Code gets access to each one. **No secrets go in this file or in the repo.** Secrets live in Dean's password manager, gitignored `.env` files, Supabase function secrets, or EAS secrets.

## Identifiers (safe to commit)

| Item | Value |
|---|---|
| App name | Jinx |
| App Store Connect name | Jinx Sports Passport |
| Bundle ID | `com.deanyao.jinx` |
| Apple Developer Team ID | `625VS6JANJ` |
| App Store Connect app ID (`ascAppId`) | Numeric Apple ID from App Store Connect → Jinx Sports Passport → App Information. Dean fills this in: `TODO` |
| Expo account / organization | User `deanyao` (personal workspace `deanyao6`, which holds SalusLink). Jinx's project belongs to the separate Jinx organization, slug **`jinx-fan-passport`** (confirmed via `eas whoami`, role Owner). |
| Supabase organization | Jinx (Free plan) |
| Supabase project | Jinx: Sports Passport |
| Supabase project ref | `vekdufflzklfxljqufbq` |
| Supabase project URL | `https://vekdufflzklfxljqufbq.supabase.co` |
| Supabase region | East US (Ohio), us-east-2 |
| GitHub repo | `deanyao6/Jinx` (private), connected to the Supabase project |
| Anthropic API | Dedicated key for Jinx (workspace and spend limit set in the Anthropic Console) |
| Email (Resend) | Not set up yet. Waits for the domain. |
| Domain | Not purchased yet. |
| Figma | Not used for building. See `design/FIGMA_NOTES.md`. |

## Environment variables

| Name | Where it lives | Secret? | Used by |
|---|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | `.env` (local), EAS environment variables | No | App |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` (the publishable key) | `.env` (local), EAS environment variables | No, protected by RLS | App |
| `SUPABASE_SERVICE_ROLE_KEY` (the secret key) | Supabase function secrets (automatic), GitHub Actions secret | **Yes** | Edge Functions, ingestion jobs |
| `SUPABASE_DB_PASSWORD` | Dean's password manager; entered when linking the CLI | **Yes** | Supabase CLI |
| `SUPABASE_ACCESS_TOKEN` | GitHub Actions secret (later, for CI deploys) | **Yes** | CI |
| `ANTHROPIC_API_KEY` | Supabase function secrets | **Yes** | `parse-ticket`, storylines |
| `EXPO_TOKEN` | GitHub Actions secret (later, if builds run in CI) | **Yes** | CI |
| App Store Connect API key (`.p8`, Key ID, Issuer ID) | Uploaded to EAS credentials; `.p8` file kept outside the repo | **Yes** | EAS Submit |

`.gitignore` must include `.env*` (except `.env.example`), `*.p8`, `*.mobileprovision`, `*.p12`, and `supabase/.temp`.

## One-time setup Dean does (logins that need a browser, password, or 2FA)

Claude Code can't type passwords or approve 2FA. Dean runs these himself, either in a separate terminal or inside Claude Code by starting the line with `!`.

1. **Tools installed:** Xcode (with iOS Simulator), Node LTS, Docker Desktop (running), GitHub CLI (`brew install gh`), Supabase CLI (`brew install supabase/tap/supabase`), EAS CLI (`npm install -g eas-cli`).
2. **GitHub:** `gh auth login`
3. **Supabase:** `supabase login` (opens the browser), then from the repo root after `supabase init` exists: `supabase link --project-ref vekdufflzklfxljqufbq` (enter the database password when prompted).
4. **Supabase Auth, Apple provider:** in the Supabase dashboard → Authentication → Sign In / Providers → Apple → enable, and add `com.deanyao.jinx` as a client ID. (Claude Code will confirm the exact fields against Supabase's current docs.)
5. **Expo:** `eas login` (as `deanyao`).
6. **Apple, App Store Connect API key** (lets EAS submit builds without Apple ID passwords): App Store Connect → Users and Access → Integrations → App Store Connect API → Team Keys → generate a key with the App Manager role. Download the `.p8` once, store it in the password manager or outside the repo, and note the Key ID and Issuer ID. When Claude Code runs `eas credentials` or the first `eas submit`, choose to use this API key. The first `eas build` may also ask Dean to sign in with his Apple ID so EAS can create certificates and provisioning profiles.
7. **Anthropic key into Supabase:** `supabase secrets set ANTHROPIC_API_KEY=...` (Dean runs this so the key never passes through chat).
8. **Local app env:** copy `.env.example` to `.env` and fill in the Supabase URL and publishable key from Supabase → Project Settings → API Keys.

## Access check (Claude Code runs this at the start of M0)

Run each check, then report a table of pass or fail. If anything fails, stop and tell Dean exactly which setup step above to do. Never ask Dean to paste a secret into chat.

| Service | Command | Pass when |
|---|---|---|
| Xcode | `xcode-select -p` and `xcrun simctl list devices available` | An iPhone 16 (or newest) simulator is listed |
| Node | `node -v` | LTS version |
| Docker | `docker info` | Daemon is running |
| GitHub | `gh auth status` and `git remote -v` | Logged in; remote is `deanyao6/Jinx` |
| Supabase CLI | `supabase --version` and `supabase projects list` | `vekdufflzklfxljqufbq` appears |
| Supabase link | `supabase link --project-ref vekdufflzklfxljqufbq` status, or `supabase migration list` | Linked to the project |
| Supabase local | `supabase start` (after `supabase init`) | Local stack starts |
| Expo | `eas whoami` | Shows `deanyao`, with access to the Jinx organization |
| Apple credentials | `eas credentials -p ios` (read only; don't create anything yet) | EAS can reach the Apple team `625VS6JANJ`, or Dean is prompted to sign in |
| App Store Connect | `ascAppId` in this file is filled in | Not `TODO` |
| Anthropic | `supabase secrets list` | `ANTHROPIC_API_KEY` is listed (value not shown) |
| App env | `.env` exists with both `EXPO_PUBLIC_` values set (check presence only, don't print values) | Both present |

Checks that depend on later milestones (for example the first `eas build`, TestFlight upload, Resend, domain) are run when that milestone begins.

## Safety rules for Claude Code

- Use the Supabase CLI against the linked remote project only for actions Dean approves (pushing migrations, deploying functions, setting secrets). Develop and test against the local stack by default.
- Never run destructive remote commands (`supabase db reset --linked`, dropping tables, deleting storage buckets, revoking certificates) without asking first.
- Never create, revoke, or rotate Apple certificates, provisioning profiles, or API keys without asking first. SalusLink uses the same Apple Developer team.
- Never touch SalusLink's Supabase organization, Expo project, or Resend team.
- Don't print secret values in terminal output or commit them.
