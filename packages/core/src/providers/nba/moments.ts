/**
 * NBA moment detectors (SPEC 6.7, extended for the NBA on 2026-09-17). Pure functions over
 * CanonicalGameDetail with fixture tests.
 *
 * - overtime: the game went past four periods.
 * - buzzer_beater: a made field goal with 1.0 s or less on the clock at the end of the fourth
 *   quarter or an overtime that tied the game or put the shooter's side ahead. The shooter's.
 * - fifty_points, triple_double, quadruple_double, twenty_rebounds, twenty_assists: from the
 *   box score lines. The player's.
 * - comeback_20: the winning side trailed by 20 or more after some play. The team's, like the
 *   NFL's 14-point rule, and never pinned on whoever scored last.
 */
import type { CanonicalGameDetail, GameEvent, NbaBoxLine, NbaPlay, Side } from '../../types.js';

const BUZZER_SECONDS = 1.0;
const FIFTY = 50;
const TWENTY = 20;
const COMEBACK_DEFICIT = 20;
const OVERTIME_PERIOD = 5;

function otherSide(side: Side): Side {
  return side === 'home' ? 'away' : 'home';
}

function lead(play: { homeScore: number; awayScore: number }, side: Side): number {
  return side === 'home' ? play.homeScore - play.awayScore : play.awayScore - play.homeScore;
}

function playDetail(play: NbaPlay, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    actionNumber: play.actionNumber,
    period: play.period,
    clock: play.clock,
    description: play.description,
    homeScore: play.homeScore,
    awayScore: play.awayScore,
    ...extra,
  };
}

function lineEvent(
  type: GameEvent['type'],
  line: NbaBoxLine,
  extra: Record<string, unknown>,
): GameEvent {
  return {
    type,
    side: line.side,
    providerPlayerId: line.playerId,
    playerName: line.playerName,
    occurredAt: null,
    detail: {
      points: line.points,
      rebounds: line.rebounds,
      assists: line.assists,
      steals: line.steals,
      blocks: line.blocks,
      ...extra,
    },
  };
}

/** How many of the five counting categories reached ten. */
export function doubleDigitCategories(line: NbaBoxLine): number {
  return [line.points, line.rebounds, line.assists, line.steals, line.blocks].filter((n) => n >= 10)
    .length;
}

function winningSide(detail: CanonicalGameDetail): Side | null {
  if (detail.homeScore == null || detail.awayScore == null) return null;
  if (detail.homeScore > detail.awayScore) return 'home';
  if (detail.awayScore > detail.homeScore) return 'away';
  return null;
}

export function detectNbaMoments(detail: CanonicalGameDetail): GameEvent[] {
  if (detail.plays.sport !== 'nba') return [];
  const plays = detail.plays.items;
  const events: GameEvent[] = [];
  const winner = winningSide(detail);

  // Overtime.
  const periods = detail.inningsOrPeriods ?? plays.reduce((m, p) => Math.max(m, p.period), 0);
  const firstOt = plays.find((p) => p.period >= OVERTIME_PERIOD) ?? null;
  if (periods >= OVERTIME_PERIOD) {
    events.push({
      type: 'overtime',
      side: null,
      providerPlayerId: null,
      playerName: null,
      occurredAt: firstOt?.timeActual ?? null,
      detail: { periods, homeScore: detail.homeScore, awayScore: detail.awayScore },
    });
  }

  // Buzzer-beater: the last made field goal of a fourth quarter or overtime, at 1.0 s or
  // less, that tied it or won it. Read against the score before the shot.
  let prevHome = 0;
  let prevAway = 0;
  for (const p of plays) {
    const before = { homeScore: prevHome, awayScore: prevAway };
    if (
      p.isScoringPlay &&
      p.isFieldGoal &&
      p.side != null &&
      p.period >= 4 &&
      p.periodSecondsRemaining != null &&
      p.periodSecondsRemaining <= BUZZER_SECONDS
    ) {
      const leadBefore = lead(before, p.side);
      const leadAfter = lead(p, p.side);
      if (leadBefore <= 0 && leadAfter >= 0) {
        const winning = leadAfter > 0;
        events.push({
          type: 'buzzer_beater',
          side: p.side,
          providerPlayerId: p.playerId,
          playerName: p.playerName,
          occurredAt: p.timeActual,
          detail: playDetail(p, {
            winning,
            tying: !winning,
            overtime: p.period >= OVERTIME_PERIOD,
            points: p.points,
          }),
        });
      }
    }
    prevHome = p.homeScore;
    prevAway = p.awayScore;
  }

  // Box score lines.
  for (const line of detail.boxLines ?? []) {
    if (line.points >= FIFTY) events.push(lineEvent('fifty_points', line, {}));
    const categories = doubleDigitCategories(line);
    if (categories >= 4) events.push(lineEvent('quadruple_double', line, { categories }));
    else if (categories === 3) events.push(lineEvent('triple_double', line, { categories }));
    if (line.rebounds >= TWENTY) events.push(lineEvent('twenty_rebounds', line, {}));
    if (line.assists >= TWENTY) events.push(lineEvent('twenty_assists', line, {}));
  }

  // Comeback from 20 down.
  if (winner != null) {
    let maxDeficit = 0;
    let deficitPlay: NbaPlay | null = null;
    for (const p of plays) {
      const deficit = -lead(p, winner);
      if (deficit > maxDeficit) {
        maxDeficit = deficit;
        deficitPlay = p;
      }
    }
    if (maxDeficit >= COMEBACK_DEFICIT && deficitPlay != null) {
      events.push({
        type: 'comeback_20',
        side: winner,
        providerPlayerId: null,
        playerName: null,
        occurredAt: deficitPlay.timeActual,
        detail: playDetail(deficitPlay, {
          maxDeficit,
          deficit: maxDeficit,
          finalHomeScore: detail.homeScore,
          finalAwayScore: detail.awayScore,
          trailing: otherSide(winner),
        }),
      });
    }
  }

  return events;
}
