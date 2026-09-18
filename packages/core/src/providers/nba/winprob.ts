/**
 * NBA win probability and the Relive story built from it (SPEC 4.3b, 6.19).
 *
 * The NBA's own win probability endpoint is dead (docs/verification.md), so the line comes
 * from ESPN's per-play `winprobability` where ESPN has it (2017-18 on) and otherwise from the
 * state model below: the home side's chance from the margin and the time left, fitted on
 * real play-by-play and recorded in docs/elo-backtest.md. Either way the story steps come
 * from the scoring timeline and never depend on the line.
 *
 * Step rule (decided for the NBA, 2026-09-17): an NBA game has 90 to 120 scoring plays, far
 * more than one step each can carry at 1.7 s a step. So a step is kept for the pregame; every
 * lead change and tie; every score in the last three minutes of regulation and all of
 * overtime; the last score of each period; then the final. Capped at MAX_STEPS by dropping
 * the earliest ties first, never a lead change in the last three minutes or the final.
 */
import type { ScoringEvent, ScoringKind, Side } from '../../types.js';
import type { EspnPlay, EspnSummary } from '../../ingest/nbaClient.js';
import type { StoryStep, WpPoint } from '../mlb/winprob.js';
import { clockToSeconds } from './ids.js';

export const MAX_STEPS = 40;
const LATE_SECONDS = 180;
const REGULATION_PERIODS = 4;
const PERIOD_SECONDS = 720;

/** Seconds of game time left in regulation-or-overtime from a period and its clock. */
export function secondsLeftInGame(period: number, periodSecondsRemaining: number | null): number {
  const left = periodSecondsRemaining ?? 0;
  if (period <= REGULATION_PERIODS) return (REGULATION_PERIODS - period) * PERIOD_SECONDS + left;
  return left;
}

// ---------------------------------------------------------------------------
// The state model: for games ESPN has no line for
// ---------------------------------------------------------------------------

/**
 * The home side's logit is the margin over the spread of what is still to come, which shrinks
 * with the square root of the time left (a lead of 10 with a minute to go is decided; at the
 * half it is a strong favourite), plus the pregame prior fading out as the game goes on.
 * `marginScale` and `priorWeight` were fitted on real games, docs/elo-backtest.md ("NBA
 * in-game model").
 */
export const NBA_WP_MODEL = { marginScale: 0.1, priorWeight: 1.0 } as const;

function logistic(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

function logit(p: number): number {
  const c = Math.min(Math.max(p, 1e-4), 1 - 1e-4);
  return Math.log(c / (1 - c));
}

/**
 * Home win probability from the state of the game. `homePrior` is the pregame chance (Elo);
 * 0.5 when unknown. At the final buzzer a lead is certain, a tie means overtime and stays at
 * the model's value.
 */
export function modelHomeWp(
  margin: number,
  secondsLeft: number,
  homePrior = 0.5,
  params: { marginScale: number; priorWeight: number } = NBA_WP_MODEL,
): number {
  if (secondsLeft <= 0 && margin !== 0) return margin > 0 ? 1 : 0;
  const fraction = Math.min(1, secondsLeft / (REGULATION_PERIODS * PERIOD_SECONDS));
  const spread = Math.sqrt(Math.max(secondsLeft, 1) / (REGULATION_PERIODS * PERIOD_SECONDS));
  const x = (params.marginScale * margin) / spread + params.priorWeight * fraction * logit(homePrior);
  return Math.min(1, Math.max(0, logistic(x)));
}

/** What the model reads off a scoring row: the same columns `game_scoring_timeline` holds. */
export type ScoreState = Pick<ScoringEvent, 'period' | 'clock' | 'homeScore' | 'awayScore' | 'occurredAt'>;

/** One point per scoring row from the model, a pregame point first, ending decided. */
export function modelWinProbability(rows: readonly ScoreState[], homePrior = 0.5): WpPoint[] {
  const out: WpPoint[] = [];
  out.push({
    seq: 1,
    period: 1,
    half: 'top',
    homeWp: modelHomeWp(0, REGULATION_PERIODS * PERIOD_SECONDS, homePrior),
    occurredAt: null,
  });
  let last: ScoreState | null = null;
  for (const p of rows) {
    const left = secondsLeftInGame(p.period, clockToSeconds(p.clock));
    out.push({
      seq: out.length + 1,
      period: p.period,
      half: p.period <= 2 ? 'top' : 'bottom',
      homeWp: modelHomeWp(p.homeScore - p.awayScore, left, homePrior),
      occurredAt: p.occurredAt,
    });
    last = p;
  }
  if (last && last.homeScore !== last.awayScore) {
    out.push({
      seq: out.length + 1,
      period: last.period,
      half: 'bottom',
      homeWp: last.homeScore > last.awayScore ? 1 : 0,
      occurredAt: last.occurredAt,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// ESPN's line
// ---------------------------------------------------------------------------

/** A probability point and the ESPN play it sits on. */
export interface EspnWpPoint extends WpPoint {
  playId: string;
  homeScore: number;
  awayScore: number;
  secondsLeft: number;
}

/** ESPN's `winprobability[]` joined to its `plays[]` by play id, in play order. */
export function parseEspnWinProbability(summary: EspnSummary): EspnWpPoint[] {
  const plays = new Map<string, EspnPlay>();
  for (const p of summary.plays ?? []) plays.set(p.id, p);
  const out: EspnWpPoint[] = [];
  for (const w of summary.winprobability ?? []) {
    const play = plays.get(w.playId);
    const wp = w.homeWinPercentage;
    if (!play || typeof wp !== 'number' || !Number.isFinite(wp)) continue;
    const period = play.period?.number ?? 1;
    out.push({
      seq: out.length + 1,
      period,
      half: period <= 2 ? 'top' : 'bottom',
      homeWp: Math.min(1, Math.max(0, wp)),
      occurredAt: play.wallclock ? new Date(Date.parse(play.wallclock)).toISOString() : null,
      playId: play.id,
      homeScore: play.homeScore ?? 0,
      awayScore: play.awayScore ?? 0,
      secondsLeft: secondsLeftInGame(period, clockToSeconds(play.clock?.displayValue)),
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Story steps
// ---------------------------------------------------------------------------

export type NbaStoryStep = StoryStep & {
  kind: ScoringKind | null;
  scorerProviderId: string | null;
  scorerName: string | null;
};

/** "1st quarter", "Overtime", "Overtime 2". */
export function nbaPeriodLabel(period: number): string {
  if (period <= 4) return `${['', '1st', '2nd', '3rd', '4th'][period] ?? `${period}th`} quarter`;
  return period === 5 ? 'Overtime' : `Overtime ${period - 4}`;
}

/** A scoring row with what the step rule needs to know about it. */
export interface StepCandidate {
  event: ScoringEvent;
  /** Seconds left in the game at the score. */
  secondsLeft: number;
  /** The winning side's lead before the score, from the previous row. */
  leadBefore: number;
  leadAfter: number;
  lastOfPeriod: boolean;
}

/** Why a scoring row was kept as a step. Ranked: a lower number is dropped first under the cap. */
export type StepReason = 'final_score' | 'late' | 'lead_change' | 'period_end' | 'tie';

export function stepReason(c: StepCandidate): StepReason | null {
  const overtime = c.event.period > REGULATION_PERIODS;
  if (overtime || c.secondsLeft <= LATE_SECONDS) return 'late';
  const beforeSign = Math.sign(c.leadBefore);
  const afterSign = Math.sign(c.leadAfter);
  if (afterSign !== 0 && beforeSign !== afterSign) return 'lead_change';
  if (c.lastOfPeriod) return 'period_end';
  if (c.leadAfter === 0) return 'tie';
  return null;
}

const RANK: Record<StepReason, number> = {
  tie: 0,
  period_end: 1,
  lead_change: 2,
  late: 3,
  final_score: 4,
};

/** The rows the rule keeps, in game order, at most MAX_STEPS. */
export function selectStepRows(rows: readonly ScoringEvent[]): { event: ScoringEvent; reason: StepReason }[] {
  const candidates: StepCandidate[] = [];
  rows.forEach((event, i) => {
    const prev = rows[i - 1];
    const next = rows[i + 1];
    candidates.push({
      event,
      secondsLeft: secondsLeftInGame(event.period, clockToSeconds(event.clock)),
      leadBefore: prev ? prev.homeScore - prev.awayScore : 0,
      leadAfter: event.homeScore - event.awayScore,
      lastOfPeriod: next == null || next.period !== event.period,
    });
  });
  let kept = candidates
    .map((c) => ({ event: c.event, reason: stepReason(c) }))
    .filter((c): c is { event: ScoringEvent; reason: StepReason } => c.reason != null);
  if (kept.length > 0) kept[kept.length - 1]!.reason = 'final_score';
  while (kept.length > MAX_STEPS) {
    let lowest = 0;
    for (let i = 1; i < kept.length; i++) {
      if (RANK[kept[i]!.reason] < RANK[kept[lowest]!.reason]) lowest = i;
    }
    if (RANK[kept[lowest]!.reason] >= RANK.late) break;
    kept = kept.filter((_, i) => i !== lowest);
  }
  return kept;
}

/**
 * The story: pregame, the selected scoring rows, the final. Each step sits on the probability
 * point nearest its score: for ESPN points, the last point whose score matches; for the model,
 * the point built from that scoring play (one per scoring row, pregame first).
 */
export function buildNbaStorySteps(
  rows: readonly ScoringEvent[],
  points: readonly WpPoint[],
  final: { awayScore: number; homeScore: number; awayName: string; homeName: string },
  pointFor: (event: ScoringEvent, index: number) => number,
): NbaStoryStep[] {
  const steps: NbaStoryStep[] = [];
  const first = points[0];
  steps.push({
    seq: 1,
    wpSeq: first?.seq ?? 1,
    awayScore: 0,
    homeScore: 0,
    label: 'Pregame',
    text: first
      ? `${final.homeName} were ${Math.round(first.homeWp * 100)}% to win at tip-off.`
      : `${final.awayName} at ${final.homeName}.`,
    kind: null,
    scorerProviderId: null,
    scorerName: null,
  });
  const indexOf = new Map<ScoringEvent, number>();
  rows.forEach((r, i) => indexOf.set(r, i));
  for (const { event } of selectStepRows(rows)) {
    const text = event.description.trim();
    if (!text) continue;
    steps.push({
      seq: steps.length + 1,
      wpSeq: pointFor(event, indexOf.get(event) ?? 0),
      awayScore: event.awayScore,
      homeScore: event.homeScore,
      label: nbaPeriodLabel(event.period),
      text,
      kind: event.kind ?? null,
      scorerProviderId: event.scorerProviderId ?? null,
      scorerName: event.scorerName ?? null,
    });
  }
  const last = points[points.length - 1];
  const winner = final.homeScore > final.awayScore ? final.homeName : final.awayName;
  steps.push({
    seq: steps.length + 1,
    wpSeq: last?.seq ?? first?.seq ?? 1,
    awayScore: final.awayScore,
    homeScore: final.homeScore,
    label: 'Final',
    text: `${winner} win ${Math.max(final.homeScore, final.awayScore)}–${Math.min(final.homeScore, final.awayScore)}.`,
    kind: null,
    scorerProviderId: null,
    scorerName: null,
  });
  return steps;
}

/**
 * Which ESPN point a scoring row sits on: the first point at or after which the score reads
 * the row's score, searching forward from the previous match so a repeated score (say 50-50
 * twice) lands on its own play.
 */
export function espnPointFinder(points: readonly EspnWpPoint[]): (event: ScoringEvent) => number {
  let cursor = 0;
  return (event) => {
    for (let i = cursor; i < points.length; i++) {
      const p = points[i]!;
      if (p.homeScore === event.homeScore && p.awayScore === event.awayScore) {
        cursor = i;
        return p.seq;
      }
    }
    return points[Math.min(cursor, points.length - 1)]?.seq ?? 1;
  };
}

/** Which model point a scoring row sits on: the pregame point is seq 1, row i is seq i + 2. */
export function modelPointFinder(points: readonly WpPoint[]): (event: ScoringEvent, index: number) => number {
  return (_event, index) => Math.min(index + 2, points.length);
}

export function scoringSideOf(prev: ScoringEvent | undefined, row: ScoringEvent): Side {
  return row.homeScore > (prev?.homeScore ?? 0) ? 'home' : 'away';
}
