# Communities, leaderboards, streaks, badges (social v2, prompt 4)

Built from `docs/prompts/social/04_communities_and_leaderboards.md`; `00_repo_reality.md` wins
where the two disagree. This is the design note the brief asks for on two things deliberately cut
from v1, plus the honest gaps in what shipped.

## Not in v1: user-created communities

`communities.kind` already accepts `'custom'`, and the RLS insert policy on `communities` is
server-only (`communities_select` reads for everyone; there is no client insert policy at all),
so a fan cannot create one today. Before opening that up, this needs:

- **An owner role.** `community_members.role` already has `'owner'` and `'moderator'` as values,
  but nothing assigns them and no policy treats them differently from `'member'` yet.
- **Rename and description rules.** Who can change `communities.name` / `description`, how often,
  and whether a rename breaks the `slug` (it should not: links and the leaderboard's community_id
  key on `id`, not `slug`, so a slug could stay put or redirect).
- **Reports and bans.** `reports.target_type` needs a `'community'` case, and a ban needs a row
  somewhere that blocks a specific user from rejoining a specific community without blocking
  every DM or follow the way `blocks` does.
- **Name-squatting defenses.** A queue or a cooldown on `slug`, and probably a minimum account
  age or a captcha-equivalent before someone can create one at all, since an empty, joinable
  community is a natural target for impersonation ("Phillies Fans 2").

None of this is started. The schema path exists so a future migration does not have to alter
`communities.kind`'s check constraint, nothing more.

## Not in v1: unofficial (self-reported) leaderboards

The brief's stat list explicitly excludes self-reported novelty stats (streakers seen, foul balls
caught, rain delays sat through) from the competitive boards in `leaderboard_stats`, because nothing
verifies them and an unverified number on a ranked board invites gaming it. A later "unofficial"
board would need:

- Its own table (or a `verified_only = false` lane in `leaderboard_stats`, which the column
  already anticipates but nothing writes today) so it can never be confused with a verified rank.
- A place to log the claim (probably alongside a post or a comment, not a bare number), since the
  whole point of the category is that it is a story, not a stat.
- A moderation path, because "foul balls caught" is exactly the kind of self-reported number
  someone will inflate for a joke, and a community with no verification needs a faster block/
  report loop than the verified boards do.

## Known gaps in what shipped

- **`venues.state` is null for 63 of 294 venues** (mostly ones with no coordinates resolved yet).
  The `new_state` badge filter and `isNewState` in `goal_games()` treat a null state as "never a
  new state," so a fan whose venues are in that set cannot earn `new_stadium_new_state` there.
  Not fixed here; it is a data-completeness job (geocoding), not a schema or logic gap.
- **`temperature_f` is populated for almost no MLB, NBA or MLS games** (NFL is the one sport with
  real coverage, 69% of games). `arctic_game` will fire almost exclusively from NFL games as a
  result. That is an honest reflection of the data, not a bug, but it means the badge reads as
  "NFL only" in practice today.
- **Four of the eight egg badges are best-effort proxies, not faithful criteria**
  (`record_rewind`, `stretch_confetti`, `secret_handshake`, and `rally_cap` only partially): the
  eggs they mirror are live or UI-gesture interactions with nothing persisted to evaluate against
  historically. See the comment at the top of `packages/core/src/badges.ts` for exactly which.
- **The "at risk" streak nudge (feed card and push) is not built.** `isStreakAtRisk` exists in
  `packages/core/src/streaks.ts` and is unit tested, but nothing calls it server side to post a
  feed event or a notification yet. `season_streaks` has no column to cache the flag either; it
  would need to be computed against each team's remaining schedule, which is a scheduled job, not
  a trigger.
- **The Profile counts block (section 4) is not wired into a screen.** `useCounts()` in
  `features/communities/queries.ts` and the `user_counts` table are real and tested
  (`090_leaderboards.test.sql` covers the verified/total split), but no screen renders it yet;
  the Passport screen gained streak patches, a four-favorites preview and a badges preview in the
  same place `FavoritePlayers` did, and Profile was left alone given the time this branch had.
