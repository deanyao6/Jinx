/**
 * Famous games in the app: the words and the grouping (docs/prompts/famous-games.md 7).
 *
 * The rows come from `my_famous_games` and `game_famous` (20260918000100_famous_games.sql).
 * A famous row carries its own title; a personal badge carries a kind and a player, and its
 * title is built here from `personalBadgeTitle` in @jinx/core so the words live in one place.
 */
import { personalBadgeExplanation, personalBadgeTitle } from '@jinx/core';

/** What a famous-game row needs to be drawn, from either RPC. */
export type FamousItem = {
  gameId: string;
  source: string;
  category: string;
  kind: string;
  title: string;
  story: string;
  personal: boolean;
  playerName: string | null;
  teamId: string | null;
  teamNickname: string | null;
  sportId: string;
};

/** A row in the list page: the item plus the game it opens. */
export type FamousListItem = FamousItem & {
  scheduledStart: string;
  away: string;
  home: string;
  awayScore: number | null;
  homeScore: number | null;
};

/** League names, keyed by sport so a new league is a row. */
const LEAGUE_LABEL: Record<string, string> = { mlb: 'MLB', nfl: 'NFL', nba: 'NBA', mls: 'MLS' };

export function leagueLabel(sportId: string): string {
  return LEAGUE_LABEL[sportId] ?? sportId.toUpperCase();
}

/** What the card or row says: the famous title, or the personal badge's sentence. */
export function famousTitle(
  item: Pick<FamousItem, 'personal' | 'title' | 'kind' | 'playerName' | 'teamNickname' | 'sportId'>,
): string {
  if (!item.personal) return item.title;
  return personalBadgeTitle({
    kind: item.kind,
    playerName: item.playerName ?? 'A favourite',
    teamNickname: item.teamNickname,
    sportId: item.sportId,
  });
}

/** The line under the title: the famous row's story, or why a personal badge counts. */
export function famousStory(item: Pick<FamousItem, 'personal' | 'story' | 'kind'>): string {
  return item.personal ? personalBadgeExplanation(item.kind) : item.story;
}

/** "Yours" over a personal badge; the category over a famous game. */
const CATEGORY_KICKER: Record<string, string> = {
  championship: 'Championship',
  playoff: 'Playoffs',
  record: 'Record',
  debut: 'Debut',
  farewell: 'Farewell',
};

export function famousKicker(item: Pick<FamousItem, 'personal' | 'category'>): string {
  if (item.personal) return 'Yours';
  return CATEGORY_KICKER[item.category] ?? 'Famous game';
}

export type FamousTeamGroup = { teamId: string | null; title: string; items: FamousListItem[] };
export type FamousLeagueGroup = { sportId: string; title: string; teams: FamousTeamGroup[] };

/**
 * By league, then by team, newest first inside each team. Leagues in alphabetical order of
 * their label; teams by how many rows they hold, then by name.
 */
export function groupFamous(items: readonly FamousListItem[]): FamousLeagueGroup[] {
  const leagues = new Map<string, Map<string, FamousTeamGroup>>();
  for (const item of items) {
    const teams = leagues.get(item.sportId) ?? new Map<string, FamousTeamGroup>();
    const key = item.teamId ?? 'league';
    const group = teams.get(key) ?? {
      teamId: item.teamId,
      title: item.teamNickname ?? leagueLabel(item.sportId),
      items: [],
    };
    group.items.push(item);
    teams.set(key, group);
    leagues.set(item.sportId, teams);
  }
  return [...leagues.entries()]
    .map(([sportId, teams]) => ({
      sportId,
      title: leagueLabel(sportId),
      teams: [...teams.values()]
        .map((t) => ({
          ...t,
          items: [...t.items].sort((a, b) => b.scheduledStart.localeCompare(a.scheduledStart)),
        }))
        .sort((a, b) => b.items.length - a.items.length || a.title.localeCompare(b.title)),
    }))
    .sort((a, b) => a.title.localeCompare(b.title));
}

/** "2 famous games", "1 famous game". */
export function famousCountLabel(n: number): string {
  return n === 1 ? '1 famous game' : `${n} famous games`;
}
