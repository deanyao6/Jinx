/**
 * The phone-side half of the prompt engine, for the sports whose feeds only the phone can read
 * (the NBA CDN, ESPN's MLS summary and NFL scoreboard; decision 8 of 2026-09-22 and R1). MLB
 * is the server's: `mlb-live` runs the same rules from packages/core against the MLB feed and
 * a phone never reports an MLB moment (report_live_moment refuses it).
 *
 * `engineStep` is pure: the previous poll, this poll, the rules, and out come the reports to
 * send. The hook around it keeps the state between polls and sends them. The server dedupes
 * by event key and applies the caps, so a phone that is wrong or late costs nothing.
 */
import {
  mlsCandidates,
  nbaCandidates,
  nflScoreCandidate,
  scheduledPromptDecision,
  toSnapshot,
  type EventCandidate,
  type LiveSnapshot,
  type NbaRun,
} from '@jinx/core';

import type { LiveState } from '@/features/checkin/lock';
import { liveStatusLabel } from '@/features/live/format';

import type { LiveMomentReport } from './queries';

export type EngineState = {
  previous: LiveSnapshot | null;
  run: NbaRun | null;
  /** How many MLS key events the last poll had seen. */
  mlsSeen: number;
  /** The scheduled prompt was reported (or found already fired) by this phone. */
  scheduledReported: boolean;
  /** Event keys already reported by this phone. */
  reported: Set<string>;
};

export function initialEngineState(): EngineState {
  return { previous: null, run: null, mlsSeen: 0, scheduledReported: false, reported: new Set() };
}

export type EngineContext = {
  gameId: string;
  sport: string;
  homeName: string;
  awayName: string;
  /** Pregame home win probability, 0.5 when unknown. */
  homePrior: number | null;
};

/** The phone-side sports. MLB is the server's. */
export const PHONE_SPORTS: ReadonlySet<string> = new Set(['nba', 'mls', 'nfl']);

function reportFor(ctx: EngineContext, c: EventCandidate, inWindow: boolean): LiveMomentReport {
  return {
    gameId: ctx.gameId,
    kind: 'event',
    label: c.label,
    audience: c.audience,
    significance: c.significance,
    eventKey: c.key,
    homeScore: c.homeScore,
    awayScore: c.awayScore,
    periodLabel: c.periodLabel,
    rule: c.rule,
    benefitSide: c.benefitSide,
    inScheduledWindow: inWindow,
  };
}

/** One poll of the feed: what to report, and the state to carry to the next poll. */
export function engineStep(
  state: EngineState,
  row: LiveState,
  ctx: EngineContext,
): { reports: LiveMomentReport[]; next: EngineState } {
  const reports: LiveMomentReport[] = [];
  const extras = row.extras ?? {};
  const wp = extras.homeWp ?? null;
  const snapshot = toSnapshot(ctx.sport, row, wp);
  const periodLabel = liveStatusLabel(ctx.sport, row) ?? '';
  const next: EngineState = { ...state, previous: snapshot, reported: new Set(state.reported) };
  if (!PHONE_SPORTS.has(ctx.sport) || snapshot.status !== 'live') return { reports, next };

  const scheduled = scheduledPromptDecision(ctx.sport, snapshot);
  const inWindow = scheduled.reason === 'waiting' || scheduled.due;

  // Events since the last poll.
  const candidates: EventCandidate[] = [];
  if (ctx.sport === 'nba' && state.previous) {
    const r = nbaCandidates(state.previous, snapshot, { homeName: ctx.homeName, awayName: ctx.awayName, homePrior: ctx.homePrior, periodLabel, run: state.run });
    next.run = r.run;
    if (r.candidate) candidates.push(r.candidate);
  } else if (ctx.sport === 'nfl' && state.previous) {
    const c = nflScoreCandidate(state.previous, snapshot, { homeName: ctx.homeName, awayName: ctx.awayName, homePrior: ctx.homePrior, lastPlay: extras.lastPlay ?? null, periodLabel });
    if (c) candidates.push(c);
  } else if (ctx.sport === 'mls') {
    const plays = extras.plays ?? [];
    // The first poll only counts what is already there: nothing is a fresh moment on arrival.
    if (state.previous) {
      candidates.push(...mlsCandidates(plays, { homeName: ctx.homeName, awayName: ctx.awayName, homePrior: ctx.homePrior, seen: state.mlsSeen }));
    }
    next.mlsSeen = plays.length;
  }
  for (const c of candidates) {
    if (next.reported.has(c.key)) continue;
    next.reported.add(c.key);
    reports.push(reportFor(ctx, c, inWindow));
  }

  // The one scheduled prompt.
  if (scheduled.due && !state.scheduledReported) {
    next.scheduledReported = true;
    reports.push({
      gameId: ctx.gameId,
      kind: 'checkin',
      label: 'late in the game',
      audience: 'all',
      significance: null,
      eventKey: 'scheduled',
      homeScore: snapshot.homeScore,
      awayScore: snapshot.awayScore,
      periodLabel,
      rule: scheduled.reason,
      benefitSide: null,
      inScheduledWindow: true,
    });
  }
  return { reports, next };
}
