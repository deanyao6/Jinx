import type { ShareGame } from './types';

/**
 * The single-game share card for a real game, from the game row and the user's own attendance.
 *
 * One function so game detail and Relive cannot disagree. Relive used to build its card from
 * the reference fixture's shape: always MLB, always the home team's side, never verified, which
 * put the wrong side on the card for anyone who rooted for the visitors.
 */
export type ShareableGame = {
  sport_id: string;
  status: string;
  scheduled_start: string;
  home_team_id: string;
  away_team_id: string;
  home_score: number | null;
  away_score: number | null;
  is_tie?: boolean | null;
  winner_team_id?: string | null;
  home: { name: string } | null;
  away: { name: string } | null;
  venue: { name: string; city?: string | null } | null;
};

export type ShareableAttendance = { rooting_team_id: string | null; verified: boolean } | null;

export function shareGameFor(g: ShareableGame, a: ShareableAttendance | undefined): ShareGame {
  const final = g.status === 'final' && g.home_score != null && g.away_score != null;
  const rooted = a?.rooting_team_id ?? null;
  const side =
    rooted === g.home_team_id
      ? (g.home?.name ?? null)
      : rooted === g.away_team_id
        ? (g.away?.name ?? null)
        : null;
  let result: ShareGame['result'] = null;
  if (final && side) {
    const mine = rooted === g.home_team_id ? g.home_score : g.away_score;
    const theirs = rooted === g.home_team_id ? g.away_score : g.home_score;
    result = g.winner_team_id
      ? rooted === g.winner_team_id
        ? 'win'
        : 'loss'
      : g.is_tie || mine === theirs
        ? 'tie'
        : (mine ?? 0) > (theirs ?? 0)
          ? 'win'
          : 'loss';
  }
  return {
    kind: 'game',
    sport: g.sport_id,
    away: g.away?.name ?? 'Away',
    home: g.home?.name ?? 'Home',
    awayScore: g.away_score,
    homeScore: g.home_score,
    winner: !final
      ? null
      : g.winner_team_id
        ? g.winner_team_id === g.home_team_id
          ? 'home'
          : 'away'
        : g.home_score! > g.away_score!
          ? 'home'
          : g.away_score! > g.home_score!
            ? 'away'
            : null,
    status: g.status,
    venue: g.venue ? [g.venue.name, g.venue.city].filter(Boolean).join(', ') : null,
    date: g.scheduled_start,
    side,
    result,
    verified: !!a?.verified,
  };
}
