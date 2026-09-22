/**
 * "Players seen" (Dean, 2026-09-22, decision 7): a fan saw a player in a game when the player
 * is a superstar and had a good game, by the sport's box-score rule below; anyone else earns a
 * place only by repetition, ten or more good games seen by this fan. The line is stored on
 * every appearance of a detailed game (`game_appearances.line`, `good_game`) and the rule is
 * applied where the rows are read (`players_seen`, `game_players_seen`, `player_games_seen`).
 *
 * One row per sport, keyed by `sport_id`. A kicker's extra point or field goal is never a good
 * game (Dean, 2026-09-17): the NFL line counts touchdowns reached, not points kicked.
 */
import type { Sport } from './types.js';

/** A box-score line, the handful of numbers the rule reads. Absent numbers are zero. */
export type BoxLine = {
  // MLB
  ab?: number;
  h?: number;
  hr?: number;
  rbi?: number;
  /** Pitched at all; the innings are in outs so 7.0 is 21 and 6.2 is 20. */
  pitched?: boolean;
  ip_outs?: number;
  er?: number;
  k?: number;
  sv?: number;
  // NFL
  td?: number;
  rush_yds?: number;
  rec_yds?: number;
  pass_yds?: number;
  sacks?: number;
  int?: number;
  // NBA
  pts?: number;
  reb?: number;
  ast?: number;
  stl?: number;
  blk?: number;
  // MLS
  goals?: number;
  assists?: number;
  /** Goalkeeper who conceded nothing while on the pitch. */
  clean_sheet?: boolean;
  gk?: boolean;
};

export type GoodGameRule = {
  /** What "a good game" means, for the report and the tests. */
  summary: string;
  isGood(line: BoxLine): boolean;
};

const n = (v: number | undefined): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

export const GOOD_GAME_RULES: Readonly<Record<Sport, GoodGameRule>> = {
  mlb: {
    summary:
      'a home run, 3+ RBI or 3+ hits; a pitcher: 7+ innings with 2 or fewer earned runs, 10+ strikeouts, or a save',
    isGood: (l) =>
      n(l.hr) >= 1 ||
      n(l.rbi) >= 3 ||
      n(l.h) >= 3 ||
      (l.pitched === true &&
        ((n(l.ip_outs) >= 21 && n(l.er) <= 2) || n(l.k) >= 10 || n(l.sv) >= 1)),
  },
  nfl: {
    summary:
      'a touchdown, 100+ rushing yards, 100+ receiving yards, 300+ passing yards, 2+ sacks or an interception; never a kick',
    isGood: (l) =>
      n(l.td) >= 1 ||
      n(l.rush_yds) >= 100 ||
      n(l.rec_yds) >= 100 ||
      n(l.pass_yds) >= 300 ||
      n(l.sacks) >= 2 ||
      n(l.int) >= 1,
  },
  nba: {
    summary: '30+ points, a triple-double, 20+ rebounds or 15+ assists',
    isGood: (l) =>
      n(l.pts) >= 30 ||
      n(l.reb) >= 20 ||
      n(l.ast) >= 15 ||
      [l.pts, l.reb, l.ast, l.stl, l.blk].filter((v) => n(v) >= 10).length >= 3,
  },
  mls: {
    summary: 'a goal, an assist, or a clean sheet for a goalkeeper',
    isGood: (l) => n(l.goals) >= 1 || n(l.assists) >= 1 || (l.gk === true && l.clean_sheet === true),
  },
};

/** How many good games a fan must have seen from a non-superstar for the player to earn a row. */
export const NICHE_GOOD_GAMES = 10;

export function isGoodGame(sport: Sport, line: BoxLine | null | undefined): boolean {
  if (!line) return false;
  return GOOD_GAME_RULES[sport]?.isGood(line) ?? false;
}

/** The line as a caption: "2 HR, 3 RBI", "7.0 IP, 10 K", "31 pts, 12 reb, 10 ast", "1 goal". */
export function lineCaption(sport: Sport, line: BoxLine | null | undefined): string | null {
  if (!line) return null;
  const parts: string[] = [];
  if (sport === 'mlb') {
    if (l(line.hr)) parts.push(`${line.hr} HR`);
    if (l(line.rbi)) parts.push(`${line.rbi} RBI`);
    if (l(line.h) && !l(line.hr)) parts.push(`${line.h} for ${n(line.ab)}`);
    if (line.pitched) {
      const outs = n(line.ip_outs);
      parts.push(`${Math.floor(outs / 3)}.${outs % 3} IP`);
      if (l(line.k)) parts.push(`${line.k} K`);
      parts.push(`${n(line.er)} ER`);
      if (l(line.sv)) parts.push('save');
    }
  } else if (sport === 'nfl') {
    if (l(line.td)) parts.push(`${line.td} TD`);
    if (l(line.pass_yds)) parts.push(`${line.pass_yds} pass yds`);
    if (l(line.rush_yds)) parts.push(`${line.rush_yds} rush yds`);
    if (l(line.rec_yds)) parts.push(`${line.rec_yds} rec yds`);
    if (l(line.sacks)) parts.push(`${line.sacks} ${n(line.sacks) === 1 ? 'sack' : 'sacks'}`);
    if (l(line.int)) parts.push(`${line.int} INT`);
  } else if (sport === 'nba') {
    parts.push(`${n(line.pts)} pts`);
    if (l(line.reb)) parts.push(`${line.reb} reb`);
    if (l(line.ast)) parts.push(`${line.ast} ast`);
    if (n(line.stl) >= 5) parts.push(`${line.stl} stl`);
    if (n(line.blk) >= 5) parts.push(`${line.blk} blk`);
  } else if (sport === 'mls') {
    if (l(line.goals)) parts.push(`${line.goals} ${n(line.goals) === 1 ? 'goal' : 'goals'}`);
    if (l(line.assists)) parts.push(`${line.assists} ${n(line.assists) === 1 ? 'assist' : 'assists'}`);
    if (line.gk && line.clean_sheet) parts.push('clean sheet');
  }
  return parts.length > 0 ? parts.join(', ') : null;
}

function l(v: number | undefined): boolean {
  return n(v) > 0;
}
