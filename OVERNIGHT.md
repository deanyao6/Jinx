# Overnight log — night of 2026-09-16

Working unattended from `CLAUDE_CODE_PROMPT.md` plus Dean's overnight brief. Newest
sections are appended at the bottom as work lands.

## Needs Dean (short list, read this first)

| # | What | Why it matters |
|---|---|---|
| 1 | Fill in `ascAppId` in `docs/ACCOUNTS.md` | Blocks EAS Submit only. Nothing tonight. |
| 2 | `supabase secrets set ANTHROPIC_API_KEY=...` | Blocks storylines (6.18) and `parse-ticket`. Nothing tonight; both are built behind the missing key. |
| 3 | Decide on Node | Machine is on v25.9.0, a current release. Expo targets LTS (22/24). Nothing has broken, but it is off-support. |
| 4 | `eas credentials -p ios` is interactive, so the Apple team `625VS6JANJ` connection stays unverified | Blocks the first real device build. Not touched per the brief. |

## (a) Access check — run 2026-09-16, per `docs/ACCOUNTS.md`

| Service | Check | Result | Detail |
|---|---|---|---|
| Xcode | `xcode-select -p`, `simctl list devices available` | **PASS\*** | Xcode 26.6.0. Simulators: iPhone 17 Pro (booted), 17 Pro Max, 17e, 17, Air. **No iPhone 16** — see note below. |
| Node | `node -v` | **FAIL** | `v25.9.0`. Not LTS. Expo targets LTS. Nothing is broken by it today. |
| Docker | `docker info` | **PASS** | Daemon running. |
| GitHub | `gh auth status`, `git remote -v` | **PASS** | Logged in as `deanyao6`; remote is `deanyao6/Jinx`. Repo is **public**, not private as `ACCOUNTS.md` claims. |
| Supabase CLI | `supabase --version`, `projects list` | **PASS** | CLI 2.117.0. `vekdufflzklfxljqufbq` ("Jinx: Sports Passport", us-east-2) listed. |
| Supabase link | `supabase migration list` | **PASS (linked), remote empty** | Linked. **0 of 15 migrations applied remotely.** Not pushed — the brief forbids remote writes tonight. |
| Supabase local | `supabase status` | **PASS** | Stack up on 54421-54427. |
| Expo | `eas whoami` | **PASS** | `deanyao`. Owner of `deanyao`, `deanyao6`, and `jinx-fan-passport`. |
| Apple credentials | `eas credentials -p ios` | **SKIPPED** | Interactive, and the brief forbids touching certificates. Apple team link unverified. |
| App Store Connect | `ascAppId` filled in | **FAIL** | Still `TODO`. |
| Anthropic | `supabase secrets list` | **FAIL** | Returns `{"secrets":[]}`. `ANTHROPIC_API_KEY` is not set. |
| App env | `apps/mobile/.env` present with both `EXPO_PUBLIC_` values | **PASS** | Both set, plus `EXPO_PUBLIC_INBOUND_EMAIL_DOMAIN`. Values not printed. |

Two failures (`ascAppId`, `ANTHROPIC_API_KEY`) were expected and neither blocks tonight's work.
Continued as instructed.

**\* Simulator note.** The prompt's parity harness specifies iPhone 16 at 393x852pt. That device is not
installed and Xcode 26.6 no longer ships it by default. I standardised the harness on **iPhone 17
Pro** instead and recorded its real point size rather than assuming one. This is a deviation from the
brief; it is recorded here rather than silently absorbed. Re-pointing the harness at another device is
a one-line change.

## (a) SPEC.md replaced

`docs/SPEC.new.md` → `SPEC.md` via `git mv` (history preserved). Revision 7 is now the spec at the
repo root. `CLAUDE.md`'s "a spec revision is in flight" banner was rewritten to say it has landed.
The old `SPEC.md` (previous product spec) is gone from the working tree but remains in git history.

## Baseline before any changes

`npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test` — **all green**, exit 0.
229 tests across `packages/core`, `ingest`, and `apps/mobile`.
