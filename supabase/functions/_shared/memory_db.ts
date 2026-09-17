/**
 * An in-memory MinimalDb for Deno tests. It keeps the one PostgREST behaviour that has cost this
 * project a real game: a response never holds more than MAX_ROWS rows, whatever was asked for.
 * A test that passes here because it fetched everything and filtered afterwards is a test that
 * would have caught that.
 */
import type { DbBuilder, DbResult, MinimalDb } from './core/index.ts';

export const MAX_ROWS = 1000;

type Row = Record<string, unknown>;
type Predicate = (row: Row) => boolean;

export interface MemoryDb extends MinimalDb {
  tables: Record<string, Row[]>;
  /** Every request that reached the "server", for asserting on what was asked. */
  requests: { table: string; op: string }[];
}

function compare(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === null || a === undefined) return 1;
  if (b === null || b === undefined) return -1;
  return a < b ? -1 : 1;
}

export function memoryDb(
  tables: Record<string, Row[]>,
  rpc: Record<string, (args: Row) => unknown> = {},
): MemoryDb {
  const requests: MemoryDb['requests'] = [];

  const builder = (
    table: string,
    op: 'select' | 'update' | 'delete',
    patch: Row | null,
    done: Row[] | null = null,
  ): DbBuilder => {
    const filters: Predicate[] = [];
    const orders: { column: string; ascending: boolean }[] = [];
    let window: [number, number] | null = null;
    let cap = MAX_ROWS;

    const run = (): DbResult<unknown[]> => {
      requests.push({ table, op });
      if (done) return { data: done, error: null };
      const all = tables[table] ?? (tables[table] = []);
      const matched = all.filter((r) => filters.every((f) => f(r)));
      if (op === 'delete') {
        tables[table] = all.filter((r) => !matched.includes(r));
        return { data: [], error: null };
      }
      if (op === 'update') {
        for (const r of matched) Object.assign(r, patch);
        return { data: [], error: null };
      }
      for (const o of [...orders].reverse()) {
        matched.sort((a, b) => compare(a[o.column], b[o.column]) * (o.ascending ? 1 : -1));
      }
      const from = window ? window[0] : 0;
      const size = Math.min(window ? window[1] - window[0] + 1 : cap, cap, MAX_ROWS);
      return { data: matched.slice(from, from + size).map((r) => ({ ...r })), error: null };
    };

    const where = (f: Predicate) => {
      filters.push(f);
      return b;
    };
    const b: DbBuilder = {
      select: () => b,
      eq: (c, v) => where((r) => r[c] === v),
      neq: (c, v) => where((r) => r[c] !== v),
      in: (c, vs) => where((r) => vs.includes(r[c])),
      is: (c, v) => where((r) => (r[c] ?? null) === v),
      gte: (c, v) => where((r) => compare(r[c], v) >= 0),
      lte: (c, v) => where((r) => compare(r[c], v) <= 0),
      gt: (c, v) => where((r) => compare(r[c], v) > 0),
      lt: (c, v) => where((r) => compare(r[c], v) < 0),
      not: (c, operator, v) => {
        if (operator !== 'is') throw new Error(`memoryDb: not.${operator} is not supported`);
        return where((r) => (r[c] ?? null) !== v);
      },
      order: (column, opts) => {
        orders.push({ column, ascending: opts?.ascending ?? true });
        return b;
      },
      range: (from, to) => {
        window = [from, to];
        return b;
      },
      limit: (count) => {
        cap = count;
        return b;
      },
      single: () => Promise.resolve({ data: run().data?.[0] ?? null, error: null }),
      maybeSingle: () => Promise.resolve({ data: run().data?.[0] ?? null, error: null }),
      then: (resolve, reject) => Promise.resolve(run()).then(resolve, reject),
    };
    return b;
  };

  return {
    tables,
    requests,
    from: (table) => ({
      select: () => builder(table, 'select', null),
      update: (patch) => builder(table, 'update', patch),
      delete: () => builder(table, 'delete', null),
      insert: (rows) => {
        (tables[table] ?? (tables[table] = [])).push(...rows.map((r) => ({ ...r })));
        return builder(table, 'select', null, []);
      },
      upsert: (rows, opts) => {
        const keys = (opts?.onConflict ?? 'id').split(',').map((k) => k.trim());
        const all = tables[table] ?? (tables[table] = []);
        for (const row of rows) {
          const hit = all.find((r) => keys.every((k) => (r[k] ?? null) === (row[k] ?? null)));
          if (hit && !opts?.ignoreDuplicates) Object.assign(hit, row);
          if (!hit) all.push({ ...row });
        }
        return builder(table, 'select', null, []);
      },
    }),
    rpc: (fn, args) => Promise.resolve({ data: rpc[fn]?.(args ?? {}) ?? [], error: null }),
  };
}
