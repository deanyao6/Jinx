/**
 * MLS honors into player_honors, from the hand-kept seed/mls_awards.json (next-wave D.1).
 *
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx ingest/src/mls/honors.ts
 *
 * The Landon Donovan MVP and its finalists, the Best XI, the Golden Boot, the Rookie of the
 * Year (the Young Player of the Year from 2020) and the MLS Cup MVP, 2016 on. Rows name the
 * player by ESPN athlete id, the id the summary's lineups and game_appearances use; every id
 * in the file was checked against a lineup of that season (docs/verification.md).
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createDb } from '../db.js';
import { loadAwards, type AwardsFile } from '../famous/awards.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
export const MLS_AWARDS: AwardsFile = {
  path: path.join(ROOT, 'seed', 'mls_awards.json'),
  source: 'seed/mls_awards.json',
  sport: 'mls',
  provider: 'espn_mls',
  idKey: 'espn_id',
  idPattern: /^\d{1,8}$/,
  idHint: '45843 (ESPN athlete id)',
  honors: new Set(['mvp', 'mvp_finalist', 'best_xi', 'golden_boot', 'roy', 'cup_mvp']),
};

const isEntrypoint = process.argv[1] != null && /[\\/]mls[\\/]honors\.ts$/.test(process.argv[1]);
if (isEntrypoint) {
  loadAwards(createDb(), MLS_AWARDS).catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
