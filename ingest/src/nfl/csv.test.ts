import type { NflverseGameRow, NflversePbpRow } from '@jinx/core';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';

import { gunzipStream } from './assets.js';
import { collectCsv, isoTimestampOrNull, toGameRow, toPbpRow } from './csv.js';

const FIXTURES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../fixtures/nfl');

function loadJson<T>(name: string): T {
  return JSON.parse(readFileSync(path.join(FIXTURES, name), 'utf8')) as T;
}

/** Renders JSON rows the way nflverse writes CSV: nulls as empty cells, quotes doubled. */
function toCsv(rows: Record<string, unknown>[]): string {
  const columns = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const cell = (v: unknown): string => {
    if (v == null) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return (
    [columns.join(','), ...rows.map((r) => columns.map((c) => cell(r[c])).join(','))].join('\n') +
    '\n'
  );
}

describe('readCsv', () => {
  const games = loadJson<NflverseGameRow[]>('games_2024_sample.json');
  const text = toCsv(games as unknown as Record<string, unknown>[]);

  it('parses games.csv text into NflverseGameRow with empty cells as null and numbers coerced', async () => {
    const parsed = (await collectCsv(text)).map(toGameRow);
    expect(parsed).toEqual(games);
    const first = parsed[0]!;
    expect(typeof first.season).toBe('number');
    expect(first.temp).toBeNull();
    expect(typeof first.home_score).toBe('number');
  });

  it('round-trips through gzip', async () => {
    const gz = gzipSync(Buffer.from(text, 'utf8'));
    const stream = gunzipStream(Readable.from([gz]));
    const parsed = (await collectCsv(stream)).map(toGameRow);
    expect(parsed).toEqual(games);
  });

  it('rejects (rather than crashing the process) on a truncated gzip stream', async () => {
    const gz = gzipSync(Buffer.from(text, 'utf8'));
    const stream = gunzipStream(Readable.from([gz.subarray(0, Math.floor(gz.length / 2))]));
    await expect(collectCsv(stream)).rejects.toThrow(/unexpected end of file/);
  });

  it('keeps quoted commas and quotes intact', async () => {
    const rows = await collectCsv('a,b,c\n"x, y","say ""hi""",\n');
    expect(rows).toEqual([{ a: 'x, y', b: 'say "hi"', c: null }]);
  });

  it('maps play-by-play rows with 0/1 flags as numbers and empty cells as null', async () => {
    const pbp = loadJson<NflversePbpRow[]>('pbp_2024_10_DET_HOU.json');
    const parsed = (await collectCsv(toCsv(pbp as unknown as Record<string, unknown>[]))).map(
      toPbpRow,
    );
    expect(parsed).toHaveLength(pbp.length);
    for (const [i, row] of pbp.entries()) {
      const got = parsed[i]!;
      for (const key of Object.keys(row) as (keyof NflversePbpRow)[]) {
        expect(got[key], `${key} on play ${row.play_id}`).toEqual(row[key]);
      }
    }
    const marker = parsed[0]!;
    expect(marker.play_type).toBeNull();
    expect(marker.time_of_day).toBeNull();
    const kickoff = parsed.find((p) => p.play_type === 'kickoff')!;
    expect(kickoff.kickoff_attempt).toBe(1);
    expect(kickoff.touchdown).toBe(0);
  });

  it('keeps only ISO time_of_day values (2001-2004 files carry a bare HH:MM:SS clock)', async () => {
    expect(isoTimestampOrNull('2024-11-11T01:23:27.127Z')).toBe('2024-11-11T01:23:27.127Z');
    expect(isoTimestampOrNull('15:55:30')).toBeNull();
    expect(isoTimestampOrNull(null)).toBeNull();
    const header =
      'game_id,play_id,order_sequence,qtr,time,quarter_seconds_remaining,game_seconds_remaining,time_of_day,desc,sp,play_type,total_home_score,total_away_score,home_team,away_team,posteam';
    const rows = await collectCsv(
      `${header}\n2001_01_A_B,1,1,1,15:00,900,3600,15:55:30,GAME,0,,0,0,B,A,\n2001_01_A_B,2,2,1,15:00,900,3600,,kick,0,kickoff,0,0,B,A,A\n`,
    );
    expect(rows.map((r) => toPbpRow(r).time_of_day)).toEqual([null, null]);
  });
});
