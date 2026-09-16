# Porting notes

Where the native app cannot do literally what `design/reference.html` does, and what it
does instead. Every entry is a deliberate substitution, not an oversight.

The reference is the visual source of truth (SPEC.md 8.1). It is never edited to make
porting easier, and no formatter is ever run over it.

## How parity is measured

`npm run parity` captures the reference in a browser, captures the app in the simulator,
and diffs the pairs. `design/parity/sheets/` holds a `reference | app | diff` contact
sheet per screen and theme. See "The parity harness" below.

## CSS features with no native equivalent

### `font-variation-settings: "wdth"` -> static Archivo instances

**Done.** The reference loads Archivo as a variable font
(`fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,300..900`) and styles condensed
display text with `font-variation-settings:"wdth" N` alongside `font-weight`. React Native has
no reliable support for variable font axes, so `scripts/fonts/build-archivo.py` pins every
(width, weight) pair the CSS actually asks for into its own static TTF with fontTools
`varLib.instancer`. `apps/mobile/src/theme/fonts.ts` registers them with expo-font and
`apps/mobile/src/app/_layout.tsx` holds the native splash until they are loaded.

The set was derived by reading every CSS rule, every inline `style=` attribute and every SVG
`font-weight` attribute in `reference.html`. **19 instances, 2,269,128 bytes (2.16 MiB)**,
about 119 KB each, committed to `apps/mobile/assets/fonts/` along with the 4,388-byte OFL
licence: 2,273,516 bytes (2.17 MiB) of assets in total.

| Width | Weight | Used by |
|---|---|---|
| 62 | 900 | `.hero .rec`, `.ring .c b`, `.vs strong`, `.loghead b`, `.scorebug .sc`, `.fx-word`, `.fx-rec b`, `.fx-rc b`, `.fx-sh h3` |
| 64 | 900 | `.side .pct`, `.fr .rec`, `.fx-wr strong` (also `.intro h1`, which is page chrome) |
| 66 | 900 | `.ticket b` |
| 70 | 700 | `.ticket .seat strong` - the rule sets no `font-weight`, so `strong` keeps the UA bold |
| 70 | 850 | `.tile b` |
| 72 | 850 | `.li .val`, `.side b` |
| 74 | 850 | `.stats b` |
| 78 | 850 | `.tl time` |
| 80 | 850 | `.circ` |
| 80 | 900 | `.fx-bd` |
| 100 | 400 | `body` default |
| 100 | 500 | `.wplbl .dog` |
| 100 | 600 | `.scorebug .sc small` |
| 100 | 650 | `.status`, `.fx-last`, `.fx-stamp span`, `.fx-chip`, `.fx-at`, `.fx-story` |
| 100 | 700 | `.pill[aria-pressed]`, `.sec a`, `.stamp b`, `.li .tx b`, `.live`, `.tchip`, `.fx-pill`, bare `<b>`/`<strong>`, SVG `font-weight="700"` |
| 100 | 750 | `.tabs .on`, `.seg [aria-selected]`, `.side .tag`, `.lockpill`, `.wplbl`, `.scorebug .tm`, `.fx-sub`, `.fx-r1`, `.fx-rc .lb`, `.fx-sh a`, `.fx-seg [aria-selected]`, `.fx-wpl`, `.fx-story small` |
| 100 | 800 | `.sec h3`, `.badge`, `.matchup .v`, `.choose button`, `.fx-stamp b`, `.fx-row .tx b`, `.fx-mu b`, `.fx-root`, SVG `font-weight="800"` |
| 100 | 850 | `.top h2`, `.vhero b`, `.prof h4`, `.matchup b`, `.fx-pill .n`, `.fx-li .tx b`, `.fx-title`, `.fx-live`, `.fx-lock`, `.fx-h1`, `.fx-vs`, `.fx-sth` |
| 100 | 900 | `.fx-res`, SVG `font-weight="900"` |

Consequences to keep in mind while porting:

- **Never set `fontWeight` on a style that uses one of these families.** The weight is already in
  the outlines; iOS would synthesise a second, fake bolding on top. Ask for the weight through
  `fontFamily({ width, weight })` instead.
- The families are *not* a weight family in the CSS sense. Each instance is a standalone
  "Regular", so `fontWeight: 'bold'` has no meaningful sibling to resolve to.
- `fontFamily()` snaps to the nearest available width and then the nearest weight at that width,
  so it is total and never returns undefined. If a screen needs a pair that is not in the table,
  add it to `INSTANCES` in the build script and regenerate rather than living on the fallback.
- The build is deterministic (`head.modified` is pinned to the upstream value), so regenerating
  and seeing a clean `git status` means the assets still match the reference. `--check` asserts
  this without writing.

```
python3 scripts/fonts/build-archivo.py            # download if needed, then generate
python3 scripts/fonts/build-archivo.py --check    # fail if any output is missing or stale
python3 scripts/fonts/build-archivo.py --refresh  # re-download the upstream variable TTF
```

The upstream variable font and its licence are cached in the gitignored
`scripts/fonts/.cache/`; the generated instances are committed because they are app assets.
Archivo is SIL Open Font License 1.1, which permits bundling. See `docs/attribution.md`.

### Still to come

Known items the reference uses that will need an entry when their screen is ported:

| Reference | Where | Expected substitution |
|---|---|---|
| `filter: blur()` on the hero glow | `.fx-hero` | A radial-gradient `<RadialGradient>` in react-native-svg, or a pre-blurred asset. `filter` does not exist in React Native. |
| Hero grid texture | `.fx-hero` background | A tiled SVG pattern via react-native-svg `<Pattern>`. |
| `color-mix()` | several | Resolved at build time into a literal hex in the token module; React Native has no runtime colour mixing. |
| `box-shadow` with spread and negative offset | `.phone`, cards | iOS `shadowOffset`/`shadowRadius`/`shadowOpacity`, which has no spread. Values are re-tuned by eye against the diff, not converted arithmetically. |
| `overflow-x: auto` pill and stamp rails | `.pills`, `.fx-stamps` | `ScrollView horizontal` with `showsHorizontalScrollIndicator={false}`. |
| `:focus-visible` outlines | interactive elements | Not ported. There is no keyboard focus ring on iOS touch. |

## The parity harness

Three scripts under `scripts/parity/`, run together by `npm run parity`.

**Reference shots** (`capture-reference.mjs`). Playwright loads `reference.html`, sets
`data-theme`, waits for Archivo to load, then reduces the page to a single `.scr`: the
phone bezel, the fake status row, the page header, the captions and the theme toggle are
all presentation rather than app (SPEC.md 8.1), so they are removed or hidden. The screen
is resized to the device's point size and allowed to reflow; it is never scaled. Shots are
taken at device pixel ratio 3.

Two things are frozen so a shot is reproducible. Timers are replaced before any page
script runs, with `window.__parityTick(ms)` to advance them deliberately; without this the
Pick a side countdown and the Relive player differ between every run, and the mismatch
percentage would be measuring the clock. CSS animations and transitions are set to zero
duration for the same reason.

**App shots** (`capture-app.mjs`). Drives the booted simulator and crops the top
`TOP_CROP_PT` points, so both images start below the status bar.

**Diff** (`diff.mjs`). pixelmatch at threshold 0.15 with antialiasing detection on, which
ignores the text rasteriser while still catching real layout and colour differences.
Writes a diff image and a three-panel contact sheet per pair, and prints a table.

### Why the app is driven over HTTP instead of deep links

The obvious design is `xcrun simctl openurl jinx://parity/passport`. It does not work:
iOS 26 shows an "Open in Jinx?" confirmation for every custom-scheme open, including from
simctl, and simctl has no way to tap it. Universal Links would avoid the dialog but need a
domain, which this project does not have yet.

So `control.mjs` serves the wanted screen on `127.0.0.1:8790`, and the app polls it from
`useParityControl` in development builds only. The simulator shares the host's network
stack, so loopback on one is loopback on the other. This is also faster than deep links,
because the app never has to relaunch between screens.

### Why the app paints a marker

`simctl openurl` and the control channel both report success whether or not the app
understood the request. The first run of this harness screenshotted the sign-in screen 32
times and scored each one against a different reference, reporting a confident mean of
52.32%. That number was worse than no number.

So in parity mode the app paints a strip of flat colour into the top of the window,
encoding a 16-bit hash of the screen id it believes it is rendering. The strip sits inside
the band the harness crops away, so it never reaches the diff. The harness polls until the
marker matches the screen it asked for; a screen that never claims itself is reported as
"not built" and produces no app shot at all.

Decoding is relative to the marker's own sentinel cell rather than to absolute colour
values. iOS composites things over the app that scale every pixel uniformly, and a system
alert dimming the screen to 80% made an exact match fail in a way that looked exactly like
"the app did not render this screen".

The app and harness implementations cannot share a module, because the harness is an ESM
Node script outside the app's build. `apps/mobile/src/features/parity/__tests__/marker.test.ts`
pins the hashes and asserts the two sources have not drifted.

### Device geometry

The brief specifies an iPhone 16 at 393x852pt. Xcode 26.6 ships no iPhone 16 simulator on
this machine, so the harness targets the **iPhone 17 Pro** at **402x874pt @3x**. Override
with `PARITY_DEVICE`, `PARITY_WIDTH`, `PARITY_HEIGHT`.

The top crop is **62pt**, measured rather than assumed: `npm run parity:selftest` renders
a block of flat colour starting at the app's real top safe-area inset and reports the row
it lands on. Re-run it after changing device.
