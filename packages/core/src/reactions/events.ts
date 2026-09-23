/**
 * Event reactions: big moments only (docs/prompts/social/03, section 2b; NBA and MLS rows from
 * 00_repo_reality.md R3). A play prompts only when it clears BOTH a whitelist and the
 * significance gate: a win-probability swing of 15 points or more, or a place on the milestone
 * list. Everything here is pure and keyed by sport; the caller supplies the live picture and
 * whatever win probability it has (MLB's own, the NBA and MLS state models, the NFL
 * approximation below), and stores `significance` on the prompt so the bar can be tuned later.
 */
import { mlsInMatchHomeWp } from '../providers/mls/detail.js';
import { modelHomeWp } from '../providers/nba/winprob.js';
import type { MlsPlay, Side } from '../types.js';

import type { EventCandidate, LiveSnapshot, PromptAudience } from './types.js';

/** The gate: a swing of this many points, or a milestone. */
export const SIGNIFICANCE_POINTS = 15;

/** Milestones and the transcendent moments carry this, so the gate never drops them. */
export const MILESTONE_SIGNIFICANCE = 100;

export function swingPoints(wpBefore: number | null, wpAfter: number | null): number | null {
  if (wpBefore == null || wpAfter == null) return null;
  return Math.round(Math.abs(wpAfter - wpBefore) * 1000) / 10;
}

/** Whether a whitelisted play also clears the significance gate. */
export function clearsGate(significance: number | null, milestone: boolean): boolean {
  return milestone || (significance != null && significance >= SIGNIFICANCE_POINTS);
}

function other(side: Side): Side {
  return side === 'home' ? 'away' : 'home';
}

function shorten(text: string, max = 110): string {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
}

// ---------------------------------------------------------------------------
// MLB: free and detailed. One `winProbability` entry per plate appearance.
// ---------------------------------------------------------------------------

/** The fields of one `/winProbability` entry this reads (docs/verification.md). */
export interface MlbLivePlay {
  about: { inning: number; halfInning: 'top' | 'bottom'; atBatIndex: number; isComplete?: boolean };
  result: {
    eventType?: string;
    event?: string;
    description?: string;
    rbi?: number;
    homeScore?: number;
    awayScore?: number;
  };
  matchup?: { batter?: { id: number; fullName: string } };
  /** Percentages, not fractions (42.4). */
  homeTeamWinProbability?: number;
}

export interface MlbPlayContext {
  homeBefore: number;
  awayBefore: number;
  /** The home side's chance before this play, 0 to 1. */
  homeWpBefore: number | null;
  /** Runs the batting side had scored in this half-inning before the play. */
  halfInningRunsBefore: number;
  /** Hits after the play, per side, from the linescore. */
  hits: { home: number; away: number } | null;
  /** Whether a batter has reached base against the fielding side all game (perfect game watch). */
  perfectSoFar?: { home: boolean; away: boolean } | null;
  /** True when the play is on the curated milestone list (a record, a franchise first). */
  milestone?: boolean;
  /** The game went final on this play. */
  gameOver?: boolean;
}

function mlbPeriodLabel(p: MlbLivePlay): string {
  const ord = ['', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th'];
  const n = p.about.inning;
  const name = ord[n] ?? `${n}th`;
  return `${p.about.halfInning === 'top' ? 'Top' : 'Bottom'} ${name}`;
}

/**
 * Whether one MLB play should prompt, and how. Null for everything the whitelist keeps out:
 * a solo home run (unless it goes ahead late, walks it off or is a milestone), an RBI single,
 * a sacrifice fly, routine scoring.
 */
export function mlbEventCandidate(play: MlbLivePlay, ctx: MlbPlayContext): EventCandidate | null {
  if (play.about.isComplete === false) return null;
  const batting: Side = play.about.halfInning === 'top' ? 'away' : 'home';
  const homeAfter = play.result.homeScore ?? ctx.homeBefore;
  const awayAfter = play.result.awayScore ?? ctx.awayBefore;
  const rbi = play.result.rbi ?? 0;
  const type = play.result.eventType ?? '';
  const desc = play.result.description ?? play.result.event ?? '';
  const wpAfter = play.homeTeamWinProbability != null ? play.homeTeamWinProbability / 100 : null;
  const significance = swingPoints(ctx.homeWpBefore, wpAfter);
  const late = play.about.inning >= 7;

  const lead = (side: Side, h: number, a: number) => (side === 'home' ? h - a : a - h);
  const leadBefore = lead(batting, ctx.homeBefore, ctx.awayBefore);
  const leadAfter = lead(batting, homeAfter, awayAfter);
  const swingsMargin = leadBefore <= 0 && leadAfter >= 0 && leadAfter !== leadBefore;
  const isHomeRun = type === 'home_run';
  const inside = /inside-the-park/i.test(desc);
  const walkOff =
    !!ctx.gameOver && batting === 'home' && play.about.inning >= 9 && leadAfter > 0 && leadBefore <= 0;

  const finish = (rule: string, audience: PromptAudience, milestone: boolean): EventCandidate | null => {
    const sig = milestone ? MILESTONE_SIGNIFICANCE : significance;
    if (!clearsGate(sig, milestone)) return null;
    return {
      key: `mlb:ab:${play.about.atBatIndex}`,
      rule,
      label: shorten(desc || rule.replace(/_/g, ' ')),
      audience,
      significance: sig ?? MILESTONE_SIGNIFICANCE,
      benefitSide: audience === 'all' ? null : audience,
      milestone,
      homeScore: homeAfter,
      awayScore: awayAfter,
      periodLabel: mlbPeriodLabel(play),
    };
  };

  // The transcendent ones first: everyone in the building gets these.
  if (ctx.gameOver && ctx.hits) {
    const fielding = other(batting);
    const noHitsAgainst = fielding === 'home' ? ctx.hits.away === 0 : ctx.hits.home === 0;
    if (noHitsAgainst && play.about.inning >= 9) {
      const perfect = ctx.perfectSoFar ? ctx.perfectSoFar[fielding] : false;
      return finish(perfect ? 'perfect_game' : 'no_hitter', 'all', true);
    }
  }
  if (walkOff) return finish(isHomeRun ? 'walk_off_home_run' : 'walk_off', 'all', true);
  if (ctx.milestone) return finish('milestone', batting, true);

  if (type === 'triple_play') return finish('triple_play', other(batting), false);
  if (isHomeRun) {
    if (rbi >= 4) return finish('grand_slam', batting, false);
    if (inside) return finish('inside_the_park_home_run', batting, false);
    if (rbi >= 2) return finish('multi_run_home_run', batting, false);
    if (late && swingsMargin) return finish('late_go_ahead_home_run', batting, false);
    return null; // a solo home run
  }
  // A 5+ run inning, once, on the play that brings the fifth run home.
  const runsOnPlay = batting === 'home' ? homeAfter - ctx.homeBefore : awayAfter - ctx.awayBefore;
  if (runsOnPlay > 0 && ctx.halfInningRunsBefore < 5 && ctx.halfInningRunsBefore + runsOnPlay >= 5) {
    return finish('five_run_inning', batting, false);
  }
  // No-hitter through 8: the last out of the 8th with a side still hitless.
  if (ctx.hits && play.about.inning === 8 && /out|strikeout|double_play/.test(type)) {
    const fielding = other(batting);
    const hitless = fielding === 'home' ? ctx.hits.away === 0 : ctx.hits.home === 0;
    if (hitless && ctx.halfInningRunsBefore === 0 && /third out|end of the 8th/i.test(desc)) {
      return finish('no_hitter_through_8', fielding, true);
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// NFL: free and coarse. ESPN's scoreboard shows score changes; the play arrives overnight.
// ---------------------------------------------------------------------------

const NFL_GAME_SECONDS = 4 * 15 * 60;

/**
 * A rough home win probability from margin and time, the NBA model's shape with football's
 * scale: a 7-point lead at the half is about 74%, the same lead with two minutes left about
 * 93%. It only feeds the significance gate on a coarse live prompt; the overnight relabel
 * replaces it with nflverse's own `home_wp` (docs/verification.md).
 */
export function nflApproxHomeWp(margin: number, secondsLeft: number, homePrior = 0.5): number {
  return modelHomeWp(margin, Math.max(0, secondsLeft), homePrior, {
    marginScale: 0.18,
    priorWeight: 1.0,
  });
}

/** Seconds left in the game for a quarters sport, from the period and the period clock. */
export function nflSecondsLeftInGame(period: number | null, clockSeconds: number | null): number {
  const p = period ?? 1;
  const c = clockSeconds ?? 15 * 60;
  if (p > 4) return c; // overtime: what is on the clock is what is left
  return (4 - p) * 15 * 60 + c;
}

export interface NflCoarseContext {
  homeName: string;
  awayName: string;
  homePrior?: number | null;
  /** ESPN's `situation.lastPlay` when the board carries one: a defensive or special-teams score shows here. */
  lastPlay?: { text?: string | null; type?: string | null } | null;
  periodLabel: string;
}

const RETURN_SCORE = /interception return|fumble return|kickoff return|punt return|blocked (punt|field goal)|safety/i;

/**
 * Between two polls of the NFL scoreboard: a score that swings the margin (go-ahead or tying),
 * or a defensive or special-teams score when the board names it. Nothing else prompts live:
 * a chip-shot field goal and a 2-yard plunge look the same as a 90-yard run from here, and it is
 * better to miss a moment than to prompt on a routine one. The overnight relabel fixes the words.
 */
export function nflScoreCandidate(
  prev: LiveSnapshot,
  next: LiveSnapshot,
  ctx: NflCoarseContext,
): EventCandidate | null {
  const dHome = next.homeScore - prev.homeScore;
  const dAway = next.awayScore - prev.awayScore;
  if (dHome <= 0 && dAway <= 0) return null;
  const side: Side = dHome > 0 ? 'home' : 'away';
  const points = side === 'home' ? dHome : dAway;
  const lead = (h: number, a: number) => (side === 'home' ? h - a : a - h);
  const before = lead(prev.homeScore, prev.awayScore);
  const after = lead(next.homeScore, next.awayScore);
  const swingsMargin = before <= 0 && after >= 0 && after !== before;
  const lastType = `${ctx.lastPlay?.type ?? ''} ${ctx.lastPlay?.text ?? ''}`;
  const returnScore = RETURN_SCORE.test(lastType);
  if (!swingsMargin && !returnScore) return null;

  const secondsLeft = nflSecondsLeftInGame(next.period, next.clockSeconds);
  const secondsBefore = nflSecondsLeftInGame(prev.period, prev.clockSeconds);
  const prior = ctx.homePrior ?? 0.5;
  const wpBefore = nflApproxHomeWp(prev.homeScore - prev.awayScore, secondsBefore, prior);
  const wpAfter = nflApproxHomeWp(next.homeScore - next.awayScore, secondsLeft, prior);
  const significance = swingPoints(wpBefore, wpAfter);
  if (!clearsGate(significance, false)) return null;

  const team = side === 'home' ? ctx.homeName : ctx.awayName;
  const what =
    points >= 6 ? 'Touchdown' : points === 3 ? 'Field goal' : points === 2 && returnScore ? 'Safety' : 'Score';
  const rule = returnScore ? 'return_score' : after > 0 ? 'go_ahead_score' : 'tying_score';
  return {
    key: `nfl:score:${next.period ?? 0}:${next.homeScore}-${next.awayScore}`,
    rule,
    label: `${what}, ${team}`,
    audience: side,
    significance: significance ?? 0,
    benefitSide: side,
    milestone: false,
    homeScore: next.homeScore,
    awayScore: next.awayScore,
    periodLabel: ctx.periodLabel,
  };
}

// ---------------------------------------------------------------------------
// NBA: the CDN scoreboard, one poll every 30 seconds.
// ---------------------------------------------------------------------------

/** A scoring run in progress, carried from poll to poll by the caller. */
export interface NbaRun {
  side: Side;
  points: number;
  /** Already prompted for this run. */
  prompted: boolean;
}

export interface NbaContext {
  homeName: string;
  awayName: string;
  homePrior?: number | null;
  periodLabel: string;
  run: NbaRun | null;
}

export const NBA_RUN_POINTS = 15;

/**
 * Between two polls: a go-ahead score inside the final two minutes, a buzzer-beater to end a
 * period (a score landing as the clock ran out), or a 15-0 run. A four-point play cannot be
 * told from two possessions on a 30-second poll, so it is not attempted here. Returns the
 * candidate, if any, and the run to carry forward.
 */
export function nbaCandidates(
  prev: LiveSnapshot,
  next: LiveSnapshot,
  ctx: NbaContext,
): { candidate: EventCandidate | null; run: NbaRun | null } {
  const dHome = next.homeScore - prev.homeScore;
  const dAway = next.awayScore - prev.awayScore;
  let run = ctx.run;
  // The run: one side scoring while the other does not, across polls.
  if (dHome > 0 && dAway > 0) run = null;
  else if (dHome > 0 || dAway > 0) {
    const side: Side = dHome > 0 ? 'home' : 'away';
    const points = side === 'home' ? dHome : dAway;
    run = run && run.side === side ? { ...run, points: run.points + points } : { side, points, prompted: false };
  }
  if (dHome <= 0 && dAway <= 0) return { candidate: null, run };

  const side: Side = dHome > 0 && dAway <= 0 ? 'home' : dAway > 0 && dHome <= 0 ? 'away' : dHome >= dAway ? 'home' : 'away';
  const lead = (h: number, a: number) => (side === 'home' ? h - a : a - h);
  const before = lead(prev.homeScore, prev.awayScore);
  const after = lead(next.homeScore, next.awayScore);
  const prior = ctx.homePrior ?? 0.5;
  const secsBefore = nbaSecondsLeft(prev);
  const secsAfter = nbaSecondsLeft(next);
  const wpBefore = modelHomeWp(prev.homeScore - prev.awayScore, secsBefore, prior);
  const wpAfter = modelHomeWp(next.homeScore - next.awayScore, secsAfter, prior);
  const significance = swingPoints(wpBefore, wpAfter) ?? 0;
  const team = side === 'home' ? ctx.homeName : ctx.awayName;
  const make = (rule: string, label: string, milestone: boolean): EventCandidate | null =>
    clearsGate(milestone ? MILESTONE_SIGNIFICANCE : significance, milestone)
      ? {
          key: `nba:score:${next.period ?? 0}:${next.homeScore}-${next.awayScore}`,
          rule,
          label,
          audience: side,
          significance: milestone ? MILESTONE_SIGNIFICANCE : significance,
          benefitSide: side,
          milestone,
          homeScore: next.homeScore,
          awayScore: next.awayScore,
          periodLabel: ctx.periodLabel,
        }
      : null;

  const late = (next.period ?? 0) >= 4 && next.clockSeconds != null && next.clockSeconds <= 120;
  if (late && before <= 0 && after > 0) {
    return { candidate: make('late_go_ahead_score', `Go-ahead score, ${team}`, false), run };
  }
  // A buzzer-beater: the previous poll had seconds left in the period and this one is past it.
  const periodEnded =
    (next.period ?? 0) > (prev.period ?? 0) || (next.periodState === 'end' && prev.periodState !== 'end');
  if (periodEnded && prev.clockSeconds != null && prev.clockSeconds <= 5) {
    return { candidate: make('buzzer_beater', `Buzzer-beater, ${team}`, true), run };
  }
  if (run && run.side === side && run.points >= NBA_RUN_POINTS && !run.prompted) {
    return {
      candidate: make('run_15_0', `${run.points}-0 run, ${team}`, true),
      run: { ...run, prompted: true },
    };
  }
  return { candidate: null, run };
}

function nbaSecondsLeft(l: LiveSnapshot): number {
  const p = l.period ?? 1;
  const c = l.clockSeconds ?? 12 * 60;
  return p > 4 ? c : (4 - p) * 12 * 60 + c;
}

// ---------------------------------------------------------------------------
// MLS: ESPN's summary, whose key events name the play.
// ---------------------------------------------------------------------------

export interface MlsContext {
  homeName: string;
  awayName: string;
  /** Pregame, from the three-way Elo; 0.5 when unknown. */
  homePrior?: number | null;
  /** How many key events the previous poll had already seen. */
  seen: number;
}

const GOAL = /^Goal/i;

/**
 * The plays since the last poll: a goal in the 85th minute or later, a red card, a penalty, a
 * hat trick, a shootout (00_repo_reality.md R3). Goals are gated on the in-match model's swing;
 * the rest are on the whitelist as moments in their own right.
 */
export function mlsCandidates(plays: readonly MlsPlay[], ctx: MlsContext): EventCandidate[] {
  const out: EventCandidate[] = [];
  const goalsBy = new Map<string, number>();
  const prior = { home: ctx.homePrior ?? 0.5, away: 1 - (ctx.homePrior ?? 0.5) };
  let home = 0;
  let away = 0;
  plays.forEach((p, i) => {
    const before = { home, away };
    home = p.homeScore;
    away = p.awayScore;
    const isGoal = GOAL.test(p.type);
    if (isGoal && p.scorerName) goalsBy.set(p.scorerName, (goalsBy.get(p.scorerName) ?? 0) + 1);
    if (i < ctx.seen) return;
    const side: Side | null = p.scoringSide ?? sideOfText(p.text, ctx);
    const team = side ? (side === 'home' ? ctx.homeName : ctx.awayName) : null;
    const minutesLeft = Math.max(0, 90 - p.minute);
    const push = (rule: string, label: string, audience: PromptAudience, milestone: boolean, sig: number) => {
      if (!clearsGate(sig, milestone)) return;
      out.push({
        key: `mls:event:${p.seq}`,
        rule,
        label,
        audience,
        significance: sig,
        benefitSide: audience === 'all' ? null : audience,
        milestone,
        homeScore: p.homeScore,
        awayScore: p.awayScore,
        periodLabel: p.clock,
      });
    };
    if (isGoal && side) {
      const wpBefore = mlsInMatchHomeWp(before.home, before.away, minutesLeft, prior);
      const wpAfter = mlsInMatchHomeWp(home, away, minutesLeft, prior);
      const sig = swingPoints(wpBefore, wpAfter) ?? 0;
      const count = p.scorerName ? goalsBy.get(p.scorerName) ?? 0 : 0;
      if (count === 3) push('hat_trick', `Hat trick, ${p.scorerName}`, side, true, MILESTONE_SIGNIFICANCE);
      else if (p.minute >= 85 || p.period >= 3) push('late_goal', `Goal, ${team}`, side, false, sig);
      else if (/Penalty/i.test(p.type)) push('penalty', `Penalty, ${team}`, side, false, sig);
      return;
    }
    if (/Red Card/i.test(p.type)) {
      const benefits = side ? other(side) : null;
      push('red_card', side ? `Red card, ${team}` : 'Red card', benefits ?? 'all', true, MILESTONE_SIGNIFICANCE);
      return;
    }
    if (/Penalty/i.test(p.type) && side) {
      push('penalty', `Penalty, ${team}`, side, true, MILESTONE_SIGNIFICANCE);
      return;
    }
    if (/Start Shootout/i.test(p.type)) push('shootout', 'Penalty shootout', 'all', true, MILESTONE_SIGNIFICANCE);
  });
  return out;
}

function sideOfText(text: string, ctx: { homeName: string; awayName: string }): Side | null {
  const t = text.toLowerCase();
  if (ctx.homeName && t.includes(ctx.homeName.toLowerCase())) return 'home';
  if (ctx.awayName && t.includes(ctx.awayName.toLowerCase())) return 'away';
  return null;
}
