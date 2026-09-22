import type { NflverseGameRow } from '@jinx/core';
import { describe, expect, it } from 'vitest';

import {
  appearancesFromSnapCounts,
  appearancesFromWeeklyStats,
  linesFromWeeklyStats,
  withLines,
  buildPfrToGsis,
  buildScheduleIndex,
  countAppearances,
  resolveGameId,
  resolveTeam,
} from './appearances.js';
import type { PlayerIdRow, SnapCountRow, StatsWeekRow } from './csv.js';

function game(
  game_id: string,
  season: number,
  week: number,
  away_team: string,
  home_team: string,
): NflverseGameRow {
  return {
    game_id,
    season,
    game_type: week >= 18 ? 'WC' : 'REG',
    week,
    gameday: `${season}-09-10`,
    gametime: '13:00',
    away_team,
    away_score: 10,
    home_team,
    home_score: 20,
    location: 'Home',
    temp: null,
    stadium_id: null,
    stadium: null,
  };
}

const schedule = buildScheduleIndex([
  game('2005_01_OAK_NE', 2005, 1, 'OAK', 'NE'),
  game('2005_01_STL_SF', 2005, 1, 'STL', 'SF'),
  game('2005_06_SD_OAK', 2005, 6, 'SD', 'OAK'),
  game('2005_18_JAX_NE', 2005, 18, 'JAX', 'NE'),
  game('2024_10_DET_HOU', 2024, 10, 'DET', 'HOU'),
]);

const players: PlayerIdRow[] = [
  { gsis_id: '00-0033106', pfr_id: 'GoffJa00', display_name: 'Jared Goff', position: 'QB' },
  { gsis_id: '00-0039163', pfr_id: 'StroCJ00', display_name: 'C.J. Stroud', position: 'QB' },
  { gsis_id: null, pfr_id: 'NoGsis00', display_name: 'Nobody Gsis', position: 'LS' },
  { gsis_id: '00-0099999', pfr_id: null, display_name: 'No PFR', position: 'K' },
];

function snap(over: Partial<SnapCountRow>): SnapCountRow {
  return {
    game_id: '2024_10_DET_HOU',
    season: 2024,
    week: 10,
    player: 'Jared Goff',
    pfr_player_id: 'GoffJa00',
    position: 'QB',
    team: 'DET',
    opponent: 'HOU',
    offense_snaps: 60,
    defense_snaps: 0,
    st_snaps: 0,
    ...over,
  };
}

describe('appearances from snap counts (2012+)', () => {
  it('maps pfr ids to gsis ids, requires a snap, skips players without a gsis id, and dedupes', () => {
    const index = appearancesFromSnapCounts(
      [
        snap({}),
        snap({}), // duplicate row for the same player and game
        snap({
          player: 'C.J. Stroud',
          pfr_player_id: 'StroCJ00',
          team: 'HOU',
          opponent: 'DET',
          offense_snaps: 0,
          st_snaps: 3,
        }),
        snap({
          player: 'Bench Guy',
          pfr_player_id: 'StroCJ00',
          offense_snaps: 0,
          defense_snaps: 0,
          st_snaps: 0,
        }),
        snap({ player: 'Nobody Gsis', pfr_player_id: 'NoGsis00' }),
        snap({ player: 'Unknown Pfr', pfr_player_id: 'Zzzz00' }),
        snap({ player: 'No Id', pfr_player_id: null }),
        snap({ game_id: '2024_99_XX_YY' }),
        snap({ team: 'KC', opponent: 'NE' }),
      ],
      buildPfrToGsis(players),
      schedule,
    );
    expect(index.byGame.get('2024_10_DET_HOU')).toEqual([
      { providerPlayerId: '00-0033106', fullName: 'Jared Goff', providerTeamId: 'DET' },
      { providerPlayerId: '00-0039163', fullName: 'C.J. Stroud', providerTeamId: 'HOU' },
    ]);
    expect(countAppearances(index)).toBe(2);
    expect(index.skipped).toEqual({
      missingGsis: 2,
      unknownGame: 1,
      unknownTeam: 1,
      missingPlayer: 1,
    });
  });
});

function stat(over: Partial<StatsWeekRow>): StatsWeekRow {
  return {
    player_id: '00-0019596',
    player_display_name: 'Tom Brady',
    player_name: 'T.Brady',
    season: 2005,
    week: 1,
    season_type: 'REG',
    game_id: '2005_01_OAK_NE',
    team: 'NE',
    opponent_team: 'LV',
    position: 'QB',
    passing_yards: null,
    passing_tds: null,
    rushing_yards: null,
    rushing_tds: null,
    receiving_yards: null,
    receiving_tds: null,
    special_teams_tds: null,
    def_tds: null,
    fumble_recovery_tds: null,
    def_sacks: null,
    def_interceptions: null,
    ...over,
  };
}

describe('appearances from weekly stats (2000-2011 fallback)', () => {
  it('resolves season/week/team to a game id, including modern aliases of relocated teams', () => {
    expect(resolveGameId(schedule, 2005, 1, 'NE')).toBe('2005_01_OAK_NE');
    expect(resolveGameId(schedule, 2005, 1, 'OAK')).toBe('2005_01_OAK_NE');
    expect(resolveGameId(schedule, 2005, 1, 'LV')).toBe('2005_01_OAK_NE');
    expect(resolveGameId(schedule, 2005, 1, 'LA')).toBe('2005_01_STL_SF');
    expect(resolveGameId(schedule, 2005, 6, 'LAC')).toBe('2005_06_SD_OAK');
    expect(resolveGameId(schedule, 2005, 18, 'JAX')).toBe('2005_18_JAX_NE');
    expect(resolveGameId(schedule, 2005, 2, 'NE')).toBeNull();
    expect(resolveGameId(schedule, 2005, null, 'NE')).toBeNull();
  });

  it('maps the current-franchise abbreviation back to the historical one on the game', () => {
    const oakNe = { home: 'NE', away: 'OAK' };
    expect(resolveTeam(oakNe, 'NE', 'LV')).toBe('NE');
    expect(resolveTeam(oakNe, 'LV', 'NE')).toBe('OAK');
    expect(resolveTeam(oakNe, 'OAK', 'NE')).toBe('OAK');
    const sdOak = { home: 'OAK', away: 'SD' };
    expect(resolveTeam(sdOak, 'LAC', 'LV')).toBe('SD');
    expect(resolveTeam(sdOak, 'LV', 'LAC')).toBe('OAK');
    expect(resolveTeam(sdOak, 'KC', 'DEN')).toBeNull();
  });

  it('uses the row game_id when present and falls back to season/week/team otherwise', () => {
    const index = appearancesFromWeeklyStats(
      [
        stat({}),
        stat({
          player_id: '00-0003292',
          player_display_name: 'Kerry Collins',
          team: 'LV',
          opponent_team: 'NE',
        }),
        stat({
          player_id: '00-0010000',
          player_display_name: 'Fallback Guy',
          game_id: null,
          team: 'LV',
          opponent_team: 'NE',
        }),
        stat({
          player_id: '00-0020000',
          player_display_name: 'Both Moved',
          game_id: null,
          week: 6,
          team: 'LAC',
          opponent_team: 'LV',
        }),
        stat({
          player_id: '00-0030000',
          player_display_name: 'Lost',
          game_id: null,
          week: 9,
          team: 'NE',
          opponent_team: 'MIA',
        }),
        stat({
          player_id: '00-0040000',
          player_display_name: 'Wrong Team',
          team: 'KC',
          opponent_team: 'DEN',
        }),
        stat({ player_id: null }),
      ],
      schedule,
    );
    expect(index.byGame.get('2005_01_OAK_NE')).toEqual([
      { providerPlayerId: '00-0019596', fullName: 'Tom Brady', providerTeamId: 'NE' },
      { providerPlayerId: '00-0003292', fullName: 'Kerry Collins', providerTeamId: 'OAK' },
      { providerPlayerId: '00-0010000', fullName: 'Fallback Guy', providerTeamId: 'OAK' },
    ]);
    expect(index.byGame.get('2005_06_SD_OAK')).toEqual([
      { providerPlayerId: '00-0020000', fullName: 'Both Moved', providerTeamId: 'SD' },
    ]);
    expect(index.skipped).toEqual({
      missingGsis: 0,
      unknownGame: 1,
      unknownTeam: 1,
      missingPlayer: 1,
    });
  });
});

describe('box-score lines from the weekly stats (players seen, decision 7)', () => {
  it('sums every kind of touchdown, keeps yards by kind, and never counts a kick', () => {
    const schedule = buildScheduleIndex([game('2005_01_OAK_NE', 2005, 1, 'OAK', 'NE')]);
    const lines = linesFromWeeklyStats(
      [
        stat({ passing_yards: 306, passing_tds: 2, rushing_yards: 3 }),
        stat({ player_id: '00-0020000', player_display_name: 'A Back', position: 'RB', rushing_yards: 101, rushing_tds: 1, receiving_yards: 22, receiving_tds: 1, special_teams_tds: 1 }),
        stat({ player_id: '00-0020001', player_display_name: 'A Kicker', position: 'K' }),
        stat({ player_id: '00-0020002', player_display_name: 'A Linebacker', position: 'LB', def_sacks: 2, def_interceptions: 1, def_tds: 1 }),
        stat({ player_id: null }),
      ],
      schedule,
    );
    const byPlayer = lines.get('2005_01_OAK_NE')!;
    expect(byPlayer.get('00-0019596')).toEqual({ td: 0, rush_yds: 3, rec_yds: 0, pass_yds: 306, sacks: 0, int: 0 });
    expect(byPlayer.get('00-0020000')).toEqual({ td: 3, rush_yds: 101, rec_yds: 22, pass_yds: 0, sacks: 0, int: 0 });
    expect(byPlayer.get('00-0020001')).toEqual({ td: 0, rush_yds: 0, rec_yds: 0, pass_yds: 0, sacks: 0, int: 0 });
    expect(byPlayer.get('00-0020002')).toEqual({ td: 1, rush_yds: 0, rec_yds: 0, pass_yds: 0, sacks: 2, int: 1 });
    expect(byPlayer.has('null')).toBe(false);
    const withL = withLines(
      [{ providerPlayerId: '00-0019596', fullName: 'Tom Brady', providerTeamId: 'NE' }, { providerPlayerId: 'x', fullName: 'X', providerTeamId: 'NE' }],
      byPlayer,
    );
    expect(withL[0]!.line?.pass_yds).toBe(306);
    expect(withL[1]!.line).toBeNull();
    expect(withLines([{ providerPlayerId: 'x', fullName: 'X', providerTeamId: 'NE' }], undefined)[0]!.line).toBeUndefined();
  });
});
