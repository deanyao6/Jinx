# Read this before any of the four social prompts

Written 2026-09-23, after checking all four briefs and `design/prototype.html` against the repo
as it actually stands. The briefs were written from the prototype, which is a clean sheet; the
repo is not. **Everything below was verified by reading the code or querying the database**, not
inferred. Where a brief and this file disagree, this file wins unless Dean says otherwise.

All four prompts run on branch **`social-v2`**, never on `main`. Dean merges when he is happy.

---

## 1. Things the briefs do not know exist

| The brief assumes | The repo already has |
|---|---|
| No feed yet ("prompt 1 ships no feed") | `feed_events(id, actor_user_id, type, game_id, payload, visibility, created_at)` and a working feed: `features/social/` with `FeedEventCard`, `FeedSegment`, `queries.ts`, plus a Feed segment inside `(tabs)/legacy-friends.tsx` |
| `reactions` is a new table for BeReal capture | **`reactions` already exists and means something else**: `(feed_event_id, user_id, emoji, created_at)`, emoji reactions on feed events, used by `features/social/copy.ts`, `queries.ts`, `FeedEventCard.tsx` and a test |
| Plan is a coming-soon screen | Plan is **a real, shipped feature**: `features/plan/gameDay.ts`, `features/plan/reference/`, `__tests__/gameDay.test.ts`, routed at `(tabs)/plan.tsx` |
| Check-in is a session to be built | `checkins(id, user_id, game_id, checked_in_at, distance_m, accuracy_m)` exists as a **moment**, with geofence logic, and Pick a side already locks against it |
| Companions are users you can ask for consent | `attendance_companions(attendance_id, person_id)` points at `people(id, owner_user_id, display_name, linked_user_id, invite_token, created_at)`. **A companion is often not a user at all**, just a name you typed |
| Badges are new | `goals` plus the predicate evaluator (SPEC 6.13) already do table-driven criteria, and eight easter eggs live in `features/eggs/flags.ts` |
| Two sports, MLB and NFL (soccer mentioned once) | **Four sports**: MLB, NFL, NBA, MLS. Every rule in the repo is keyed by `sport_id` |
| `docs/MODERATION.md` is to be created | `docs/moderation.md` exists (lowercase) and is linked from CLAUDE.md |

Also present and relevant: `blocks`, `reports`, `follows`, `profiles`, `handshakes`, `player_firsts`,
`franchise_players`, `player_honors`, `team_rosters`, `game_win_prob`, `welcome_wall_cards`.
`mutes` does **not** exist.

---

## 2. Hard conflicts, already ruled

### R1. Do not buy a data feed (prompt 3, section 3.2)

The brief proposes "a budget scores API (roughly $19 to $39 a month)" for live NFL. This breaks a
standing ground rule in CLAUDE.md: **"$0 data sources"**, repeated in `docs/prompts/next-wave.md`
as "$0 data. No paid feeds."

It is also unnecessary. On 2026-09-22 Dean amended the rules so **the app may read free public
live feeds directly**, and `apps/mobile/src/features/live/feeds.ts` already does it for the NBA
(cdn.nba.com) and MLS (ESPN), keyless, polled only while a fan is checked in, never writing to
the database. ESPN publishes a free NFL scoreboard on the same host and shape.

**Ruling:** extend `features/live/feeds.ts` with an NFL feed reading ESPN's free scoreboard.
Verify the endpoint and its fields from a device build (there is a probe pattern at
`features/live/Probe.tsx` and evidence in `docs/evidence/live/`), and record the findings in
`docs/verification.md`. The rest of prompt 3 section 3 stands: conservative live gating, then
the overnight nflverse relabel.

### R2. The `reactions` name collision

Two different features cannot own one table name.

**Ruling:** rename the existing emoji table to **`feed_reactions`** (blast radius is four files in
`features/social/` plus its migration), and let the new BeReal capture own `reactions`, because
every brief, the prototype and the product language use "reaction" for the photo. Do the rename
in prompt 1's migration, with `npm run db:types` after, so prompts 2 and 3 never see the old name.

### R3. Four sports, not two

Every list in the briefs that names MLB and NFL must cover NBA and MLS as well, keyed by
`sport_id`, the way the rest of the repo is:

- Prompt 3's scheduled reaction window needs an NBA rule (recommended: from the start of the 4th
  quarter) alongside MLB, NFL and the existing soccer rule, and MLS's is the soccer one.
- Prompt 3's event whitelist needs NBA and MLS entries (recommended NBA: a go-ahead score inside
  the final 2 minutes, a 4-point play, a buzzer-beater to end a period, a 15-0 run; MLS: a goal
  in the 85th minute or later, a red card, a penalty, a hat trick, a shootout).
- Prompt 4's communities are "one per MLB and NFL team": make it one per team in all four
  sports, and the leaderboard stat list needs NBA and MLS stats (recommended: three-pointers
  seen and 30-point games for the NBA, goals seen and clean sheets for MLS).
- Prompt 4's badge set should include at least a few NBA and MLS badges.

### R4. Check-in: extend, do not fork

`checkins` already exists as a moment and Pick a side reads it. A parallel `checkin_sessions`
table would make two sources of truth for "is this fan at the game".

**Ruling:** extend `checkins` into a session (add `ended_at`, `end_reason`, `attendance_id`,
`visibility`, and rename `checked_in_at` to `started_at` in the same migration), and keep the
table name. Update Pick a side's lock and the eggs' `liveFeed` checks to read the extended row.
If the session turns out to need a separate lifecycle from the geofence proof, say so in the
report before forking it.

### R5. Companion consent only applies to real users

`attendance_companions.person_id` points at `people`, whose `linked_user_id` is nullable. Tagging
"Dad" when Dad has no account is a private label on your own attendance and **must keep working
exactly as it does now, with no consent step and no notification**.

**Ruling:** the `status` column defaults to `confirmed` for a person with no `linked_user_id`,
and to `pending` only when `linked_user_id` is set. Everything in prompt 2 section 7 (notify,
accept, decline, silent block on re-tagging) applies to the linked case alone. The acceptance
tests must cover both.

### R6. Small corrections

- The prototype's Plan screen shows `hello@jinx.app`. **We do not own that domain.** Use an
  address on `jinxsports.fans`. Note that `support@example.com` is still a placeholder in the
  app and is on Dean's list, so do not invent a second one; ask him for the real address.
- Use the existing `docs/moderation.md`, do not create `docs/MODERATION.md`.
- Badges must reuse the goals predicate evaluator (SPEC 6.13), and the eight existing easter eggs
  in `features/eggs/flags.ts` become `is_secret` badges rather than a parallel mechanic.
- `mutes` is genuinely new. `blocks` and `reports` are not: extend them.

---

## 3. Open questions, Dean must answer before the affected work starts

These are not blocked on the other parts, so start everything else and come back.

### Q1. Does Plan really become a "coming soon" screen? (prompt 1, section 1)

Plan is built and tested today. The brief would replace it with a placeholder, which deletes
working code and would be visible to anyone on TestFlight as a feature disappearing.

**Recommendation: keep the existing Plan.** The prototype predates it, or Dean decided it is not
good enough. If he does want it hidden, hide it behind `FEATURE_PLAN=false` rather than deleting
the code, so nothing is lost.

### Q2. Do the routes get renamed? (prompt 1, section 2)

The brief's map and the repo's routes differ:

| Brief | Repo today |
|---|---|
| `/game/[gameId]` | `/games/[gameId]` |
| `/user/[handle]` | `/u/[handle]` |
| `/profile/settings` | `/settings` and `/you/*` |
| `/game/[gameId]/relive` | `/relive/[gameId]` |
| `/passport/badges` etc. | `/passport`, `/friends`, `/wrapped`, `/guide`, `/invite`, `/share` |

Renaming breaks every share link and push notification already delivered to builds 4 and 5, and
the reachability test plus the parity harness both key on the current paths.

**Recommendation: keep the existing paths, add only genuinely new ones** (`/feed`, `/post/...`,
`/communities`, `/community/...`, `/react/...`). If Dean wants the tidier names, add redirects
from the old paths and keep them forever; do not break a link that is already in the wild.

---

## 4. Native builds, because three of these cannot ship over the air

`expo-updates` was wired up on 2026-09-23 with the fingerprint runtime policy, so JS-only changes
ship with `eas update`. **None of the following are JS-only:**

- **`expo-camera`** is not installed and reactions need it (prompt 3).
- **`expo-contacts`** is not installed and the contacts import needs it (prompt 2, section 5).
- **Live Activity** (prompt 3, section 1) has no Expo module. It needs ActivityKit through a
  custom native module or a third-party dev-client library, plus an entitlement. This is the
  single largest native lift in the four briefs. **Treat it as optional for v1**: the session
  screen works without it. If it is cut, say so in the report rather than faking it.
- New permission strings for camera and contacts in `app.json` `infoPlist`.

So: prompts 2 and 3 each end with a native build, and the fingerprint policy will correctly
refuse to deliver their JS to any earlier build. Plan for that; do not be surprised by it.

---

## 5. Sequencing and collision discipline

**Prompt 1 must land alone and first.** Prompts 2, 3 and 4 all build on its tables and routes.
Running them concurrently with prompt 1 will waste all four sessions.

After prompt 1 is merged into `social-v2`, prompts 2, 3 and 4 can run at once, but **each in its
own git worktree**, never in the same checkout. Two sessions sharing `~/Desktop/Jinx` on
2026-09-22 produced half-finished files landing in each other's test runs and one rebase that
rewrote another session's commit. The memory note `project-worktree-simulator-workflow` records
the rule: own worktree, own simulator, own Metro port.

Reserved ranges, so four sessions never collide:

| Prompt | Migrations | pgTAP tests | Owns |
|---|---|---|---|
| 1 | `20260924000100`+ | `060`+ | routes, tab bar, all new tables, the `feed_reactions` rename |
| 2 | `20260924010000`+ | `070`+ | `features/feed/`, posts, kudos, comments, contacts, companion consent |
| 3 | `20260924020000`+ | `080`+ | `features/reactions/`, check-in sessions, `features/live/` NFL feed |
| 4 | `20260924030000`+ | `090`+ | `features/communities/`, leaderboards, streaks, badges, counts, four favorites |

The highest thing on `main` today is migration `20260923110000` and test `051`.

Standing repo rules that all four inherit, from CLAUDE.md and `docs/prompts/next-wave.md`:

- Never `supabase db reset` locally: 112,090 games are loaded. Use `npx supabase migration up --local`.
- `npm run db:types` after every schema change.
- No em dash in UI copy; a test enforces it. No emojis. Reference icon set only. Sentence case.
  American spelling. Venue nouns per sport through `venue_noun`.
- Verify against the real thing before reporting anything done, and screenshot every screen you
  change. Three restyle bugs in September were found only by screenshots.
- Run `npm test && npm run typecheck && npm run lint && npm run db:test` before every push. Five
  pushes in a row on 2026-09-22 arrived red and had to be fixed by another session.
- Do **not** push to `main`, and do **not** deploy to hosted. This branch is for Dean to review.
  Apply migrations to local only.
