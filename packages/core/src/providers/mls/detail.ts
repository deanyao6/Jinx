/**
 * MLS detail and Relive from ESPN's `summary?event=` (next-wave E.4, 2026-09-22; the shapes are
 * in docs/verification.md and ingest/fixtures/mls/espn_summary_detail_*).
 *
 * What the summary gives: `rosters[].roster[]` (every player of the squad with `starter`,
 * `subbedIn`, `subbedOut`, `position` and a `stats[]` line: goals, assists, goals conceded,
 * cards); `keyEvents[]` (kickoff, every goal with the score in its text, cards, substitutions,
 * halftime, extra time, the start of a shootout and the end, each with the match clock and a
 * wall clock); `header.competitions[0]` (status, scores, shootout scores). It has no
 * win-probability series (the NBA summary does), so the Relive line is a state model here: a
 * Poisson estimate of the remaining goals from the pregame three-way probabilities, decorative
 * like the NBA's model line; the story steps never depend on it.
 */
import { isGoodGame, type BoxLine } from '../../goodGame.js';
import { threeWayProbabilities } from '../../elo.js';
import type { StoryStep, WpPoint } from '../mlb/winprob.js';
import type {
  Appearance,
  CanonicalGame,
  CanonicalGameDetail,
  GameEvent,
  MlsPlay,
  MlsScoringKind,
  ScoringEvent,
  Side,
} from '../../types.js';
import { mlsSummaryFinalAt, type MlsSummary } from './parse.js';

export interface MlsSummaryDetail extends MlsSummary {
  header?: {
    competitions?: {
      date?: string;
      status?: {
        type: { name: string; state: string; completed: boolean };
        displayClock?: string;
        period?: number;
      };
      competitors?: {
        homeAway: 'home' | 'away';
        score?: string | number;
        shootoutScore?: number | null;
        winner?: boolean;
        team?: { id?: string; displayName?: string };
      }[];
    }[];
  };
  rosters?: {
    homeAway: 'home' | 'away';
    team?: { id?: string | number; displayName?: string; abbreviation?: string };
    roster?: {
      active?: boolean;
      starter?: boolean;
      subbedIn?: boolean;
      subbedOut?: boolean;
      jersey?: string;
      position?: { abbreviation?: string; name?: string };
      athlete?: { id: string | number; displayName?: string; fullName?: string };
      stats?: { name: string; value?: number }[];
    }[];
  }[];
  gameInfo?: { attendance?: number };
}

/**
 * Every key event of the summary as a play, with the score as it stood after it: the live
 * feed's plays (features/live/feeds.ts, for the reaction rules) and the detail's, from one
 * reading of ESPN's `keyEvents`.
 */
export function parseMlsKeyEvents(summary: Pick<MlsSummaryDetail, 'keyEvents'>): MlsPlay[] {
  const events = [...(summary.keyEvents ?? [])].map((e, i) => ({ e, i }));
  const plays: MlsPlay[] = [];
  let home = 0;
  let away = 0;
  const goalsByName = new Map<string, number>();
  for (const { e, i } of events) {
    const type = e.type?.text ?? '';
    const period = e.period?.number ?? (i === 0 ? 1 : (plays[plays.length - 1]?.period ?? 1));
    let scoringSide: Side | null = null;
    let scorer: string | null = null;
    let kind: MlsScoringKind | null = null;
    if (GOAL_TYPES.has(type) || /^Goal/.test(type)) {
      const m = GOAL_TEXT.exec(e.text ?? '');
      if (m) {
        // Home is named first in the text (checked on 655997 and 761829).
        const h = Number(m[2]);
        const a = Number(m[4]);
        scoringSide = h > home ? 'home' : a > away ? 'away' : null;
        home = h;
        away = a;
        const who = SCORER.exec(m[5] ?? '');
        scorer = who?.[1] ?? null;
      }
      kind =
        type === 'Own Goal'
          ? 'own_goal'
          : type === 'Penalty - Scored'
            ? 'penalty'
            : type === 'Goal - Header'
              ? 'header'
              : type === 'Goal - Free-kick'
                ? 'free_kick'
                : 'goal';
      if (scorer) goalsByName.set(scorer, (goalsByName.get(scorer) ?? 0) + 1);
    }
    plays.push({
      seq: i + 1,
      period,
      minute: minutesOf(e.clock),
      clock: e.clock?.displayValue ?? '',
      wallclock: e.wallclock ?? null,
      type,
      text: e.text ?? '',
      homeScore: home,
      awayScore: away,
      scoringSide,
      scorerName: scorer,
      kind,
    });
  }
  return plays;
}

/** What the caller knows from the games row: the schedule half of the detail. */
export type MlsDetailContext = CanonicalGame;

const GOAL_TYPES = new Set([
  'Goal',
  'Goal - Header',
  'Goal - Free-kick',
  'Goal - Volley',
  'Penalty - Scored',
  'Own Goal',
]);

/** "Goal! Los Angeles Football Club 2, Philadelphia Union 2. Jack Elliott (Philadelphia Union) header..." */
const GOAL_TEXT = /^Goal!\s*(.+?) (\d+), (.+?) (\d+)\.\s*(.*)$/;
const SCORER = /^(.+?) \((.+?)\)/;

function stat(row: { stats?: { name: string; value?: number }[] } | undefined, name: string): number {
  return row?.stats?.find((s) => s.name === name)?.value ?? 0;
}

/** The minute as ESPN shows it ("116'", "45'+6'"); the seconds value only when it has none. */
function minutesOf(clock: { value?: number; displayValue?: string } | undefined): number {
  const m = /^(\d+)'/.exec(clock?.displayValue ?? '');
  if (m) return Number(m[1]);
  return clock?.value != null ? Math.ceil(clock.value / 60) : 0;
}

/**
 * The summary as canonical detail: appearances with lines, the goals as the scoring timeline,
 * every key event as a play, and the context columns.
 */
export function parseMlsSummaryDetail(
  summary: MlsSummaryDetail,
  ctx: MlsDetailContext,
): CanonicalGameDetail {
  const comp = summary.header?.competitions?.[0];
  const homeName = summary.rosters?.find((r) => r.homeAway === 'home')?.team?.displayName ?? null;
  const awayName = summary.rosters?.find((r) => r.homeAway === 'away')?.team?.displayName ?? null;
  // Plays: every key event, with the score as it stood after it.
  const plays = parseMlsKeyEvents(summary);
  const timeline: ScoringEvent[] = [];
  for (const play of plays) {
    if (play.scoringSide) {
      timeline.push({
        seq: timeline.length + 1,
        occurredAt: play.wallclock,
        period: play.period,
        half: null,
        clock: play.clock || null,
        homeScore: play.homeScore,
        awayScore: play.awayScore,
        scoringSide: play.scoringSide,
        description: play.text,
        kind: play.kind ?? 'goal',
        scorerProviderId: null,
        scorerName: play.scorerName,
      });
    }
  }

  // Appearances: the players who took the pitch, with the line the "players seen" rule reads.
  const appearances: Appearance[] = [];
  const idByName = new Map<string, string>();
  for (const side of summary.rosters ?? []) {
    const teamId = side.homeAway === 'home' ? ctx.homeProviderTeamId : ctx.awayProviderTeamId;
    for (const r of side.roster ?? []) {
      if (!r.athlete?.id) continue;
      const played = r.starter === true || r.subbedIn === true || stat(r, 'appearances') > 0;
      if (!played) continue;
      const name = r.athlete.displayName ?? r.athlete.fullName ?? String(r.athlete.id);
      idByName.set(name, String(r.athlete.id));
      const gk = r.position?.abbreviation === 'G';
      const line: BoxLine = {
        goals: stat(r, 'totalGoals'),
        assists: stat(r, 'goalAssists'),
        gk,
        clean_sheet: gk && stat(r, 'goalsConceded') === 0,
      };
      appearances.push({ providerPlayerId: String(r.athlete.id), fullName: name, providerTeamId: teamId, line });
    }
  }
  for (const t of timeline) {
    if (t.scorerName) t.scorerProviderId = idByName.get(t.scorerName) ?? null;
  }

  const stamps = plays.filter((p) => p.wallclock).length;
  const finalAt = mlsSummaryFinalAt(summary, ctx.scheduledStart);
  return {
    ...ctx,
    finalAt: ctx.status === 'final' ? (finalAt ?? ctx.finalAt) : null,
    temperatureF: null,
    durationMinutes:
      finalAt && plays[0]?.wallclock
        ? Math.round((Date.parse(finalAt) - Date.parse(plays[0].wallclock)) / 60_000)
        : null,
    attendance: summary.gameInfo?.attendance ?? null,
    inningsOrPeriods: comp?.status?.period ?? (plays.length ? Math.max(...plays.map((p) => p.period)) : null),
    appearances,
    timeline,
    timestampsReliable: plays.length > 0 && stamps === plays.length && finalAt != null,
    plays: { sport: 'mls', items: plays },
    homeName: homeName ?? undefined,
    awayName: awayName ?? undefined,
  } as CanonicalGameDetail & { homeName?: string; awayName?: string };
}

/** The pledge lock: the first goal or halftime, whichever came first, by its wall clock. */
export function mlsTrueLock(items: readonly MlsPlay[]): {
  at: string | null;
  reliable: boolean;
  reason: 'first_score' | 'end_of_first' | 'unknown';
} {
  const first = items.find((p) => p.scoringSide != null || p.type === 'Halftime');
  if (!first) return { at: null, reliable: false, reason: 'unknown' };
  return {
    at: first.wallclock,
    reliable: first.wallclock != null,
    reason: first.scoringSide != null ? 'first_score' : 'end_of_first',
  };
}

/** Moments: a hat trick, a red card, a shootout, a two-goal comeback win. */
export function detectMlsMoments(detail: CanonicalGameDetail): GameEvent[] {
  if (detail.plays.sport !== 'mls') return [];
  const out: GameEvent[] = [];
  const items = detail.plays.items;
  const goals = new Map<string, { n: number; side: Side; id: string | null; last: string | null }>();
  for (const t of detail.timeline) {
    if (!t.scorerName || t.kind === 'own_goal') continue;
    const g = goals.get(t.scorerName) ?? { n: 0, side: t.scoringSide, id: t.scorerProviderId ?? null, last: null };
    g.n += 1;
    g.last = t.occurredAt;
    goals.set(t.scorerName, g);
  }
  for (const [name, g] of goals) {
    if (g.n >= 3)
      out.push({ type: 'hat_trick', side: g.side, providerPlayerId: g.id, playerName: name, occurredAt: g.last, detail: { goals: g.n } });
  }
  for (const p of items) {
    if (p.type === 'Red Card') {
      // "Second yellow card to Federico Bernardeschi (Toronto FC)." is a red card too.
      const who = SCORER.exec(p.text.replace(/^Second yellow card to /i, ''));
      out.push({ type: 'red_card', side: null, providerPlayerId: null, playerName: who?.[1] ?? null, occurredAt: p.wallclock, detail: { minute: p.minute } });
    }
  }
  if (items.some((p) => p.type === 'Start Shootout')) {
    out.push({ type: 'shootout', side: null, providerPlayerId: null, playerName: null, occurredAt: items.find((p) => p.type === 'Start Shootout')?.wallclock ?? null, detail: {} });
  }
  // A two-goal comeback: a side trailed by two and won on goals.
  if (detail.homeScore != null && detail.awayScore != null && detail.homeScore !== detail.awayScore) {
    const winner: Side = detail.homeScore > detail.awayScore ? 'home' : 'away';
    const trailedByTwo = detail.timeline.some((t) =>
      winner === 'home' ? t.awayScore - t.homeScore >= 2 : t.homeScore - t.awayScore >= 2,
    );
    if (trailedByTwo)
      out.push({ type: 'comeback_2', side: winner, providerPlayerId: null, playerName: null, occurredAt: detail.finalAt, detail: {} });
  }
  return out;
}

// ---------------------------------------------------------------------------
// The Relive line: a Poisson state model.
// ---------------------------------------------------------------------------

function poisson(k: number, lambda: number): number {
  let p = Math.exp(-lambda);
  for (let i = 1; i <= k; i++) p *= lambda / i;
  return p;
}

/**
 * P(home wins) from the score and the minutes left. Each side's remaining goals are Poisson
 * with the league's rates (1.53 home, 1.20 away goals a match on 2016-2025 MLS finals) tilted by
 * the pregame view: a side expected to win more often scores more. Not fitted to a play
 * series (ESPN publishes none for soccer); it is the shape of the line, not a forecast.
 */
function homeWinFromRates(homeGoals: number, awayGoals: number, lh: number, la: number): number {
  let p = 0;
  for (let i = 0; i <= 9; i++) {
    for (let j = 0; j <= 9; j++) {
      if (homeGoals + i > awayGoals + j) p += poisson(i, lh) * poisson(j, la);
    }
  }
  return Math.min(Math.max(p, 0), 1);
}

const HOME_RATE = 1.53;
const AWAY_RATE = 1.2;

/**
 * The tilt on the league rates that makes a 0-0 start reproduce the pregame home win
 * probability: the home side scores at HOME_RATE * t, the away side at AWAY_RATE / t. Found
 * by bisection; a pregame view the rates cannot reach is clamped at the ends.
 */
export function calibratedRates(pregame: { home: number }): { home: number; away: number } {
  const target = Math.min(Math.max(pregame.home, 0.02), 0.98);
  let lo = 0.1;
  let hi = 10;
  for (let i = 0; i < 40; i++) {
    const mid = Math.sqrt(lo * hi);
    const p = homeWinFromRates(0, 0, HOME_RATE * mid, AWAY_RATE / mid);
    if (p < target) lo = mid;
    else hi = mid;
  }
  const t = Math.sqrt(lo * hi);
  return { home: HOME_RATE * t, away: AWAY_RATE / t };
}

export function mlsInMatchHomeWp(
  homeGoals: number,
  awayGoals: number,
  minutesLeft: number,
  pregame: { home: number; away: number },
): number {
  const rates = calibratedRates(pregame);
  const frac = Math.max(0, minutesLeft) / 90;
  return homeWinFromRates(homeGoals, awayGoals, rates.home * frac, rates.away * frac);
}

const STEP_LABEL: Record<string, string> = {
  Kickoff: 'Kick-off',
  Halftime: 'Halftime',
  'Start 2nd Half': 'Second half',
  'End Regular Time': 'Full time',
  'Start Extra Time': 'Extra time',
  'Halftime Extra Time': 'Extra time, halftime',
  'Start 2nd Half Extra Time': 'Extra time, second half',
  'End Extra Time': 'End of extra time',
  'Start Shootout': 'Penalties',
  'End Match': 'Full time',
};

/**
 * Story steps: kick-off, every goal, card and substitution, the breaks, the shootout and the
 * end, each on a point of the model line. The final step names the shootout score when one
 * decided the match.
 */
export function buildMlsStory(
  detail: CanonicalGameDetail,
  names: { homeName: string; awayName: string },
  pregame: { home: number; draw: number; away: number } | null,
  shootout: { home: number; away: number } | null,
): { points: WpPoint[]; steps: StoryStep[] } {
  if (detail.plays.sport !== 'mls') return { points: [], steps: [] };
  const pre = pregame ?? threeWayProbabilities(1500, 1500, 100, 0.8);
  const items = detail.plays.items;
  const points: WpPoint[] = [];
  const steps: StoryStep[] = [];
  const point = (seq: number, play: MlsPlay | null, wp: number) => {
    points.push({
      seq,
      period: play?.period ?? 1,
      // The point type is baseball's; the first half of a period is "top".
      half: (play?.period ?? 1) % 2 === 1 ? 'top' : 'bottom',
      homeWp: Math.round(wp * 1000) / 1000,
      occurredAt: play?.wallclock ?? null,
    });
  };
  const minutesLeft = (p: MlsPlay): number => {
    const total = p.period >= 3 ? 120 : 90;
    return Math.max(0, total - Math.min(p.minute, total));
  };
  point(0, null, pre.home);
  steps.push({ seq: 0, wpSeq: 0, awayScore: 0, homeScore: 0, label: 'Pregame', text: `${names.awayName} at ${names.homeName}. ${Math.round(pre.home * 100)}% home win, ${Math.round(pre.draw * 100)}% draw.` });
  let seq = 0;
  for (const p of items) {
    const decided = p.type === 'End Match' || p.type === 'End Regular Time' && !items.some((x) => x.type === 'Start Extra Time');
    let wp: number;
    if (p.type === 'Start Shootout') wp = 0.5;
    else if (decided) wp = shootout ? (shootout.home > shootout.away ? 1 : 0) : p.homeScore > p.awayScore ? 1 : 0;
    else wp = mlsInMatchHomeWp(p.homeScore, p.awayScore, minutesLeft(p), pre);
    seq += 1;
    point(seq, p, wp);
    const isGoal = p.scoringSide != null;
    const label = p.type in STEP_LABEL ? STEP_LABEL[p.type]! : p.clock || `${p.minute}'`;
    let text: string;
    if (isGoal) text = p.text.replace(/^Goal!\s*/, '');
    else if (p.type === 'Kickoff') text = 'Kick-off.';
    else if (p.type === 'End Match' && shootout) text = `${names.homeName} ${p.homeScore}, ${names.awayName} ${p.awayScore}; ${shootout.home > shootout.away ? names.homeName : names.awayName} win ${Math.max(shootout.home, shootout.away)}-${Math.min(shootout.home, shootout.away)} on penalties.`;
    else if (p.type === 'End Match' || p.type === 'End Regular Time') text = `Full time: ${names.homeName} ${p.homeScore}, ${names.awayName} ${p.awayScore}.`;
    else if (p.type === 'Halftime') text = `Halftime: ${names.homeName} ${p.homeScore}, ${names.awayName} ${p.awayScore}.`;
    else if (p.type === 'Start Shootout') text = 'Level after extra time: the shootout decides it.';
    else if (p.text) text = p.text;
    else continue;
    const step: StoryStep = { seq: steps.length, wpSeq: seq, awayScore: p.awayScore, homeScore: p.homeScore, label, text };
    if (isGoal) {
      step.kind = (p.kind ?? 'goal') as MlsScoringKind;
      step.scorerName = p.scorerName;
      const t = detail.timeline.find((x) => x.homeScore === p.homeScore && x.awayScore === p.awayScore && x.scorerName === p.scorerName);
      step.scorerProviderId = t?.scorerProviderId ?? null;
    }
    steps.push(step);
  }
  return { points, steps };
}

/** Whether a line makes an MLS appearance a good game, for callers building rows by hand. */
export function mlsGoodGame(line: BoxLine | null): boolean {
  return isGoodGame('mls', line);
}
