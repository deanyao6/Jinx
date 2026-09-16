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

---

## (b) Renamed to Jinx — done

Workspace scope `@jinx/*`, bundle ID `com.deanyao.jinx`, URL scheme `jinx://`, Xcode scheme `Jinx`,
display name and all user-facing copy. The native project was regenerated with `expo prebuild`.

**Verified in the simulator, not from logs:** the app builds, launches, and the welcome screen
renders the Jinx wordmark and "You must be 13 or older to use Jinx".
Screenshot: `design/parity/rename-launch-iphone17pro.png`.

Two deliberate exceptions, both recorded in the commit message and `CLAUDE.md`:

- **`supabase/config.toml` keeps `project_id = "name_tbd"`.** That string names the local Docker
  volumes. Changing it starts an empty stack and orphans the 82,240 loaded games. It is not
  user-visible. **This is a trap worth knowing about before anyone "finishes" the rename.**
- **The Expo slug is now `jinx` and no longer matches the EAS project `appname-monorepo`.**
  EAS commands will refuse until the project is renamed or recreated. **Needs Dean** — see the
  table at the top. The project has to move off the personal account to the Jinx org anyway.

One incidental bug fixed: `ingest/src/nfl/appearances.ts` contained a raw NUL character inside a
template literal, which made `grep` classify the file as binary and silently skip it. The first
rename pass missed the file for exactly that reason. Replaced with the equivalent escape sequence —
identical string value, and the file is now visible to repo-wide text tooling. It was the only
tracked file with this problem.

## (c) Schema for colours, shapes, on-demand detail and Relive — done

Migration `supabase/migrations/20260916000100_design_detail_relive.sql` adds `team_colors`,
`venue_shapes`, `detail_queue`, `game_wp_timeline`, `game_story_steps`, `storylines` and
`attendance_photos`, with a private `attendance-photos` storage bucket.

Applied with `migration up`, **never a reset**, so the loaded games survived. Confirmed: 82,240
games still present afterwards.

Design decisions worth reviewing:

- `detail_queue` is filled by triggers on `attendances` and `checkins`, so no caller can forget to
  enqueue. `enqueue_game_detail()` is idempotent and only re-opens an already-ingested game for an
  explicit `'refresh'`, which is the post-final correction pass in SPEC.md 4.7.
- `detail_queue_pending()` withholds games that are not final yet, so a future game can be queued
  the moment a user marks it Going without the worker picking it up.
- `game_story_steps` references `game_wp_timeline` by a composite foreign key, so a Relive step
  cannot point at a win-probability point that does not exist.
- Photo visibility lives in one security-definer function, `can_view_attendance_photo()`, used by
  both the table policy and the storage object policy. **My first draft of the storage policy only
  checked that a metadata row existed, which would have let any authenticated user read every
  object in the bucket.** Sharing one function means the object and its row cannot disagree.

**35 new pgTAP assertions**, covering every new policy. All 117 database tests pass.
`database.types.ts` regenerated.

## (d) Visual parity harness — done, and it works

`npm run parity`. 16 screens x 2 themes. Output in `design/parity/`:
`reference/`, `app/`, `diff/`, `sheets/` (a `reference | app | diff` contact sheet per pair) and
`summary.json`. That directory is gitignored — the PNGs are large and regenerate on every run — so
**the contact sheets are on disk, not in the repo.**

All 32 reference shots render correctly today. All 32 app shots correctly report **"not built"**,
because no screen has been ported yet.

Three things did not work the obvious way, and the reasons are worth knowing:

1. **Deep links cannot drive the app.** iOS 26 shows an "Open in Jinx?" confirmation for every
   custom-scheme open, including `xcrun simctl openurl`, and simctl cannot tap it. Universal Links
   would avoid it but need a domain. The harness now serves the wanted screen on `127.0.0.1:8790`
   and the app polls it in development builds only. It is also faster — no relaunch per screen.
2. **The harness needed proof of what actually rendered.** `openurl` reports success whether or not
   the app understood it. The first full run screenshotted the sign-in screen 32 times, scored each
   against a different reference, and printed a confident mean of **52.32%**. That number was worse
   than no number. The app now paints a strip encoding a hash of the screen id into the band the
   harness crops away, and the harness polls until it matches. A screen that never claims itself is
   reported as not built and produces no app shot at all.
3. **Marker decoding is relative, not absolute.** A stale system alert dimming the screen to 80%
   made an exact colour match fail in a way that looked exactly like "the app did not render this
   screen". Cost me a wrong debugging detour. It now reads bits against its own sentinel cell, so
   any uniform brightness change cancels out.

**Device: iPhone 17 Pro, 402x874pt @3x.** The brief says iPhone 16 at 393x852; Xcode 26.6 ships no
iPhone 16 simulator here. Overridable with `PARITY_DEVICE` / `PARITY_WIDTH` / `PARITY_HEIGHT`.

**The top crop is measured, not assumed.** `npm run parity:selftest` renders a block starting at the
app's real safe-area inset and reports the row: 186px = **62pt**. It also round-trips the marker, so
the whole pipeline is provable without any ported screen. Run it first if the harness looks wrong.

## (e) Design system — in progress

Done and verified:

- **Base tokens** (`apps/mobile/src/theme/reference/tokens.ts`). Copied verbatim from the
  reference's `:root` blocks. **A test re-parses `design/reference.html` and fails on drift**, so
  "copied verbatim, never eyeballed" keeps holding when the reference is revised. 27 assertions.
- **Team palettes** (`theme/reference/teams.ts`). All 14 `.t-*` classes, likewise parsed back out of
  the reference and compared, including the rule that the fill colour is the same in both themes.
- **`TeamTheme` provider** (`theme/reference/TeamTheme.tsx`). React context has the same semantics
  as the CSS cascade, so a nested `<TeamTheme team="lad">` overrides an outer team exactly the way a
  nested `.t-*` class does, and the light/dark value is resolved once rather than at each call site.
- **Icons** (`components/reference/icons.tsx`). All 36, **generated** from the sprite by
  `npm run build:icons` rather than hand-copied: SPEC.md 8.4 demands identical paths, and a
  transposed digit in a hand-copied curve still renders, so nothing would have caught it. A test
  asserts every sprite symbol and every icon reference in the markup resolves.

The new design system lives under `theme/reference/` and `components/reference/` alongside the old
placeholder `theme/tokens.ts`, which the not-yet-rebuilt screens still read. They coexist until the
last screen moves across. Replacing the old tokens in place would have broken every screen at once
for no benefit.

## (f) Demo fixtures — done

`apps/mobile/src/features/demo/fixtures.ts` reproduces the reference's sample data: the three
passport pills and their full contents, six stamps with their metal gradients and per-pill
filtering, the games list, all three game logs including the aliases the reference uses for the
Home / Road / companion cards, and the avatar palettes.

**20 assertions check each value appears in `design/reference.html` verbatim**, including that every
record uses the reference's en-dash rather than a hyphen — a hyphen would change the glyph widths
and show up in the parity diff as a layout failure, sending the next person looking in the wrong
place.
