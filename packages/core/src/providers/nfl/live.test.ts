import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { findEspnNflEvent, parseEspnNflLiveState, parseNflverseGameId, type EspnNflScoreboard } from './live.js';

const board = JSON.parse(
  readFileSync(new URL('../../../../../ingest/fixtures/nfl/espn_scoreboard_2026-09-21_NYG_LAR_final.json', import.meta.url), 'utf8'),
) as EspnNflScoreboard;

describe('ESPN’s NFL scoreboard as the app reads it', () => {
  it('matches an nflverse id by club, spelling the Rams and Commanders ESPN’s way', () => {
    expect(parseNflverseGameId('2026_02_NYG_LA')).toEqual({ season: 2026, week: 2, away: 'NYG', home: 'LA' });
    expect(parseNflverseGameId('0022500001')).toBeNull();
    expect(findEspnNflEvent(board, '2026_02_NYG_LA')?.id).toBe('401872947');
    expect(findEspnNflEvent(board, '2026_02_LA_NYG')).toBeNull();
  });

  it('reads a final: period 4, clock 0:00, the scores', () => {
    const e = findEspnNflEvent(board, '2026_02_NYG_LA')!;
    const parsed = parseEspnNflLiveState(e, '2026-09-23T00:00:00Z')!;
    expect(parsed.live).toEqual({ status: 'final', inning: 4, inningState: 'end', clock: null, homeScore: 28, awayScore: 6, fetchedAt: '2026-09-23T00:00:00Z' });
    expect(parsed.extras).toEqual({ homeWp: null, lastPlay: null });
  });

  it('reads a game under way, halftime, and the end of a period, with the last play when the board has one', () => {
    const e = findEspnNflEvent(board, '2026_02_NYG_LA')!;
    const c = e.competitions[0]!;
    const live = {
      ...e,
      competitions: [{
        ...c,
        status: { period: 4, displayClock: '4:12', type: { name: 'STATUS_IN_PROGRESS', state: 'in', completed: false } },
        situation: { lastPlay: { text: 'C.DeJean 38 yd interception return', type: { text: 'Interception Return Touchdown' }, probability: { homeWinPercentage: 0.81 } } },
      }],
    };
    const parsed = parseEspnNflLiveState(live, 'now')!;
    expect(parsed.live).toMatchObject({ status: 'live', inning: 4, inningState: 'live', clock: '4:12' });
    expect(parsed.extras).toEqual({ homeWp: 0.81, lastPlay: { text: 'C.DeJean 38 yd interception return', type: 'Interception Return Touchdown' } });
    const half = { ...e, competitions: [{ ...c, status: { period: 2, displayClock: '0:00', type: { name: 'STATUS_HALFTIME', state: 'in', completed: false } } }] };
    expect(parseEspnNflLiveState(half, 'now')!.live).toMatchObject({ status: 'live', inning: 2, inningState: 'halftime', clock: null });
    const end = { ...e, competitions: [{ ...c, status: { period: 1, displayClock: '0:00', type: { name: 'STATUS_END_PERIOD', state: 'in', completed: false } } }] };
    expect(parseEspnNflLiveState(end, 'now')!.live).toMatchObject({ inning: 1, inningState: 'end' });
    const pre = { ...e, competitions: [{ ...c, status: { period: 0, displayClock: '0:00', type: { name: 'STATUS_SCHEDULED', state: 'pre', completed: false } } }] };
    expect(parseEspnNflLiveState(pre, 'now')!.live).toMatchObject({ status: 'scheduled', inning: null, inningState: null });
  });
});
