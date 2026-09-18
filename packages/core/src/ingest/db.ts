/**
 * Minimal structural interface over a supabase-js client so ingestion code runs unchanged in
 * Node (ingest package) and Deno (Edge Functions). Cast a real client with `asDb(client)`.
 */

export interface DbResult<T> {
  data: T | null;
  error: { message: string } | null;
}

export interface DbBuilder extends PromiseLike<DbResult<unknown[]>> {
  select(columns: string): DbBuilder;
  eq(column: string, value: unknown): DbBuilder;
  neq(column: string, value: unknown): DbBuilder;
  in(column: string, values: unknown[]): DbBuilder;
  is(column: string, value: unknown): DbBuilder;
  gte(column: string, value: unknown): DbBuilder;
  lte(column: string, value: unknown): DbBuilder;
  gt(column: string, value: unknown): DbBuilder;
  lt(column: string, value: unknown): DbBuilder;
  not(column: string, operator: string, value: unknown): DbBuilder;
  order(column: string, opts?: { ascending?: boolean }): DbBuilder;
  range(from: number, to: number): DbBuilder;
  limit(count: number): DbBuilder;
  single(): PromiseLike<DbResult<unknown>>;
  maybeSingle(): PromiseLike<DbResult<unknown>>;
}

export interface DbTable {
  select(columns: string): DbBuilder;
  insert(rows: Record<string, unknown>[]): DbBuilder;
  upsert(
    rows: Record<string, unknown>[],
    opts?: { onConflict?: string; ignoreDuplicates?: boolean },
  ): DbBuilder;
  update(patch: Record<string, unknown>): DbBuilder;
  delete(): DbBuilder;
}

export interface MinimalDb {
  from(table: string): DbTable;
  rpc(fn: string, args?: Record<string, unknown>): PromiseLike<DbResult<unknown>>;
}

/** Structural cast for a supabase-js client (Node or Deno). */
export function asDb(client: unknown): MinimalDb {
  return client as MinimalDb;
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export async function upsertRows(
  db: MinimalDb,
  table: string,
  rows: Record<string, unknown>[],
  onConflict: string,
  opts: { ignoreDuplicates?: boolean; chunkSize?: number } = {},
): Promise<void> {
  for (const part of chunk(rows, opts.chunkSize ?? 500)) {
    const { error } = await db
      .from(table)
      .upsert(part, { onConflict, ignoreDuplicates: opts.ignoreDuplicates ?? false });
    if (error) throw new Error(`upsert ${table}: ${error.message}`);
  }
}

/** Pages through a select so results never hit the default 1000-row cap. */
export async function selectAll<T>(
  db: MinimalDb,
  table: string,
  columns: string,
  filter?: (q: DbBuilder) => DbBuilder,
  pageSize = 1000,
): Promise<T[]> {
  const out: T[] = [];
  let from = 0;
  for (;;) {
    let q = db.from(table).select(columns);
    if (filter) q = filter(q);
    const { data, error } = await q.range(from, from + pageSize - 1);
    if (error) throw new Error(`select ${table}: ${error.message}`);
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < pageSize) break;
    from += pageSize;
  }
  return out;
}

/** provider_team_id -> team uuid for one provider. */
export async function loadTeamMap(db: MinimalDb, provider: string): Promise<Map<string, string>> {
  const rows = await selectAll<{ id: string; provider_team_id: string }>(
    db,
    'teams',
    'id, provider_team_id',
    (q) => q.eq('provider', provider),
  );
  return new Map(rows.map((r) => [r.provider_team_id, r.id]));
}

export interface VenueMaps {
  byMlbVenueId: Map<string, string>;
  byNflverseStadiumId: Map<string, string>;
  /** ESPN venue ids (`provider_ids.espn_venue_ids`), which the NBA schedule carries. */
  byEspnVenueId: Map<string, string>;
  /** Every venue name and alias, lower-cased, for feeds that name the building. */
  byAlias: Map<string, string>;
  byKey: Map<string, string>;
}

export async function loadVenueMaps(db: MinimalDb): Promise<VenueMaps> {
  const rows = await selectAll<{
    id: string;
    key: string;
    name: string;
    provider_ids: Record<string, unknown>;
  }>(db, 'venues', 'id, key, name, provider_ids');
  const aliases = await selectAll<{ venue_id: string; alias: string }>(
    db,
    'venue_aliases',
    'venue_id, alias',
  );
  const maps: VenueMaps = {
    byMlbVenueId: new Map(),
    byNflverseStadiumId: new Map(),
    byEspnVenueId: new Map(),
    byAlias: new Map(),
    byKey: new Map(),
  };
  for (const r of rows) {
    maps.byKey.set(r.key, r.id);
    if (r.name) maps.byAlias.set(r.name.trim().toLowerCase(), r.id);
    const mlb = r.provider_ids['mlb_venue_id'];
    if (mlb !== undefined && mlb !== null) maps.byMlbVenueId.set(String(mlb), r.id);
    const nfl = r.provider_ids['nflverse_stadium_ids'];
    if (Array.isArray(nfl)) for (const id of nfl) maps.byNflverseStadiumId.set(String(id), r.id);
    const espn = r.provider_ids['espn_venue_ids'];
    if (Array.isArray(espn)) for (const id of espn) maps.byEspnVenueId.set(String(id), r.id);
  }
  // An alias shared by two buildings (a renamed arena's old name reused elsewhere) keeps the
  // first; the name set above wins over an alias that collides with it.
  for (const a of aliases) {
    const k = a.alias.trim().toLowerCase();
    if (!maps.byAlias.has(k)) maps.byAlias.set(k, a.venue_id);
  }
  return maps;
}

export type ProgressStatus = 'pending' | 'running' | 'done' | 'failed';

export async function setProgress(
  db: MinimalDb,
  job: string,
  key: string,
  status: ProgressStatus,
  detail: Record<string, unknown> = {},
): Promise<void> {
  const { error } = await db
    .from('ingest_progress')
    .upsert([{ job, key, status, detail, updated_at: new Date().toISOString() }], {
      onConflict: 'job,key',
    });
  if (error) throw new Error(`ingest_progress: ${error.message}`);
}

export async function getProgress(
  db: MinimalDb,
  job: string,
  key: string,
): Promise<ProgressStatus | null> {
  const { data, error } = await db
    .from('ingest_progress')
    .select('status')
    .eq('job', job)
    .eq('key', key)
    .maybeSingle();
  if (error) throw new Error(`ingest_progress: ${error.message}`);
  return (data as { status: ProgressStatus } | null)?.status ?? null;
}
