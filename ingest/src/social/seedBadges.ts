/**
 * Seeds `public.badges` from packages/core's BADGE_CATALOG (docs/prompts/social/04, section 5;
 * 00_repo_reality.md R6). The catalog is the source of truth for the 25 launch badges plus the
 * eight easter-egg secrets; this script only writes it to the database.
 *
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx ingest/src/social/seedBadges.ts
 *
 * Idempotent: upserted by key. A badge removed from the catalog is left in the database (its
 * criteria simply stops changing) rather than deleted, so an earned row in `user_badges` never
 * dangles.
 */
import { BADGE_CATALOG } from '@jinx/core';

import { createDb, upsertRows } from '../db.js';

async function main() {
  const db = createDb();
  const rows = BADGE_CATALOG.map((b) => ({
    key: b.key,
    name: b.name,
    description: b.description,
    criteria: b.criteria,
    tier: b.tier,
    sport_id: b.sport,
    is_secret: b.isSecret,
  }));
  await upsertRows(db, 'badges', rows, 'key');
  console.log(`Seeded ${rows.length} badges (${rows.filter((r) => r.is_secret).length} secret).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
