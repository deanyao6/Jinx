import {
  CLIENT_LIVE_FEEDS,
  MLS_SUMMARY_URL,
  NBA_SCOREBOARD_URL,
  clientLiveFeed,
  mlsLiveFeed,
  nbaLiveFeed,
  pollDelayMs,
  toRow,
} from '../feeds';
import { isUnderWay, liveStatusLabel } from '../format';

// Trimmed from ingest/fixtures/nba/cdn_todaysScoreboard_empty_offseason_2026-09-22.json and
// ingest/fixtures/mls/espn_summary_761829_MIA_SD_wallclock_2026-09-22.json (Metro tests cannot
// read files).
const EMPTY_BOARD = { scoreboard: { gameDate: '2026-09-22', leagueId: '00', games: [] } };
const SUMMARY_761829_HEADER = {
  date: '2026-09-20T23:00Z',
  status: {
    type: { id: '28', name: 'STATUS_FULL_TIME', state: 'post', completed: true, description: 'Full Time', detail: 'FT', shortDetail: 'FT' },
  },
  competitors: [
    { id: '20232', abbreviation: 'MIA', homeAway: 'home', score: '2' },
    { id: '22529', abbreviation: 'SD', homeAway: 'away', score: '2' },
  ],
};

function mockFetch(handler: (url: string, init?: RequestInit) => { status: number; body: unknown }) {
  const calls: { url: string; headers: Record<string, string> }[] = [];
  globalThis.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, headers: (init?.headers as Record<string, string>) ?? {} });
    const { status, body } = handler(url, init);
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    } as Response;
  }) as unknown as typeof fetch;
  return calls;
}

describe('the feeds the app reads itself', () => {
  it('are the NBA and MLS, keyed by sport; MLB and the NFL have none', () => {
    expect(Object.keys(CLIENT_LIVE_FEEDS).sort()).toEqual(['mls', 'nba']);
    expect(clientLiveFeed('mlb')).toBeUndefined();
    expect(clientLiveFeed('nfl')).toBeUndefined();
    expect(clientLiveFeed(null)).toBeUndefined();
  });

  it('NBA: the game on today’s board becomes the row Pick a side reads, with the CDN headers', async () => {
    const calls = mockFetch(() => ({
      status: 200,
      body: {
        scoreboard: {
          gameDate: '2025-10-21',
          games: [
            {
              gameId: '0022500001',
              gameStatus: 2,
              gameStatusText: 'Q3 4:12',
              period: 3,
              gameClock: 'PT04M12.00S',
              gameTimeUTC: '2025-10-21T23:30:00Z',
              homeTeam: { teamId: 1610612747, teamTricode: 'LAL', score: 78 },
              awayTeam: { teamId: 1610612744, teamTricode: 'GSW', score: 81 },
            },
          ],
        },
      },
    }));
    const row = await nbaLiveFeed.fetchLive(
      { provider_game_id: '0022500001', scheduled_start: '2025-10-21T23:30:00Z' },
      '2025-10-22T01:10:00Z',
    );
    expect(row).toEqual({
      status: 'live',
      inning: 3,
      inning_state: 'live',
      clock: '4:12',
      home_score: 78,
      away_score: 81,
      locked: false,
      lock_reason: null,
      fetched_at: '2025-10-22T01:10:00Z',
    });
    expect(calls[0]!.url).toBe(NBA_SCOREBOARD_URL);
    expect(calls[0]!.headers['Referer']).toBe('https://www.nba.com/');
    expect(liveStatusLabel('nba', row)).toBe('Q3 4:12');
  });

  it('NBA: a game not on today’s board is null, so the countdown keeps its estimate', async () => {
    mockFetch(() => ({ status: 200, body: EMPTY_BOARD }));
    await expect(
      nbaLiveFeed.fetchLive({ provider_game_id: '0022500001', scheduled_start: '2025-10-21T23:30:00Z' }),
    ).resolves.toBeNull();
  });

  it('NBA: the end of the first quarter and halftime read as the lock and the break', async () => {
    const game = (text: string, period: number, status = 2) => ({
      scoreboard: {
        games: [
          {
            gameId: 'g',
            gameStatus: status,
            gameStatusText: text,
            period,
            gameClock: 'PT00M00.00S',
            gameTimeUTC: '',
            homeTeam: { teamId: 1, teamTricode: 'A', score: 30 },
            awayTeam: { teamId: 2, teamTricode: 'B', score: 28 },
          },
        ],
      },
    });
    mockFetch(() => ({ status: 200, body: game('End of 1st Qtr', 1) }));
    let row = await nbaLiveFeed.fetchLive({ provider_game_id: 'g', scheduled_start: '' });
    expect(row?.inning_state).toBe('end');
    expect(liveStatusLabel('nba', row)).toBe('End of 1st');
    mockFetch(() => ({ status: 200, body: game('Halftime', 2) }));
    row = await nbaLiveFeed.fetchLive({ provider_game_id: 'g', scheduled_start: '' });
    expect(row?.inning_state).toBe('halftime');
    expect(liveStatusLabel('nba', row)).toBe('Halftime');
    mockFetch(() => ({ status: 200, body: game('Final', 4, 3) }));
    row = await nbaLiveFeed.fetchLive({ provider_game_id: 'g', scheduled_start: '' });
    expect(row?.status).toBe('final');
    expect(liveStatusLabel('nba', row)).toBeNull();
  });

  it('MLS: the summary header of a finished match, fetched by event id with no custom User-Agent', async () => {
    const summary = { header: { competitions: [SUMMARY_761829_HEADER] } };
    const calls = mockFetch(() => ({ status: 200, body: summary }));
    const row = await mlsLiveFeed.fetchLive(
      { provider_game_id: '761829', scheduled_start: '2026-09-20T23:00:00Z' },
      '2026-09-21T01:20:00Z',
    );
    expect(calls[0]!.url).toBe(`${MLS_SUMMARY_URL}?event=761829`);
    expect(calls[0]!.headers['User-Agent']).toBeUndefined();
    expect(row?.status).toBe('final');
    expect(row?.inning_state).toBe('end');
    expect(row?.home_score).toBe(2);
    expect(row?.away_score).toBe(2);
  });

  it('MLS: a match in its second half carries the clock; halftime is the break; a goal shows', async () => {
    const header = (name: string, state: string, period: number, clock: string, home: string, away: string) => ({
      header: {
        competitions: [
          {
            status: { type: { name, state, completed: false }, displayClock: clock, period },
            competitors: [
              { homeAway: 'home', score: home },
              { homeAway: 'away', score: away },
            ],
          },
        ],
      },
    });
    mockFetch(() => ({ status: 200, body: header('STATUS_SECOND_HALF', 'in', 2, "67'", '1', '0') }));
    let row = await mlsLiveFeed.fetchLive({ provider_game_id: 'e', scheduled_start: '' });
    expect(row).toMatchObject({ status: 'live', inning: 2, inning_state: 'live', clock: "67'", home_score: 1, away_score: 0 });
    expect(liveStatusLabel('mls', row)).toBe("67'");
    mockFetch(() => ({ status: 200, body: header('STATUS_HALFTIME', 'in', 1, "45'", '0', '0') }));
    row = await mlsLiveFeed.fetchLive({ provider_game_id: 'e', scheduled_start: '' });
    expect(row?.inning_state).toBe('halftime');
    expect(liveStatusLabel('mls', row)).toBe('Halftime');
  });

  it('a refused fetch throws, and the poller backs off from 30 s to five minutes', async () => {
    mockFetch(() => ({ status: 403, body: {} }));
    await expect(
      nbaLiveFeed.fetchLive({ provider_game_id: 'g', scheduled_start: '' }),
    ).rejects.toThrow('cdn.nba.com 403');
    expect(pollDelayMs(30_000, 0)).toBe(30_000);
    expect(pollDelayMs(30_000, 1)).toBe(60_000);
    expect(pollDelayMs(30_000, 3)).toBe(240_000);
    expect(pollDelayMs(30_000, 4)).toBe(300_000);
    expect(pollDelayMs(30_000, 20)).toBe(300_000);
  });

  it('toRow keeps the MLB path’s column names', () => {
    expect(
      toRow({ status: 'live', inning: 7, inningState: 'middle', homeScore: 3, awayScore: 2, fetchedAt: 't' }),
    ).toEqual({
      status: 'live',
      inning: 7,
      inning_state: 'middle',
      clock: null,
      home_score: 3,
      away_score: 2,
      locked: false,
      lock_reason: null,
      fetched_at: 't',
    });
  });
});

describe('when a page polls', () => {
  const start = '2026-10-21T23:30:00Z';
  const t = (iso: string) => Date.parse(iso);
  it('a live game always, a scheduled game from 15 minutes before tip-off to six hours after, a final never', () => {
    expect(isUnderWay('live', start, t('2027-01-01T00:00:00Z'))).toBe(true);
    expect(isUnderWay('scheduled', start, t('2026-10-21T23:14:00Z'))).toBe(false);
    expect(isUnderWay('scheduled', start, t('2026-10-21T23:16:00Z'))).toBe(true);
    expect(isUnderWay('scheduled', start, t('2026-10-22T05:29:00Z'))).toBe(true);
    expect(isUnderWay('scheduled', start, t('2026-10-22T05:31:00Z'))).toBe(false);
    expect(isUnderWay('final', start, t('2026-10-22T01:00:00Z'))).toBe(false);
  });
  it('MLB status lines read as the linescore', () => {
    const live = (inning: number, state: string) => ({
      status: 'live', inning, inning_state: state, home_score: 0, away_score: 0, locked: false, lock_reason: null, fetched_at: 't',
    });
    expect(liveStatusLabel('mlb', live(7, 'middle'))).toBe('Middle 7th');
    expect(liveStatusLabel('mlb', live(11, 'top'))).toBe('Top 11th');
    expect(liveStatusLabel('mlb', live(1, 'bottom'))).toBe('Bottom 1st');
    expect(liveStatusLabel('nba', { ...live(5, 'live'), clock: '2:00' })).toBe('OT 2:00');
    expect(liveStatusLabel('nba', { ...live(6, 'live'), clock: '0:30' })).toBe('2OT 0:30');
    expect(liveStatusLabel('mls', live(5, 'live'))).toBe('Penalties');
    expect(liveStatusLabel('mls', { ...live(3, 'live'), clock: "97'" })).toBe("ET 1 97'");
  });
});
