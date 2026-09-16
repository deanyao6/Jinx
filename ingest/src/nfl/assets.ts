/**
 * Downloads nflverse release assets into ingest/.cache/nfl with ETag caching.
 *
 * Every asset lives at https://github.com/nflverse/nflverse-data/releases/download/{tag}/{file}.
 * Next to each cached file we keep `{file}.meta.json` with the ETag from the last download; the
 * next request sends If-None-Match and a 304 keeps the cached copy. If the network is unreachable
 * and a cached copy exists, the cached copy is used with a warning so offline reruns still work.
 *
 * `.csv.gz` assets are stored compressed; `openAsset` gunzips on the fly (node:zlib).
 */
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pipeline, Readable } from 'node:stream';
import { pipeline as pipelineAsync } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { createGunzip } from 'node:zlib';

export const NFLVERSE_BASE = 'https://github.com/nflverse/nflverse-data/releases/download';

export const DEFAULT_CACHE_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../.cache/nfl',
);

/**
 * First season with usable snap counts. nflverse lists snap_counts_2012 but every format of it is
 * a header-only stub (csv.gz 103 bytes, verified 2026-09-15), so 2012 uses the weekly-stats
 * fallback like 2000-2011. run.ts also falls back at runtime if a season's snap counts are empty.
 */
export const SNAP_COUNTS_FROM = 2013;

export interface AssetRef {
  tag: string;
  file: string;
}

export const schedulesAsset = (): AssetRef => ({ tag: 'schedules', file: 'games.csv' });
export const pbpAsset = (season: number): AssetRef => ({
  tag: 'pbp',
  file: `play_by_play_${season}.csv.gz`,
});
export const snapCountsAsset = (season: number): AssetRef => ({
  tag: 'snap_counts',
  file: `snap_counts_${season}.csv.gz`,
});
export const statsPlayerWeekAsset = (season: number): AssetRef => ({
  tag: 'stats_player',
  file: `stats_player_week_${season}.csv.gz`,
});
export const playersAsset = (): AssetRef => ({ tag: 'players', file: 'players.csv.gz' });

export function assetUrl(ref: AssetRef): string {
  return `${NFLVERSE_BASE}/${ref.tag}/${ref.file}`;
}

interface CacheMeta {
  etag: string | null;
  lastModified: string | null;
  url: string;
  fetchedAt: string;
}

export interface FetchOptions {
  cacheDir?: string;
  /** Re-download even when the ETag matches. */
  force?: boolean;
  log?: (line: string) => void;
}

export interface FetchResult {
  path: string;
  /** 'downloaded' | 'not-modified' | 'offline-cache' */
  source: 'downloaded' | 'not-modified' | 'offline-cache';
}

async function readMeta(metaPath: string): Promise<CacheMeta | null> {
  try {
    return JSON.parse(await readFile(metaPath, 'utf8')) as CacheMeta;
  } catch {
    return null;
  }
}

async function exists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

/** Fetches one asset into the cache and returns its local path (still gzipped for .gz files). */
export async function fetchAsset(ref: AssetRef, opts: FetchOptions = {}): Promise<FetchResult> {
  const cacheDir = opts.cacheDir ?? DEFAULT_CACHE_DIR;
  const log = opts.log ?? (() => undefined);
  await mkdir(cacheDir, { recursive: true });
  const filePath = path.join(cacheDir, ref.file);
  const metaPath = `${filePath}.meta.json`;
  const url = assetUrl(ref);
  const cached = (await exists(filePath)) ? await readMeta(metaPath) : null;

  const headers: Record<string, string> = {};
  if (cached?.etag && !opts.force) headers['If-None-Match'] = cached.etag;

  let res: Response;
  try {
    res = await fetch(url, { headers, redirect: 'follow' });
  } catch (err) {
    if (cached) {
      log(`warn: ${url} unreachable (${String(err)}); using cached ${ref.file}`);
      return { path: filePath, source: 'offline-cache' };
    }
    throw err;
  }

  if (res.status === 304) {
    return { path: filePath, source: 'not-modified' };
  }
  if (!res.ok || res.body == null) {
    throw new Error(`download ${url}: HTTP ${res.status}`);
  }

  const tmpPath = `${filePath}.part`;
  await pipelineAsync(Readable.fromWeb(res.body as never), createWriteStream(tmpPath));
  const expected = Number(res.headers.get('content-length') ?? NaN);
  const written = (await stat(tmpPath)).size;
  if (Number.isFinite(expected) && expected !== written) {
    throw new Error(`download ${url}: truncated (${written} of ${expected} bytes)`);
  }
  await rename(tmpPath, filePath);
  const meta: CacheMeta = {
    etag: res.headers.get('etag'),
    lastModified: res.headers.get('last-modified'),
    url,
    fetchedAt: new Date().toISOString(),
  };
  await writeFile(metaPath, JSON.stringify(meta, null, 2));
  log(`downloaded ${ref.file} (${(written / 1024 / 1024).toFixed(1)} MB)`);
  return { path: filePath, source: 'downloaded' };
}

/** Opens a cached asset as a readable stream, gunzipping `.gz` files. */
export function openAsset(filePath: string): Readable {
  const raw = createReadStream(filePath);
  return filePath.endsWith('.gz') ? gunzipStream(raw) : raw;
}

export function gunzipStream(input: Readable): Readable {
  const gunzip = createGunzip();
  // pipeline propagates errors in either direction so consumers see a rejection.
  pipeline(input, gunzip, () => undefined);
  return gunzip;
}
