import { describe, expect, it } from 'vitest';

import { GOOD_GAME_RULES, NICHE_GOOD_GAMES, isGoodGame, lineCaption } from './goodGame.js';

describe('a good game, per sport (Dean, 2026-09-22)', () => {
  it('has a rule for every sport', () => {
    expect(Object.keys(GOOD_GAME_RULES).sort()).toEqual(['mlb', 'mls', 'nba', 'nfl']);
    expect(NICHE_GOOD_GAMES).toBe(10);
    expect(isGoodGame('mlb', null)).toBe(false);
  });

  it('MLB batter: a home run, 3 RBI or 3 hits; not 2 hits and 2 RBI', () => {
    expect(isGoodGame('mlb', { ab: 4, h: 1, hr: 1, rbi: 1 })).toBe(true);
    expect(isGoodGame('mlb', { ab: 4, h: 1, hr: 0, rbi: 3 })).toBe(true);
    expect(isGoodGame('mlb', { ab: 5, h: 3, hr: 0, rbi: 0 })).toBe(true);
    expect(isGoodGame('mlb', { ab: 4, h: 2, hr: 0, rbi: 2 })).toBe(false);
    expect(isGoodGame('mlb', { ab: 4, h: 0 })).toBe(false);
  });

  it('MLB pitcher: 7 innings with 2 or fewer earned runs, 10 strikeouts, or a save; a hitter with those keys is not a pitcher', () => {
    expect(isGoodGame('mlb', { pitched: true, ip_outs: 21, er: 2, k: 4 })).toBe(true);
    expect(isGoodGame('mlb', { pitched: true, ip_outs: 20, er: 0, k: 9 })).toBe(false);
    expect(isGoodGame('mlb', { pitched: true, ip_outs: 21, er: 3, k: 9 })).toBe(false);
    expect(isGoodGame('mlb', { pitched: true, ip_outs: 18, er: 4, k: 10 })).toBe(true);
    expect(isGoodGame('mlb', { pitched: true, ip_outs: 3, er: 0, k: 1, sv: 1 })).toBe(true);
    expect(isGoodGame('mlb', { pitched: false, ip_outs: 21, er: 0 })).toBe(false);
  });

  it('NFL: a touchdown, 100 rushing or receiving yards, 300 passing, 2 sacks or a pick; a kicker never', () => {
    expect(isGoodGame('nfl', { td: 1 })).toBe(true);
    expect(isGoodGame('nfl', { rush_yds: 100 })).toBe(true);
    expect(isGoodGame('nfl', { rush_yds: 99, rec_yds: 99 })).toBe(false);
    expect(isGoodGame('nfl', { rec_yds: 100 })).toBe(true);
    expect(isGoodGame('nfl', { pass_yds: 300 })).toBe(true);
    expect(isGoodGame('nfl', { pass_yds: 299, td: 0 })).toBe(false);
    expect(isGoodGame('nfl', { sacks: 2 })).toBe(true);
    expect(isGoodGame('nfl', { sacks: 1.5 })).toBe(false);
    expect(isGoodGame('nfl', { int: 1 })).toBe(true);
    // Four field goals and three extra points: nothing in the line says so, on purpose.
    expect(isGoodGame('nfl', {})).toBe(false);
  });

  it('NBA: 30 points, a triple-double, 20 rebounds or 15 assists', () => {
    expect(isGoodGame('nba', { pts: 30, reb: 4, ast: 2 })).toBe(true);
    expect(isGoodGame('nba', { pts: 29, reb: 9, ast: 9 })).toBe(false);
    expect(isGoodGame('nba', { pts: 18, reb: 13, ast: 10 })).toBe(true);
    expect(isGoodGame('nba', { pts: 12, reb: 10, ast: 3, blk: 10 })).toBe(true);
    expect(isGoodGame('nba', { pts: 6, reb: 20 })).toBe(true);
    expect(isGoodGame('nba', { pts: 6, ast: 15 })).toBe(true);
    expect(isGoodGame('nba', { pts: 6, reb: 19, ast: 14 })).toBe(false);
  });

  it('MLS: a goal, an assist, or a clean sheet for a goalkeeper only', () => {
    expect(isGoodGame('mls', { goals: 1 })).toBe(true);
    expect(isGoodGame('mls', { assists: 1 })).toBe(true);
    expect(isGoodGame('mls', { gk: true, clean_sheet: true })).toBe(true);
    expect(isGoodGame('mls', { gk: false, clean_sheet: true })).toBe(false);
    expect(isGoodGame('mls', { gk: true, clean_sheet: false })).toBe(false);
    expect(isGoodGame('mls', {})).toBe(false);
  });

  it('captions read like a box score', () => {
    expect(lineCaption('mlb', { ab: 4, h: 2, hr: 2, rbi: 3 })).toBe('2 HR, 3 RBI');
    expect(lineCaption('mlb', { ab: 5, h: 3 })).toBe('3 for 5');
    expect(lineCaption('mlb', { pitched: true, ip_outs: 21, er: 1, k: 10 })).toBe('7.0 IP, 10 K, 1 ER');
    expect(lineCaption('mlb', { pitched: true, ip_outs: 4, er: 0, k: 2, sv: 1 })).toBe('1.1 IP, 2 K, 0 ER, save');
    expect(lineCaption('nfl', { td: 2, rec_yds: 131 })).toBe('2 TD, 131 rec yds');
    expect(lineCaption('nfl', { sacks: 1, int: 1 })).toBe('1 sack, 1 INT');
    expect(lineCaption('nba', { pts: 31, reb: 12, ast: 10 })).toBe('31 pts, 12 reb, 10 ast');
    expect(lineCaption('mls', { goals: 2, assists: 1 })).toBe('2 goals, 1 assist');
    expect(lineCaption('mls', { gk: true, clean_sheet: true })).toBe('clean sheet');
    expect(lineCaption('nfl', {})).toBeNull();
    expect(lineCaption('mlb', null)).toBeNull();
  });
});
