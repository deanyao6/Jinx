import {
  MlbClient,
  MlbProvider,
  drainMlbQueue,
  loadTeamMap,
  loadVenueMaps,
} from '../_shared/core/index.ts';
import { authorizeInternal, json, serviceDb } from '../_shared/db.ts';
import { runMlbSync } from './sync.ts';

Deno.serve(async (req) => {
  if (!authorizeInternal(req)) return json({ error: 'unauthorized' }, 401);
  try {
    const db = serviceDb();
    const client = new MlbClient();
    const provider = new MlbProvider(client);
    const result = await runMlbSync(db, provider);
    // The on-demand queue and Relive ride on the same 15 minute schedule (SPEC 4.7): a game
    // someone just logged has its detail and its story by the next run, with nobody involved.
    const queue = await drainMlbQueue(db, provider, client, {
      teamMap: await loadTeamMap(db, 'mlb'),
      venueMaps: await loadVenueMaps(db),
      venueLookup: 'mlb',
    });
    return json({ ...result, queue });
  } catch (err) {
    console.error(err);
    return json({ error: String(err) }, 500);
  }
});
