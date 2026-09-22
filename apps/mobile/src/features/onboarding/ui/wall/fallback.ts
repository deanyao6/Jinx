import type { WallGame } from './types';

/**
 * The six game cards baked into the app: exactly what `design/welcome-reference.html` shows,
 * in its order. They draw when there is no cached payload, when the cache is older than two
 * weeks, and whenever the debug flag freezes the screen for a screenshot.
 *
 * `playedOn` is null on purpose: these carry the reference's literal dates and never turn into
 * "Last night". `fill` is the reference's own hex for the same reason (types.ts explains).
 */
export const FALLBACK_CARDS: readonly WallGame[] = [
  {
    gameId: 'fallback-1',
    sport: 'mlb',
    title: 'Phillies 7, Mets 2',
    venue: 'Citi Field',
    playedOn: null,
    night: true,
    dateLabel: 'Sep 20, 2026',
    result: 'W',
    teamKey: 'mlb:143',
    fill: '#E81828',
  },
  {
    gameId: 'fallback-2',
    sport: 'nfl',
    title: 'Cowboys 37, Commanders 20',
    venue: 'AT&T Stadium',
    playedOn: null,
    night: false,
    dateLabel: 'Sep 20, 2026',
    result: 'W',
    teamKey: 'nflverse:DAL',
    fill: '#041E42',
  },
  {
    gameId: 'fallback-3',
    sport: 'mlb',
    title: 'Dodgers 10, Giants 4',
    venue: 'Dodger Stadium',
    playedOn: null,
    night: true,
    dateLabel: 'Sep 19, 2026',
    result: 'W',
    teamKey: 'mlb:119',
    fill: '#005A9C',
  },
  {
    gameId: 'fallback-4',
    sport: 'mlb',
    title: 'Yankees 2, Rays 0',
    venue: 'Yankee Stadium',
    playedOn: null,
    night: true,
    dateLabel: 'Sep 22, 2026',
    result: 'L',
    teamKey: 'mlb:147',
    fill: '#0C2340',
  },
  {
    gameId: 'fallback-5',
    sport: 'nfl',
    title: 'Eagles 24, Titans 20',
    venue: 'Nissan Stadium',
    playedOn: null,
    night: false,
    dateLabel: 'Sep 20, 2026',
    result: 'W',
    teamKey: 'nflverse:PHI',
    fill: '#004C54',
  },
  {
    gameId: 'fallback-6',
    sport: 'nfl',
    title: 'Rams 28, Giants 6',
    venue: 'SoFi Stadium',
    playedOn: null,
    night: true,
    dateLabel: 'Sep 21, 2026',
    result: 'W',
    teamKey: 'nflverse:LA',
    fill: '#003594',
  },
];
