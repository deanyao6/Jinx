import { NbaClient, NbaProvider } from '@jinx/core';

import { diskCache } from './cache.js';

/** The provider every NBA script uses: cached on disk, throttled to one nba.com request a second. */
export function nbaProvider(): NbaProvider {
  return new NbaProvider(new NbaClient({ cache: diskCache() }));
}

export { NbaClient, NbaProvider };
