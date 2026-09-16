# Claude Code kickoff prompt for Jinx

## Before you start

Your repo root should contain:
- `SPEC.md`
- `CLAUDE_CODE_PROMPT.md` (this file)
- `docs/ACCOUNTS.md`
- `design/reference.html`
- `design/FIGMA_NOTES.md`
- `design/figma/passport-games-pick-side.png`

Before pasting the prompt:
1. Fill in the App Store Connect app ID `TODO` in `docs/ACCOUNTS.md`. (The Expo organization slug is filled in: `jinx-fan-passport`.)
2. Do the one-time setup steps in `docs/ACCOUNTS.md` (installing tools and the logins that need your password or 2FA). You can also do them after Claude Code's access check tells you what's missing.

Then paste everything below the line into Claude Code.

## Handoff corrections, verified 2026-09-16

Checked against the actual machine and repo. Resolve items 1 and 2 before pasting.

**1. The repo is NOT empty, and starting over would be expensive.** `~/Desktop/name_tbd` holds a
complete, tested implementation of the previous spec: 229 passing tests, 15 migrations, eight Edge
Functions, both ingestion pipelines, 82,000 games loaded locally. A section-by-section audit against
this spec found roughly **55 to 60 percent of it survives by value**:

| Area | Survives |
|---|---|
| `packages/core` domain rules | ~95% |
| `ingest/` pipelines and fixtures | ~90% |
| `supabase/` migrations, functions, RLS tests | ~80-90% |
| `apps/mobile` data layer (`lib/`, `features/*/queries.ts`) | ~70% |
| `apps/mobile` presentation (`components/`, screens, `theme/`) | ~5% |

Sections 5, 6, 7 and 9 of this spec are near-identical to the old one. Elo parameters, the pledge
lock rules, the goal predicate grammar and the rooting rules already match verbatim. The on-demand
detail model is largely built: `games.detail_ingested_at` and `games_needing_detail()` already
exist and are the ancestor of `detail_queue`. The single hardest asset to rebuild is
`packages/core/src/matcher.ts` with its 30-fixture test suite, which this spec still demands
unchanged in 7.4.

The presentation layer genuinely is a from-scratch rebuild, and that is M0.5. But "from an empty
repo" would also discard the backend. **Decide explicitly and say which in the prompt:** start
clean, or keep the server and domain layers and rebuild the UI on top.

**2. Three referenced files do not exist anywhere.** The prompt tells you to read all of them.
- `design/FIGMA_NOTES.md` — must be written; only Dean knows the Figma history it describes.
- `design/figma/passport-games-pick-side.png` — must be exported from Figma.
- `docs/data-sources.md` — named only in this prompt, never in `SPEC.md`. The existing repo already
  records every VERIFY finding in `docs/verification.md`. Pick one path and use it consistently.

Two files exist but are in the wrong place: `reference.html` and `ACCOUNTS.md` sit at the root of
the `jinx-docs` bundle and need to move to `design/reference.html` and `docs/ACCOUNTS.md`.

**3. Access check results.** Passing: Xcode 26.6 with four iPhone simulators, Docker, GitHub CLI,
Supabase CLI, the project link to `vekdufflzklfxljqufbq`, the local Supabase stack, `eas whoami`,
and a populated `.env`. Failing or needs attention:
- `ANTHROPIC_API_KEY` is **not** set as a Supabase function secret, though the prompt says it is.
- App Store Connect `ascAppId` is still `TODO`.
- Node is v25.9.0, a current release, not LTS. Expo targets LTS.
- `eas credentials -p ios` was not run because it is interactive; the Apple team `625VS6JANJ`
  connection is therefore unverified.

**4. Three statements below do not match reality.**
- The repo `deanyao6/Jinx` is **public**, not private as `docs/ACCOUNTS.md` says.
- The EAS project is `appname-monorepo` under the personal `deanyao` account, not under the
  `jinx-fan-passport` organization, and its bundle ID is `com.deanyao.appname`.
- The hosted Supabase project is linked but empty: 0 of 15 migrations applied, no function secrets.
  Its GitHub Actions secrets are set, so the two scheduled workflows will run and fail nightly until
  a schema is pushed.

**5. Missing dependencies** for the work described below: `react-native-svg`, Playwright, and
pixelmatch. `expo-font` and `react-native-reanimated` are already installed.

**6. Scope worth pricing before you start.** `design/reference.html` defines team color tokens for
14 teams (`.t-phi`, `.t-nym`, `.t-lad`, `.t-sf`, `.t-chc`, `.t-bos`, `.t-sd`, `.t-nyg`, `.t-phl`,
`.t-chi`, `.t-gb`, `.t-lar`, `.t-lv`, `.t-none`). "Every MLB and NFL team" means hand-tuning about
60 more four-value palettes, each with a dark-mode variant.

---

You're building **Jinx**, an iOS app for sports fans, from an empty repo. These files define it:

1. `SPEC.md`: the product and engineering spec (stack, data, domain rules, milestones). Read all of it before doing anything.
2. `design/reference.html`: the visual specification for every screen. Open it in a browser and read its CSS and JavaScript. It contains seven phone screens, slide-over panels, an icon sprite, and generators for stamp seals, stadium shapes, thumbnails, and avatars.
3. `docs/ACCOUNTS.md`: every external account (Apple Developer, App Store Connect, Supabase, Expo, GitHub, Anthropic), the identifiers you need, how each is connected, the access check to run, and safety rules. Read it before touching any account.
4. `design/FIGMA_NOTES.md`: explains that Passport, Pick a side, and Games were recreated from a Figma design, and why the reference differs from the original Figma frames. Build from the reference, never from the PNG.

## The non-negotiable goal

The app's UI must match `design/reference.html` one to one: same layout, spacing, sizes, radii, colors in light and dark mode, typography, icons, copy, sample content (in demo mode), and interactions. Treat the reference like a pixel-perfect design file. Where `SPEC.md` and the reference disagree on anything visual, the reference wins. Do not "improve", modernize, or reinterpret the design. If something can't be reproduced natively or looks like a mistake, stop and ask me before deviating.

The reference currently has two visual styles: Passport, Pick a side, and Games use the newer Figma-derived style (classes prefixed `fx-`), while Relive, Game day, Stadium guide, Profile, and Friends still use the earlier style. Build each exactly as shown. I'll update the older screens in the reference later, and you'll restyle them then. Any new screen that isn't in the reference (onboarding, settings, and so on) should use the `fx-` components.

Not part of the app: the phone frames, fake status bar rows (use the real iOS status bar and safe areas), the page title and intro text, the captions under each phone, and the page-level System/Light/Dark toggle (in the app, theme follows the system with an override in Settings).

## Accounts and access

These are already set up, and you are expected to use them:
- **Apple Developer Program** (team `625VS6JANJ`) with the bundle ID `com.deanyao.jinx` registered (Sign in with Apple and Push Notifications enabled) and an App Store Connect app record named "Jinx Sports Passport".
- **Supabase** project "Jinx: Sports Passport" (ref `vekdufflzklfxljqufbq`, us-east-2) in its own free organization, connected to GitHub.
- **Expo** organization "Jinx" for EAS Build, credentials, and Submit.
- **GitHub** repo `deanyao6/Jinx` (currently public; make it private before relying on that).
- **Anthropic API** key dedicated to Jinx. Not yet stored as a Supabase function secret; ask me to set it.
- Not set up yet: Resend and a domain. Build email features behind flags as the spec says.

You reach these through the CLIs on this machine (`gh`, `supabase`, `eas`, `xcrun`), not through the web dashboards. Logins that need a password, browser, or 2FA are done by me; tell me the exact command and I'll run it.

**Your very first task, before planning:** run the access check in `docs/ACCOUNTS.md` and show me a pass/fail table. For anything that fails, tell me which setup step to do, wait for me, and re-run that check. Don't start planning until everything in the check passes or I tell you to skip an item. Follow the safety rules in that file at all times, especially: never touch anything belonging to SalusLink, which shares the same Apple Developer team and GitHub account.

## How to work

**Start in planning.** After the access check passes, and before writing code, give me a plan for M0 and M0.5 from `SPEC.md` Section 12: repo layout, packages, how you'll port tokens, fonts, and SVG, how the parity harness will work, what you are keeping from the existing implementation and what you are replacing, and anything in the spec or reference you find ambiguous. Wait for my approval.

Then work milestone by milestone in this order: M0, M0.5, M1, M2, and onward. At the end of each milestone: all tests pass, update the README, commit with a clear message, summarize what was built and what's left, and wait for me before starting the next milestone.

## Stack (from SPEC Section 3)

Expo (latest stable SDK) with expo-router, TypeScript strict, TanStack Query, Supabase (Postgres with RLS, Auth, Storage, Edge Functions in Deno, pg_cron), react-native-svg, react-native-reanimated for motion, expo-font, EAS Build and Submit to TestFlight. The bundle ID is `com.deanyao.jinx`, and the Expo project belongs to my **Jinx** organization (details in `docs/ACCOUNTS.md`). Sign in with Apple is the only sign-in method for now. Keep it simple.

## Porting the design exactly

**Tokens.** Extract every color, radius, size, spacing value, and font setting from the reference CSS into a typed theme module. Copy values verbatim; never eyeball them. This includes:
- Base tokens (`--bg`, `--scr`, `--canvas`, `--card`, `--surface`, `--ink`, `--muted`, `--line`, `--link`, `--good`, `--bad`, `--warn`) for light and dark.
- Team tokens per `.t-*` class: `--tf` (fill, same in both themes), `--t` (accent, with a dark-mode value), `--t2` (secondary), `--on`. Include `.t-none`. Add hand-tuned values for every MLB and NFL team following the same pattern.
- A `TeamTheme` provider so any subtree can take on a team, mirroring how `.t-*` classes cascade.

**Units.** Treat 1 CSS px as 1 point. The reference screen content is 318pt wide; real iPhones are wider, so layouts should stretch the way the CSS does (flex, grids, percentages), not scale.

**Fonts.** The reference uses Archivo with the variable `wdth` axis (62 to 100) and weights 300 to 900. React Native doesn't reliably support variable axes, so use fontTools (`varLib.instancer`) to generate static TTF instances for every width and weight combination the CSS actually uses, register them with expo-font, and expose typography helpers such as `{ weight: 900, width: 62 }`. Archivo is under the SIL Open Font License, which allows bundling.

**SVG.** Port the icon sprite to typed React components with paths copied exactly (24×24 viewBox, stroke 1.9, round caps and joins, currentColor). Port `SHAPES`, `seal()`, `thumb()`, `stamp()`, the circular team badges (`.fx-bd`, also used on the Relive scorebug), the avatar generator, the photo placeholders, and the win probability chart to react-native-svg with identical geometry, including TextPath labels and gradients. No emojis and no icon libraries.

**CSS features without native equivalents** (for example `filter: blur()` on the hero glow, the hero grid texture, `color-mix()`, box shadows): use the closest native equivalent and record each substitution in `design/PORTING_NOTES.md`.

**Interactions to reproduce exactly (read the reference JS):**
- Passport team pills filter the whole screen: hero text, glow color, record cards, stamps, and superlatives.
- Record cards open the game log slide-over (320ms, `cubic-bezier(.2,.8,.2,1)`), with the header in that record's team color.
- Pick a side: countdown in the lock pill; tapping a root button selects it (check icon and ring), dims the other, and shows the confirmation row with the vs-expected gain; buttons disable at lock.
- Relive: play and pause, steps every 1.7s, score, period label, story text, the win probability line drawn up to the current step with a dot, restart after the final step.
- Stadium guide segments switch lists.
- Profile's Friends row opens the Friends slide-over; back closes it.
- Live indicator dots pulse (1.6s). Respect Reduce Motion for all animation.

## Demo mode

Implement `SPEC.md` Section 8.9: a `DEMO=1` flag that loads fixtures reproducing every piece of sample data in the reference exactly. All screens read data through repository interfaces so demo fixtures and Supabase are interchangeable without touching UI code. The Plan and Stadium guide screens are shells behind feature flags that show demo data in v1.

## Visual parity harness (build this in M0.5)

Build a repeatable way to prove the app matches the reference:

1. **Reference screenshots.** A Playwright script opens `design/reference.html` and, for each screen and state (each passport pill, an open game log, a picked side, Relive mid-story, each guide tab, the open Friends panel), isolates that screen's `.scr` content, sizes it to the simulator's point width (iPhone 16: 393×852) while keeping the CSS layout rules, removes the fake status row, sets light or dark with the `data-theme` attribute, waits for fonts to load, and saves a screenshot at device pixel ratio 3.
2. **App screenshots.** A script boots the iOS Simulator (iPhone 16), launches the app in demo mode with deep links for each screen and state, forces appearance with `xcrun simctl ui booted appearance`, captures with `xcrun simctl io booted screenshot`, and crops out the real status bar.
3. **Diff.** Compare pairs with pixelmatch, write diff images and side-by-side contact sheets to `design/parity/`, and print a mismatch percentage per screen and theme.
4. **Iterate** until differences are limited to unavoidable native rendering (font antialiasing, status bar), then show me the contact sheets. Never declare a screen done from code review alone.

## Guardrails

- Follow `SPEC.md` for everything functional. When a data source detail is marked VERIFY, confirm it against the live source before building on it, and record what you found in `docs/data-sources.md`.
- Keep secrets out of the app bundle. The Anthropic API key and Supabase service role key live only in Edge Function and CI secrets. I'll put local values in gitignored `.env` files; don't ask me to paste secrets into chat.
- No team or league logos, wordmarks, or marks. Use the circular initials badges exactly as in the reference.
- Every RLS policy gets a test. Domain rules in SPEC Section 6 are pure functions with unit tests covering every edge case listed there.
- Don't add features, screens, dependencies, or design changes that aren't in the spec or reference without asking.
- If you get stuck, find a conflict, or need a decision, stop and ask me with a short list of options and your recommendation.
