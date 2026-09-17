# Interaction spec: wiring the ported screens

The M0.5 port reproduced the reference's pixels. It did not reproduce its behaviour, because
the parity harness drives screens over a control channel rather than by touching them, so a
screen could score well while every control on it was dead.

Measured on 2026-09-16, across the seven ported screens and their two slide-over panels:

| | Count |
|---|---|
| Controls that look tappable | 50 |
| Have an `onPress` | 12 |
| Inert | 38 |
| Of those, rendered as a plain `View` or `Text`, so not even pressable | 35 |
| Controls that navigate anywhere | 1 (the tab bar) |
| Controls that write anything to the backend | 0 |

## Two of these are worse than inert

These change state, so they look like they worked, and then show you the same content. That is
a bug rather than an unbuilt feature, and it should be fixed first.

- **Games segments** (History / Upcoming / Imports). `setSegment` runs, but the list comes from
  `repo.games()` and ignores the segment, so all three tabs show identical rows.
- **Friends panel tabs** (With / Following / Rivals). Same shape: the tab state changes, the
  people list is not filtered by it.

A third case is cosmetically misleading: Profile's "2026 goals", "Map" and "2025 Wrapped" rows
are `Pressable` with `onPress={undefined}`. They render a chevron and take a press without
doing anything.

## The decision this depends on

Most of these controls should open a screen that **already exists and already works**. The app
has ~46 implemented routes behind the old design: game detail, the log sheet, check-in, imports,
stamps, the map, goals, bucket lists, Wrapped, the settings pages, friend profiles.

But SPEC.md 8.8 says screens not in the reference "must be composed only from the components and
tokens above ... so they look native to the same design". So there are two ways to proceed:

**A. Link now, restyle later.** Every control works today. Tapping one drops you from the new
design into the old one mid-flow. Fast, and the seam is obvious and temporary.

**B. Restyle each destination, then link it.** Visually coherent throughout, and each screen
lands finished. Much slower, and most controls stay dead in the meantime.

A hybrid is likely right: link everything now so the app is navigable and testable, then restyle
destinations in priority order, because a dead button teaches you nothing about whether the flow
is correct and a wrongly-styled one still does.

## Per-screen spec

Status key: **wired** works; **cosmetic** changes state but not content; **dead** does nothing.

### Passport

| Control | Now | Should do |
|---|---|---|
| Bell icon | dead | Open `/you/notifications` |
| Person icon | dead | Go to the Profile tab |
| Team pills | wired | Keep. Filters the screen |
| Hero "Last Game" row | dead | Open `/games/[gameId]` for that game |
| Record cards | wired | Keep. Opens the game log panel |
| "Stadium stamps" count link | dead | Open `/passport/stamps` |
| Stamp tiles | dead | Open `/passport/stamps` at that venue |
| Superlative rows | dead | Open `/passport/superlatives`, or the game/venue/player each names |

### Record game log panel

| Control | Now | Should do |
|---|---|---|
| Back chevron | wired | Keep |
| Share icon | dead | Open `/share/[template]` for that record |
| Log rows | dead | Open `/games/[gameId]` |
| "+N more" footer | dead | Page the list, or open filtered History |

### Games

| Control | Now | Should do |
|---|---|---|
| "+" button | dead | Offer log a game, log a season (`/games/bulk`), upload tickets (`/games/import`) |
| Search field | dead | Make it a real `TextInput` and filter the list |
| Segments | **cosmetic** | Filter the list: History, Upcoming, Imports (`/games/imports`) |
| Game rows | dead | Open `/games/[gameId]`; finished games with detail offer Relive |

### Pick a side

| Control | Now | Should do |
|---|---|---|
| Root buttons | wired, local only | Persist the pledge via the `make_pledge` RPC, honour the lock window |
| Storyline cards | dead | Stay inert. They are content, not controls |

### Relive

| Control | Now | Should do |
|---|---|---|
| Back chevron | dead | `router.back()`. There is currently no way out except the tab bar |
| Share icon | dead | Open `/share/[template]` |
| Play / pause | wired | Keep |
| "Add" link and camera tile | dead | Open the photo picker, upload to `attendance_photos` |
| Your photo tiles | dead | Open the photo, offer visibility and delete |
| Fan photo tiles | dead | Open the photo, offer report and block |
| "Official highlights" row | dead | Open the external link. It explicitly promises to |

### Game day

Every control is dead; the screen is a demo shell in v1 per SPEC.md 2. Minimum: the share icon
opens `/share/[template]`. The ticket card, companions and timeline stay inert until the planner
is real.

### Stadium guide

| Control | Now | Should do |
|---|---|---|
| Back chevron | dead | `router.back()` |
| Share icon | dead | Open `/share/[template]` |
| Category tabs | wired | Keep. Genuinely refilters |
| Venue hero, guide rows | dead | Stay inert while the guide is a demo shell |

### Profile

| Control | Now | Should do |
|---|---|---|
| Gear icon | dead | Open a settings index over `/you/*`. **Settings is currently unreachable** |
| Profile photo | dead | Open `/you/edit-profile` |
| Team chips | dead | Filter the Passport by that team, or open the team |
| Games / Stadiums stats | dead | Open History and `/passport/stamps` |
| Followers / Following | dead | Open the follower and following lists |
| Friends row | wired | Keep |
| Goals row | **dead, looks pressable** | Open `/passport/goals` |
| Map row | **dead, looks pressable** | Open `/passport/map` |
| Wrapped row | **dead, looks pressable** | Open `/wrapped/[sport]/[season]` |

### Friends panel

| Control | Now | Should do |
|---|---|---|
| Back chevron | wired | Keep |
| Search icon | dead | Open `/friends/find` |
| Tabs | **cosmetic** | Filter the list: With, Following, Rivals |
| Friend rows | dead | Open `/friends/person/[id]` |
| Rivalry and overlap cards | dead | Open that person |

## Suggested order

1. **The three lies.** Games segments, Friends tabs, and the three Profile rows that take a press
   and do nothing. These actively mislead.
2. **Escape hatches.** Relive and Stadium guide have dead back buttons, and settings is
   unreachable from anywhere. Right now you can get stuck.
3. **The spine.** Game rows, log rows and the Last Game row all open game detail. That one
   destination unlocks the most.
4. **Passport depth.** Stamps, superlatives, notifications.
5. **Profile depth.** Goals, map, Wrapped, followers, edit profile.
6. **Writes.** The pledge from Pick a side, photo upload from Relive. These need care: they are
   the first controls that change data rather than read it.
7. **Share.** Four share icons, one destination.

## Testing

Parity cannot catch any of this, by construction. Every control above needs a test that presses
it and asserts the navigation or the state change, in the style of
`features/*/reference/__tests__/interactions.test.tsx`. The tab bar test added when the screens
were wired is the pattern: render the real screen, press by accessibility label, assert the route.

## Update, 2026-09-16: Relive's entry point

"Finished games with detail offer Relive" (Games rows, above) was the one row in this
document that nothing satisfied, and the gap was bigger than a missing link:

1. **Nothing in the app routed to `/relive/[gameId]`.** The route existed; no screen pushed
   to it. Game detail now does, as a card, and only when the game has story steps — so the
   link never opens onto the empty state.
2. **The route dropped its own parameter.** `relive/[gameId].tsx` rendered `<ReliveScreen />`
   with no id, and the screen read `relive()` off the repository, which holds the signed-in
   user's aggregate data and takes no game id. Every real user therefore saw "nothing to
   relive" on every game. `useReliveGame(gameId)` is the missing half.
3. **NFL games had no story to show.** `ingest/src/nfl/relive.ts` and the `home_wp` column it
   needs are new; see docs/verification.md.

`/guide/[venueId]` had the same problem — a route with no inbound link — and game detail now
links to it from the venue as well.

Still open on this screen: photo upload (`attendance_photos` has no writer), the fan photo
strip, and the per-game highlight URL, all unchanged from the table above.

## Update, 2026-09-16: Favorites

Favourite teams lived inside Edit profile, as a 62-row checklist beside your name and handle.
They are not a profile field: they decide what the passport counts, which pills appear, and
which games are yours. They now have their own place, with players beside them.

`Settings > Favorites`, two tabs:

| Screen | Route | What it does |
|---|---|---|
| Favorites | `/settings/favorites` | Teams and Players tabs. Lists what you have; a row removes |
| League | `/settings/favorites/league?mode=` | Step one of both pickers |
| Teams | `/settings/favorites/teams?sport=` | Step two for teams. Tapping favourites immediately |
| Teams (for players) | `/settings/favorites/players?sport=` | Step two for players. Drills in, favourites nothing |
| Roster | `/settings/favorites/roster?teamId=` | Step three. Tapping favourites the player |

Three things worth knowing:

- **The picker drills down rather than listing everything.** League, then team, then player.
  The old one put all 62 teams behind a search box, which does not survive a third league.
- **A team has no roster in the schema**, because a player moves and the truth is per game.
  `team_roster` derives one from `game_appearances`, so the list is everyone who has ever
  appeared for that team — the right set for an app about who you have SEEN.
- **`seen_by_you` is the payoff.** The roster says "Seen 4 times" where it can, and only falls
  back to a database-wide count when you have not seen that player. The first draft said
  "5 games recorded", which reads as a claim about you and is not one.

Edit profile keeps name, handle and home city, and links here.

### Favorite players on the Passport (2026-09-17)

A section between Stadium stamps and Fan superlatives, not in the reference. It follows the team
pill like the rest of the screen:

- **All teams** lists every favourite: "Seen 9 times" with a "Last" date chip, and "Not seen yet"
  for one you have never seen. A traded player's games add up across teams.
- **A team pill** lists only favourites you have seen play *for that team*, counted for that team.
  The section disappears when there are none.
- A row opens the last game you saw that player in; an unseen one opens Settings > Favorites.
  "Edit" opens the Players tab there.
- Data: `favorite_players_seen()` (scoped to the caller), shaped by `features/players/passport.ts`.
  Demo mode draws no section, so the parity screenshots are unchanged.
