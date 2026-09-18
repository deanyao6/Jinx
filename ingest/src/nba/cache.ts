/**
 * On-disk cache for NBA responses, under ingest/.cache/nba (gitignored), so a backfill never
 * fetches the same season, box score or ESPN month twice. Keys are the client's cache keys,
 * which are already file-safe (`stats_leaguegamelog_2016-17_Regular_Season`).
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { ResponseCache } from '@jinx/core';

export const NBA_CACHE_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../.cache/nba',
);

export function diskCache(dir = NBA_CACHE_DIR): ResponseCache {
  const file = (key: string) => path.join(dir, `${key.replace(/[^A-Za-z0-9_.-]+/g, '_')}.json`);
  return {
    async get(key) {
      try {
        return await readFile(file(key), 'utf8');
      } catch {
        return null;
      }
    },
    async set(key, value) {
      await mkdir(dir, { recursive: true });
      await writeFile(file(key), value);
    },
  };
}
