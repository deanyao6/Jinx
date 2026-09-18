/**
 * Who scored, and how it is said (SPEC.md 5.1 `game_scoring_timeline`, 6.19).
 *
 * Dean, 2026-09-17: "a note on who scored in a game, unless it's a field goal: no one cares
 * that the kicker scored their extra point." So the rules, as pure functions:
 *
 *   NFL  a touchdown names the player who reached the end zone (rushing, receiving, any
 *        return); a field goal names the kicker, because a field goal is a real score; an
 *        extra point, a two-point conversion and a safety name nobody. When shown, the extra
 *        point folds into its touchdown as a quiet "PAT good".
 *   MLB  the note is the batter and the event: "Home run, Rafael Devers", "2-run home run",
 *        "Grand slam", "RBI double, Trea Turner", "Sacrifice fly, Bryce Harper",
 *        "Bases-loaded walk". A run that came home on a wild pitch, a passed ball or a balk
 *        names nobody; a steal of home names the runner.
 *   NBA  every score names the scorer: "Three, Stephen Curry", "Dunk, Anthony Edwards",
 *        "Free throws, Joel Embiid (2 of 2)". A made free throw that followed the same
 *        player's made basket is an and-one and folds into the basket's line.
 *
 * Everything is keyed by sport in a table, so a sport this does not know falls back to the
 * play's own description, shortened. Nothing here does I/O.
 */
import type {
  MlbPlay,
  MlbScoringKind,
  NbaPlay,
  NbaScoringKind,
  NflPlay,
  NflScoringKind,
  ScoringKind,
} from './types.js';

export interface Scorer {
  kind: ScoringKind;
  /** The provider's player id (MLB person id, nflverse gsis id), for the `players` lookup. */
  scorerProviderId: string | null;
  scorerName: string | null;
}

// ---------------------------------------------------------------------------
// From a play to (kind, scorer)
// ---------------------------------------------------------------------------

type NflScoringPlay = Pick<
  NflPlay,
  | 'touchdown'
  | 'tdSide'
  | 'fieldGoalResult'
  | 'extraPointAttempt'
  | 'twoPointAttempt'
  | 'safety'
  | 'scorerProviderId'
  | 'scorerName'
>;

/** One nflverse scoring play. `scorerProviderId` on the play is the touchdown scorer, else the kicker. */
export function nflScorer(play: NflScoringPlay): Scorer {
  const named = (kind: NflScoringKind): Scorer => ({
    kind,
    scorerProviderId: play.scorerProviderId || null,
    scorerName: play.scorerName || null,
  });
  const unnamed = (kind: NflScoringKind): Scorer => ({
    kind,
    scorerProviderId: null,
    scorerName: null,
  });
  if (play.touchdown || play.tdSide != null) return named('touchdown');
  if (play.fieldGoalResult === 'made') return named('field_goal');
  if (play.extraPointAttempt) return unnamed('extra_point');
  if (play.twoPointAttempt) return unnamed('two_point');
  if (play.safety) return unnamed('safety');
  return unnamed('other');
}

type MlbScoringPlay = Pick<
  MlbPlay,
  'eventType' | 'description' | 'rbi' | 'batterId' | 'batterName' | 'runScoredOn'
>;

/** The batter's event as a kind, for a plate appearance whose result drove in a run. */
function mlbBatterKind(eventType: string, description: string): MlbScoringKind {
  switch (eventType) {
    case 'home_run':
      return 'home_run';
    case 'single':
      return 'single';
    case 'double':
      return 'double';
    case 'triple':
      return 'triple';
    case 'sac_fly':
    case 'sac_fly_double_play':
      return 'sac_fly';
    case 'sac_bunt':
    case 'sac_bunt_double_play':
      return 'sac_bunt';
    case 'walk':
    case 'intent_walk':
      return 'walk';
    case 'hit_by_pitch':
      return 'hit_by_pitch';
    case 'fielders_choice':
    case 'fielders_choice_out':
      return 'fielders_choice';
    case 'force_out':
      return 'groundout';
    case 'field_out':
      // The feed's event says "Groundout" or "Flyout" only in the prose.
      return /\bgrounds\b/i.test(description) ? 'groundout' : 'flyout';
    case 'field_error':
      return 'error';
    default:
      return 'other';
  }
}

/** The event a run came home on when the batter did not drive it in. */
function mlbRunnerKind(eventType: string): MlbScoringKind {
  if (eventType === 'wild_pitch') return 'wild_pitch';
  if (eventType === 'passed_ball') return 'passed_ball';
  if (eventType === 'balk') return 'balk';
  if (eventType.startsWith('stolen_base')) return 'steal';
  if (eventType === 'error' || eventType.includes('error')) return 'error';
  return 'other';
}

/**
 * One MLB plate appearance on which the score changed.
 *
 * The batter is the scorer when his result scored: a home run, or any event with an RBI.
 * Otherwise the run came home some other way. If the feed says how (`runScoredOn`), that
 * is the kind, and only a steal of home has a name, the runner's. If it does not say, the
 * batter's own event is the kind when it is one this knows (a run on a fielding error, a
 * fielder's choice), named, because he was the one at the plate; anything else is `other`
 * with no name.
 */
export function mlbScorer(play: MlbScoringPlay): Scorer {
  const batter = (kind: MlbScoringKind): Scorer => ({
    kind,
    scorerProviderId: play.batterId || null,
    scorerName: play.batterName || null,
  });
  if (play.eventType === 'home_run') return batter('home_run');
  if (play.rbi > 0) return batter(mlbBatterKind(play.eventType, play.description));
  const on = play.runScoredOn;
  if (on) {
    const kind = mlbRunnerKind(on.eventType);
    if (kind === 'steal') {
      return { kind, scorerProviderId: on.runnerId || null, scorerName: on.runnerName || null };
    }
    return { kind, scorerProviderId: null, scorerName: null };
  }
  const kind = mlbBatterKind(play.eventType, play.description);
  // A strikeout under a changed score with no word on how: nobody is named for it.
  if (kind === 'other') return { kind, scorerProviderId: null, scorerName: null };
  return batter(kind);
}

type NbaScoringPlay = Pick<
  NbaPlay,
  'actionType' | 'subType' | 'description' | 'playerId' | 'playerName' | 'isFieldGoal' | 'freeThrowOf' | 'clock' | 'period'
>;

/** The two-point basket's kind from the feed's subType ("DUNK", "Layup", "Jump Shot", "Hook"). */
function nbaTwoKind(subType: string | null, description: string): NbaScoringKind {
  const text = `${subType ?? ''} ${description}`;
  if (/dunk/i.test(text)) return 'dunk';
  if (/layup|finger roll|tip shot|tip layup/i.test(text)) return 'layup';
  if (/jump shot|jumper|hook|bank|fadeaway|fade away|floating|pullup|pull-up|step back|turnaround/i.test(text))
    return 'jumper';
  return 'two';
}

/**
 * One NBA scoring play. `lastBasket` is the most recent made field goal, so a "1 of 1" free
 * throw by that shooter at the same clock reads as the and-one it was.
 */
export function nbaScorer(play: NbaScoringPlay, lastBasket: NbaScoringPlay | null): Scorer {
  const named = (kind: NbaScoringKind): Scorer => ({
    kind,
    scorerProviderId: play.playerId || null,
    scorerName: play.playerName || null,
  });
  if (play.actionType === '3pt') return named('three');
  if (play.actionType === '2pt') return named(nbaTwoKind(play.subType, play.description));
  if (play.actionType === 'freethrow') {
    const andOne =
      play.freeThrowOf === '1 of 1' &&
      lastBasket != null &&
      lastBasket.playerId != null &&
      lastBasket.playerId === play.playerId &&
      lastBasket.period === play.period &&
      lastBasket.clock === play.clock;
    return named(andOne ? 'and_one' : 'free_throw');
  }
  if (play.isFieldGoal) return named('two');
  return { kind: 'other', scorerProviderId: null, scorerName: null };
}

// ---------------------------------------------------------------------------
// From a stored row to the words on the screen
// ---------------------------------------------------------------------------

export interface ScoringNoteInput {
  sport: string;
  kind: string | null;
  scorerName: string | null;
  description: string;
  /** Points or runs this play put on the board (the change in score from the row before). */
  runs: number;
}

const NFL_KIND_LABEL: Record<NflScoringKind, string> = {
  touchdown: 'Touchdown',
  field_goal: 'Field goal',
  extra_point: 'Extra point',
  two_point: 'Two-point conversion',
  safety: 'Safety',
  other: '',
};

/** "44-yard field goal" when the play says how long it was. */
function nflEvent(kind: NflScoringKind, description: string): string {
  if (kind === 'field_goal') {
    const m = /(\d+)\s+yard field goal/i.exec(description);
    if (m) return `${m[1]}-yard field goal`;
  }
  return NFL_KIND_LABEL[kind];
}

/** "RBI double", "2-run double", "Grand slam": the event with the runs it drove in. */
function mlbEvent(kind: MlbScoringKind, runs: number): string {
  const multi = (noun: string): string => (runs >= 2 ? `${runs}-run ${noun}` : `RBI ${noun}`);
  switch (kind) {
    case 'home_run':
      return runs >= 4 ? 'Grand slam' : runs >= 2 ? `${runs}-run home run` : 'Home run';
    case 'single':
    case 'double':
    case 'triple':
    case 'groundout':
    case 'flyout':
      return multi(kind);
    case 'fielders_choice':
      return multi("fielder's choice");
    case 'sac_fly':
      return 'Sacrifice fly';
    case 'sac_bunt':
      return 'Sacrifice bunt';
    case 'walk':
      return 'Bases-loaded walk';
    case 'hit_by_pitch':
      return 'Bases-loaded hit by pitch';
    case 'wild_pitch':
      return 'Wild pitch';
    case 'passed_ball':
      return 'Passed ball';
    case 'balk':
      return 'Balk';
    case 'steal':
      return 'Steal of home';
    case 'error':
      return 'Error';
    case 'other':
      return '';
  }
}

/**
 * The play's own description, cut to something a row can hold: the first sentence, and
 * only up to its first comma. nflverse leads with the clock and the formation in
 * parentheses, which the row already shows or does not need.
 */
export function shortDescription(description: string): string {
  let text = description.trim().replace(/^(\(\s*[^)]*\)\s*)+/, '');
  const sentence = /^(.*?[.!?])(\s|$)/.exec(text);
  if (sentence?.[1]) text = sentence[1];
  const comma = text.indexOf(', ');
  if (comma > 0) text = text.slice(0, comma);
  return text.replace(/[.\s]+$/, '');
}

const NBA_KIND_LABEL: Record<NbaScoringKind, string> = {
  three: 'Three',
  two: 'Two',
  dunk: 'Dunk',
  layup: 'Layup',
  jumper: 'Jumper',
  free_throw: 'Free throw',
  and_one: 'And-one',
  other: '',
};
const NBA_KINDS = new Set<string>(Object.keys(NBA_KIND_LABEL));

/** "Free throws (2 of 2)" when the play says which; a single make is "Free throw". */
function nbaEvent(kind: NbaScoringKind, description: string): string {
  if (kind === 'free_throw') {
    const m = /(\d) of (\d)/.exec(description);
    if (m && m[2] !== '1') return `Free throw ${m[1]} of ${m[2]}`;
  }
  return NBA_KIND_LABEL[kind];
}

const NFL_KINDS = new Set<string>(Object.keys(NFL_KIND_LABEL));
const MLB_KINDS = new Set<string>([
  'home_run',
  'single',
  'double',
  'triple',
  'sac_fly',
  'sac_bunt',
  'walk',
  'hit_by_pitch',
  'groundout',
  'flyout',
  'fielders_choice',
  'wild_pitch',
  'passed_ball',
  'balk',
  'steal',
  'error',
  'other',
]);

/** The event half of the note, before any name. Empty when the description has to stand in. */
const EVENT_BY_SPORT: Record<string, (input: ScoringNoteInput) => string> = {
  nfl: (input) =>
    input.kind != null && NFL_KINDS.has(input.kind)
      ? nflEvent(input.kind as NflScoringKind, input.description)
      : '',
  mlb: (input) => {
    if (input.kind == null || !MLB_KINDS.has(input.kind)) return '';
    const event = mlbEvent(input.kind as MlbScoringKind, input.runs);
    // A run on an error where the batter is named: he reached on it.
    if (input.kind === 'error' && input.scorerName) return 'Reached on error';
    return event;
  },
  nba: (input) =>
    input.kind != null && NBA_KINDS.has(input.kind)
      ? nbaEvent(input.kind as NbaScoringKind, input.description)
      : '',
};

/**
 * "Touchdown, A.J. Brown". "2-run home run, Enrique Hernández". "Wild pitch".
 *
 * A kind the sport table does not know, or a sport with no table, gives the shortened
 * description, so a row is never blank.
 */
export function scoringNote(input: ScoringNoteInput): string {
  const event = EVENT_BY_SPORT[input.sport]?.(input) ?? '';
  if (!event) return shortDescription(input.description) || 'Score';
  return input.scorerName ? `${event}, ${input.scorerName}` : event;
}

// ---------------------------------------------------------------------------
// Rows as a list shows them
// ---------------------------------------------------------------------------

export interface ScoringRow {
  seq: number;
  period: number;
  half: 'top' | 'bottom' | null;
  clock: string | null;
  homeScore: number;
  awayScore: number;
  scoringSide: 'home' | 'away';
  description: string;
  kind: string | null;
  scorerPlayerId: string | null;
  scorerName: string | null;
}

export interface ScoringLine {
  /** The `seq` of the row the line stands for; folded rows are named in `folded`. */
  seq: number;
  period: number;
  half: 'top' | 'bottom' | null;
  clock: string | null;
  scoringSide: 'home' | 'away';
  scorerPlayerId: string | null;
  note: string;
  /** "PAT good" on a touchdown line, once the extra point has folded into it. */
  suffix: string | null;
  /** Score after the line, the folded conversion included. */
  homeScore: number;
  awayScore: number;
  /** Seqs of the rows folded into this one. Empty for most lines. */
  folded: number[];
}

/** The runs or points a row added, from the row before it. */
function pointsOf(row: ScoringRow, prev: ScoringRow | undefined): number {
  const before = prev ? prev.homeScore + prev.awayScore : 0;
  return Math.max(0, row.homeScore + row.awayScore - before);
}

/**
 * Scoring rows as a list shows them, oldest first.
 *
 * The timeline table is complete: an NFL extra point and the touchdown before it are two
 * rows, because the scoreboard changed twice. On screen nobody cares that the kicker made
 * the point after, so a conversion folds into the touchdown line that precedes it as a
 * suffix, and the line's score is the score after the conversion. A conversion with no
 * touchdown before it (a data gap) stays a line of its own.
 */
export function scoringLines(sport: string, rows: readonly ScoringRow[]): ScoringLine[] {
  const sorted = [...rows].sort((a, b) => a.seq - b.seq);
  const lines: ScoringLine[] = [];
  sorted.forEach((row, i) => {
    const runs = pointsOf(row, sorted[i - 1]);
    const last = lines[lines.length - 1];
    if (
      sport === 'nfl' &&
      (row.kind === 'extra_point' || row.kind === 'two_point') &&
      last &&
      last.suffix == null &&
      last.scoringSide === row.scoringSide &&
      sorted[i - 1]?.kind === 'touchdown'
    ) {
      last.suffix = row.kind === 'extra_point' ? 'PAT good' : 'Two-point conversion good';
      last.homeScore = row.homeScore;
      last.awayScore = row.awayScore;
      last.folded.push(row.seq);
      return;
    }
    // Basketball's version: the and-one folds into the basket it came with, and a second
    // free throw folds into the first, so "Free throws, Joel Embiid (2 of 2)" is one line.
    if (
      sport === 'nba' &&
      last &&
      last.scoringSide === row.scoringSide &&
      last.scorerPlayerId != null &&
      last.scorerPlayerId === row.scorerPlayerId &&
      last.clock === row.clock &&
      last.period === row.period &&
      (row.kind === 'and_one' || (row.kind === 'free_throw' && sorted[i - 1]?.kind === 'free_throw'))
    ) {
      if (row.kind === 'and_one') last.suffix = 'And-one';
      else {
        const made = (last.folded.length + 2);
        const of = /of (\d)/.exec(row.description)?.[1];
        last.note = `Free throws, ${row.scorerName ?? ''}`.replace(/, $/, '');
        last.suffix = of ? `${made} of ${of}` : null;
      }
      last.homeScore = row.homeScore;
      last.awayScore = row.awayScore;
      last.folded.push(row.seq);
      return;
    }
    lines.push({
      seq: row.seq,
      period: row.period,
      half: row.half,
      clock: row.clock,
      scoringSide: row.scoringSide,
      scorerPlayerId: row.scorerPlayerId,
      note: scoringNote({
        sport,
        kind: row.kind,
        scorerName: row.scorerName,
        description: row.description,
        runs,
      }),
      suffix: null,
      homeScore: row.homeScore,
      awayScore: row.awayScore,
      folded: [],
    });
  });
  return lines;
}

const ORDINAL = (n: number): string => {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  const rem = n % 10;
  return `${n}${rem === 1 ? 'st' : rem === 2 ? 'nd' : rem === 3 ? 'rd' : 'th'}`;
};

/**
 * When a line happened, short enough for a kicker: "Top 2nd", "Bot 9th" in baseball;
 * "Q1 1:35", "OT 4:12" in football and basketball; the period number alone for a sport this
 * has no words for.
 */
export function scoringWhen(
  sport: string,
  period: number,
  half: 'top' | 'bottom' | null,
  clock: string | null,
): string {
  if (sport === 'mlb') {
    const side = half === 'bottom' ? 'Bot' : half === 'top' ? 'Top' : '';
    return `${side} ${ORDINAL(period)}`.trim();
  }
  if (sport === 'nfl' || sport === 'nba') {
    const q = period <= 4 ? `Q${period}` : period === 5 ? 'OT' : `${period - 4}OT`;
    const time = clock ? clock.replace(/^0(\d:)/, '$1') : null;
    return time ? `${q} ${time}` : q;
  }
  return String(period);
}
