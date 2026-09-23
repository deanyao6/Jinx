/**
 * NBA honors into player_honors, from the hand-kept seed/nba_awards.json (next-wave D.1).
 *
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx ingest/src/nba/honors.ts
 *
 * MVP, the rest of the MVP top five (from the NBA's own voting releases; Wikipedia has only the
 * three finalists), the three All-NBA teams, Rookie of the Year and Finals MVP, 2013-14 on.
 * Rows name the player by stats.nba.com PERSON_ID, the id game_appearances uses. Seasons are
 * start years (2025 is 2025-26), the Finals MVP filed under its season's start year.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createDb } from '../db.js';
import { loadAwards, type AwardsFile } from '../famous/awards.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
export const NBA_AWARDS: AwardsFile = {
  path: path.join(ROOT, 'seed', 'nba_awards.json'),
  source: 'seed/nba_awards.json',
  sport: 'nba',
  provider: 'nba',
  idKey: 'person_id',
  idPattern: /^\d{1,8}$/,
  idHint: '203999 (stats.nba.com PERSON_ID)',
  honors: new Set(['mvp', 'mvp_top5', 'all_nba_1st', 'all_nba_2nd', 'all_nba_3rd', 'roy', 'finals_mvp']),
};

const isEntrypoint = process.argv[1] != null && /[\\/]nba[\\/]honors\.ts$/.test(process.argv[1]);
if (isEntrypoint) {
  loadAwards(createDb(), NBA_AWARDS).catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
