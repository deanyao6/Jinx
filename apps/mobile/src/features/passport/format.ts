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
  gameId?: string;
  venueId?: string;
  playerId?: string;
};

/**
 * Display rows in preview priority order. Walk-offs come from the moments list because the mockup
 * shows them next to the other superlatives.
 */
export function superlativeRows(
  s: Superlatives,
  moments: StatsMoment[] = [],
  streaks?: StatsStreaks,
): SuperlativeRow[] {
  const rows: SuperlativeRow[] = [];
  if (s.most_seen_player) {
    rows.push({
      key: 'most_seen_player',
      title: `Seen ${s.most_seen_player.name} play`,
      value: `${s.most_seen_player.count} ${s.most_seen_player.count === 1 ? 'time' : 'times'}`,
      playerId: s.most_seen_player.player_id,
    });
  }
  const walkOffs = moments
    .filter((m) => m.type === 'walk_off' || m.type === 'walk_off_score')
    .reduce((acc, m) => acc + m.count, 0);
  if (walkOffs > 0) {
    rows.push({ key: 'walk_offs', title: 'Walk-offs witnessed', value: String(walkOffs) });
  }
  if (s.coldest) {
    rows.push({
      key: 'coldest',
      title: 'Coldest game',
      value: `${Math.round(s.coldest.value)}°F`,
      gameId: s.coldest.game_id,
    });
  }
  if (s.biggest_comeback) {
    rows.push({
      key: 'biggest_comeback',
      title: 'Biggest comeback',
      value: `Down ${s.biggest_comeback.deficit}`,
      gameId: s.biggest_comeback.game_id,
    });
  }
  if (s.hottest) {
    rows.push({
      key: 'hottest',
      title: 'Hottest game',
      value: `${Math.round(s.hottest.value)}°F`,
      gameId: s.hottest.game_id,
    });
  }
  if (s.longest) {
    rows.push({
      key: 'longest',
      title: 'Longest game',
      value: formatDuration(s.longest.minutes, s.longest.periods),
      gameId: s.longest.game_id,
    });
  }
  if (s.highest_scoring) {
    rows.push({
      key: 'highest_scoring',
      title: 'Highest-scoring game',
      value: `${s.highest_scoring.total} total`,
      gameId: s.highest_scoring.game_id,
    });
  }
  if (s.lowest_scoring) {
    rows.push({
      key: 'lowest_scoring',
      title: 'Lowest-scoring game',
      value: `${s.lowest_scoring.total} total`,
      gameId: s.lowest_scoring.game_id,
    });
  }
  if (streaks && streaks.longest_win > 1) {
    rows.push({
      key: 'longest_win',
      title: 'Longest win streak',
      value: plural(streaks.longest_win, 'game'),
    });
  }
  if (streaks && streaks.longest_loss > 1) {
    rows.push({
      key: 'longest_loss',
      title: 'Longest losing streak',
      value: plural(streaks.longest_loss, 'game'),
    });
  }
  if (s.most_visited_venue) {
    rows.push({
      key: 'most_visited_venue',
      title: `Most visits, ${s.most_visited_venue.name}`,
      value: visitsLabel(s.most_visited_venue.visits),
      venueId: s.most_visited_venue.venue_id,
    });
  }
  if (s.farthest_venue) {
    rows.push({
      key: 'farthest_venue',
      title: `Farthest trip, ${s.farthest_venue.name}`,
      value: formatMiles(s.farthest_venue.km),
      venueId: s.farthest_venue.venue_id,
    });
  }
  if (s.most_miles_team) {
    rows.push({
      key: 'most_miles_team',
      title: `Most miles for the ${s.most_miles_team.team_name}`,
      value: formatMiles(s.most_miles_team.km),
    });
  }
  for (const t of s.most_seen_by_team ?? []) {
    rows.push({
      key: `most_seen_${t.franchise_id}`,
      title: `Most seen ${t.team_name}, ${t.name}`,
      value: `${t.count} ${t.count === 1 ? 'time' : 'times'}`,
      playerId: t.player_id,
    });
  }
  if (s.first_game) {
    rows.push({
      key: 'first_game',
      title: 'First game',
      value: formatShortDate(s.first_game.date),
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
