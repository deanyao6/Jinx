/**
 * The league's own video page for one game (SPEC.md 6.19: a link out, never hosted clips).
 *
 * Both leagues have a stable per-game page, checked on 2026-09-17 by requesting real games and
 * a made-up one: real ids answer 200, the made-up ones 404, so these are pages about the game
 * and not a catch-all that accepts anything (docs/verification.md).
 *
 *   MLB  https://www.mlb.com/gameday/{gamePk}/final/video
 *   NFL  https://www.nfl.com/games/{away}-at-{home}-{season}-{reg|post}-{week}
 *
 * When a piece is missing the league's video hub is returned instead. A hub is a weaker link,
 * but it opens; a guessed per-game URL that 404s is a broken button.
 */

export interface HighlightsGame {
  sport: 'mlb' | 'nfl' | string;
  /** MLB gamePk, or the nflverse id such as `2025_13_CHI_PHI`. */
  providerGameId: string | null | undefined;
  season: number | null | undefined;
  gameType: 'preseason' | 'regular' | 'postseason' | string | null | undefined;
  awayNickname: string | null | undefined;
  homeNickname: string | null | undefined;
}

export const MLB_VIDEO_HUB = 'https://www.mlb.com/video';
export const NFL_VIDEO_HUB = 'https://www.nfl.com/videos/';

/** "49ers" -> "49ers", "Football Team" -> "football-team". */
function slug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * nflverse numbers playoff weeks on from the regular season: 18 to 21 while the season had 17
 * weeks, 19 to 22 since it grew to 18 in 2021. nfl.com restarts at post-1.
 */
export function nflWeekSlug(season: number, week: number, gameType: string): string | null {
  if (!Number.isInteger(week) || week < 1) return null;
  if (gameType === 'postseason') {
    const round = week - (season >= 2021 ? 18 : 17);
    return round >= 1 && round <= 4 ? `post-${round}` : null;
  }
  if (gameType === 'preseason') return null;
  return `reg-${week}`;
}

export function officialHighlightsUrl(game: HighlightsGame): string {
  if (game.sport === 'mlb') {
    const pk = (game.providerGameId ?? '').trim();
    return /^\d+$/.test(pk) ? `https://www.mlb.com/gameday/${pk}/final/video` : MLB_VIDEO_HUB;
  }
  if (game.sport === 'nfl') {
    const week = Number((game.providerGameId ?? '').split('_')[1]);
    const away = slug(game.awayNickname ?? '');
    const home = slug(game.homeNickname ?? '');
    const weekSlug = game.season
      ? nflWeekSlug(game.season, week, game.gameType ?? 'regular')
      : null;
    if (!away || !home || !game.season || !weekSlug) return NFL_VIDEO_HUB;
    return `https://www.nfl.com/games/${away}-at-${home}-${game.season}-${weekSlug}`;
  }
  return MLB_VIDEO_HUB;
}

/** What the row under the link says, so it never promises MLB's site for an NFL game. */
export function highlightsSiteLabel(sport: string): string {
  return sport === 'nfl' ? 'Opens on NFL.com' : 'Opens on MLB.com';
}
