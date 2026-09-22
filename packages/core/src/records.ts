/**
 * Records (SPEC.md 6.2). Only final games with a rooting side count toward W-L-T.
 * These functions mirror the SQL in supabase/migrations/*_stats.sql; keep them in sync.
 */
import type { GameStatus } from './types.js';
import type { RootingBasis } from './rooting.js';

export interface AttendedGame {
  gameId: string;
  status: GameStatus;
  scheduledStart: string;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number | null;
  awayScore: number | null;
  /** Explicit winner, including soccer shootouts. Missing preserves score-derived results. */
  winnerTeamId?: string | null;
  rootingTeamId: string | null;
  rootingBasis: RootingBasis | null;
  /** Pledge for this game, when any. */
  pledge?:
    | {
        teamId: string;
        status: 'provisional' | 'valid' | 'void';
        winProbAtPledge: number;
      }
    | undefined;
}

export interface WinLossRecord {
  wins: number;
  losses: number;
  ties: number;
}

export type GameResult = 'win' | 'loss' | 'tie';

export const EMPTY_RECORD: WinLossRecord = { wins: 0, losses: 0, ties: 0 };

/** Result of a final game from the perspective of `teamId`; null if the game does not count. */
export function gameResult(g: AttendedGame, teamId: string | null): GameResult | null {
  if (g.status !== 'final' || teamId === null) return null;
  if (g.homeScore === null || g.awayScore === null) return null;
  if (teamId !== g.homeTeamId && teamId !== g.awayTeamId) return null;
  if (g.winnerTeamId === g.homeTeamId || g.winnerTeamId === g.awayTeamId) {
    return teamId === g.winnerTeamId ? 'win' : 'loss';
  }
  if (g.homeScore === g.awayScore) return 'tie';
  const homeWon = g.homeScore > g.awayScore;
  return (teamId === g.homeTeamId) === homeWon ? 'win' : 'loss';
}

export function tally(results: Iterable<GameResult | null>): WinLossRecord {
  const rec = { ...EMPTY_RECORD };
  for (const r of results) {
    if (r === 'win') rec.wins++;
    else if (r === 'loss') rec.losses++;
    else if (r === 'tie') rec.ties++;
  }
  return rec;
}

/** Overall record: every attended final game with a rooting side. */
export function overallRecord(games: AttendedGame[]): WinLossRecord {
  return tally(games.map((g) => gameResult(g, g.rootingTeamId)));
}

/** Team record: attended games where the user rooted for `teamId` (by team id; callers group by franchise). */
export function teamRecord(games: AttendedGame[], teamIds: Iterable<string>): WinLossRecord {
  const ids = new Set(teamIds);
  return tally(
    games
      .filter((g) => g.rootingTeamId !== null && ids.has(g.rootingTeamId))
      .map((g) => gameResult(g, g.rootingTeamId)),
  );
}

/** Pledge record: basis 'pledge' with a valid pledge. */
export function pledgeRecord(games: AttendedGame[]): WinLossRecord {
  return tally(
    games
      .filter((g) => g.rootingBasis === 'pledge' && g.pledge?.status === 'valid')
      .map((g) => gameResult(g, g.rootingTeamId)),
  );
}

/** sum(result_score - win_prob_at_pledge) over valid pledges; result_score 1/0/0.5. */
export function pledgeVsExpected(games: AttendedGame[]): number {
  let total = 0;
  for (const g of games) {
    if (g.rootingBasis !== 'pledge' || g.pledge?.status !== 'valid') continue;
    const r = gameResult(g, g.rootingTeamId);
    if (r === null) continue;
    const score = r === 'win' ? 1 : r === 'tie' ? 0.5 : 0;
    total += score - g.pledge.winProbAtPledge;
  }
  return total;
}

/** Companion record: overall record over the tagging user's games where the person is tagged. */
export function companionRecord(
  games: AttendedGame[],
  taggedGameIds: Iterable<string>,
): WinLossRecord {
  const ids = new Set(taggedGameIds);
  return tally(games.filter((g) => ids.has(g.gameId)).map((g) => gameResult(g, g.rootingTeamId)));
}

/** wins / (wins + losses), ties excluded; null when no decisions. */
export function winRate(rec: WinLossRecord): number | null {
  const decided = rec.wins + rec.losses;
  return decided === 0 ? null : rec.wins / decided;
}

/** Baseball-style three decimals: ".646". */
export function formatWinRate(rec: WinLossRecord): string {
  const r = winRate(rec);
  // En dash, never an em dash: this string is rendered in the UI (SPEC.md 8.2).
  if (r === null) return '–';
  if (r >= 1) return '1.000';
  return r.toFixed(3).replace(/^0/, '');
}

/** "31–17", or "31–17–2" when ties are nonzero. Uses an en dash. */
export function formatRecord(rec: WinLossRecord): string {
  const base = `${rec.wins}–${rec.losses}`;
  return rec.ties > 0 ? `${base}–${rec.ties}` : base;
}

/** "+2.4" / "-0.6" / "0.0" with one decimal. */
export function formatVsExpected(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  if (Object.is(rounded, -0) || rounded === 0) return '0.0';
  return `${rounded > 0 ? '+' : '-'}${Math.abs(rounded).toFixed(1)}`;
}

export interface Streaks {
  longestWin: number;
  longestLoss: number;
  /** Positive for a current win streak, negative for a losing streak, 0 for none. */
  current: number;
}

/** Longest win and loss streaks over attended games in chronological order (ties break streaks). */
export function streaks(games: AttendedGame[]): Streaks {
  const ordered = [...games].sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart));
  let longestWin = 0;
  let longestLoss = 0;
  let run = 0;
  for (const g of ordered) {
    const r = gameResult(g, g.rootingTeamId);
    if (r === null) continue;
    if (r === 'win') run = run > 0 ? run + 1 : 1;
    else if (r === 'loss') run = run < 0 ? run - 1 : -1;
    else run = 0;
    longestWin = Math.max(longestWin, run);
    longestLoss = Math.max(longestLoss, -run);
  }
  return { longestWin, longestLoss, current: run };
}
