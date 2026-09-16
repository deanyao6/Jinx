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

*(Filled in as screens are ported. Nothing here yet: the design system port is the next
piece of work, and an empty list at this stage is accurate rather than convenient.)*

Known items the reference uses that will need an entry when their screen is ported:

| Reference | Where | Expected substitution |
|---|---|---|
| `filter: blur()` on the hero glow | `.fx-hero` | A radial-gradient `<RadialGradient>` in react-native-svg, or a pre-blurred asset. `filter` does not exist in React Native. |
| Hero grid texture | `.fx-hero` background | A tiled SVG pattern via react-native-svg `<Pattern>`. |
| `color-mix()` | several | Resolved at build time into a literal hex in the token module; React Native has no runtime colour mixing. |
| `box-shadow` with spread and negative offset | `.phone`, cards | iOS `shadowOffset`/`shadowRadius`/`shadowOpacity`, which has no spread. Values are re-tuned by eye against the diff, not converted arithmetically. |
| `font-variation-settings: "wdth"` | headings, `.hero .rec` | Static Archivo instances generated with fontTools `varLib.instancer`, one per width and weight the CSS actually uses (SPEC.md 8.2). |
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
