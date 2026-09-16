/**
 * NFL per-play win probability and the Relive story built from it (SPEC 4.3b, 6.19).
 *
 * The MLB half of this reads a dedicated endpoint; nflverse instead ships win probability
 * inside the play-by-play everything else already comes from. `home_wp` is the home team's
 * probability as a fraction, and `sp` marks a play on which points were scored, so the
 * same two outputs — a timeline and a scoring-play story — fall out of rows the pipeline
 * has already downloaded.
 *
 * As with MLB, step text is the provider's own play description verbatim. Nothing here is
 * model-written.
 */
import type { WpPoint, StoryStep } from '../mlb/winprob.js';

export type { WpPoint, StoryStep };

/** The play-by-play columns this reads. A superset lives in NflversePbpRow. */
export type PbpWpRow = {
  play_id: number | null;
  qtr: number | null;
  desc: string | null;
  /** 1 when the play scored points. */
  sp: number | null;
  home_wp: number | null;
  total_home_score: number | null;
  total_away_score: number | null;
  time_of_day: string | null;
};

/**
 * "1st quarter", "Overtime".
 *
 * nflverse numbers overtime as quarter 5 and beyond, so anything past the fourth is
 * overtime rather than a "5th quarter"; a second overtime period is numbered.
 */
export function quarterLabel(qtr: number): string {
  if (qtr <= 4) {
    const ordinal = ['', '1st', '2nd', '3rd', '4th'][qtr] ?? `${qtr}th`;
    return `${ordinal} quarter`;
  }
  return qtr === 5 ? 'Overtime' : `Overtime ${qtr - 4}`;
}

/**
 * Every play that carries a probability, in order.
 *
 * `half` exists to match the MLB shape, which the `game_wp_timeline` column set follows.
 * Football has halves, so quarters 1 and 2 are the top and 3 onward the bottom; overtime
 * stays with the second half rather than inventing a third value.
 *
 * A play with no readable probability is dropped rather than guessed, for the same reason
 * as MLB: a gap in the line is honest and an invented point is not.
 */
export function parsePbpWinProbability(rows: readonly PbpWpRow[]): WpPoint[] {
  const out: WpPoint[] = [];
  for (const r of rows) {
    const wp = r.home_wp;
    const qtr = r.qtr;
    if (typeof wp !== 'number' || !Number.isFinite(wp) || !qtr) continue;
    out.push({
      seq: out.length + 1,
      period: qtr,
      half: qtr <= 2 ? 'top' : 'bottom',
      homeWp: Math.min(1, Math.max(0, wp)),
      occurredAt: r.time_of_day ?? null,
    });
  }
  return out;
}

/**
 * Pregame, one step per scoring play, then the final (SPEC 6.19).
 *
 * Scores are read off the play rather than accumulated, so a step shows what the
 * scoreboard actually read. An extra point and the touchdown before it are two scoring
 * plays in nflverse and stay two steps, because that is what the scoreboard did.
 */
export function buildPbpStorySteps(
  rows: readonly PbpWpRow[],
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
      ? `${final.homeName} were ${Math.round(first.homeWp * 100)}% to win at kickoff.`
      : `${final.awayName} at ${final.homeName}.`,
  });

  // Walk rows and points together: parsePbpWinProbability keeps their order but drops rows
  // it could not read, so the two indexes are not shared.
  let pi = 0;
  for (const r of rows) {
    const usable = typeof r.home_wp === 'number' && Number.isFinite(r.home_wp) && !!r.qtr;
    const point = usable ? points[pi++] : undefined;
    if (!point) continue;
    if (r.sp !== 1) continue;
    const text = (r.desc ?? '').trim();
    if (!text) continue;
    steps.push({
      seq: steps.length + 1,
      wpSeq: point.seq,
      awayScore: r.total_away_score ?? 0,
      homeScore: r.total_home_score ?? 0,
      label: quarterLabel(point.period),
      text,
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
