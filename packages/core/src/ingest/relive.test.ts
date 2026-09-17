import { describe, expect, it } from 'vitest';

import type { DbBuilder, DbResult, MinimalDb } from './db.js';
import type { MlbClient } from './mlbClient.js';
import { drainMlbQueue } from './relive.js';
import type { GameWriteContext } from './writer.js';

/** Records writes and answers rpc calls; just enough of MinimalDb for the worker's own logic. */
function fakeDb(rpc: Record<string, unknown[]>) {
  const writes: { table: string; op: string; patch?: unknown; rows?: unknown; where: unknown[] }[] =
    [];
  const builder = (entry: (typeof writes)[number]): DbBuilder => {
    const b = {
      eq: (column: string, value: unknown) => {
        entry.where.push([column, value]);
        return b;
      },
      then: (resolve: (r: DbResult<unknown[]>) => unknown) => resolve({ data: [], error: null }),
    };
    return b as unknown as DbBuilder;
  };
  const db: MinimalDb = {
    from: (table) =>
      ({
        update: (patch: Record<string, unknown>) => {
          const entry = { table, op: 'update', patch, where: [] };
          writes.push(entry);
          return builder(entry);
        },
        delete: () => {
          const entry = { table, op: 'delete', where: [] };
          writes.push(entry);
          return builder(entry);
        },
        insert: (rows: Record<string, unknown>[]) => {
          const entry = { table, op: 'insert', rows, where: [] };
          writes.push(entry);
          return builder(entry);
        },
      }) as never,
    rpc: (fn) => Promise.resolve({ data: rpc[fn] ?? [], error: null }),
  };
  return { db, writes };
}

const ctx = {} as GameWriteContext;
const target = {
  game_id: 'g-1',
  provider_game_id: '718780',
  season: 2023,
  home_score: 2,
  away_score: 7,
  home_name: 'Washington Nationals',
  away_name: 'Atlanta Braves',
};
const entry = (inning: number, away: number, home: number, wp: number, description: string) => ({
  about: { inning, halfInning: 'top', startTime: '2023-03-30T17:05:00Z' },
  result: { description, rbi: 0, awayScore: away, homeScore: home },
  homeTeamWinProbability: wp,
});

describe('drainMlbQueue', () => {
  it('records a failed fetch on the queue row and keeps going', async () => {
    const { db, writes } = fakeDb({
      detail_queue_pending: [{ game_id: 'g-9', provider_game_id: '999', attempts: 2 }],
    });
    const provider = { fetchGameDetail: () => Promise.reject(new Error('MLB 503 for feed')) };
    const result = await drainMlbQueue(db, provider, {} as MlbClient, ctx);

    expect(result.errors).toEqual(['999: MLB 503 for feed']);
    expect(result.detailed).toEqual([]);
    const update = writes.find((w) => w.table === 'detail_queue');
    expect(update?.patch).toEqual({ attempts: 3, last_error: 'MLB 503 for feed' });
    expect(update?.where).toEqual([['game_id', 'g-9']]);
  });

  it('builds a story for an attended game that has none', async () => {
    const { db, writes } = fakeDb({ games_needing_relive: [target] });
    const client = {
      getJson: () =>
        Promise.resolve([
          entry(1, 0, 0, 46, 'Strikeout.'),
          entry(2, 1, 0, 38, 'Orlando Arcia singles. Michael Harris II scores.'),
        ]),
    } as unknown as MlbClient;
    const result = await drainMlbQueue(
      db,
      { fetchGameDetail: () => Promise.reject() },
      client,
      ctx,
    );

    expect(result.relived).toEqual(['718780']);
    const steps = writes.find((w) => w.table === 'game_story_steps' && w.op === 'insert');
    // Pregame, the one scoring play, the final.
    expect((steps?.rows as unknown[]).length).toBe(3);
    // Steps are deleted before points, and points inserted before steps: steps reference points.
    expect(writes.filter((w) => w.op !== 'update').map((w) => `${w.op} ${w.table}`)).toEqual([
      'delete game_story_steps',
      'delete game_wp_timeline',
      'insert game_wp_timeline',
      'insert game_story_steps',
    ]);
  });

  it('marks a game with no published win probability as checked, and does not write a story', async () => {
    const { db, writes } = fakeDb({ games_needing_relive: [target] });
    const client = { getJson: () => Promise.resolve([]) } as unknown as MlbClient;
    const result = await drainMlbQueue(
      db,
      { fetchGameDetail: () => Promise.reject() },
      client,
      ctx,
    );

    expect(result.noStory).toEqual(['718780']);
    expect(writes.map((w) => `${w.op} ${w.table}`)).toEqual(['update games']);
    expect(Object.keys(writes[0]?.patch as object)).toEqual(['relive_checked_at']);
  });

  it('a story that fails to build is reported, not thrown', async () => {
    const { db } = fakeDb({ games_needing_relive: [target] });
    const client = {
      getJson: () => Promise.reject(new Error('MLB 500')),
    } as unknown as MlbClient;
    const result = await drainMlbQueue(
      db,
      { fetchGameDetail: () => Promise.reject() },
      client,
      ctx,
    );
    expect(result.errors).toEqual(['718780 relive: MLB 500']);
  });
});
