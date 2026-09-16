import {
  formatRecord,
  formatVsExpected,
  formatWinRate,
  gameResult,
  type WinLossRecord,
} from '@jinx/core';

import { superlativeRows } from '@/features/passport/format';
import type { StatsPayload, StatsStamp, StatsTeam } from '@/features/passport/types';

import { demoRepository } from './demo';
import type {
  GameRowFixture,
  PassportFixture,
  RecordCardFixture,
  ShapeKey,
  StampFixture,
  SuperlativeFixture,
  TeamPill,
} from './shapes';
import type { Repository } from './types';

/**
 * The Supabase-backed repository (SPEC.md 8.9), built up milestone by milestone.
 *
 * **Only the Passport methods are real so far.** Passport's records are M3; Games is M2,
 * imports M4, Relive M8.5. Everything else still returns the demo fixtures, and
 * {@link SUPABASE_BACKED} says which is which so that state is legible rather than hidden
 * behind a screen that looks like it is showing your data and is not.
 */
export const SUPABASE_BACKED: ReadonlySet<keyof Repository> = new Set([
  'passportPills',
  'passport',
  'stamps',
  'games',
]);

/**
 * The reference writes records with spaces around the dash — `31 – 17` — while
 * `formatRecord` in packages/core writes `31–17`, because that form is also produced
 * server-side and in share cards. This is a display concern of this design, so it is
 * applied here rather than changed in the domain layer.
 */
export function displayRecord(rec: WinLossRecord): string {
  return formatRecord(rec).replace(/–/g, ' – ');
}

/** "Philadelphia Phillies" in "Philadelphia" is shown as "Phillies" on a pill. */
export function nickname(name: string, city: string | null | undefined): string {
  if (!city) return name;
  return name.startsWith(city) ? name.slice(city.length).trim() || name : name;
}

/** `+3 game win streak`, `-2 game losing streak`, or nothing at all when there is none. */
export function streakLine(current: number): string {
  if (current === 0) return 'No active streak';
  const n = Math.abs(current);
  const kind = current > 0 ? 'win' : 'losing';
  return `${current > 0 ? '+' : '-'}${n} game ${kind} streak`;
}

export type TeamRef = { id: string; name: string; city: string | null };

/**
 * The hero's Last Game row: `Last Game: PHI 4 – 2 NYM`.
 *
 * Home team first, matching the reference's sample, and the same spaced dash the records
 * use. A game without a final score has nothing to show, so this returns null rather than
 * a line with holes in it.
 */
export function lastGameLine(game: {
  home_score: number | null;
  away_score: number | null;
  home: { abbreviation: string } | null;
  away: { abbreviation: string } | null;
}): string | null {
  if (game.home_score == null || game.away_score == null) return null;
  if (!game.home || !game.away) return null;
  return `Last Game: ${game.home.abbreviation} ${game.home_score} – ${game.away_score} ${game.away.abbreviation}`;
}

export type PassportInputs = {
  stats: StatsPayload;
  /** The user's attended games, most recent first. */
  attendances?: readonly AttendanceRow[];
  /** Team lookup, for turning a full team name into the nickname a pill shows. */
  teams: ReadonlyMap<string, TeamRef>;
  /** Stadium shape per venue, from `venue_shapes`. */
  shapes: ReadonlyMap<string, ShapeKey>;
  /** "PHI 4 – 2 NYM" for the hero's Last Game row, or null when there are no games yet. */
  lastGame: string | null;
};

/**
 * The stamp metals are an inference, and Dean should confirm it.
 *
 * The reference draws Philadelphia's two venues in brass and the four away venues in
 * silver, and there is nothing in the schema that says which a venue is. The rule here is
 * "a venue one of your favourite teams calls home is brass", which reproduces the
 * reference's six exactly. It is a guess at the intent, not something the data told me.
 */
export function stampMetal(stamp: StatsStamp, homeVenueIds: ReadonlySet<string>) {
  return homeVenueIds.has(stamp.venue_id) ? ('brass' as const) : ('silver' as const);
}

function toStamp(
  stamp: StatsStamp,
  shapes: ReadonlyMap<string, ShapeKey>,
  homeVenueIds: ReadonlySet<string>,
  teams: readonly string[],
): StampFixture {
  return {
    name: stamp.name,
    city: (stamp.city ?? '').toUpperCase(),
    ring: stamp.name.toUpperCase(),
    // Until `venue_shapes` is populated for a venue, the reference's generic ballpark is
    // the placeholder, which is what SPEC.md 8.5 says v1 ships.
    shape: shapes.get(stamp.venue_id) ?? 'ballparkA',
    metal: stampMetal(stamp, homeVenueIds),
    teams,
  };
}

function teamCard(team: StatsTeam, teams: ReadonlyMap<string, TeamRef>): RecordCardFixture {
  const ref = teams.get(team.team_id);
  return {
    name: nickname(team.name, ref?.city),
    record: displayRecord(team.record),
    pct: `${formatWinRate(team.record)} pct`,
    team: team.team_id,
    log: team.team_id,
  };
}

/** The reference's icon for each superlative, keyed by `superlativeRows`' stable key. */
const SUPERLATIVE_ICONS: Record<string, string> = {
  most_seen_player: 'i-user',
  coldest: 'i-thermo',
  hottest: 'i-thermo',
  longest: 'i-clock',
  walk_offs: 'i-bolt',
  biggest_comeback: 'i-trend',
  highest_scoring: 'i-trend',
  lowest_scoring: 'i-trend',
  most_visited_venue: 'i-speaker',
  farthest_venue: 'i-route',
  first_game: 'i-book',
};

function toSuperlatives(stats: StatsPayload): SuperlativeFixture[] {
  // superlativeRows already ranks and labels them; the reference shows three.
  return superlativeRows(stats.superlatives, stats.moments, stats.streaks)
    .slice(0, 3)
    .map((row) => ({
      // `superlativeRows` carries no icon or context chip, because the earlier screens did
      // not show them. SUPERLATIVE_ICONS maps its stable `key` onto the reference's icon
      // set; the chip is left empty until the stats payload carries the context the
      // reference shows there ("Linc, Jan 2024", "11 Games").
      icon: SUPERLATIVE_ICONS[row.key] ?? 'i-spark',
      label: row.title,
      value: row.value,
      chip: '',
    }));
}

/** The pills: All teams, then each favourite team, with their game counts. */
export function passportPillsFromStats(inputs: PassportInputs): TeamPill[] {
  const { stats, teams } = inputs;
  const all: TeamPill = {
    key: 'all',
    label: 'All Teams',
    count: String(stats.totals.games),
    team: 'none',
  };
  return [
    all,
    ...stats.teams.map((team) => {
      const ref = teams.get(team.team_id);
      const played = team.record.wins + team.record.losses + team.record.ties;
      return {
        key: team.team_id,
        label: nickname(team.name, ref?.city),
        count: String(played),
        team: team.team_id,
      };
    }),
  ];
}

/** One pill's worth of Passport content. */
export function passportFromStats(inputs: PassportInputs, pill: string): PassportFixture {
  const { stats, teams } = inputs;
  const team = stats.teams.find((t) => t.team_id === pill);
  const stampsForPill = stampsFromStats(inputs, pill);

  if (!team) {
    return {
      teamKey: 'none',
      label: 'LIFETIME RECORD',
      badge: `${stats.totals.games} GAMES ATTENDED`,
      record: displayRecord(stats.overall),
      winRate: formatWinRate(stats.overall),
      streak: streakLine(stats.streaks.current),
      lastGame: inputs.lastGame ?? 'No games logged yet',
      stampCount: `View All (${stats.stamps.length})`,
      cards: [
        ...stats.teams.slice(0, 2).map((t) => teamCard(t, teams)),
        {
          name: 'Neutral',
          record: displayRecord(stats.pledge.record),
          pct: `${formatVsExpected(stats.pledge.vs_expected)} vs exp`,
          team: 'neutral',
          log: 'neutral',
        },
      ],
      superlatives: toSuperlatives(stats),
    };
  }

  const ref = teams.get(team.team_id);
  const short = nickname(team.name, ref?.city);
  const played = team.record.wins + team.record.losses + team.record.ties;
  return {
    teamKey: team.team_id,
    label: `${short.toUpperCase()} RECORD`,
    badge: `${played} GAMES ATTENDED`,
    record: displayRecord(team.record),
    winRate: formatWinRate(team.record),
    streak: streakLine(stats.streaks.current),
    lastGame: inputs.lastGame ?? 'No games logged yet',
    stampCount: `View All (${stampsForPill.length})`,
    // Home / Road / Playoffs need per-game splits the stats cache does not carry yet, so
    // the team view shows the one card it can compute honestly rather than three
    // plausible-looking ones. Tracked in OVERNIGHT.md.
    cards: [teamCard(team, teams)],
    superlatives: toSuperlatives(stats),
  };
}

export function stampsFromStats(inputs: PassportInputs, pill: string): StampFixture[] {
  const { stats, shapes } = inputs;
  const homeVenueIds = new Set<string>();
  return stats.stamps
    .filter((stamp) => pill === 'all' || stamp.sports.length > 0)
    .map((stamp) => toStamp(stamp, shapes, homeVenueIds, ['all', pill]));
}

export type AttendanceRow = {
  rooting_team_id: string | null;
  game: {
    id: string;
    status: string;
    scheduled_start: string;
    home_team_id: string;
    away_team_id: string;
    home_score: number | null;
    away_score: number | null;
    home: { id: string; name: string; abbreviation: string } | null;
    away: { id: string; name: string; abbreviation: string } | null;
    venue: { id: string; name: string; city: string | null } | null;
  };
  companions: { person: { id: string; display_name: string } | null }[];
};

/**
 * One row of the Games history list (SPEC.md 8.8.2).
 *
 * The row takes the HOME team's colours, because the thumbnail's gradient ends in that
 * team's fill and the thumbnail is a picture of that stadium. The reference's own sample
 * does the same: a Phillies game at Dodger Stadium is a Dodgers-blue row.
 *
 * The W/L circle is the result from the side the user was rooting for, which is why this
 * calls `gameResult` from packages/core rather than comparing the scores here. A game with
 * no rooting side, or one that is not final, has no result and shows no circle.
 */
export function gameRowFromAttendance(
  attendance: AttendanceRow,
  shapes: ReadonlyMap<string, ShapeKey>,
  teams: ReadonlyMap<string, TeamRef>,
): GameRowFixture | null {
  const g = attendance.game;
  if (!g.home || !g.away) return null;

  const homeCity = teams.get(g.home.id)?.city ?? null;
  const awayCity = teams.get(g.away.id)?.city ?? null;
  const title =
    g.home_score == null || g.away_score == null
      ? `${nickname(g.away.name, awayCity)} at ${nickname(g.home.name, homeCity)}`
      : `${nickname(g.away.name, awayCity)} ${g.away_score}, ${nickname(g.home.name, homeCity)} ${g.home_score}`;

  const when = new Date(g.scheduled_start).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const people = attendance.companions
    .map((c) => c.person)
    .filter((p): p is { id: string; display_name: string } => p != null);

  const result = gameResult(
    {
      status: g.status as 'final',
      homeTeamId: g.home_team_id,
      awayTeamId: g.away_team_id,
      homeScore: g.home_score,
      awayScore: g.away_score,
    } as Parameters<typeof gameResult>[0],
    attendance.rooting_team_id,
  );

  return {
    team: g.home.id,
    shape: (g.venue && shapes.get(g.venue.id)) || 'ballparkA',
    title,
    meta: g.venue?.name ? `${g.venue.name}, ${when}` : when,
    // Real people have their own profile photos; the generated avatar keys are a demo
    // concern, so a person's id is passed through and the Avatar falls back to a
    // generated one when there is no photo (SPEC.md 8.6).
    withAvatars: people.slice(0, 3).map((p) => p.id),
    withText: companionLine(people.map((p) => p.display_name)),
    // `.fx-res` has only w and l, so a tie or an undecided game gets no circle rather
    // than being mislabelled as a loss. See GameRowFixture.
    result: result === 'win' ? 'w' : result === 'loss' ? 'l' : null,
  };
}

/** `w/ Alex, Marcus` or `w/ Chloe, David +1`, as the reference writes them. */
export function companionLine(names: readonly string[], shown = 2): string {
  if (names.length === 0) return '';
  const visible = names.slice(0, shown);
  const extra = names.length - visible.length;
  return `w/ ${visible.join(', ')}${extra > 0 ? ` +${extra}` : ''}`;
}

export type ReliveGame = {
  scheduled_start: string;
  home: { abbreviation: string; name: string; id: string } | null;
  away: { abbreviation: string; name: string; id: string } | null;
  venue: { name: string } | null;
};

/**
 * Relive's scorebug and the line beneath it (SPEC.md 6.19).
 *
 * The note reads "Aug 14, 2025, Citizens Bank Park, Section 321 with Dad and Maya" in the
 * reference. Seat and companions are per-attendance, so they are passed in; the parts that
 * are missing are simply left out rather than rendered as empty clauses.
 */
export function reliveFromGame(
  game: ReliveGame,
  opts: { seat?: string | null; companions?: readonly string[] } = {},
) {
  const parts: string[] = [
    new Date(game.scheduled_start).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }),
  ];
  if (game.venue?.name) parts.push(game.venue.name);
  const people = opts.companions ?? [];
  const seat = opts.seat ? `Section ${opts.seat}` : null;
  const withWhom = people.length ? `with ${listSentence(people)}` : null;
  if (seat && withWhom) parts.push(`${seat} ${withWhom}`);
  else if (seat) parts.push(seat);
  else if (withWhom) parts.push(withWhom.replace(/^with /, 'With '));

  return {
    away: {
      team: game.away?.id ?? 'none',
      badge: game.away?.abbreviation ?? '—',
      name: nickname(game.away?.name ?? '', null),
    },
    home: {
      team: game.home?.id ?? 'none',
      badge: game.home?.abbreviation ?? '—',
      name: nickname(game.home?.name ?? '', null),
    },
    note: parts.join(', '),
  };
}

/** "Dad", "Dad and Maya", "Dad, Maya and Sam" — the reference uses "and", not an ampersand. */
export function listSentence(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/**
 * Compose the repository. Methods outside {@link SUPABASE_BACKED} fall through to the demo
 * fixtures, which is what the Plan and Guide shells need in v1 anyway (SPEC.md 8.9).
 */
export function supabaseRepository(inputs: PassportInputs): Repository {
  return {
    ...demoRepository,
    passportPills: () => passportPillsFromStats(inputs),
    passport: (pill) => passportFromStats(inputs, pill),
    stamps: (pill) => stampsFromStats(inputs, pill),
    games: () =>
      (inputs.attendances ?? [])
        .map((a) => gameRowFromAttendance(a, inputs.shapes, inputs.teams))
        .filter((row): row is GameRowFixture => row != null),
  };
}
