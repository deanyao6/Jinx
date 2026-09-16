import { MlbProvider } from '../_shared/core/index.ts';
import { authorizeInternal, json, serviceDb } from '../_shared/db.ts';
import { runMlbSync } from './sync.ts';

Deno.serve(async (req) => {
  if (!authorizeInternal(req)) return json({ error: 'unauthorized' }, 401);
  try {
    const result = await runMlbSync(serviceDb(), new MlbProvider());
    return json(result);
  } catch (err) {
    console.error(err);
    return json({ error: String(err) }, 500);
  }
});
