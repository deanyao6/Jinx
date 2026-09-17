/**
 * Whether a game is a big one, and why (SPEC 6.18, as narrowed 2026-09-17).
 *
 * Dean's rule: at most one storyline per team, and one more about the game's significance only
 * when it is "something huge, like a big event". Whether a game qualifies is decided HERE, from
 * the schedule, and never by the model. Asking a model "is this game significant?" invites it to
 * find significance in every game, which is how every game becomes a "must-win".
 *
 * Three things qualify, because each is a fact the schedule states outright:
 *
 * - a postseason game, with the series score between these two teams where there is one;
 * - either team's first regular-season game of the season;
 * - the home team's first regular-season home game.
 *
 * Nothing that needs standings math qualifies yet: a clinch, an elimination, a division decider.
 * Those are genuinely big, and a wrong one ("the Phillies can clinch tonight") is a claim a fan
 * would notice immediately. They wait for a standings table rather than being inferred.
 */
import type { WinLossRecord } from '../records.js';
import { gameResult, tally } from '../records.js';
import type { ScheduleGame } from './facts.js';

export type Significance =
  | {
      kind: 'postseason';
      home: string;
      away: string;
      /** This postseason's games between the two, from the HOME team's side. Absent for game 1. */
      seriesRecordForHome?: WinLossRecord;
    }
  | { kind: 'season_opener'; team: string; season: number }
  | { kind: 'home_opener'; team: string; season: number };

function isFinal(g: ScheduleGame): boolean {
  return g.status === 'final' && g.homeScore !== null && g.awayScore !== null;
}

function before(game: ScheduleGame, history: readonly ScheduleGame[]): ScheduleGame[] {
  return history.filter(
    (g) =>
      g.gameId !== game.gameId &&
      g.season === game.season &&
      g.scheduledStart < game.scheduledStart,
  );
}

export function significance(
  game: ScheduleGame,
  names: { home: string; away: string },
  history: readonly ScheduleGame[],
): Significance | null {
  const earlier = before(game, history);

  if (game.gameType === 'postseason') {
    const series = earlier.filter(
      (g) =>
        g.gameType === 'postseason' &&
        isFinal(g) &&
        ((g.homeTeamId === game.homeTeamId && g.awayTeamId === game.awayTeamId) ||
          (g.homeTeamId === game.awayTeamId && g.awayTeamId === game.homeTeamId)),
    );
    const out: Significance = { kind: 'postseason', home: names.home, away: names.away };
    if (series.length > 0) {
      out.seriesRecordForHome = tally(
        series.map((g) =>
          gameResult(
            {
              gameId: g.gameId,
              status: g.status,
              scheduledStart: g.scheduledStart,
              homeTeamId: g.homeTeamId,
              awayTeamId: g.awayTeamId,
              homeScore: g.homeScore,
              awayScore: g.awayScore,
              rootingTeamId: game.homeTeamId,
              rootingBasis: null,
            },
            game.homeTeamId,
          ),
        ),
      );
    }
    return out;
  }

  if (game.gameType !== 'regular') return null;

  const regularEarlier = earlier.filter((g) => g.gameType === 'regular');
  const playedBefore = (teamId: string) =>
    regularEarlier.some((g) => g.homeTeamId === teamId || g.awayTeamId === teamId);

  // The home side first: an opener at home is the bigger occasion of the two.
  if (!playedBefore(game.homeTeamId)) {
    return { kind: 'season_opener', team: names.home, season: game.season };
  }
  if (!playedBefore(game.awayTeamId)) {
    return { kind: 'season_opener', team: names.away, season: game.season };
  }
  if (!regularEarlier.some((g) => g.homeTeamId === game.homeTeamId)) {
    return { kind: 'home_opener', team: names.home, season: game.season };
  }
  return null;
}
