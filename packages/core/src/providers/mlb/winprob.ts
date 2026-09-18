/**
 * MLB per-play win probability and the Relive story built from it (SPEC 4.3b, 6.19).
 *
 * `GET /v1/game/{gamePk}/winProbability` gives one entry per plate appearance. See
 * docs/verification.md: the probabilities are percentages, not fractions, and the series
 * ends at 100 for the winner. No state-based model is needed for MLB.
 */
import { mlbScorer, type Scorer } from '../../scoring.js';
import type { ScoringKind } from '../../types.js';
import { runScoredOn, type MlbRunner } from './parse.js';

export type WpPoint = {
  seq: number;
  period: number;
  half: 'top' | 'bottom';
  /** Home team's win probability, 0 to 1. */
  homeWp: number;
  occurredAt: string | null;
};

export type StoryStep = {
  seq: number;
  /** The win probability point this step sits on. */
  wpSeq: number;
  awayScore: number;
  homeScore: number;
  /** Shown in the scorebug, e.g. "Top 9th" or "Pregame". */
  label: string;
  /** Templated from play-by-play. Never model-written (SPEC 6.18 keeps generation separate). */
  text: string;
  /** What the score was (`scoring.ts`), on the steps that are a score. Null or absent otherwise. */
  kind?: ScoringKind | null;
  /** Who it belongs to, by the same rule as the scoring timeline: the batter, the touchdown scorer, the field goal kicker. */
  scorerProviderId?: string | null;
  scorerName?: string | null;
};

/**
 * One entry of `/winProbability`: the same play object as `liveData.plays.allPlays`, plus the
 * probability (verified against the live endpoint, docs/verification.md).
 */
export type RawEntry = {
  about?: { inning?: number; halfInning?: string; startTime?: string };
  result?: {
    description?: string;
    event?: string;
    eventType?: string;
    rbi?: number;
    awayScore?: number;
    homeScore?: number;
  };
  matchup?: { batter?: { id: number; fullName: string } };
  runners?: MlbRunner[];
  homeTeamWinProbability?: number;
};

/** The scorer of a scoring entry, by the timeline's rule (`mlbScorer`). */
function entryScorer(e: RawEntry): Scorer {
  return mlbScorer({
    eventType: e.result?.eventType ?? '',
    description: e.result?.description ?? '',
    rbi: e.result?.rbi ?? 0,
    batterId: e.matchup?.batter ? String(e.matchup.batter.id) : '',
    batterName: e.matchup?.batter?.fullName ?? '',
    runScoredOn: runScoredOn({ result: e.result ?? {}, runners: e.runners ?? [] }),
  });
}

const ORDINALS = ['', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th'];

/** "Top 9th", "Bottom 12th". Extra innings get a plain ordinal suffix. */
export function periodLabel(period: number, half: 'top' | 'bottom'): string {
  const side = half === 'top' ? 'Top' : 'Bottom';
  const n =
    ORDINALS[period] ??
    `${period}${period % 10 === 1 && period !== 11 ? 'st' : period % 10 === 2 && period !== 12 ? 'nd' : period % 10 === 3 && period !== 13 ? 'rd' : 'th'}`;
  return `${side} ${n}`;
}

function half(raw: string | undefined): 'top' | 'bottom' | null {
  if (raw === 'top' || raw === 'bottom') return raw;
  return null;
}

/**
 * Every plate appearance that carries a probability, in order.
 *
 * Entries without a probability or a recognisable half-inning are dropped rather than
 * guessed, because a gap in the line is honest and an invented point is not.
 */
export function parseWinProbability(entries: readonly RawEntry[]): WpPoint[] {
  const out: WpPoint[] = [];
  for (const e of entries) {
    const pct = e.homeTeamWinProbability;
    const h = half(e.about?.halfInning);
    const period = e.about?.inning;
    if (typeof pct !== 'number' || !Number.isFinite(pct) || h == null || !period) continue;
    out.push({
      seq: out.length + 1,
      period,
      half: h,
      // The feed is a percentage; the column is a fraction. See docs/verification.md.
      homeWp: Math.min(1, Math.max(0, pct / 100)),
      occurredAt: e.about?.startTime ?? null,
    });
  }
  return out;
}

/**
 * The play's own description when it says who scored. A run that comes home in the middle of a
 * plate appearance (a wild pitch, a steal of home) is not mentioned in the appearance's result,
 * so "strikes out swinging" alone would sit under a changed score; say what happened first.
 */
function scoringText(description: string | undefined, runs: number, team: string): string {
  const text = description?.trim() ?? '';
  if (/\bscores\b|\bhomers\b|\bhome run\b|\bgrand slam\b/i.test(text)) return text;
  const lead = `${team} score ${runs === 1 ? 'a run' : `${runs} runs`} during the at-bat.`;
  return text ? `${lead} ${text}` : lead;
}

/**
 * Pregame, one step per scoring play, then the final (SPEC 6.19).
 *
 * Scores come from the entries themselves rather than being accumulated, so a step always
 * shows what the scoreboard actually read. The personal line the spec wants on the final
 * step is computed at view time and deliberately not stored.
 */
export function buildStorySteps(
  entries: readonly RawEntry[],
  points: readonly WpPoint[],
  final: { awayScore: number; homeScore: number; awayName: string; homeName: string },
): StoryStep[] {
  const steps: StoryStep[] = [];
  const first = points[0];
  steps.push({
    seq: 1,
    wpSeq: first?.seq ?? 1,
    awayScore: 0,
    homeScore: 0,
    label: 'Pregame',
    text: first
      ? `${final.homeName} were ${Math.round(first.homeWp * 100)}% to win before first pitch.`
      : `${final.awayName} at ${final.homeName}.`,
  });

  // Walk entries and points together: parseWinProbability keeps their order, but drops
  // entries it could not read, so the index is not shared.
  //
  // A scoring play is one where the scoreboard changed, NOT one with an RBI. A run that comes
  // home on a double play, an error, a wild pitch or a balk carries no RBI, and keying on RBI
  // dropped those steps entirely: Braves at Nationals on 2023-03-30 jumped from 3-1 to 4-2 and
  // ended 6-2 on a 7-2 final. The score is tracked across every entry, usable or not, so a
  // dropped entry cannot make the next one look like it scored twice.
  let pi = 0;
  let prevAway = 0;
  let prevHome = 0;
  for (const e of entries) {
    const h = half(e.about?.halfInning);
    const usable = typeof e.homeTeamWinProbability === 'number' && h != null && !!e.about?.inning;
    const point = usable ? points[pi++] : undefined;
    const awayScore = e.result?.awayScore ?? prevAway;
    const homeScore = e.result?.homeScore ?? prevHome;
    const runs = awayScore - prevAway + (homeScore - prevHome);
    const scoredForAway = awayScore > prevAway;
    prevAway = awayScore;
    prevHome = homeScore;
    if (!point || runs <= 0) continue;
    steps.push({
      seq: steps.length + 1,
      wpSeq: point.seq,
      awayScore,
      homeScore,
      label: periodLabel(point.period, point.half),
      text: scoringText(
        e.result?.description,
        runs,
        scoredForAway ? final.awayName : final.homeName,
      ),
      ...entryScorer(e),
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
    text:
      final.homeScore === final.awayScore
        ? `Tied ${final.homeScore}–${final.awayScore}.`
        : `${winner} win ${Math.max(final.homeScore, final.awayScore)}–${Math.min(final.homeScore, final.awayScore)}.`,
  });
  return steps;
}
