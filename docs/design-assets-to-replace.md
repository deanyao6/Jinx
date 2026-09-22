# Every drawn asset in Jinx, and who drew it

Written 2026-09-17 for Dean, to take to Figma or an image model. Every item here was drawn by
Claude or shipped by the Expo template. None of it came from a designer. The one exception is
noted: three screens in `design/reference.html` were recreated from Dean's own Figma layout, but
the drawing inside them (icons, seals, shapes, avatars) is still invented.

Format per item: what it is, where it lives, what a replacement has to be to drop in.

---

## 1. The app icon set. Still the Expo default

**This is the most visible one.** `apps/mobile/assets/images/icon.png` is the blue Expo starter
icon with a white chevron. It has never been touched. It is what shows on the home screen, in
TestFlight and in the App Store listing.

| File | Size | State |
|---|---|---|
| `icon.png` | 1024x1024 | Expo default (blue, white chevron) |
| `splash-icon.png` | 228x213 | Blank white. The splash is a white screen with nothing on it |
| `favicon.png` | 48x48 | Expo default |
| `android-icon-foreground.png` | 512x512 | Expo default |
| `android-icon-background.png` | 512x512 | Expo default |
| `android-icon-monochrome.png` | 432x432 | Expo default |

Needed: a real Jinx mark. It has to work at 1024 and at 48, on light and dark, with no team or
league marks (App Store rule, SPEC 1 non-goals). The splash wants the same mark on the app's
background colour, not a blank page. Android needs the foreground and background split.

There is no logo mark anywhere in the app today: the wordmark is the word JINX set in Archivo
condensed heavy. If you want a symbol, this is the place it starts.

---

## 2. The 36-icon UI set

`design/reference.html` holds an SVG sprite; `scripts/design/build-icons.mjs` turns it into
`apps/mobile/src/components/reference/icons.tsx`. Every icon in the app comes from here. All 36
were drawn by Claude in the reference file.

Style contract, which a replacement must match exactly: 24x24 viewBox, 1.9 stroke, round caps
and joins, `currentColor`, no fills.

```
i-passport  i-ticket  i-route   i-user    i-search  i-share
i-bell      i-verified i-lock   i-chev-r  i-chev-l  i-car
i-grill     i-gate    i-flag    i-food    i-door    i-seat
i-thermo    i-clock   i-bolt    i-trend   i-eye     i-users
i-target    i-map     i-spark   i-gear    i-swords  i-ext
i-camera    i-news    i-speaker i-book    i-check-c i-plus
```

Known gaps the code works around: no cross (Wrapped rotates `i-plus` 45 degrees), no down
chevron (rotates `i-chev-r`), no minus (draws a bar), no cat, no basketball. Worth adding.

To replace: edit the sprite in `design/reference.html`, then `npm run build:design`.

---

## 3. Stadium shapes (7, and the NBA needs an 8th)

`apps/mobile/src/components/reference/shapes.ts`, generated from the reference. Stylized
footprints in a 64x64 viewBox, drawn inside seals, game thumbnails and the map.

| Key | Meant to be |
|---|---|
| `ballparkA` | Generic ballpark (the MLB default) |
| `dodger` | Dodger Stadium |
| `wrigley` | Wrigley Field |
| `oracle` | Oracle Park |
| `bowl` | Generic football bowl (the NFL default) |
| `canopy` | A canopied stadium |
| `colonnade` | A colonnaded stadium |

They are placeholders by design (SPEC 8.5): the plan was always to trace real OpenStreetMap
footprints later into the `venue_shapes` table. Two routes: draw better stylized ones, or trace
the real outlines. An `arena` shape is needed before the NBA lands.

---

## 4. The stamp seal, and its four states

`apps/mobile/src/components/reference/Seal.tsx` plus `sealColors.ts` and `sealWear.ts`. The
engraved circular stamp that is the heart of the Passport: an outer dashed ring, a metal disc
with a gradient, the venue name curved around the inside on a text path, a stadium shape in the
middle, a year.

States, all drawn by Claude:

- **Metal**: brass, silver, gold (`palettes.ts` `METAL`, three colours each).
- **Team tint**: the disc in the home team's colours, with a deepened body for bright fills.
- **Wear** (easter egg): crisp, lightly worn at 5 visits, heavily over-inked at 10 or more, with
  a double-struck ring, ink blots and specks, seeded by venue id.
- **Gold foil** (easter egg): a diagonal sheen band, animated unless Reduce Motion is on.
- **Ghost** (`features/bucketlists/ui/GhostSeal.tsx`): a dashed ring with a faint outline, for a
  venue not yet visited.

This is the app's signature object. If one thing gets real design attention, this is it.

---

## 5. Avatars

Two separate systems, both invented:

- **The demo faces** (`components/reference/Avatar.tsx`): six flat portraits, 40x40, three
  colours each (skin, hair, background) from `palettes.ts` `AVATARS`. Used only in demo mode and
  the visual parity harness, so `npm run parity` depends on them staying as they are.
- **The real generated avatar** (`components/PersonAvatar.tsx`): initials on a flat fill picked
  deterministically from the person's id out of `AVATAR_HUES`, with the text colour chosen by
  contrast. This is what every real user without a photo sees.

Needed: a better default avatar system. The initials work but are plain.

---

## 6. Team badge

`apps/mobile/src/features/games/ui/TeamBadge.tsx`, plus pixel-matched copies inside Pick a side
and Relive. A circle in the team's fill, a ring in its second colour, the abbreviation in
condensed heavy type. No logos, ever (trademark, SPEC 1). This is the stand-in for team logos
across the whole app.

---

## 7. Easter egg art

- **The black cat** (`features/eggs/JinxBadge.tsx`): a seated cat seen from behind, tail curled,
  drawn in the icon set's geometry. Sits on a pale chip as a badge on a companion's avatar. This
  is the app's namesake image and deserves a real drawing.
- **Confetti pieces** (`features/eggs/pieces.tsx`): peanut (two lobes, a waist, shell dimples),
  a striped snack box deliberately blank of lettering, a baseball, and for the NFL a football, a
  whistle and a sideline yard marker.
- **Mirror shards** (`features/eggs/CurseShatter.tsx`): 8 to 14 polygons generated deterministically,
  that crack, hold, then fall.
- **Rally cap**: no art, a transform on the wordmark.

---

## 8. Photo placeholders

`components/reference/PhotoScene.tsx`: three fake photos for Relive in demo mode, drawn in SVG
(a selfie with two of the demo faces, a field view, a scoreboard). `PHOTO_SKIES` gives three sky
colours. Demo only, but they appear in every parity screenshot.

---

## 9. Smaller drawn things

| What | Where |
|---|---|
| Game row thumbnail (a stadium shape on a team-coloured tile) | `components/reference/GameThumb.tsx` |
| Hero glow (a blurred disc of team colour behind the record) | `features/passport/reference/parts.tsx` |
| Win probability chart (polyline, dot, baseline) | `features/relive/reference/ReliveScreen.tsx` |
| Wrapped card backdrops (gradient, team glow, stadium watermark) | `features/wrapped/ui/story.tsx` |
| Welcome screen wall (rebuilt 2026-09-22 from `design/welcome-reference.html`): the cards behind the sign-in copy. The seals, the bolt and the stadium shapes are the items above; drawn only here are the two photo scenes (a field, a scoreboard, 120x84 SVG), the ticket stub, the companion avatar discs (flat colour) and the ghost stamp's two dashed rings. The six game cards are data, not art | `features/onboarding/ui/wall/` (`cards/PhotoCard.tsx`, `cards/StubCard.tsx`, `cards/SmallCards.tsx`) |
| Map pins (team-coloured discs sized by visit count, dashed ghosts for unvisited) | `app/passport/map.tsx`, `features/map/markers.ts` |
| Handshake waiting ring (a dashed rotating ring on an avatar) | `features/eggs/HandshakeAvatar.tsx` |
| Stadium guide hero shape | `features/guide/reference/StadiumGuideScreen.tsx` |
| Live dot (a pulsing red dot) | `components/reference/LiveDot.tsx` |

---

## 10. Colour, which is design work too

- **65 team palettes** in `seed/team_colors.json`: 13 copied verbatim from the reference, **52
  hand-tuned by Claude**. Four values per team per theme (fill, on-fill, accent, secondary). The
  52 are educated guesses at each team's colours with contrast fixes; a designer or a fan would
  improve them. `python3 seed/scripts/check_team_colors.py` enforces 4.5:1 contrast.
- **The base palette** (`apps/mobile/src/theme/reference/tokens.ts`): 12 colours per theme, taken
  verbatim from the reference file, which Claude wrote.
- **30 NBA palettes** will be needed and do not exist yet.

---

## 11. The share cards

Eight templates in `features/share/templates.tsx`, rendered at 360x640 and captured at 3x for
Instagram: record, game, pledge, stamp, companion, goal, wrapped, handshake. Composed from the
components above rather than drawn separately, so fixing the seal and the badge fixes these too.

---

## 12. Typography and the wordmark

Archivo, the reference's typeface, licensed under the OFL and bundled as 19 static instances in
`apps/mobile/assets/fonts/`. That is a real typeface, not invented. The JINX wordmark is just the
word set in Archivo at width 62, weight 900. There is no drawn logotype.

---

## What I would prioritise

1. **The app icon and splash.** They are the Expo default and ship to TestFlight looking like a
   starter project.
2. **The seal.** It is the Passport's signature object and appears on every stamp, bucket list,
   Wrapped card and share card.
3. **The black cat**, since the app is called Jinx.
4. **The 36 icons**, as a set, with the four missing ones added.
5. **The stadium shapes**, or a decision to trace real footprints.
6. **The 52 hand-tuned team palettes**, checked by someone who knows the teams.
