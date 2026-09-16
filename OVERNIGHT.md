# Overnight log — night of 2026-09-16

Working unattended from `CLAUDE_CODE_PROMPT.md` plus Dean's overnight brief. Newest
sections are appended at the bottom as work lands.

## Read this first

1. **Look at the contact sheets before anything else:** `open design/parity/sheets/`.
   Six of them, all Passport, each showing reference | app | diff side by side.
2. Passport is the only screen rebuilt so far, at a **4.10% mean mismatch** against the
   reference. Everything else is honestly reported as not built. The per-screen table is
   in section (g) near the bottom.
3. Six commits, all with the full check suite green. Nothing remote was touched.

## Needs Dean (short list)

| # | What | Why it matters |
|---|---|---|
| 1 | Fill in `ascAppId` in `docs/ACCOUNTS.md` | Blocks EAS Submit only. Nothing tonight. |
| 2 | `supabase secrets set ANTHROPIC_API_KEY=...` | Blocks storylines (6.18) and `parse-ticket`. Nothing tonight; both are built behind the missing key. |
| 3 | Decide on Node | Machine is on v25.9.0, a current release. Expo targets LTS (22/24). Nothing has broken, but it is off-support. |
| 4 | `eas credentials -p ios` is interactive, so the Apple team `625VS6JANJ` connection stays unverified | Blocks the first real device build. Not touched per the brief. |
| 5 | The Expo slug is now `jinx` and no longer matches the EAS project `appname-monorepo` | EAS commands will refuse until the project is renamed or recreated under the Jinx org. |
| 6 | The reference's own MLB Giants accent fails contrast (3.15:1 on white) | Left verbatim because the reference is authoritative. A design call, not a bug. |

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

## (g) Screens — Passport done and measured, the rest not started

**Look at these first**, before reading anything else:

```
open design/parity/sheets/          # reference | app | diff, one per screen and theme
```

Six sheets are there, all Passport. They are gitignored on purpose — 2.5 MB each, and
`npm run parity` regenerates them in about four minutes — so they exist on your disk, not
in the repo.

### Parity per screen and theme

| Screen | Light | Dark |
|---|---|---|
| Passport, All teams | **4.60%** | **3.97%** |
| Passport, Phillies pill | **4.38%** | **3.84%** |
| Passport, Eagles pill | **4.20%** | **3.61%** |
| Record game log (Phillies, As a neutral) | not built | not built |
| Pick a side, and picked | not built | not built |
| Games | not built | not built |
| Relive, pregame and mid-story | not built | not built |
| Game day | not built | not built |
| Stadium guide (Food, Bathrooms, Seats) | not built | not built |
| Profile | not built | not built |
| Friends panel | not built | not built |

Mean across what exists: **4.10%**. All 32 reference shots render; 26 of 32 app shots
correctly report "not built" rather than being scored against something they are not.

### What the remaining 4% is

I looked at the diff images rather than trusting the number. Structure, spacing, colour,
copy and content all line up. What is left is:

1. **Text baseline drift**, accumulating down the screen. Rows near the top align; by the
   superlatives list the app sits a few points lower than the reference, so that text
   shows doubled in the diff. This is React Native resolving line box height from the
   font's own metrics where the CSS leaves `line-height: normal`.
2. **Font antialiasing**, which no native renderer avoids and which the 0.15 pixelmatch
   threshold already tolerates most of.

**A warning about (1), because it cost me time.** I assumed React Native's default line
box is taller than CSS `normal` and set every unspecified line-height to 1.2em. The mean
went from 5.13% to **5.76%** — worse. I reverted it. Do not repeat that guess; measure a
single row's baseline in both images first and derive the factor, rather than reasoning
about it. The one place the CSS does declare `line-height: 1.2` (`.fx-stamp b`) is kept.

### Bugs the harness caught that reading the code would not have

Worth knowing, because the same traps will come up on the next screens:

- **The app sat on the native splash in parity mode.** Font loading and
  `SplashScreen.hideAsync()` were inside `RootNavigator`, but `ParityHost` renders a
  parity screen *instead of* its children, so the navigator never mounted. Fonts now load
  in a `FontGate` above anything that can replace the tree.
- **Three screen ids rendered identical pixels.** React reused the component instance
  across screen changes, so Passport's pill kept whatever it was first mounted with.
  `ParityHost` now keys the subtree by screen id. A parity screen has to be a pure
  function of its id. The duplicate-shot backstop found this; the screen-id marker alone
  could not have, since the marker was correct each time.
- **The screen drew under the status bar**, because I had not applied the top safe-area
  inset.

### One open design question, for you

The reference's tab bar has `padding-bottom: 20px`, which is its stand-in for the home
indicator on a phone frame that does not have one. The real bottom safe-area inset on an
iPhone 17 Pro is 34pt. I matched the reference (20pt) so parity is measurable, but on a
real device the labels sit closer to the home indicator than they probably should. Using
the real inset would cost parity points at the bottom of every screen. **Your call**; it
is one line either way.

---

## Everything that needs you

Repeating the table at the top, with what landed overnight added:

1. **`ascAppId`** in `docs/ACCOUNTS.md` is still `TODO`. Blocks EAS Submit only.
2. **`supabase secrets set ANTHROPIC_API_KEY=...`**. Blocks storylines (6.18) and
   `parse-ticket`. Nothing tonight depended on it.
3. **The EAS project.** The Expo slug is now `jinx` and no longer matches the EAS project
   `appname-monorepo`. EAS commands will refuse until you rename it or create a new one
   under the `jinx-fan-passport` org. It needed to move off the personal account anyway.
4. **Node is v25.9.0**, a current release rather than LTS. Nothing has broken.
5. **`eas credentials -p ios` is interactive**, so the Apple team `625VS6JANJ` connection
   is still unverified. Untouched per your instructions.
6. **The MLB Giants accent fails contrast, and it is the reference's own value.**
   `.t-sf` light `--t` is `#FD5A1E`, which is 3.15:1 on white — below the 4.5:1 that every
   one of the 52 hand-tuned palettes clears. SPEC.md 8.2 makes the reference
   authoritative, so it was copied verbatim rather than silently corrected. The palette
   checker reports it without failing the build. `#C43B00` would be 5.6:1 and keeps the
   Giants orange as the fill; that is a one-line change, but it is a deviation from the
   reference and is yours to make.
7. **The tab bar bottom padding question** above.

## What I would do next, in order

1. **Nail the baseline drift once.** It affects every screen, so solving it on Passport
   pays for itself immediately. Measure a known row's y-position in the reference and app
   PNGs, derive the actual line box difference, and apply it as a typography helper rather
   than per-style guesses. Expect Passport to land near 1-2%.
2. **Port the record game log slide-over.** It is the other half of Passport, the
   fixtures and the log data already exist, and the panel motion is specified
   (320ms, `cubic-bezier(.2,.8,.2,1)`).
3. **Then Games, then Pick a side**, in the brief's order. Both reuse components that now
   exist: the team badges, the result circles and the thumbnails are the only genuinely
   new SVG work.
4. **Wire `team_colors` into the app.** The 65 palettes are seeded but nothing reads them
   yet; the app uses the 14 static fallbacks. A repository that loads them and falls back
   to the static set is small and unblocks every non-Philadelphia team.
5. Leave storylines (6.18) and Relive (6.19) until the screens are done. Storylines is
   blocked on the Anthropic key anyway.

## State of the checks

Green as of the last commit:

- `npm run typecheck`, `npm run lint`, `npm run format:check` — clean.
- `npm test` — **353 tests** (214 mobile, 126 core, 13 ingest).
- `npm run db:test` — **117 assertions**, 6 files, PASS.

Nothing was pushed to the hosted Supabase project, no migrations were applied remotely, no
Apple certificates or provisioning profiles were touched, nothing belonging to SalusLink
was touched, watchman is still uninstalled and the Metro watcher settings are unchanged.
Disk finished at 65 GB free.

## New commands

```
npm run parity              # reference shots, app shots, diff, contact sheets
npm run parity:selftest     # prove the harness end to end and measure the safe-area inset
npm run parity:ref          # reference shots only (no simulator needed)
npm run build:design        # regenerate icons and stadium shapes from the reference
npm run fonts               # regenerate the static Archivo instances
npm run fonts:check         # fail if the font assets are stale
npm run seed:colors:check   # validate the 65 team palettes and their contrast
```

All of them take screen ids as arguments, e.g. `npm run parity -- passport-all games`.
