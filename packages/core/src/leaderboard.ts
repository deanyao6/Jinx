/**
 * Leaderboards (docs/prompts/social/04, section 2). Ranking and paging are pure; the numbers
 * themselves are computed server side (`leaderboard_stats`, SPEC 5.3) because they read
 * attendance, verification and box-score data no client should scan.
 */
import type { Sport } from './types.js';

export type LeaderboardPeriod = 'season' | 'month' | 'all';
export type CommunityKind = 'team' | 'venue' | 'school' | 'custom';

export interface LeaderboardStatDef {
  key: string;
  label: string;
  /** null when every sport's community offers this stat (games, wins, stadiums). */
  sport: Sport | null;
  kinds: readonly CommunityKind[];
}

const ALL_KINDS: readonly CommunityKind[] = ['team', 'venue', 'school', 'custom'];
/** Every stat but the plain attendance count and its venue-scoped twin (never both at once). */
const NON_VENUE_KINDS: readonly CommunityKind[] = ['team', 'school', 'custom'];

/** The stat list (section 2, and 00_repo_reality.md R3 for the NBA and MLS rows). */
export const LEADERBOARD_STATS: readonly LeaderboardStatDef[] = [
  { key: 'games', label: 'Games attended', sport: null, kinds: NON_VENUE_KINDS },
  { key: 'wins', label: 'Wins seen', sport: null, kinds: NON_VENUE_KINDS },
  { key: 'stadiums', label: 'Stadiums visited', sport: null, kinds: ['team', 'school', 'custom'] },
  { key: 'venue_games', label: 'Games at this venue', sport: null, kinds: ['venue'] },
  { key: 'mlb_home_runs', label: 'Home runs seen', sport: 'mlb', kinds: ALL_KINDS },
  { key: 'mlb_walk_offs', label: 'Walk-offs seen', sport: 'mlb', kinds: ALL_KINDS },
  { key: 'mlb_shutouts', label: 'Shutouts seen', sport: 'mlb', kinds: ALL_KINDS },
  { key: 'mlb_extra_innings', label: 'Extra-inning games', sport: 'mlb', kinds: ALL_KINDS },
  { key: 'nfl_touchdowns', label: 'Touchdowns seen', sport: 'nfl', kinds: ALL_KINDS },
  { key: 'nfl_overtimes', label: 'Overtime games', sport: 'nfl', kinds: ALL_KINDS },
  { key: 'nba_30pt_games', label: '30-point games seen', sport: 'nba', kinds: ALL_KINDS },
  { key: 'nba_buzzer_beaters', label: 'Buzzer-beaters seen', sport: 'nba', kinds: ALL_KINDS },
  { key: 'nba_overtimes', label: 'Overtime games', sport: 'nba', kinds: ALL_KINDS },
  { key: 'mls_goals', label: 'Goals seen', sport: 'mls', kinds: ALL_KINDS },
  { key: 'mls_clean_sheets', label: 'Clean sheets seen', sport: 'mls', kinds: ALL_KINDS },
];

export function statsForCommunity(kind: CommunityKind, sport: Sport | null): LeaderboardStatDef[] {
  return LEADERBOARD_STATS.filter(
    (s) => s.kinds.includes(kind) && (s.sport === null || s.sport === sport),
  );
}

export interface LeaderboardRow {
  userId: string;
  value: number;
  /** When this value was first reached; ties break to whoever got there first. */
  achievedAt: string;
}

export interface RankedRow extends LeaderboardRow {
  rank: number;
}

export function rankLeaderboard(rows: readonly LeaderboardRow[]): RankedRow[] {
  const sorted = [...rows].sort((a, b) => {
    if (b.value !== a.value) return b.value - a.value;
    return Date.parse(a.achievedAt) - Date.parse(b.achievedAt);
  });
  return sorted.map((r, i) => ({ ...r, rank: i + 1 }));
}

export interface LeaderboardPage {
  rows: RankedRow[];
  /** The viewer's own row, present even when off the visible page; `pinned` says which. */
  viewer: (RankedRow & { pinned: boolean }) | null;
}

/** Ranks and pages `rows`, pinning the viewer's row at the bottom when it is off-page. */
export function pageLeaderboard(
  rows: readonly LeaderboardRow[],
  viewerId: string | null,
  pageSize: number,
): LeaderboardPage {
  const ranked = rankLeaderboard(rows);
  const page = ranked.slice(0, Math.max(pageSize, 0));
  const viewerRow = viewerId ? (ranked.find((r) => r.userId === viewerId) ?? null) : null;
  const onPage = viewerRow ? page.some((r) => r.userId === viewerId) : false;
  return { rows: page, viewer: viewerRow ? { ...viewerRow, pinned: !onPage } : null };
}

/** `leaderboard_stats.season` for a period, matching its check constraint (period 'all' => 0). */
export function leaderboardSeasonKey(
  period: LeaderboardPeriod,
  season: number,
  monthDate: Date,
): number {
  if (period === 'all') return 0;
  if (period === 'season') return season;
  return monthDate.getUTCFullYear() * 100 + (monthDate.getUTCMonth() + 1);
}
