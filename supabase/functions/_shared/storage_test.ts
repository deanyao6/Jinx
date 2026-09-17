import { assert, assertEquals } from 'jsr:@std/assert@1';
import type { SupabaseClient } from '@supabase/supabase-js';

import { removeUserObjects, USER_BUCKETS } from './storage.ts';

/**
 * Account deletion (SPEC.md 9, 11) walks USER_BUCKETS, so a bucket missing from that list is a
 * file that outlives its owner. These run the real walk against an in-memory bucket.
 */

type Entry = { name: string; id: string | null };

/** A storage client over a flat set of object paths, listing one level at a time like the API. */
function fakeAdmin(objects: Record<string, Set<string>>) {
  const removed: Record<string, string[]> = {};
  const client = {
    storage: {
      from(bucket: string) {
        const paths = objects[bucket] ?? new Set<string>();
        return {
          list(prefix: string, opts: { limit: number; offset: number }) {
            const seen = new Map<string, Entry>();
            for (const path of paths) {
              if (!path.startsWith(`${prefix}/`)) continue;
              const rest = path.slice(prefix.length + 1);
              const [head, ...tail] = rest.split('/');
              seen.set(head, { name: head, id: tail.length ? null : `id-${head}` });
            }
            const all = [...seen.values()];
            return Promise.resolve({
              data: all.slice(opts.offset, opts.offset + opts.limit),
              error: null,
            });
          },
          remove(gone: string[]) {
            for (const path of gone) paths.delete(path);
            removed[bucket] = [...(removed[bucket] ?? []), ...gone];
            return Promise.resolve({ data: null, error: null });
          },
        };
      },
    },
  };
  return { admin: client as unknown as SupabaseClient, removed };
}

Deno.test('every bucket that holds user files is cleaned on account deletion', () => {
  assertEquals([...USER_BUCKETS].sort(), ['attendance-photos', 'avatars', 'ticket-imports']);
});

Deno.test('a profile photo goes with the account, and nobody else is touched', async () => {
  const objects = {
    avatars: new Set(['user-a/avatar-1700000000000.jpg', 'user-b/avatar-1700000000001.jpg']),
    'attendance-photos': new Set(['user-a/att-1/photo.jpg', 'user-a/att-2/clip.mp4']),
    'ticket-imports': new Set<string>(),
  };
  const { admin, removed } = fakeAdmin(objects);
  const counts: Record<string, number> = {};
  for (const bucket of USER_BUCKETS) {
    counts[bucket] = await removeUserObjects(admin, bucket, 'user-a');
  }

  assertEquals(counts, { 'ticket-imports': 0, 'attendance-photos': 2, avatars: 1 });
  assertEquals(removed.avatars, ['user-a/avatar-1700000000000.jpg']);
  assert(
    objects.avatars.has('user-b/avatar-1700000000001.jpg'),
    "another user's avatar is left alone",
  );
  assertEquals(objects['attendance-photos'].size, 0);
});
