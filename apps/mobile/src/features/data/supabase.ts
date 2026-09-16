import { formatRecord, formatVsExpected, formatWinRate, type WinLossRecord } from '@jinx/core';

import { superlativeRows } from '@/features/passport/format';
import type { StatsPayload, StatsStamp, StatsTeam } from '@/features/passport/types';

import { demoRepository } from './demo';
import type {
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
  };
}
