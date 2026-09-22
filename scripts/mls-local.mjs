/** Run MLS ingestion against this project's LOCAL database, without printing its keys. */
import { execFileSync, spawnSync } from 'node:child_process';
const status = JSON.parse(
  execFileSync('node_modules/.bin/supabase', ['status', '-o', 'json'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }),
);
const url = new URL(status.API_URL);
if (!['127.0.0.1', 'localhost'].includes(url.hostname))
  throw new Error('Refusing non-local Supabase');
const result = spawnSync(
  process.execPath,
  ['--import', 'tsx', 'ingest/src/mls/backfill.ts', ...process.argv.slice(2)],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      SUPABASE_URL: status.API_URL,
      SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
    },
  },
);
process.exitCode = result.status ?? 1;
