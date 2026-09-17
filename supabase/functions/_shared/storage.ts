import type { SupabaseClient } from '@supabase/supabase-js';

/** Every bucket that holds files under a `<user_id>/` prefix. A new bucket must be added here. */
export const USER_BUCKETS = ['ticket-imports', 'attendance-photos', 'avatars'] as const;

/**
 * Every object path under `prefix`, walking folders.
 *
 * `list()` is one level deep and returns folders as entries with a null id, so a flat listing of
 * `<user_id>/` misses `<user_id>/<attendance_id>/photo.jpg` entirely. It is also paged, so a
 * single call silently stops at its limit.
 */
export async function listAllObjects(
  admin: SupabaseClient,
  bucket: string,
  prefix: string,
): Promise<string[]> {
  const out: string[] = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await admin.storage
      .from(bucket)
      .list(prefix, { limit: pageSize, offset });
    if (error) throw new Error(`list ${bucket}/${prefix}: ${error.message}`);
    const entries = data ?? [];
    for (const entry of entries) {
      const path = `${prefix}/${entry.name}`;
      if (entry.id === null) out.push(...(await listAllObjects(admin, bucket, path)));
      else out.push(path);
    }
    if (entries.length < pageSize) break;
  }
  return out;
}

/** Removes everything a user stored in one bucket. Returns how many objects went. */
export async function removeUserObjects(
  admin: SupabaseClient,
  bucket: string,
  userId: string,
): Promise<number> {
  const paths = await listAllObjects(admin, bucket, userId);
  for (let i = 0; i < paths.length; i += 500) {
    const { error } = await admin.storage.from(bucket).remove(paths.slice(i, i + 500));
    if (error) throw new Error(`remove ${bucket}: ${error.message}`);
  }
  return paths.length;
}
