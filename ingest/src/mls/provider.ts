import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MlsProvider } from '@jinx/core';
import { diskCache } from '../nba/cache.js';

export function mlsProvider() {
  return new MlsProvider({
    cache: diskCache(
      path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../.cache/mls'),
    ),
  });
}
