# Prompt 4: communities, leaderboards, streaks, badges, counts, four favorites

> **Read [`00_repo_reality.md`](00_repo_reality.md) first.** It lists every place this brief
> disagrees with the repo as it stands, and how to resolve each one. Where the two conflict,
> `00_repo_reality.md` wins unless Dean says otherwise.

Depends on prompts 1 and 2. In `design/prototype.html`: Feed → Discover → Communities → a community → its leaderboard, then Passport and Profile.

## 1. Communities

Joinable groups, in the spirit of a subreddit or a Fantasy Premier League mini-league. Leaderboards only exist inside them, which is what keeps rank winnable.

- **Seeded at launch, all official:** one per MLB and NFL team (`kind='team'`), one per venue (`kind='venue'`), and a small set of schools (`kind='school'`, starting with Caltech and any school Dean names). Slugs like `phillies-fans`, `citizens-bank-park`, `caltech`.
- Joining is one tap, leaving is one tap, membership is public, and a user can join many.
- On following a team in onboarding, offer (do not force) that team's community.
- **Community page:** header with name, member count, your rank, join state; leaderboard previews; a member feed of public posts from members, which is the only place non-followed members' posts appear.
- **User-created communities are out of scope for this prompt.** They need an owner role, rename rules, reports and bans, and name squatting defenses. Add a `kind='custom'` path in the schema only, and put a short design note in `docs/COMMUNITIES.md` about what is required before opening it.
- Every community screen has report and leave. Members who are blocked by the viewer never appear.

## 2. Leaderboards

Inside a community only. Two filter rows, both from the prototype:

- **Period:** This season, This month, All time, plus a **Friends only** toggle that filters to people you follow.
- **Stat:** derived from data, never self-reported in v1:
  - Games attended (default)
  - Wins seen (games where the user's rooting side won)
  - Home runs seen (MLB), touchdowns seen (NFL)
  - Walk-offs seen, extra-inning and overtime games, shutouts seen, errors seen
  - Stadiums visited (for venue-agnostic communities), and for a venue community, games at that venue
- **Only verified attendance ranks** (check-in or matched ticket). Unverified games still count on the user's own passport and profile counts. Show this rule as one line under the filters, exactly as the prototype does, so nobody thinks the board is broken.
- Ties break by earliest achievement, so the person who got there first ranks higher.
- Show the viewer's own row pinned at the bottom if they are off-screen, with their rank, which is the part that makes a losing rank still feel actionable.
- Self-reported novelty stats (streakers seen, foul balls caught, rain delays) are **not** in v1. Design them as a separate "unofficial" board later, and note that in `docs/COMMUNITIES.md`.

**Computation.** Recompute `leaderboard_stats` when a game goes final, when an attendance changes verification, and nightly as a reconciliation pass. Stats are additive per user per community per period, so recompute only the affected users. Leaderboard reads are a single indexed query, never a scan.

## 3. Season streaks

Per user, per team, per sport. This is a **computed** streak, not a user-set goal.

- A season counts if the user attended **at least one** game involving that team in that season (any venue, home or away, regular season or postseason).
- The streak is the longest run of consecutive seasons ending with the most recent season, plus a derived floor: `min_games` is the smallest per-season count inside that run.
- Display: on the Passport it is a **small patch next to the record**, one per team, not a full card. Tapping a patch opens a streak screen listing each season and its game count. Copy on the patch: **"6-season Phillies streak"**; inside: **"never fewer than 2 games."** The floor rises on its own as weak years drop out of the run, which makes it a brag that improves without the user doing anything.
- Active versus broken: a streak is active while the current season is either in progress or already attended. It breaks only when a season ends with zero attended games. Show "at risk" from a configurable point (default: the team has 10 or fewer games left and the user has none this season) with a nudge in the feed and a push.
- Offseason never breaks a streak.
- Multiple teams mean multiple streaks; the Passport shows the longest, and the rest live on the streak detail screen.
- Edge cases to test: a season with only a postseason game, a relocated or renamed franchise (follow `franchise_id`), a user who adds a team mid-life (streaks compute historically from attendance, not from when they followed).

## 4. Profile counts badge

On every profile, a compact counts block, exactly as the prototype shows:

- **All-time games attended** (all sports combined).
- **Per sport, this season:** "17 MLB this season", "3 NFL this season". Use the sport's current season, and during the offseason show the most recent completed season labeled as such.
- Verified versus total: show total, with verified as a subtle secondary ("14 verified").
- Own profile and other profiles use the same component.

## 5. Badges

Badges are the public, collectible surface of superlatives, with their own screen.

- Table-driven from `badges.criteria` JSON, evaluated by the same predicate evaluator used for goals (`SPEC.md` 6.13). Adding a badge must be a data change, not a code change.
- Launch set of roughly 25, weighted toward specific and weird rather than generic: three parks in one weekend, walk-off witnessed, opening day ×3, a game in three time zones, 19°F or colder, undefeated with one companion (5+ games), a no-hitter, extra innings on the road, a doubleheader, a new stadium in a new state, a team's road game 1,000+ miles from home.
- Locked badges show their requirement. Secret badges (`is_secret`) show only after earning, and the easter eggs belong here.
- Earning a badge creates a system post and a share card.

## 6. Four favorite games

- Up to four games pinned at the top of Profile and Passport, chosen from the user's attendances, reorderable, each with an optional one-line note.
- Empty slots show a prompt to pick, since an empty slot is a strong call to action.
- They appear on other users' profiles too, and they are the first thing a visitor sees, which is the entire point of the Letterboxd mechanic.

## 7. Acceptance

- Streak function unit tests: `[3,4,2,5,7,4]` produces "6 seasons, never fewer than 2"; a zero season breaks it; a postseason-only season counts; an in-progress season keeps it active; a franchise rename keeps continuity.
- Leaderboard tests: verified-only filter, each stat key, each period, friends-only, tie-break by earliest, the viewer's pinned row, and a blocked user excluded.
- Badge evaluator tests for every launch badge, with fixtures.
- Counts match the passport totals exactly, including the offseason label.
- Joining and leaving a community updates counts and feed inclusion immediately.
- Performance: a leaderboard for a 50,000-member community returns its first page in under 300ms from the materialized table.
