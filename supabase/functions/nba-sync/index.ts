import {
  NbaClient,
  NbaProvider,
  drainNbaQueue,
  loadTeamMap,
  loadVenueMaps,
} from '../_shared/core/index.ts';
import { authorizeInternal, json, serviceDb } from '../_shared/db.ts';
import { runNbaSync } from './sync.ts';

Deno.serve(async (req) => {
  if (!authorizeInternal(req)) return json({ error: 'unauthorized' }, 401);
  try {
    const db = serviceDb();
    const client = new NbaClient();
    const provider = new NbaProvider(client);
    const result = await runNbaSync(db, provider);
    // The on-demand queue and Relive ride on the same 15 minute schedule (SPEC 4.7).
    const queue = await drainNbaQueue(db, provider, client, {
      teamMap: await loadTeamMap(db, 'nba'),
      venueMaps: await loadVenueMaps(db),
      venueLookup: 'nba',
    });
    return json({ ...result, queue });
  } catch (err) {
    console.error(err);
    return json({ error: String(err) }, 500);
  }
});
