# The sub page style

Every screen outside `design/reference.html` follows this, so the whole app reads as one design.
The reference screens (Passport, Games, Pick a side, Relive, Plan, Guide, Profile, Friends, the
record game log) are the source; this is what they imply for everything else. Dean asked for it on
2026-09-17: one style on every page, much more team colour, far fewer outlines, better type ratios.

## The rules

1. **Colour comes from a team, and there is always one in scope.** `useTheme().accent` is the
   person's own team by default (`features/teams/AccentRoot.tsx`). A screen or a card that is about
   one game or one team wraps itself in `<TeamTheme team={teamId}>` and everything inside takes that
   side's colours. Never hardcode a team hex; never use ink where the accent belongs.
   - `accent.fill` / `accent.onFill`: the one primary button, a selected chip or segment, a hero.
   - `accent.text`: links, small marks, icons, kickers, the number that matters.
   - `accent.wash`: the background of an icon tile, a highlighted card, a secondary button.
   - `accent.second`: a ring, the far end of a gradient, a thin accent rule.
   - `colors.green` / `colors.red` / `colors.gold` stay for state: win, loss or error, a warning.
2. **No outlines.** A card is a fill (`colors.card`) on the canvas (`colors.screen`); the contrast
   is the edge. No `borderWidth` on cards, rows, chips, buttons or inputs, and no hairline between
   rows: rows are set apart by their padding. The only lines allowed are a focus or error ring on
   an input, a checkbox's box, a dashed "ghost" shape for something not yet earned, and SVG art.
3. **Type has three voices.**
   - Condensed heavy (`variant="h1" | "section" | "stat" | "display"`, and `h2`): page titles,
     section headings, every number that is a score, a record or a count. Capitals for `h1` and
     `section` come from the variant; do not upper-case the string.
   - `kicker`: small spaced capitals above a title or a value, in `muted` or `accent`.
   - Archivo at normal width (`body`, `bodyStrong`, `sub`, `caption`, `label`): everything else.
   Use `<Text weight={750}>` for an in-between weight. Never set `fontFamily` or a system font.
   Ratios: a value is at least 1.6x its label; a card has one heading level, not three; body copy
   under a title is `sub` + `muted`, never the same size as the title.
4. **Spacing.** Screen padding is 16. Cards have 16 inside and 12 between. Sections are 20 to 24
   apart, headed by `<SectionHeader>`. Nothing sits closer than 8 to anything else. No dead bands:
   `Screen` already handles the navigator header, so never add a top inset or a spacer yourself.
5. **One primary action per screen**, solid in the team colour. Everything else is `secondary`
   (washed), `ghost` (text) or `danger`. Do not show the same action twice.
6. **Icons are the reference set** (`components/reference/icons.tsx`, 36 of them), usually on an
   `<IconTile>`. No emojis, ever. No Ionicons in new code; replace one when you touch it if the
   reference set has an equivalent.
7. **Both sports, every time.** Jinx is MLB and NFL now and more later. Copy says "stadium" and
   "game", not "ballpark" and "innings", unless the thing on screen is known to be baseball. Pick
   the word from the sport (`sport_id`) when it matters.
8. **Copy:** never an em dash. En dashes in scores and records (`31–17`) stay. Sentence case in
   body copy and buttons.
9. **Dark and light both have to work.** Every colour comes from the theme, so check that nothing
   is hardcoded white or black outside a region pinned to one scheme.
10. **Do not change behaviour.** Queries, mutations, navigation, accessibility labels and testIDs
    stay as they are. This is a restyle.

## The kit

| Component | Use it for |
|---|---|
| `Screen`, `FormScreen` | Every screen. Canvas background, correct top inset |
| `PageIntro` | Kicker + condensed title + one line of help, at the top of a page |
| `SectionHeader` | A section heading, with an optional action on the right |
| `Card` (`tone="plain" \| "accent" \| "solid"`) | Grouping. `accent` for the card that matters most, `solid` for a hero |
| `StatTile` | A label over a condensed number. Put two or three in a row with `gap: 10` |
| `ProgressBar` | Goal and bucket list progress. `done` turns it green |
| `Row` (`icon`, `chevron`) | Settings-style and list rows. Give navigation rows an `icon` |
| `IconTile` | An icon on a washed tile |
| `Button`, `Chip`, `Segmented`, `TextField`, `CheckRow` | As named. All already borderless and accent-aware |
| `EmptyState` (`icon`) | Nothing here yet: tile, condensed title, one line, one action |
| `Notice` | Inline info, success, error |
| `PersonAvatar` (`ring`) | Every real person, everywhere: their photo, or a generated default that is theirs (initials on a colour from their id). `ring` rings it in the team in scope. The reference `Avatar` below is demo fixture art only |
| `components/reference/*` | `Seal` for a stadium stamp, `Avatar`, `GameThumb`, `StadiumShape`, `LiveDot`, `TightText`. Reuse these rather than drawing a second version |
| `features/passport/seals` `VenueSeal` | A real stadium's stamp: `Seal` in the colours of the team that plays there (a favourite first, slate for a closed park), worn by visits and gold after a rare game (`features/eggs/flags.ts`). Use it wherever a seal comes from real data; plain `Seal` with `metal="brass" \| "silver"` is for demo mode and the reference |
| `theme/color.ts` `alpha()` | A tint of any theme colour |

## What good looks like

- A page about a game opens on a scoreboard in the two teams' colours, not a grey box.
- A list page opens on a number: "12 of 30", "3 stadiums", with a bar or tiles in the team colour.
- A settings page is one or two cards of icon rows, no rules between them.
- An empty page has a tile, five words, and a button.
