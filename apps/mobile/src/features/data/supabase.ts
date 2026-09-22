import {
  formatRecord,
  formatVsExpected,
  formatWinRate,
  gameResult,
  type WinLossRecord,
} from '@jinx/core';

import { companionLuck, talliesFromRecords } from '@/features/eggs/jinx';
import {
  superlativeLabel,
  superlativeRows,
  type SuperlativeGame,
  type SuperlativeRow,
} from '@/features/passport/format';
import type { StatsPayload, StatsStamp, StatsTeam } from '@/features/passport/types';
import { gameDayFromUpcoming, type UpcomingGame } from '@/features/plan/gameDay';
import { defaultShapeKey } from '@/features/venues/shapes';

import { emptyRepository } from './empty';
import { listSentence, shortTeamName, type TeamRef } from './names';
import type {
  GameLogFixture,
  GameRowFixture,
  LogRowFixture,
  PassportFixture,
  PersonRef,
  ProfileFixture,
  RecordCardFixture,
  ShapeKey,
  StampFixture,
  SuperlativeFixture,
  TeamPill,
} from './shapes';
import type { Repository } from './types';

// Re-exported: these moved to ./names to break an import cycle with the Plan tab, and
// everything that already imports them from here keeps working.
export { listSentence, nickname, shortTeamName, type TeamRef } from './names';

/**
 * The Supabase-backed repository (SPEC.md 8.9), built up milestone by milestone.
 *
 * {@link SUPABASE_BACKED} names exactly which methods are real. Everything else returns
 * {@link emptyRepository}'s empty value, and the screen shows its empty state. It used to
 * fall through to the demo fixtures, which meant a user who had logged one game was shown
 * a 31–17 record, 48 games and four friends who do not exist — data they cannot act on and
 * cannot test anything against. An empty screen is the honest answer to "we have not built
 * this yet".
 *
 * The per-game mappings in this file — {@link pickASideFromContext} and
 * {@link reliveFromGame} — are written and tested but deliberately NOT in that set. They
 * need a game id, and this repository only holds the current user's aggregate data, so a
 * synchronous method here cannot serve them. See the note on the Repository type.
 */
export const SUPABASE_BACKED: ReadonlySet<keyof Repository> = new Set([
  'passportPills',
  'passport',
  'stamps',
  'gameLog',
  'games',
  'profile',
  'friends',
  'gameDay',
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

/**
 * `+3 game win streak` as the reference writes it, `2 game losing streak`, or a plain line when
 * there is none. A losing streak takes no minus sign: "losing" already says which way it runs,
 * and "-1 game losing streak" read as a bug.
 */
export function streakLine(current: number): string {
  if (current === 0) return 'No active streak';
  const n = Math.abs(current);
  const kind = current > 0 ? 'win' : 'losing';
  return `${current > 0 ? '+' : ''}${n} game ${kind} streak`;
}

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
  /** The signed-in account, for the Profile screen. Null until the profile row loads. */
  account?: ProfileAccount | null;
  /** Companion records, rivalries and overlaps for the Friends panel. */
  companions?: readonly CompanionRow[];
  rivalries?: readonly RivalryRow[];
  overlaps?: readonly OverlapRow[];
  /** The user's attended games, most recent first. */
  attendances?: readonly AttendanceRow[];
  /** Team lookup, for turning a full team name into the nickname a pill shows. */
  teams: ReadonlyMap<string, TeamRef>;
  /** Stadium shape per venue, from `venue_shapes`. */
  shapes: ReadonlyMap<string, ShapeKey>;
  /**
   * Games marked as going, with their seats, for the Plan tab. Separate from `attendances`,
   * which is filtered to games already attended.
   */
  upcoming?: readonly UpcomingGame[];
  /** "PHI 4 – 2 NYM" for the hero's Last Game row, or null when there are no games yet. */
  lastGame: string | null;
  lastGameId: string | null;
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
    // A venue with no `venue_shapes` row falls back to its sport's family rather than to a
    // ballpark, which is what drew football stadiums as baseball diamonds (SPEC.md 8.5).
    shape: shapes.get(stamp.venue_id) ?? defaultShapeKey(stamp.sports),
    // Kept for the contract. With `venueId` set the Passport draws the seal in the home team's
    // colours instead (features/passport/seals), which is what replaced silver.
    metal: stampMetal(stamp, homeVenueIds),
    teams,
    venueId: stamp.venue_id,
    visits: stamp.visits,
  };
}

function teamCard(team: StatsTeam, teams: ReadonlyMap<string, TeamRef>): RecordCardFixture {
  const ref = teams.get(team.team_id);
  return {
    name: shortTeamName(team.name, ref),
    record: displayRecord(team.record),
    pct: `${formatWinRate(team.record)} pct`,
    team: team.team_id,
    log: team.team_id,
  };
}

/** The reference's icon for each superlative, keyed by `superlativeRows`' stable key. */
const SUPERLATIVE_ICONS: Record<string, string> = {
  most_seen_favorite_player: 'i-user',
  coldest: 'i-thermo',
  hottest: 'i-thermo',
  longest: 'i-clock',
  walk_offs: 'i-bolt',
  biggest_comeback: 'i-trend',
  largest_crowd: 'i-users',
  highest_altitude: 'i-flag',
  highest_scoring: 'i-trend',
  lowest_scoring: 'i-trend',
  most_visited_venue: 'i-speaker',
  farthest_venue: 'i-route',
  first_game: 'i-book',
  famous_games: 'i-spark',
};

/** How many the Passport shows; the rest are one tap away on the superlatives screen. */
export const PASSPORT_SUPERLATIVES = 6;

/**
 * Where a superlative row goes: the games you saw the player in, or the game the number is from.
 * A stadium row opens the most recent game there, since the stamps screen has no route per venue.
 * A row about no one game (a streak, walk-offs) has nowhere better than the full list.
 */
export function superlativeHref(row: SuperlativeRow): string | undefined {
  if (row.href) return row.href;
  if (row.playerId) return `/passport/player/${row.playerId}`;
  if (row.gameId) return `/games/${row.gameId}`;
  return undefined;
}

function toSuperlatives(inputs: PassportInputs): SuperlativeFixture[] {
  const { stats } = inputs;
  // The attended games are already loaded for the Games tab, and every game a superlative
  // points at is one of them, so the chip needs no query of its own.
  const games = new Map<string, SuperlativeGame>();
  for (const a of inputs.attendances ?? []) {
    games.set(a.game.id, {
      scheduled_start: a.game.scheduled_start,
      away: a.game.away?.abbreviation ?? null,
      home: a.game.home?.abbreviation ?? null,
    });
  }
  // superlativeRows already ranks and labels them.
  return superlativeRows(stats.superlatives, stats.moments, stats.streaks, (id) => games.get(id))
    .slice(0, PASSPORT_SUPERLATIVES)
    .map((row) => {
      const href = superlativeHref(row);
      return {
        icon: SUPERLATIVE_ICONS[row.key] ?? 'i-spark',
        label: superlativeLabel(row),
        value: row.value,
        chip: row.context ?? '',
        ...(href ? { href } : {}),
        ...(row.tone ? { tone: row.tone } : {}),
      };
    });
}

/** "48 GAMES ATTENDED", and the singular a user with one game actually sees. */
export function gamesBadge(games: number): string {
  return `${games} ${games === 1 ? 'GAME' : 'GAMES'} ATTENDED`;
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
        label: shortTeamName(team.name, ref),
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
      badge: gamesBadge(stats.totals.games),
      record: displayRecord(stats.overall),
      winRate: formatWinRate(stats.overall),
      streak: streakLine(stats.streaks.current),
      lastGame: inputs.lastGame ?? 'No games logged yet',
      lastGameId: inputs.lastGameId ?? '',
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
      superlatives: toSuperlatives(inputs),
    };
  }

  const ref = teams.get(team.team_id);
  const short = shortTeamName(team.name, ref);
  const played = team.record.wins + team.record.losses + team.record.ties;
  return {
    teamKey: team.team_id,
    label: `${short.toUpperCase()} RECORD`,
    badge: gamesBadge(played),
    record: displayRecord(team.record),
    winRate: formatWinRate(team.record),
    streak: streakLine(stats.streaks.current),
    lastGame: inputs.lastGame ?? 'No games logged yet',
    lastGameId: inputs.lastGameId ?? '',
    stampCount: `View All (${stampsForPill.length})`,
    // Home / Road / Playoffs need per-game splits the stats cache does not carry yet, so
    // the team view shows the one card it can compute honestly rather than three
    // plausible-looking ones. Tracked in OVERNIGHT.md.
    cards: [teamCard(team, teams)],
    superlatives: toSuperlatives(inputs),
  };
}

/**
 * The stamps for one pill.
 *
 * A team pill keeps the venues where that team's sport is played. The stats payload says
 * which sports a venue has hosted and nothing about which team's games you saw there, so
 * this is as narrow as the data allows — but it is narrower than "every stamp under every
 * pill", which showed an NFL pill a ballpark. Filtering by the attended game's team needs
 * the per-venue team breakdown; noted for the stats payload.
 */
export function stampsFromStats(inputs: PassportInputs, pill: string): StampFixture[] {
  const { stats, shapes } = inputs;
  const homeVenueIds = new Set<string>();
  const sport = stats.teams.find((t) => t.team_id === pill)?.sport_id ?? null;
  return stats.stamps
    .filter((stamp) => pill === 'all' || sport == null || stamp.sports.includes(sport))
    .map((stamp) => toStamp(stamp, shapes, homeVenueIds, ['all', pill]));
}

/**
 * One record card's game log (SPEC.md 8.8.9), from the same attendances the Games list uses.
 *
 * A key names a record: a team id, or 'neutral'. An unknown key returns null and the card
 * does not open, which is how Passport decides whether a card is tappable at all. A known
 * record with no games returns a log with no rows rather than null, because "you have no
 * Phillies games yet" is a true answer and a dead card is not.
 */
export function gameLogFromAttendances(inputs: PassportInputs, key: string): GameLogFixture | null {
  const { stats, teams, shapes } = inputs;
  const attendances = inputs.attendances ?? [];

  if (key === 'neutral') {
    const mine = new Set(stats.teams.map((t) => t.team_id));
    const matching = attendances.filter(
      (a) => !mine.has(a.game.home_team_id) && !mine.has(a.game.away_team_id),
    );
    return {
      title: 'As a neutral',
      teamKey: 'none',
      sub: 'Record as a neutral',
      meta: `${countLine(matching.length)}, ${formatVsExpected(stats.pledge.vs_expected)} vs expected`,
      ...logRows(matching, null, shapes, teams),
    };
  }

  const team = stats.teams.find((t) => t.team_id === key);
  if (!team) return null;
  const short = shortTeamName(team.name, teams.get(team.team_id));
  const matching = attendances.filter(
    (a) => a.game.home_team_id === key || a.game.away_team_id === key,
  );
  return {
    title: short,
    teamKey: team.team_id,
    sub: `${short} record at games`,
    meta: `${countLine(matching.length)}, ${formatWinRate(team.record)}`,
    ...logRows(matching, key, shapes, teams),
  };
}

/** "17 games", and the singular for one. */
function countLine(n: number): string {
  return `${n} game${n === 1 ? '' : 's'}`;
}

/** The reference shows six rows and pages the rest behind a "+N more" footer. */
const LOG_ROWS_SHOWN = 6;

function logRows(
  attendances: readonly AttendanceRow[],
  /** Whose result the circle shows: the log's team, or the user's pick for a neutral log. */
  teamId: string | null,
  shapes: ReadonlyMap<string, ShapeKey>,
  teams: ReadonlyMap<string, TeamRef>,
): { rows: LogRowFixture[]; more: string } {
  const rows = attendances
    .slice(0, LOG_ROWS_SHOWN)
    .map((a) => logRowFromAttendance(a, teamId, shapes, teams));
  const extra = attendances.length - rows.length;
  return { rows, more: extra > 0 ? `${extra} more games` : '' };
}

export function logRowFromAttendance(
  attendance: AttendanceRow,
  teamId: string | null,
  shapes: ReadonlyMap<string, ShapeKey>,
  teams: ReadonlyMap<string, TeamRef>,
): LogRowFixture {
  const g = attendance.game;
  const row = gameRowFromAttendance(attendance, shapes, teams);
  const when = new Date(g.scheduled_start).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  });
  const result = gameResult(
    {
      status: g.status as 'final',
      homeTeamId: g.home_team_id,
      awayTeamId: g.away_team_id,
      homeScore: g.home_score,
      awayScore: g.away_score,
      winnerTeamId: g.winner_team_id,
    } as Parameters<typeof gameResult>[0],
    teamId ?? attendance.rooting_team_id,
  );
  return {
    gameId: g.id,
    team: g.home?.id ?? 'none',
    shape: (g.venue && shapes.get(g.venue.id)) || defaultShapeKey([g.sport_id]),
    title: row?.title ?? 'Game',
    meta: g.venue?.name ? `${g.venue.name}, ${when}` : when,
    // A game with no side to root for, a tie, or one that is not final has no result, and
    // the circle is omitted rather than drawn as a loss. Same rule as the Games list.
    result: result === 'win' ? 'w' : result === 'loss' ? 'l' : null,
  };
}

/**
 * The signed-in account, for the Profile screen (SPEC.md 8.8.7).
 *
 * Everything here is the user's own: their handle and name, their favourite teams, their
 * counts. A field that has not loaded yet is null and is shown as a dash rather than a
 * zero, because "0 followers" and "not known yet" are different claims.
 */
export type ProfileAccount = {
  handle: string;
  displayName: string;
  homeCity: string | null;
  /** Avatar key: the user's own id. `Repository.person` resolves it to the account. */
  avatarKey: string;
  /** `profiles.avatar_path`: the uploaded photo, or null for the generated default. */
  avatarPath?: string | null;
  favorites: readonly { id: string; name: string; city: string | null }[];
  followers: number | null;
  following: number | null;
  goals: { total: number; done: number } | null;
  /** The newest Wrapped snapshot, or null when none has been generated. */
  wrapped: { sport_id: string; season: number } | null;
};

function statValue(n: number | null | undefined): string {
  return n == null ? '–' : String(n);
}

export function profileFromAccount(
  account: ProfileAccount,
  stats: StatsPayload,
  companions: readonly CompanionRow[],
): ProfileFixture {
  const chips = account.favorites.map((t) => ({
    team: t.id,
    label: shortTeamName(t.name, t),
  }));

  const rows: ProfileFixture['rows'][number][] = [
    {
      icon: 'i-users',
      title: 'Friends',
      meta: companions.length
        ? `${companions.length} companion${companions.length === 1 ? '' : 's'}`
        : 'Companions, rivals, overlaps',
      facepile: true,
    },
    {
      icon: 'i-target',
      title: `${new Date().getFullYear()} goals`,
      meta: goalsLine(account.goals),
      facepile: false,
    },
    {
      icon: 'i-map',
      title: 'Map',
      meta: mapLine(stats),
      facepile: false,
    },
  ];
  // The Wrapped row is only shown when a snapshot exists: its route needs a season, and a
  // row that opens an empty Wrapped is worse than no row.
  if (account.wrapped) {
    rows.push({
      icon: 'i-spark',
      title: `${account.wrapped.season} Wrapped`,
      meta: account.wrapped.sport_id.toUpperCase(),
      facepile: false,
    });
  }

  return {
    team: chips[0]?.team ?? 'none',
    handle: account.handle ? `@${account.handle}` : '',
    avatar: account.avatarKey,
    name: account.displayName || account.handle,
    tagline: account.homeCity ?? '',
    teamChips: chips,
    stats: [
      { value: String(stats.totals.games), label: 'Games' },
      { value: String(stats.totals.venues), label: 'Venues' },
      { value: statValue(account.followers), label: 'Followers' },
      { value: statValue(account.following), label: 'Following' },
    ],
    facepile: companions.slice(0, 3).map((c) => c.person_id),
    rows,
  };
}

/** "1 of 3 done", or that there are none rather than a count of nothing. */
function goalsLine(goals: ProfileAccount['goals']): string {
  if (!goals || goals.total === 0) return 'None set yet';
  return `${goals.done} of ${goals.total} done`;
}

function mapLine(stats: StatsPayload): string {
  const { venues, countries } = stats.totals;
  if (venues === 0) return 'No venues yet';
  const country = `${countries} ${countries === 1 ? 'country' : 'countries'}`;
  return `${venues} venue${venues === 1 ? '' : 's'}, ${country}`;
}

export type AttendanceRow = {
  rooting_team_id: string | null;
  game: {
    id: string;
    /** Chooses the stadium-shape family when the venue has no `venue_shapes` row. */
    sport_id: string;
    status: string;
    scheduled_start: string;
    home_team_id: string;
    away_team_id: string;
    home_score: number | null;
    away_score: number | null;
    winner_team_id?: string | null;
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

  const home = shortTeamName(g.home.name, teams.get(g.home.id));
  const away = shortTeamName(g.away.name, teams.get(g.away.id));
  const title =
    g.home_score == null || g.away_score == null
      ? `${away} at ${home}`
      : `${away} ${g.away_score}, ${home} ${g.home_score}`;

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
      winnerTeamId: g.winner_team_id,
    } as Parameters<typeof gameResult>[0],
    attendance.rooting_team_id,
  );

  return {
    gameId: g.id,
    team: g.home.id,
    shape: (g.venue && shapes.get(g.venue.id)) || defaultShapeKey([g.sport_id]),
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

/**
 * Pick a side (SPEC.md 8.8.3, 6.4), from the `game_context` RPC the check-in flow already
 * uses. The countdown is formatted by the caller so it can tick.
 */
export type PickASideContext = {
  sport_id: string;
  venue: { name: string | null };
  home: { team_id: string; name: string; win_prob: number | null };
  away: { team_id: string; name: string; win_prob: number | null };
  pledge: { team_id: string } | null;
};

export type StorylineRow = { team_id: string; text: string; source: string };

/** The source label under a storyline card, as the reference writes them. */
export function storylineSource(source: string): string {
  switch (source) {
    case 'results':
      return 'FROM RESULTS';
    case 'injury_report':
      return 'OFFICIAL INJURY REPORT';
    case 'probable_starter':
      return 'PROBABLE STARTERS';
    // The one storyline about the game itself: a postseason game or an opener, both read straight
    // off the schedule (SPEC 6.18, as narrowed 2026-09-17).
    case 'schedule':
      return 'FROM THE SCHEDULE';
    default:
      return source.replace(/_/g, ' ').toUpperCase();
  }
}

export function pickASideFromContext(
  ctx: PickASideContext,
  teams: ReadonlyMap<string, TeamRef>,
  storylines: readonly StorylineRow[],
  countdown: string,
) {
  const side = (team: PickASideContext['home']) => {
    const ref = teams.get(team.team_id);
    const short = shortTeamName(team.name, ref);
    return {
      team: team.team_id,
      badge: ref?.abbreviation ?? '–',
      name: short,
      // The season record shown under each badge is not in the game context and there is
      // no standings query yet, so it is left empty rather than invented. See
      // OVERNIGHT.md.
      record: '',
      winProb: team.win_prob ?? 0.5,
      button: `Root for ${ref?.abbreviation ?? ''} ${short}`.trim(),
    };
  };

  return {
    venue: ctx.venue.name ? `At ${ctx.venue.name}` : 'At the game',
    lockCountdown: countdown,
    title: 'Pick a side',
    explainer:
      "You don't follow either team. Pick who you're rooting for. It counts toward your neutral record.",
    away: side(ctx.away),
    home: side(ctx.home),
    storylines: storylines.map((row) => ({
      text: row.text,
      source: storylineSource(row.source),
    })),
  };
}

export type CompanionRow = {
  person_id: string;
  display_name: string;
  /** The account behind the person, when they have one. A placeholder ("Dad") has none. */
  linked_user_id?: string | null;
  linked_handle?: string | null;
  linked_avatar_path?: string | null;
  games: number;
  wins: number;
  losses: number;
  ties: number;
};

export type RivalryRow = {
  rival_display_name: string;
  rival_teams: string[];
  my_wins: number;
  rival_wins: number;
};

export type OverlapRow = {
  other_display_name: string;
  home_team_name: string;
  away_team_name: string;
  scheduled_start: string;
  section_gap: number | null;
  /** True when you were both there before you followed each other (SPEC.md 6.12). */
  before_connected: boolean;
};

/**
 * The colour of a companion record, which is an inference.
 *
 * The reference shows Dad at 7-1 in green, Jordan at 0-4 in red, and Maya at 4-2 and Priya
 * at 3-1 in plain ink. So it is not simply "winning or losing": .750 is still ink. The
 * thresholds below reproduce all four, but nothing in the design states them, so this is a
 * reading of the sample rather than a rule I was given.
 */
export function companionTone(rec: WinLossRecord): 'good' | 'bad' | 'ink' {
  const decided = rec.wins + rec.losses;
  if (decided === 0) return 'ink';
  const rate = rec.wins / decided;
  if (rate > 0.8) return 'good';
  if (rate < 0.2) return 'bad';
  return 'ink';
}

/** "11 games together", and the singular for one. */
export function togetherLine(games: number): string {
  return `${games} game${games === 1 ? '' : 's'} together`;
}

/**
 * The Friends panel (SPEC.md 8.8.8), from `companion_records`, `rivalries` and `overlaps`.
 *
 * Each person's favourite team is not returned by `companion_records`, so their row is
 * drawn in the neutral theme rather than their team colour and the team name is left out
 * of the subtitle. The reference shows both. Noted in OVERNIGHT.md.
 */
export function friendsFromRecords(
  companions: readonly CompanionRow[],
  rivalries: readonly RivalryRow[],
  overlaps: readonly OverlapRow[],
) {
  const rival = rivalries[0];
  // The card is literally titled "Before you connected", so prefer one that was.
  const overlap = overlaps.find((o) => o.before_connected) ?? overlaps[0];
  // The certified jinx egg. An empty map when `eggs.certifiedJinx` is off.
  const luck = companionLuck(talliesFromRecords(companions));

  return {
    tabs: ['With', 'Following', 'Rivals'] as const,
    note: 'Your record when you go together',
    people: companions.map((c) => {
      const rec = { wins: c.wins, losses: c.losses, ties: c.ties };
      const mark = luck.get(c.person_id);
      return {
        key: c.person_id,
        name: c.display_name,
        team: 'none',
        teamName: '',
        sub: togetherLine(c.games),
        record: formatRecord(rec),
        tone: companionTone(rec),
        // Absent, not undefined, when the egg has nothing to say: the row is then the same
        // object it was before the egg existed.
        ...(mark ? { luck: mark } : null),
      };
    }),
    rivalry: rival
      ? {
          team: 'none',
          label: `Rivalry with ${rival.rival_display_name}${rival.rival_teams[0] ? `, ${rival.rival_teams[0]} fan` : ''}`,
          you: { team: 'none', score: String(rival.my_wins), label: 'You' },
          them: { score: String(rival.rival_wins), label: rival.rival_display_name },
          middle: 'Head to head',
        }
      : null,
    overlap: overlap
      ? {
          label: 'Before you connected',
          text: overlapLine(overlap),
        }
      : null,
  };
}

/** "You and Maya were both at Phillies vs Mets in August 2019, eleven sections apart." */
export function overlapLine(o: OverlapRow): string {
  const when = new Date(o.scheduled_start).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
  const base = `You and ${o.other_display_name} were both at ${o.home_team_name} vs ${o.away_team_name} in ${when}`;
  // The section gap is only known when both of you recorded a seat.
  return o.section_gap == null ? `${base}.` : `${base}, ${o.section_gap} sections apart.`;
}

export type ReliveGame = {
  scheduled_start: string;
  home: { abbreviation: string; name: string; id: string; nickname?: string | null } | null;
  away: { abbreviation: string; name: string; id: string; nickname?: string | null } | null;
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
      badge: game.away?.abbreviation ?? '–',
      name: shortTeamName(game.away?.name ?? '', game.away),
    },
    home: {
      team: game.home?.id ?? 'none',
      badge: game.home?.abbreviation ?? '–',
      name: shortTeamName(game.home?.name ?? '', game.home),
    },
    note: parts.join(', '),
  };
}

/**
 * Compose the repository. Methods outside {@link SUPABASE_BACKED} keep
 * {@link emptyRepository}'s empty value: Pick a side and Relive need a game id this
 * repository does not hold, and the Plan and Guide screens have no backend at all in v1, so
 * each of those screens says so rather than borrowing the reference's sample data.
 */
/**
 * The real person behind an avatar key (SPEC.md 8.6). Keys are the signed-in user's own id, or
 * the id of one of their people; every person they own is in `companion_records`, tagged in a
 * game or not. A key that matches nobody yet (the list is still loading) is still a real
 * person, so it gets a generated default rather than fixture art.
 */
export function personFromInputs(inputs: PassportInputs, key: string): PersonRef {
  const account = inputs.account;
  if (account && key === account.avatarKey) {
    return {
      userId: account.avatarKey,
      name: account.displayName || null,
      handle: account.handle || null,
      avatarPath: account.avatarPath ?? null,
    };
  }
  const companion = (inputs.companions ?? []).find((c) => c.person_id === key);
  return {
    // The person id seeds a placeholder's colour, so "Dad" keeps his wherever he appears.
    userId: companion?.linked_user_id ?? key,
    name: companion?.display_name ?? null,
    handle: companion?.linked_handle ?? null,
    avatarPath: companion?.linked_avatar_path ?? null,
  };
}

export function supabaseRepository(inputs: PassportInputs): Repository {
  return {
    ...emptyRepository,
    passportPills: () => passportPillsFromStats(inputs),
    passport: (pill) => passportFromStats(inputs, pill),
    stamps: (pill) => stampsFromStats(inputs, pill),
    gameLog: (key) => gameLogFromAttendances(inputs, key),
    games: () =>
      (inputs.attendances ?? [])
        .map((a) => gameRowFromAttendance(a, inputs.shapes, inputs.teams))
        .filter((row): row is GameRowFixture => row != null),
    profile: () =>
      inputs.account
        ? profileFromAccount(inputs.account, inputs.stats, inputs.companions ?? [])
        : emptyRepository.profile(),
    friends: () =>
      friendsFromRecords(inputs.companions ?? [], inputs.rivalries ?? [], inputs.overlaps ?? []),
    person: (key) => personFromInputs(inputs, key),
    // Read at render rather than when the repository is built, so "today" and the lit step
    // in the timeline stay right on a screen left open.
    gameDay: () =>
      gameDayFromUpcoming(inputs.upcoming ?? [], inputs.teams, Date.now()) ??
      emptyRepository.gameDay(),
  };
}
