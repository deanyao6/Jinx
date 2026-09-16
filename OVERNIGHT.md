# Overnight log — night of 2026-09-16

Working unattended from `CLAUDE_CODE_PROMPT.md` plus Dean's overnight brief. Newest
sections are appended at the bottom as work lands.

## Read this first

1. **Look at the contact sheets before anything else:** `open design/parity/sheets/`.
   32 of them, one per screen and theme, each showing reference | app | diff side by side.
2. **Every screen in the reference is rebuilt**, in both themes, interactive, at a
   **4.37% mean mismatch**. Best 0.93% (Game day), worst 8.93% (Stadium guide, and that
   one is a bug in the reference rather than the port). Per-screen table in section (g).
3. **Passport, Games and the Friends panel read real data**; the rest still render demo
   fixtures behind the same repository interface. `SUPABASE_BACKED` says which is which,
   and a test asserts it.
4. Nothing remote was touched: no migrations pushed, no Apple certificates, nothing of
   SalusLink's, and the Metro watcher settings are untouched. **The M1 ingestion
   rearchitecture was deliberately not started** — it is the one piece that could damage
   the 82,240 games loaded locally, and it needs someone awake.
5. Every commit has the full check suite green: typecheck, lint, format, 263 mobile tests
   plus 139 in core and ingest, and 117 database assertions. Verified again at the end,
   and the app was launched in the simulator to confirm it still boots.

## Needs Dean (short list)

| # | What | Why it matters |
|---|---|---|
| 1 | Fill in `ascAppId` in `docs/ACCOUNTS.md` | Blocks EAS Submit only. Nothing tonight. |
| 2 | `supabase secrets set ANTHROPIC_API_KEY=...` | Blocks storylines (6.18) and `parse-ticket`. Nothing tonight; both are built behind the missing key. |
| 3 | Decide on Node | Machine is on v25.9.0, a current release. Expo targets LTS (22/24). Nothing has broken, but it is off-support. |
| 4 | `eas credentials -p ios` is interactive, so the Apple team `625VS6JANJ` connection stays unverified | Blocks the first real device build. Not touched per the brief. |
| 5 | The Expo slug is now `jinx` and no longer matches the EAS project `appname-monorepo` | EAS commands will refuse until the project is renamed or recreated under the Jinx org. |
| 6 | The reference's own MLB Giants accent fails contrast (3.15:1 on white) | Left verbatim because the reference is authoritative. A design call, not a bug. |
| 7 | **The Stadium guide's avatars are 88px because of a CSS collision in the reference** | The single biggest remaining parity gap, and one line either way. Detail below. |
| 8 | **The Games row has no state for a tie or an unfinished game** | `.fx-res` has only `w` and `l`. NFL ties are real and SPEC.md 6.2 counts them. The circle is omitted rather than a tie being called a loss, which needs a design decision. |
| 9 | Stamp metals (brass vs silver) are an inference, not data | Nothing in the schema says which a venue is. The rule used reproduces the reference's six exactly, but it is a guess at intent. |

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

## (g) Screens — all sixteen built and measured

**Look at these first**, before reading anything else:

```
open design/parity/sheets/          # reference | app | diff, one per screen and theme
```

Thirty-two of them, one per screen and theme. They are gitignored on purpose — 2.5 MB
each, and `npm run parity` regenerates them in about ten minutes — so they exist on your
disk, not in the repo.

### Parity per screen and theme

| Screen | Light | Dark |
|---|---|---|
| Game day | **0.93%** | **0.93%** |
| Profile | **1.04%** | **1.03%** |
| Relive, pregame | **2.77%** | **2.58%** |
| Relive, mid story | **3.06%** | **2.87%** |
| Games, History | **3.32%** | **2.92%** |
| Friends panel | **3.48%** | **3.43%** |
| Passport, Eagles pill | **3.74%** | **3.19%** |
| Passport, Phillies pill | **3.78%** | **3.28%** |
| Passport, All teams | **4.14%** | **3.55%** |
| Record game log, As a neutral | **4.66%** | **4.61%** |
| Record game log, Phillies | **5.18%** | **5.08%** |
| Pick a side | **5.37%** | **5.06%** |
| Pick a side, picked | **5.70%** | **5.40%** |
| Stadium guide, Seats | **7.93%** | **7.48%** |
| Stadium guide, Bathrooms | **8.15%** | **7.70%** |
| Stadium guide, Food | **8.93%** | **8.48%** |

**Every screen in the reference is now built**, in both themes. 32 comparisons, mean
**4.37%**. Best is Game day at 0.96%; worst is the Stadium guide at 8.93%, and that one is
a bug in the reference rather than the port — see below.

Games, Relive, Game day and Profile each measured well on the first attempt, without any
tuning. That is the return on building the design system against the reference rather than
by eye: by the time those screens were written, almost every component they needed already
existed and had been measured.

### The game log slide-over

Ported from `.panel#logPanel`. It is one of the earlier-concept screens, so it uses the
older classes (`.top`, `.loghead`, `.li`, `.thumb`, `.circ`) exactly as the reference draws
them, not the `fx-` set.

It started at 13.45% and three bugs took it to 5.24%, two of them in the harness rather
than the screen:

- **The reference's panel draws its own fake status row**, and `capture-reference` only
  removed the first one on the screen. Every panel shot therefore carried a 28pt band the
  app does not have, offsetting the entire comparison. Now every `.status` is removed.
- **A Metro "Refreshing..." banner** was caught mid-reload in one shot, pushing the screen
  down 5pt and scoring it at 8.62% instead of 5.02% — which reads exactly like a layout
  bug. `capture-app` now requires two identical consecutive frames before accepting a
  shot, so anything transient is rejected rather than measured.
- In the screen itself, the stadium thumbnails fill part of the shape with `currentColor`,
  which needs `color` set on the `Svg` and not just `stroke`, and the panel's tab bar takes
  the screen's neutral theme rather than the record's team colour, because in the reference
  only `.loghead` carries the team class.

### What the remaining 4% is

I looked at the diff images rather than trusting the number. Structure, spacing, colour,
copy and content all line up. What is left is:

1. **Three localized vertical offsets**, and — importantly — *not* a steady accumulation.
2. **Font antialiasing**, which no native renderer avoids and which the 0.15 pixelmatch
   threshold already tolerates most of.

**I was wrong about (1) twice, so here is the measurement instead of a theory.**

First I assumed React Native's line boxes are taller than CSS `normal` and set every
unspecified line-height to 1.2em. The mean went from 5.13% to **5.76%** — worse. Reverted;
only the one line-height the CSS actually declares (`.fx-stamp b`) is kept.

Then I wrote in this file that the residue was drift accumulating down the screen. It is
not. `npm run parity:drift passport-all light` slices the screen into 40pt bands and finds
the vertical offset that best aligns each one. Accumulation would show as a steadily
growing number; the measured rate is 0.22pt per 100pt, which is noise. What it actually
shows, identically on `passport-all.light` and `passport-phi.dark`:

Re-measured after the TightText fix, on `passport-all.light`:

| Region | Offset | Status |
|---|---|---|
| 0-45pt (wordmark, pills) | **+0.33pt** | **fixed.** Was -2 to -3pt. |
| 45-135pt (hero) | **+0.7 to +3.7pt** | app sits low. Open. |
| 195-315pt (record cards) | **+2 to +5pt** | carried down from the hero. Open. |
| 390-480pt (stamps) | **-0.67pt** | aligned |
| 495-570pt (stamp captions) | **-2.7 to +1.3pt** | **fixed.** Was -7 to -11.7pt. |
| 585-720pt (superlatives) | **+2.7 to +6.3pt** | carried down. Open. |

So specific block heights are wrong at two boundaries, and everything between them is
carried along. This is a handful of individual margins and line boxes, not a global
typography factor.

**I fixed the worst one, and the method is the point.** The stamp caption was 7pt high and
everything below it 8.3pt high. The cause was structural rather than metric: in the
reference, `.fx-stamp span` is an *inline* element, so its line box is sized by the
enclosing block's 16px strut, not by the 8.5px span. React Native sizes a line box from
the Text's own font. Setting that one line height explicitly aligned the following section
to within 1pt and took the mean from 4.28% to 3.86%.

**And three things that did not work, so you do not repeat them.** Setting the pill label's
line height to CSS `normal` (1.17em) changed nothing, because the pill's height is set by
the taller count badge, not the label. Setting the *badge's* line height to 1.17em made
the pill taller, not shorter, and the mean went from 3.86% to 4.28%. React Native's
`lineHeight` on small text does not simply shrink the box the way CSS `line-height` does.
Third, a first `TightText` wrapper for the two places the reference sets a line-height
below 1 (`.fx-word` at `.85`, `.fx-rec b` at `.78`). Centring the natural text box inside a
short wrapper overcorrected: the wordmark went from 2.5pt high to 4.3pt low, and the mean
from 3.66% to 4.30%. All three reverted. `TightText` came back later and did work, but by
computing the offset from the font's metrics rather than centring; that is the section
below.

That guess about the top region turned out to be right in kind and wrong in execution.
`.fx-word` at `.85` and `.fx-rec b` at `.78` really were the cause — the glyphs overflow
their line box in CSS and React Native clips them instead — but centring was the wrong way
to place them. **See "The typography problem, solved" below for what actually worked and
the measurement that got there.** The top band is now within 0.33pt.

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

### The one typography rule that does generalise, and its limits

The stamp-caption fix worked because of a *structural* difference, not a metrics one: an
inline element's CSS line box is sized by the enclosing block's strut, and React Native
sizes it from the Text's own font. That is worth knowing, and it recurs.

But it is not a rule to apply on sight. `.fx-mu span` on Pick a side is the identical
construction — an inline span in a block that inherits 16px — and applying the same fix
there took that screen from 5.38% to 7.50%. Measuring afterwards showed why: the record
line genuinely needed about 4.7pt more space, but everything below it was already sitting
3pt high, so adding 6.4pt fixed one row and broke five. Reverted.

The lesson is the method rather than the rule. Measure the ink rows in both PNGs, work out
what each block actually needs, and only then change something. Four of my six typography
changes made parity worse, and every one of them came from reasoning rather than measuring.

### A bug in the reference, which needs your call

**This is why the Stadium guide sits at 8% while every other screen is under 6%.**

In `design/reference.html`:

```
.avs svg   { width:20px; height:20px; ... }   /* line 148 */
.vhero svg { width:88px; height:88px }        /* line 200 */
```

Both selectors have identical specificity, so for the friends' avatars inside `.vhero` the
later rule wins and they render at **88x88 instead of 20x20** — four times the size of
every other avatar stack in the app. They then overflow the row, squeeze the caption onto
four lines, and make the venue hero about 100pt taller than it looks in any other screen.

That is a cascade collision, not a design decision: `.vhero svg` is clearly meant for the
stadium shape beside the venue name.

**I did not reproduce it.** The brief says the reference wins on anything visual, but it
also says to stop and ask rather than deviate when something looks like a mistake, and
this one is unambiguous. So the app draws those avatars at 20px like every other stack,
and the ~8% is almost entirely that one difference. Two one-line options:

- **Fix the reference** (add `.vhero > svg` or reorder), and the guide should drop to ~2%.
- **Match the reference** and I will make the app draw them at 88px instead.

Everything else on that screen — the segments, the ranked rows, the score circles and
their green/amber/red thresholds — matches.

## Interactions — done

Every screen was a static render of one state, which is what the parity harness needs and
not what the app needs. They are now interactive:

- **Passport** pills filter the whole screen — hero, badge, record cards, stamps and
  superlatives — and each record card opens its game log.
- **Pick a side** buttons select and switch freely, dimming the other and showing the
  confirmation with the gain recomputed from that side's probability.
- **Relive** plays, pauses and restarts, advancing one step immediately and then every
  1.7s, exactly as the reference's handler does.
- **Games**, **Stadium guide** and **Friends** segments switch.
- **Profile** opens the Friends panel, and both slide-overs close again.

The two panels slide in over 320ms on `cubic-bezier(.2,.8,.2,1)` and the live dot pulses
at 1.6s, both from the reference. **Reduce Motion** is honoured: the panels still open,
they just arrive rather than travel, and the dot holds at full opacity. The Relive player
is deliberately *not* disabled under Reduce Motion — stepping through the story is the
feature, not decoration, and the steps are discrete rather than animated.

**Parity is unchanged at 4.44%**, which is the point: the interactions did not disturb any
rendering.

### How the interactions are verified

Not by the parity harness. It drives the app over a control channel rather than by
touching it, so it can prove a screen *renders* a state and never that a tap *reaches*
one. **15 new tests** fire real press events and assert the result, including the two
things most likely to rot: that the neutral record card's log is titled "As a neutral"
rather than "Neutral", and that Relive's gain and restart arithmetic match the reference's
handler rather than being hard-coded.

Two pieces of test infrastructure were needed. `react-native-reanimated` reaches for a
native worklets runtime that does not exist under Jest, and its own shipped mock
re-exports the real module, so it does not help; `jest.setup.ts` now has a small mock
covering only the surface these screens use, resolving animations to their final value.
It reports Reduce Motion as **off**, so the tests exercise the animated path rather than
the shortcut. `jest.resolver.js` also delegates to the resolver react-native-worklets
ships, which steers it away from its native-only entry points.

## Team colours wired up

The 65 seeded palettes are now read by the app. Until this, only the 14 the reference
itself defines existed in the theme layer, so every other team rendered in the neutral grey.

`useTeamPalettes` loads `team_colors` once and keeps it a day; a `TeamPaletteProvider` near
the root supplies them, and both `ReferenceThemeProvider` and the nested `TeamTheme`
resolve through it. The lookup falls through in order: a loaded palette, then one of the
14 static ones, then neutral. **It never blocks rendering** — while the query is in flight,
when it fails, and in demo mode where there is no backend at all, a screen still draws with
the fallback. A team is therefore always themed, just sometimes with the fallback rather
than its own colours.

The mapping from row to palette is in a module with no Supabase or storage import, so the
theme layer and its tests can use it without dragging the network stack along. Six tests
cover the whole fallback chain, including that the dark accent comes from the stored value
rather than being derived, and that the fill stays the same across themes.

## The repository interface

SPEC.md 8.9 asks for every screen to read data through a repository so demo fixtures and
Supabase are interchangeable without touching UI code. **No screen imports a fixture any
more.** They take a `Repository` from context, and the demo implementation is the default,
which is what makes demo mode work with no backend and what the parity harness measures.

Two things moved while doing it, because the refactor showed they were in the wrong place:

- The SVG generators' palettes — seal metals, avatar colours, photo skies — are part of the
  design, not the demo data. A component needs them whether it is drawing a fixture or a
  real user's photo, so they now live beside the components. The fixtures re-export them so
  the test that checks every value against the reference still covers them.
- Relive's story steps, win probability series and photo lists are per-game **data**, so
  they come through the repository. `relivePoint` now takes the series as an argument
  rather than closing over the fixture, which makes it a chart function rather than a
  fixture-bound one.

**What is not done is the Supabase implementation.** That is deliberate: it is per-milestone
work — Passport's records are M3, imports are M4 — and the point of the interface is that
none of these screens change when it arrives. The structural half, which was the blocker,
is finished.

Parity is unchanged at 4.44% through all of it.

## The typography problem, solved

Four earlier attempts at this made parity worse, all of them from reasoning about metrics
rather than measuring. The fifth worked, and the reason is worth writing down.

**The symptom.** The Passport wordmark sat 2pt high and its glyphs measured 20.7pt tall
against the reference's 22.0pt. Same font, same size, different height.

**The first useful measurement** was the glyph *width*, which was identical at 56.0pt. That
ruled out a font fallback — the condensed instance really was being used — and left only
one explanation for a shorter glyph: the descender on the J was being clipped.

**The cause.** `.fx-word` is `line-height:.85`, a line box shorter than the glyphs. In CSS
they simply overflow it. React Native instead compresses the line, moves the baseline up
and clips. So the fix is to let the text keep its natural line and place it deliberately.

**The number came out of the font, not out of trial and error.** `fontTools` reports
Archivo's hhea ascent as 878 and descent as -210 over a 1000-unit em, so its content height
is 1.088em. CSS puts the baseline at `(lineBox - contentHeight) / 2 + ascent` from the
block's top. I first assumed React Native draws the baseline at `usWinAscent` (1.100em),
which put the wordmark 6.7pt too *low*. Measuring showed it uses the hhea ascent instead,
so the ascent terms cancel and **the offset is exactly CSS half-leading**. That is a real
answer rather than a fudge factor, and it holds at every size.

The wordmark now lands within 0.3pt of the reference.

**One more mistake worth recording.** Applying it everywhere immediately made four screens
worse, because I passed each style straight to the inner `Text` — including its margins,
which then stacked on top of the half-leading offset. Margins belong to the block, not the
glyphs. `TightText` now splits them out. The two places that had worked first time were
exactly the two whose styles carried no margin.

**Pick a side did not yield to any of this.** Its records sit about 4.7pt too close to the
team name, and `.fx-mu span` is inline in a block inheriting 16px, so the same strut
reasoning that fixed the Passport stamp captions should apply. Setting that line height to
the derived 17.41pt changed the mismatch by **nothing at all** — 5.37% before and after, to
two decimal places. The likely explanation is that the matchup row's height is set by the
62pt team badge rather than by the text column, so growing the record's line box moves
nothing. Reverted: an inert change with a confident comment on it is worse than no change.

It is applied wherever the reference sets a line-height below Archivo's 1.088em: the
wordmark, the record hero, the win rate, the record cards, the game log header, the Relive
scorebug and the ticket title. One exception: `.vs strong` on the Friends panel measured
*worse* with it than with a plain line height, so it is left alone with a comment saying
so. I do not know why, and guessing is what cost me the first four attempts.

## The Supabase repository, M3

Passport's records now map from the real `user_stats_cache` payload rather than fixtures:
the pills and their game counts, the lifetime and per-team heroes, win rate, streak, the
Last Game line, the neutral record with its vs-expected, and the stamps.

`supabaseRepository` is composed over the demo one and **`SUPABASE_BACKED` names exactly
which methods are real**. Everything else still returns fixtures, which is what the Plan
and Guide shells need in v1 anyway. That set is asserted in a test, so the partial state is
legible rather than hidden behind a screen that looks like it is showing your data and is
not. `useSupabaseRepository` also returns the demo repository until the stats query
resolves, because an empty passport and a loading one should not look the same.

Two small things the mapping had to decide, both worth your eye:

- **Records are spaced differently.** `packages/core` writes `31–17`, because that form is
  also produced server-side and on share cards. The reference writes `31 – 17`. The spacing
  is a display concern of this design, so it is applied in the mapping rather than changed
  in the domain layer, where it would alter the server output too.
- **Stamp metals are an inference.** The reference draws Philadelphia's two venues in brass
  and the four away venues in silver, and nothing in the schema says which a venue is. The
  rule implemented is "a venue one of your favourite teams calls home is brass", which
  reproduces the reference's six exactly. It is a guess at intent. If it is wrong, it is one
  function.

**Two gaps the stats cache cannot fill yet**, both left honest rather than faked:

- The team view's Home / Road / Playoffs cards need per-game splits the payload does not
  carry, so a team pill currently shows the one card it can compute correctly rather than
  three plausible-looking ones.
- The superlative context chips ("Linc, Jan 2024", "11 Games") are not in the payload
  either, so they render empty against real data. Demo mode still shows them.

### Relive against real data, M8.5

The win probability series and the story steps read from `game_wp_timeline` and
`game_story_steps`, the tables added earlier tonight. A game whose detail has not been
ingested yet returns empty arrays rather than an error, which is what the screen's
"details arrive overnight" state exists for (SPEC.md 4.7).

The scorebug and the line under it map from the game and the user's own attendance. That
note is assembled from what it actually has: no venue, no seat or no companions means the
clause is left out rather than rendered as an empty one. Tested, including a game whose
team joins are missing.

**Photos are not wired up.** They need signed Storage URLs, and the repository's `PhotoRef`
is currently shaped for the reference's generated placeholder scenes. Widening it to carry
either a placeholder or a real storage path is the next piece, along with the
`game_fan_photos()` function that already exists in the schema with its privacy rules and
tests.

One thing the repository refactor caught: the contract types were derived from the demo fixtures,
which are `as const`, so `TeamPill.count` was typed `'48' | '17' | '8'` — a type only the
demo implementation could ever satisfy. A contract shaped by one of its implementations is
not a contract. They are declared properly now.

## Companions and the Friends panel (M6/M7)

Backed by `companion_records`, `rivalries` and `overlaps`. Unlike Pick a side, this one
genuinely is aggregate user data, so it fits the repository and is in `SUPABASE_BACKED`.

The panel now omits the rivalry and overlap cards when a user has neither, rather than
rendering empty ones — a new account has no rivals. That needed `FriendsFixture` declared
properly instead of derived from the `as const` fixture, the same leak `TeamPill` had.

Two things worth your eye:

- **The record colours are an inference.** The reference shows Dad at 7-1 green, Jordan at
  0-4 red, and both Maya at 4-2 and Priya at 3-1 in plain ink. So it is not "winning or
  losing": .750 is still ink. Thresholds of above .8 and below .2 reproduce all four, but
  nothing states them, so this is a reading of the sample.
- **Each companion's favourite team is not returned by `companion_records`**, so their row
  is drawn neutral rather than in their team colour and the team name is left out of the
  subtitle. The reference shows both. It needs either a join in that function or a second
  query.

## Pick a side (M5), and a flaw in my own interface

The mapping from the `game_context` RPC is written and tested: both sides with their
badges, nicknames and win probabilities, the venue line, the lock countdown, and the
storyline cards with their source labels. Storyline *generation* stays blocked on the
Anthropic key, but reading the table is not, and an empty list renders as no cards rather
than placeholder ones.

**It is not wired, and that is the finding.** The repository serves the *current user's
aggregate* data — their records, their stamps, their games. `pickASide()` and `relive()`
do not fit that shape: they need a game id, and a synchronous method cannot serve one
unless that game is already loaded into the implementation. Putting them on the repository
was my mistake earlier tonight.

They belong on per-game hooks instead — `useGameContext(gameId)` already exists, and I
added `useGameStorySteps(gameId)` and `useGameWinProbability(gameId)` for Relive. What is
left is moving those two screens onto the hooks directly and taking the methods off the
interface. Until then both stay on fixtures, and neither appears in `SUPABASE_BACKED`, so
nothing claims to be real that is not.

Two data gaps found while mapping, both left empty rather than invented:

- The season record under each team badge (`68–54` in the reference) is not in the game
  context and there is no standings query.
- The superlative context chips, as noted above.

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

Nothing below is blocked on you except items 1 and 6.

1. **Decide the Stadium guide avatar question** above. It is the single largest remaining
   parity gap and it is one line either way.
2. **Finish the Supabase repository.** Passport's records (M3) and Relive's steps, series
   and scorebug (M8.5) are mapped; Games is M2 and imports M4. `SUPABASE_BACKED` lists what
   is real. The gaps in each are noted below.
3. **The typography offsets that remain**, each worth a point or two. Pick a side's records
   and the Passport hero are the two biggest. See the warning below before starting: the
   obvious fix for Pick a side is measurably inert, and I do not know why.
4. **Then the real feature work**: storylines (6.18), which is blocked on the Anthropic
   key, and Relive (6.19) against real data rather than fixtures.

## State of the checks

Verified at the end of the night, not assumed. Everything below was re-run after the last
code change:

- `npm run typecheck`, `npm run lint`, `npm run format:check` — clean.
- `npm test` — **395 tests** (256 mobile, 126 core, 13 ingest).
- `npm run parity` — 32 of 32 screens captured and diffed, mean 4.37%. Every figure in
  the table in section (g) comes from that run.
- The app was launched in the simulator and screenshotted, to confirm it still boots after
  the night's changes rather than only that the tests pass:
  `design/parity/final-launch-iphone17pro.png`.
- `npm run db:test` — **117 assertions**, 6 files, PASS.

Nothing was pushed to the hosted Supabase project, no migrations were applied remotely, no
Apple certificates or provisioning profiles were touched, nothing belonging to SalusLink
was touched, watchman is still uninstalled and the Metro watcher settings are unchanged.
Disk finished at about 64 GB free.

## New commands

```
npm run parity              # reference shots, app shots, diff, contact sheets
npm run parity:selftest     # prove the harness end to end and measure the safe-area inset
npm run parity:drift        # where a screen is vertically offset, band by band (PARITY_BAND=15 for finer)
npm run parity:ref          # reference shots only (no simulator needed)
npm run build:design        # regenerate icons and stadium shapes from the reference
npm run fonts               # regenerate the static Archivo instances
npm run fonts:check         # fail if the font assets are stale
npm run seed:colors:check   # validate the 65 team palettes and their contrast
```

All of them take screen ids as arguments, e.g. `npm run parity -- passport-all games`.
