/**
 * NFL v1 moment detectors (SPEC 6.7). Pure functions over CanonicalGameDetail.
 *
 * Resolutions of ambiguities in the spec text:
 * - late_go_ahead_score: a score change in Q4 with <= 2:00 on the clock where the scoring side
 *   was tied or behind before the play and is tied or ahead after it (2-point conversions and
 *   extra points count as their own scoring events).
 * - walk_off_score: the last play of the game (ignoring `no_play` rows such as timeouts) is a
 *   score change in Q4 or OT, the scoring side was tied or behind before it, and that side wins.
 *   nflverse records the clock at the snap, so a "time expires" kick shows e.g. 00:03, not 00:00;
 *   being the final play is what establishes that time expired. A go-ahead score followed by a
 *   kickoff or kneel is not a walk-off.
 * - kick_return_td requires no fumble on the play: a muffed punt recovered in the end zone by the
 *   kicking team has punt_attempt=1 and return_touchdown=1 in nflverse, but it is a fumble
 *   return TD, not a kick return.
 * - comeback_14: the winning side trailed by 14+ after some play; ties never qualify.
 */
import type { CanonicalGameDetail, GameEvent, NflPlay, Side } from '../../types.js';

const LATE_GO_AHEAD_SECONDS = 120;
const LONG_FIELD_GOAL_YARDS = 50;
const COMEBACK_DEFICIT = 14;
const OVERTIME_PERIOD = 5;

interface PlayWithContext {
  play: NflPlay;
  index: number;
  homeBefore: number;
  awayBefore: number;
  scoreChanged: boolean;
  /** Side whose total increased on this play, if any. */
  scoringSide: Side | null;
}

function otherSide(side: Side): Side {
  return side === 'home' ? 'away' : 'home';
}

function sideScore(play: NflPlay, side: Side): number {
  return side === 'home' ? play.homeScore : play.awayScore;
}

function leadBefore(ctx: PlayWithContext, side: Side): number {
  return side === 'home' ? ctx.homeBefore - ctx.awayBefore : ctx.awayBefore - ctx.homeBefore;
}

function leadAfter(ctx: PlayWithContext, side: Side): number {
  return sideScore(ctx.play, side) - sideScore(ctx.play, otherSide(side));
}

function withContext(items: NflPlay[]): PlayWithContext[] {
  const out: PlayWithContext[] = [];
  let homeBefore = 0;
  let awayBefore = 0;
  items.forEach((play, index) => {
    const scoreChanged = play.homeScore !== homeBefore || play.awayScore !== awayBefore;
    let scoringSide: Side | null = null;
    if (play.homeScore > homeBefore) scoringSide = 'home';
    else if (play.awayScore > awayBefore) scoringSide = 'away';
    out.push({ play, index, homeBefore, awayBefore, scoreChanged, scoringSide });
    homeBefore = play.homeScore;
    awayBefore = play.awayScore;
  });
  return out;
}

/** Yards from the last "... for N yards, TOUCHDOWN" fragment of a play description. */
function touchdownYards(description: string): number | null {
  const matches = [...description.matchAll(/for (-?\d+) yards?, TOUCHDOWN/g)];
  const last = matches[matches.length - 1];
  return last?.[1] != null ? Number(last[1]) : null;
}

function playDetail(play: NflPlay, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    playId: play.playId,
    period: play.qtr,
    clock: play.clock,
    description: play.description,
    homeScore: play.homeScore,
    awayScore: play.awayScore,
    ...extra,
  };
}

/**
 * Moments that belong to one player, and moments that belong to the game.
 *
 * Every NFL moment used to be written with a null player, so "Players seen" had nothing to
 * name and the Moments list could not say who did it — 8,406 of 8,597 rows in the database
 * carried no player, all of them NFL. A pick six is somebody's pick six; a comeback from 14
 * down is the team's, and stays unattributed rather than being pinned on whoever happened
 * to score last.
 */
const ATTRIBUTED: ReadonlySet<GameEvent['type']> = new Set([
  'pick_six',
  'fumble_return_td',
  'kick_return_td',
  'long_field_goal',
]);

function playEvent(
  type: GameEvent['type'],
  side: Side | null,
  play: NflPlay,
  extra: Record<string, unknown> = {},
): GameEvent {
  const attributed = ATTRIBUTED.has(type);
  return {
    type,
    side,
    providerPlayerId: attributed ? play.scorerProviderId : null,
    playerName: attributed ? play.scorerName : null,
    occurredAt: play.timeOfDay,
    detail: playDetail(play, extra),
  };
}

function winningSide(detail: CanonicalGameDetail): Side | null {
  if (detail.homeScore == null || detail.awayScore == null) return null;
  if (detail.homeScore > detail.awayScore) return 'home';
  if (detail.awayScore > detail.homeScore) return 'away';
  return null;
}

/** Touchdown side, falling back to the defense when nflverse omits td_team. */
function touchdownSide(play: NflPlay): Side | null {
  if (play.tdSide != null) return play.tdSide;
  return play.posSide != null ? otherSide(play.posSide) : null;
}

export function detectNflMoments(detail: CanonicalGameDetail): GameEvent[] {
  if (detail.plays.sport !== 'nfl') return [];
  const items = detail.plays.items;
  const plays = withContext(items);
  const winner = winningSide(detail);
  const events: GameEvent[] = [];

  const lastRealPlay = [...plays].reverse().find((ctx) => ctx.play.playType !== 'no_play') ?? null;

  for (const ctx of plays) {
    const { play, scoringSide } = ctx;

    if (play.interception && play.returnTouchdown) {
      events.push(
        playEvent('pick_six', touchdownSide(play), play, {
          yards: touchdownYards(play.description),
        }),
      );
    }

    if (play.fumble && play.returnTouchdown && !play.interception) {
      events.push(
        playEvent('fumble_return_td', touchdownSide(play), play, {
          yards: touchdownYards(play.description),
          onKick: play.kickoffAttempt || play.puntAttempt,
        }),
      );
    }

    if ((play.kickoffAttempt || play.puntAttempt) && play.returnTouchdown && !play.fumble) {
      events.push(
        playEvent('kick_return_td', touchdownSide(play), play, {
          yards: touchdownYards(play.description),
          kind: play.kickoffAttempt ? 'kickoff' : 'punt',
        }),
      );
    }

    if (play.safety) {
      const side = scoringSide ?? (play.posSide != null ? otherSide(play.posSide) : null);
      events.push(playEvent('safety', side, play));
    }

    if (
      play.fieldGoalResult === 'made' &&
      play.kickDistance != null &&
      play.kickDistance >= LONG_FIELD_GOAL_YARDS
    ) {
      events.push(
        playEvent('long_field_goal', scoringSide ?? play.posSide, play, {
          yards: play.kickDistance,
        }),
      );
    }

    if (
      scoringSide != null &&
      play.qtr === 4 &&
      play.quarterSecondsRemaining != null &&
      play.quarterSecondsRemaining <= LATE_GO_AHEAD_SECONDS
    ) {
      const before = leadBefore(ctx, scoringSide);
      const after = leadAfter(ctx, scoringSide);
      if (before <= 0 && after >= 0) {
        events.push(
          playEvent('late_go_ahead_score', scoringSide, play, {
            tying: after === 0,
            leadBefore: before,
            leadAfter: after,
          }),
        );
      }
    }

    if (
      lastRealPlay != null &&
      ctx.index === lastRealPlay.index &&
      scoringSide != null &&
      winner != null &&
      scoringSide === winner &&
      play.qtr >= 4 &&
      leadBefore(ctx, scoringSide) <= 0 &&
      leadAfter(ctx, scoringSide) > 0
    ) {
      events.push(
        playEvent('walk_off_score', scoringSide, play, {
          overtime: play.qtr >= OVERTIME_PERIOD,
          yards: play.kickDistance ?? touchdownYards(play.description),
        }),
      );
    }
  }

  const firstOvertimePlay = plays.find((ctx) => ctx.play.qtr >= OVERTIME_PERIOD) ?? null;
  const periods = detail.inningsOrPeriods;
  if (firstOvertimePlay != null || (periods != null && periods >= OVERTIME_PERIOD)) {
    events.push({
      type: 'overtime',
      side: null,
      providerPlayerId: null,
      playerName: null,
      occurredAt: firstOvertimePlay?.play.timeOfDay ?? null,
      detail: {
        periods: periods ?? Math.max(OVERTIME_PERIOD, firstOvertimePlay?.play.qtr ?? 0),
        description: firstOvertimePlay?.play.description ?? null,
        homeScore: detail.homeScore,
        awayScore: detail.awayScore,
      },
    });
  }

  if (winner != null) {
    let maxDeficit = 0;
    let deficitPlay: PlayWithContext | null = null;
    for (const ctx of plays) {
      const deficit = -leadAfter(ctx, winner);
      if (deficit > maxDeficit) {
        maxDeficit = deficit;
        deficitPlay = ctx;
      }
    }
    if (maxDeficit >= COMEBACK_DEFICIT && deficitPlay != null) {
      events.push({
        type: 'comeback_14',
        side: winner,
        providerPlayerId: null,
        playerName: null,
        occurredAt: deficitPlay.play.timeOfDay,
        detail: playDetail(deficitPlay.play, {
          maxDeficit,
          finalHomeScore: detail.homeScore,
          finalAwayScore: detail.awayScore,
        }),
      });
    }
  }

  return events;
}
