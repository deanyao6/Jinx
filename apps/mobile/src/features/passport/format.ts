/**
 * Pure helpers over the stats payload: normalizing the JSON from the server and turning it into
 * display rows. No I/O so the profile screen can reuse them for another user's passport.
 */
import { formatRecord } from '@jinx/core';

import { momentLabel } from '@/features/attendances/moments';
import type {
  StatsMoment,
  StatsPayload,
  StatsStamp,
  StatsStreaks,
  Superlatives,
  WinLossRecord,
} from './types';

const EMPTY_RECORD: WinLossRecord = { wins: 0, losses: 0, ties: 0 };

function num(v: unknown, fallback = 0): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function str(v: unknown): string | null {
  return typeof v === 'string' ? v : null;
}

export function parseRecord(v: unknown): WinLossRecord {
  const o = obj(v);
  return { wins: num(o['wins']), losses: num(o['losses']), ties: num(o['ties']) };
}

function parseStamp(v: unknown): StatsStamp | null {
  const o = obj(v);
  const venueId = str(o['venue_id']);
  const name = str(o['name']);
  if (!venueId || !name) return null;
  return {
    venue_id: venueId,
    name,
    city: str(o['city']),
    state: str(o['state']),
    country: str(o['country']),
    visits: num(o['visits']),
    first_visit: str(o['first_visit']),
    sports: arr(o['sports']).filter((s): s is string => typeof s === 'string'),
    closed: o['closed'] === true,
    lat: typeof o['lat'] === 'number' ? o['lat'] : null,
    lng: typeof o['lng'] === 'number' ? o['lng'] : null,
  };
}

/** Normalizes the server payload; every key may be missing or null on a fresh account. */
export function parseStats(input: unknown): StatsPayload {
  const p = obj(input);
  const totals = obj(p['totals']);
  const pledge = obj(p['pledge']);
  const streaks = obj(p['streaks']);
  return {
    totals: {
      games: num(totals['games']),
      venues: num(totals['venues']),
      states: num(totals['states']),
      countries: num(totals['countries']),
    },
    overall: parseRecord(p['overall']),
    teams: arr(p['teams']).flatMap((t) => {
      const o = obj(t);
      const franchiseId = str(o['franchise_id']);
      if (!franchiseId) return [];
      return [
        {
          franchise_id: franchiseId,
          team_id: str(o['team_id']) ?? '',
          name: str(o['name']) ?? '',
          abbreviation: str(o['abbreviation']) ?? '',
          sport_id: str(o['sport_id']) ?? '',
          record: parseRecord(o['record']),
        },
      ];
    }),
    pledge: { record: parseRecord(pledge['record']), vs_expected: num(pledge['vs_expected']) },
    stamps: arr(p['stamps']).flatMap((s) => {
      const stamp = parseStamp(s);
      return stamp ? [stamp] : [];
    }),
    superlatives: (obj(p['superlatives']) as Superlatives) ?? {},
    streaks: {
      longest_win: num(streaks['longest_win']),
      longest_loss: num(streaks['longest_loss']),
      current: num(streaks['current']),
    },
    moments: arr(p['moments']).flatMap((m) => {
      const o = obj(m);
      const type = str(o['type']);
      return type ? [{ type, count: num(o['count']) }] : [];
    }),
    players_seen: num(p['players_seen']),
    computed_at: str(p['computed_at']),
  };
}

export const EMPTY_STATS: StatsPayload = parseStats({});

export function isEmptyStats(s: StatsPayload): boolean {
  return s.totals.games === 0 && s.stamps.length === 0;
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** "48 games, 14 stadiums, 3 states" */
export function totalsLine(t: StatsPayload['totals']): string {
  const parts = [plural(t.games, 'game'), plural(t.venues, 'stadium'), plural(t.states, 'state')];
  if (t.countries > 1) parts.push(plural(t.countries, 'country', 'countries'));
  return parts.join(', ');
}

export function possessive(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return 'Your';
  return /s$/i.test(trimmed) ? `${trimmed}’` : `${trimmed}’s`;
}

/** 1-based position of a venue in first-visit order ("Stamp #14"); null when unknown. */
export function stampNumber(stamps: StatsStamp[], venueId: string): number | null {
  const ordered = [...stamps].sort((a, b) => {
    if (a.first_visit && b.first_visit) return a.first_visit.localeCompare(b.first_visit);
    if (a.first_visit) return -1;
    if (b.first_visit) return 1;
    return a.name.localeCompare(b.name);
  });
  const i = ordered.findIndex((s) => s.venue_id === venueId);
  return i === -1 ? null : i + 1;
}

export function visitsLabel(n: number): string {
  return plural(n, 'visit');
}

export function kmToMiles(km: number): number {
  return Math.round(km * 0.621371);
}

export function formatMiles(km: number): string {
  return `${kmToMiles(km).toLocaleString()} mi`;
}

export function formatDuration(minutes: number | null, periods: number | null): string {
  if (minutes != null && minutes > 0) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
  }
  if (periods != null) return `${periods} periods`;
  return '–';
}

export function formatShortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export type SuperlativeRow = {
  key: string;
  title: string;
  value: string;
  /** A few words for the chip beside the value: the matchup and month, or the stadium. */
  context?: string;
  /** A quiet line that says what the value measures, when the value alone would not. */
  detail?: string;
  gameId?: string;
  venueId?: string;
  playerId?: string;
  /** A row about no one game opens its own page. Famous games is the only one so far. */
  href?: string;
  /** Gold marks a rarity: the icon is drawn in gold rather than the team colour. */
  tone?: 'gold';
};

/** What a row needs to know about the game it points at. Team abbreviations, not names. */
export type SuperlativeGame = {
  scheduled_start: string;
  away: string | null;
  home: string | null;
};

export type SuperlativeGameLookup = (gameId: string) => SuperlativeGame | null | undefined;

/** "NYM at PHI, Apr 2024": short enough for the Passport's chip. `date: false` is the matchup alone. */
export function gameContext(
  game: SuperlativeGame | null | undefined,
  opts: { date?: boolean } = {},
): string | undefined {
  if (!game) return undefined;
  const d = new Date(game.scheduled_start);
  const when =
    opts.date === false || Number.isNaN(d.getTime())
      ? ''
      : d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
  const matchup = game.away && game.home ? `${game.away} at ${game.home}` : '';
  return [matchup, when].filter(Boolean).join(', ') || undefined;
}

/** The label where a row has one line for it: what the value measures joins the title. */
export function superlativeLabel(row: Pick<SuperlativeRow, 'title' | 'detail'>): string {
  return row.detail ? `${row.title}, ${row.detail}` : row.title;
}

function times(n: number): string {
  return `${n} ${n === 1 ? 'time' : 'times'}`;
}

/**
 * "From 4%" when the game has a win probability timeline. Otherwise the deficit, in the sport's
 * own unit, because four runs and fourteen points are not the same size of hole.
 */
export function comebackValue(c: NonNullable<Superlatives['biggest_comeback']>): string {
  if (typeof c.low_win_prob === 'number') {
    const pct = Math.round(c.low_win_prob * 100);
    return pct < 1 ? 'Won from under 1%' : `Won from ${pct}%`;
  }
  if (c.sport_id === 'mlb') return `Down ${plural(c.deficit, 'run')}`;
  if (c.sport_id === 'nfl') return `Down ${plural(c.deficit, 'point')}`;
  return `Down ${c.deficit}`;
}

/**
 * Display rows, the most interesting first: the Passport shows the first six.
 *
 * `games` finds the game a row points at, for its context chip. Without it (another person's
 * passport, or before the games load) the rows are the same, just without that chip.
 */
export function superlativeRows(
  s: Superlatives,
  moments: StatsMoment[] = [],
  streaks?: StatsStreaks,
  games?: SuperlativeGameLookup,
): SuperlativeRow[] {
  const rows: SuperlativeRow[] = [];
  const at = (gameId: string | undefined) => (gameId ? gameContext(games?.(gameId)) : undefined);
  /** Drops undefined keys, so a row without a chip is the same object it always was. */
  const push = (row: SuperlativeRow) => {
    const clean = { ...row };
    for (const k of Object.keys(clean) as (keyof SuperlativeRow)[]) {
      if (clean[k] === undefined) delete clean[k];
    }
    rows.push(clean);
  };

  // Famous games lead: they are the rarest thing on the list, and the only way to their page.
  if (s.famous_games && s.famous_games.count + s.famous_games.personal_count > 0) {
    const { count, personal_count } = s.famous_games;
    push({
      key: 'famous_games',
      title: 'Famous games',
      value: String(count),
      context: personal_count > 0 ? `${personal_count} personal` : undefined,
      href: '/passport/famous',
      tone: 'gold',
    });
  }

  // The overall most seen player is deliberately not a row: it is usually a stranger. The
  // payload still carries `most_seen_player` for builds already installed.
  if (s.most_seen_favorite_player) {
    push({
      key: 'most_seen_favorite_player',
      title: `Seen ${s.most_seen_favorite_player.name} play`,
      value: times(s.most_seen_favorite_player.count),
      playerId: s.most_seen_favorite_player.player_id,
    });
  }
  if (s.biggest_comeback) {
    push({
      key: 'biggest_comeback',
      title: 'Biggest comeback',
      value: comebackValue(s.biggest_comeback),
      context: at(s.biggest_comeback.game_id),
      detail: typeof s.biggest_comeback.low_win_prob === 'number' ? 'win probability' : undefined,
      gameId: s.biggest_comeback.game_id,
    });
  }
  if (s.coldest) {
    push({
      key: 'coldest',
      title: 'Coldest game',
      value: `${Math.round(s.coldest.value)}°F`,
      context: at(s.coldest.game_id),
      gameId: s.coldest.game_id,
    });
  }
  // One game with a temperature is both the coldest and the hottest; saying it twice is noise.
  if (s.hottest && s.hottest.game_id !== s.coldest?.game_id) {
    push({
      key: 'hottest',
      title: 'Hottest game',
      value: `${Math.round(s.hottest.value)}°F`,
      context: at(s.hottest.game_id),
      gameId: s.hottest.game_id,
    });
  }
  if (s.largest_crowd) {
    push({
      key: 'largest_crowd',
      title: 'Largest crowd',
      value: s.largest_crowd.attendance.toLocaleString('en-US'),
      context: at(s.largest_crowd.game_id),
      gameId: s.largest_crowd.game_id,
    });
  }
  if (s.highest_altitude) {
    push({
      key: 'highest_altitude',
      title: 'Highest altitude',
      value: `${s.highest_altitude.elevation_ft.toLocaleString('en-US')} ft`,
      context: s.highest_altitude.name,
      gameId: s.highest_altitude.game_id,
      venueId: s.highest_altitude.venue_id,
    });
  }
  if (s.farthest_venue) {
    push({
      key: 'farthest_venue',
      title: 'Farthest from home',
      value: formatMiles(s.farthest_venue.km),
      context: s.farthest_venue.name,
      gameId: s.farthest_venue.game_id,
      venueId: s.farthest_venue.venue_id,
    });
  }
  if (s.longest) {
    push({
      key: 'longest',
      title: 'Longest game',
      value: formatDuration(s.longest.minutes, s.longest.periods),
      context: at(s.longest.game_id),
      gameId: s.longest.game_id,
    });
  }
  if (s.highest_scoring) {
    push({
      key: 'highest_scoring',
      title: 'Highest-scoring game',
      value: `${s.highest_scoring.total} total`,
      context: at(s.highest_scoring.game_id),
      gameId: s.highest_scoring.game_id,
    });
  }
  if (s.lowest_scoring && s.lowest_scoring.game_id !== s.highest_scoring?.game_id) {
    push({
      key: 'lowest_scoring',
      title: 'Lowest-scoring game',
      value: `${s.lowest_scoring.total} total`,
      context: at(s.lowest_scoring.game_id),
      gameId: s.lowest_scoring.game_id,
    });
  }
  const walkOffs = moments
    .filter((m) => m.type === 'walk_off' || m.type === 'walk_off_score')
    .reduce((acc, m) => acc + m.count, 0);
  if (walkOffs > 0) {
    push({ key: 'walk_offs', title: 'Walk-offs witnessed', value: String(walkOffs) });
  }
  if (streaks && streaks.longest_win > 1) {
    push({
      key: 'longest_win',
      title: 'Longest win streak',
      value: plural(streaks.longest_win, 'game'),
    });
  }
  if (streaks && streaks.longest_loss > 1) {
    push({
      key: 'longest_loss',
      title: 'Longest losing streak',
      value: plural(streaks.longest_loss, 'game'),
    });
  }
  if (s.most_visited_venue) {
    push({
      key: 'most_visited_venue',
      title: 'Most visited stadium',
      value: visitsLabel(s.most_visited_venue.visits),
      context: s.most_visited_venue.name,
      gameId: s.most_visited_venue.game_id,
      venueId: s.most_visited_venue.venue_id,
    });
  }
  if (s.most_miles_team) {
    push({
      key: 'most_miles_team',
      title: `Most miles for the ${s.most_miles_team.team_name}`,
      value: formatMiles(s.most_miles_team.km),
    });
  }
  for (const t of s.most_seen_by_team ?? []) {
    push({
      key: `most_seen_${t.franchise_id}`,
      title: `Most seen ${t.team_name}, ${t.name}`,
      value: times(t.count),
      playerId: t.player_id,
    });
  }
  if (s.first_game) {
    push({
      key: 'first_game',
      title: 'First game',
      value: formatShortDate(s.first_game.date),
      // The value is already the date, so the chip is the matchup alone.
      context: gameContext(games?.(s.first_game.game_id), { date: false }),
      gameId: s.first_game.game_id,
    });
  }
  return rows;
}

export function momentRows(
  moments: StatsMoment[],
): { type: string; label: string; count: number }[] {
  return [...moments]
    .sort((a, b) => b.count - a.count)
    .map((m) => ({ type: m.type, label: momentLabel(m.type), count: m.count }));
}

/** Team tile text: "12–5" with the record helper from core. */
export function tileRecord(rec: WinLossRecord): string {
  return formatRecord(rec ?? EMPTY_RECORD);
}
