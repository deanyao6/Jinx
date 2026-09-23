/**
 * The server's half for MLB (03, section 3.1): one poll of `/v1/game/{gamePk}/winProbability`
 * and the linescore, against what the last poll had seen, gives the prompts to fire. Pure, so
 * `mlb-live` (Deno) and the tests share it.
 */
import { mlbEventCandidate, type MlbLivePlay } from './events.js';
import { scheduledPromptDecision } from './window.js';
import type { EventCandidate, LiveSnapshot } from './types.js';

export interface MlbPollState {
  /** The at-bat index of the last complete play the previous poll had seen, -1 at first. */
  lastAtBat: number;
  scheduledReported: boolean;
}

export interface MlbLinescore {
  currentInning?: number;
  inningState?: string;
  teams?: { home?: { runs?: number; hits?: number }; away?: { runs?: number; hits?: number } };
}

export interface MlbPollInput {
  status: 'scheduled' | 'live' | 'final' | string;
  linescore: MlbLinescore | null;
  entries: readonly MlbLivePlay[];
  /** Provider ids of plays on the curated milestone list for this game, if any. */
  milestoneAtBats?: ReadonlySet<number>;
  fetchedAt: string;
}

export interface MlbPollOutput {
  events: EventCandidate[];
  /** The scheduled prompt is due at this poll. */
  scheduled: { periodLabel: string; homeScore: number; awayScore: number; reason: string } | null;
  next: MlbPollState;
  /** The snapshot the rules read, for the caller's own logging. */
  snapshot: LiveSnapshot;
}

function mlbSnapshot(input: MlbPollInput, homeWp: number | null): LiveSnapshot {
  const ls = input.linescore;
  return {
    status: input.status,
    period: ls?.currentInning ?? null,
    periodState: ls?.inningState ? ls.inningState.toLowerCase() : null,
    clockSeconds: null,
    homeScore: ls?.teams?.home?.runs ?? 0,
    awayScore: ls?.teams?.away?.runs ?? 0,
    homeWp,
    fetchedAt: input.fetchedAt,
  };
}

const ORD = ['', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th'];

function mlbLabel(snapshot: LiveSnapshot): string {
  const n = snapshot.period ?? 0;
  const half = snapshot.periodState === 'top' ? 'Top' : snapshot.periodState === 'bottom' ? 'Bottom' : snapshot.periodState === 'middle' ? 'Middle' : 'End';
  return `${half} ${ORD[n] ?? `${n}th`}`;
}

/** Walk the plays newer than the last poll's, with the score and the line before each. */
export function mlbPollStep(state: MlbPollState, input: MlbPollInput): MlbPollOutput {
  const events: EventCandidate[] = [];
  const plays = input.entries.filter((e) => e.about?.isComplete !== false);
  let homeBefore = 0;
  let awayBefore = 0;
  let wpBefore: number | null = null;
  let halfKey = '';
  let halfRunsBefore = 0;
  let lastAtBat = state.lastAtBat;
  const last = plays[plays.length - 1];
  const gameOver = input.status === 'final';
  const hits = input.linescore?.teams
    ? { home: input.linescore.teams.home?.hits ?? 0, away: input.linescore.teams.away?.hits ?? 0 }
    : null;

  for (const p of plays) {
    const key = `${p.about.inning}-${p.about.halfInning}`;
    if (key !== halfKey) {
      halfKey = key;
      halfRunsBefore = 0;
    }
    const batting = p.about.halfInning === 'top' ? 'away' : 'home';
    const isNew = p.about.atBatIndex > state.lastAtBat;
    if (isNew) {
      const c = mlbEventCandidate(p, {
        homeBefore,
        awayBefore,
        homeWpBefore: wpBefore,
        halfInningRunsBefore: halfRunsBefore,
        // The line's hits are after the last play; only the last play can be judged by them.
        hits: p === last ? hits : null,
        milestone: input.milestoneAtBats?.has(p.about.atBatIndex) ?? false,
        gameOver: gameOver && p === last,
      });
      if (c) events.push(c);
      lastAtBat = Math.max(lastAtBat, p.about.atBatIndex);
    }
    const homeAfter = p.result.homeScore ?? homeBefore;
    const awayAfter = p.result.awayScore ?? awayBefore;
    halfRunsBefore += batting === 'home' ? homeAfter - homeBefore : awayAfter - awayBefore;
    homeBefore = homeAfter;
    awayBefore = awayAfter;
    if (p.homeTeamWinProbability != null) wpBefore = p.homeTeamWinProbability / 100;
  }

  const snapshot = mlbSnapshot(input, wpBefore);
  const decision = scheduledPromptDecision('mlb', snapshot);
  const scheduled =
    decision.due && !state.scheduledReported
      ? { periodLabel: mlbLabel(snapshot), homeScore: snapshot.homeScore, awayScore: snapshot.awayScore, reason: decision.reason }
      : null;
  return {
    events,
    scheduled,
    next: { lastAtBat, scheduledReported: state.scheduledReported || !!scheduled },
    snapshot,
  };
}
