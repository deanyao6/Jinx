/**
 * Node-side Supabase service-role client. Everything else (upserts, maps, progress) is shared from
 * @appname/core so the Edge Functions use the same code.
 */
import { asDb, type MinimalDb } from '@appname/core';
import { createClient } from '@supabase/supabase-js';

export {
  chunk,
  getProgress,
  loadTeamMap,
  loadVenueMaps,
  selectAll,
  setProgress,
  upsertRows,
  type MinimalDb as Db,
  type VenueMaps,
} from '@appname/core';

export function createDb(): MinimalDb {
  const url = process.env['SUPABASE_URL'];
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  return asDb(createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }));
}
