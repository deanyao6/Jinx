/**
 * Season streaks (SPEC.md, docs/prompts/social/04, section 3). Computed, not set by the user:
 * the longest run of consecutive seasons with at least one attended game for a team, ending
 * with the most recent season, plus the floor (the fewest games in any season of that run).
 */

export interface SeasonCount {
  season: number;
  /** Games attended that season, any venue, home or away, regular season or postseason. */
  games: number;
}

export interface SeasonStreak {
  startSeason: number;
  endSeason: number;
  seasons: number;
  /** The fewest games attended in any season inside the run. */
  minGames: number;
  /** True while the current season is either in progress or already attended this run. */
  isActive: boolean;
}

/**
 * `counts` need not be sorted or contiguous; zero-game seasons should simply be absent (a
 * present row always means `games >= 1`, so a season with `games: 0` is treated as absent).
 * `currentSeason` is the sport's current season number; `currentSeasonEnded` is true once
 * that season is fully over (its games are all final and it has no more left to play), so an
 * in-progress season with zero games so far never breaks the streak.
 */
export function computeSeasonStreak(
  counts: readonly SeasonCount[],
  currentSeason: number,
  currentSeasonEnded: boolean,
): SeasonStreak | null {
  const attended = new Map(counts.filter((c) => c.games >= 1).map((c) => [c.season, c.games]));
  if (attended.size === 0) return null;

  const mostRecent = Math.max(...attended.keys());
  const endSeason = mostRecent;
  let startSeason = mostRecent;
  let minGames = attended.get(mostRecent)!;
  for (let s = mostRecent - 1; attended.has(s); s--) {
    startSeason = s;
    minGames = Math.min(minGames, attended.get(s)!);
  }

  const isActive =
    endSeason === currentSeason || (endSeason === currentSeason - 1 && !currentSeasonEnded);

  return { startSeason, endSeason, seasons: endSeason - startSeason + 1, minGames, isActive };
}

/** Copy for the passport patch: "6-season Phillies streak". */
export function streakPatchLabel(teamName: string, streak: SeasonStreak): string {
  return `${streak.seasons}-season ${teamName} streak`;
}

/** Copy for the streak detail screen: "never fewer than 2 games." */
export function streakFloorLabel(streak: SeasonStreak): string {
  return `never fewer than ${streak.minGames} game${streak.minGames === 1 ? '' : 's'}`;
}

/** Default "at risk" rule (section 3): 10 or fewer games left in the season, none attended yet. */
export function isStreakAtRisk(
  streak: SeasonStreak,
  currentSeason: number,
  currentSeasonEnded: boolean,
  gamesLeftThisSeason: number,
  atRiskFromGamesLeft = 10,
): boolean {
  if (currentSeasonEnded) return false;
  if (streak.endSeason !== currentSeason - 1) return false;
  return gamesLeftThisSeason <= atRiskFromGamesLeft;
}
