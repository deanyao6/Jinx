/**
 * welcome-wall: the six game cards on the signed-out welcome screen (SPEC.md 8.8).
 *
 * GET, public, no auth: nobody is signed in when the screen shows, and the answer holds no user
 * data of any kind. Deploy with `--no-verify-jwt`. It reads the current week's cards through
 * welcome_wall_current() and nothing else; the scoring runs in SQL from pg_cron
 * (migration 20260923100000), so this function cannot write.
 *
 * The answer is cached at the CDN for six hours and is a few hundred bytes. Requests are
 * rate-limited per IP inside the isolate, which is best effort: it protects the database from one
 * noisy client, not from a distributed one, and the cache in front does the rest.
 */
import { json, serviceDb } from '../_shared/db.ts';
import { serveWelcomeWall } from './serve.ts';

Deno.serve((req) => serveWelcomeWall(req, () => serviceDb(), json));
