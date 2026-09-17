import type { ReplayGame } from '@/features/eggs/rewind';

/**
 * A history from a string, oldest first: W and L are games the person's side won or lost, T a
 * tie, N a neutral game with no side, and P one that is not final yet.
 */
export function history(results: string, start = Date.UTC(2025, 3, 1, 23, 5)): ReplayGame[] {
  return results.split('').map((letter, i) => {
    const mine = letter === 'W' ? 5 : letter === 'L' ? 2 : 3;
    const theirs = letter === 'W' ? 2 : letter === 'L' ? 5 : 3;
    return {
      gameId: `g${i}`,
      scheduledStart: new Date(start + i * 24 * 60 * 60 * 1000).toISOString(),
      status: letter === 'P' ? 'live' : 'final',
      homeTeamId: 'phi',
      awayTeamId: 'nym',
      homeScore: mine,
      awayScore: theirs,
      rootingTeamId: letter === 'N' ? null : 'phi',
      homeAbbreviation: 'PHI',
      awayAbbreviation: 'NYM',
    };
  });
}
