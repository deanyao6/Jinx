/** Normalizes the Wrapped JSON from the server; every card may carry nulls. Pure. */
import { parseRecord } from '@/features/passport/format';
import type { WrappedCard, WrappedCompanion, WrappedPayload, WrappedTeamRecord } from './types';

function obj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v ? v : null;
}

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() && Number.isFinite(Number(v))) return Number(v);
  return null;
}

function companion(v: unknown): WrappedCompanion | null {
  const o = obj(v);
  const id = o ? str(o['person_id']) : null;
  const name = o ? str(o['name']) : null;
  if (!o || !id || !name) return null;
  return { person_id: id, name, record: parseRecord(o['record']) };
}

function gameRef<T extends Record<string, unknown>>(
  v: unknown,
  extra: (o: Record<string, unknown>) => T | null,
) {
  const o = obj(v);
  const gameId = o ? str(o['game_id']) : null;
  if (!o || !gameId) return undefined;
  const rest = extra(o);
  return rest ? { game_id: gameId, ...rest } : undefined;
}

export function parseWrappedCard(v: unknown): WrappedCard | null {
  const o = obj(v);
  if (!o) return null;
  switch (o['kind']) {
    case 'games':
      return { kind: 'games', games: num(o['games']) ?? 0 };
    case 'record':
      return {
        kind: 'record',
        record: parseRecord(o['record']),
        teams: arr(o['teams']).flatMap((t): WrappedTeamRecord[] => {
          const to = obj(t);
          const id = to ? str(to['team_id']) : null;
          const name = to ? str(to['name']) : null;
          return to && id && name ? [{ team_id: id, name, record: parseRecord(to['record']) }] : [];
        }),
      };
    case 'pledge': {
      const p = obj(o['pledge']);
      const record = p ? parseRecord(p['record']) : null;
      const counted = record ? record.wins + record.losses + record.ties > 0 : false;
      return {
        kind: 'pledge',
        pledge: p && record && counted ? { record, vs_expected: num(p['vs_expected']) ?? 0 } : null,
      };
    }
    case 'stamps': {
      const s = obj(o['stamps']);
      return {
        kind: 'stamps',
        stamps: {
          venues: s ? (num(s['venues']) ?? 0) : 0,
          new: arr(s?.['new']).flatMap((n) => {
            const no = obj(n);
            const id = no ? str(no['venue_id']) : null;
            const name = no ? str(no['name']) : null;
            return no && id && name ? [{ venue_id: id, name }] : [];
          }),
        },
      };
    }
    case 'player': {
      const p = obj(o['player']);
      const id = p ? str(p['player_id']) : null;
      const name = p ? str(p['name']) : null;
      return {
        kind: 'player',
        player: p && id && name ? { player_id: id, name, count: num(p['count']) ?? 0 } : null,
      };
    }
    case 'moment': {
      const m = obj(o['moment']);
      const type = m ? str(m['type']) : null;
      const gameId = m ? str(m['game_id']) : null;
      return {
        kind: 'moment',
        moment:
          m && type && gameId
            ? {
                type,
                game_id: gameId,
                player: str(m['player']),
                occurred_at: str(m['occurred_at']),
              }
            : null,
      };
    }
    case 'companions':
      return { kind: 'companions', best: companion(o['best']), worst: companion(o['worst']) };
    case 'miles':
      return { kind: 'miles', km: num(o['km']) };
    case 'superlative': {
      const s = obj(o['superlatives']) ?? {};
      const coldest = gameRef(s['coldest'], (x) => {
        const value = num(x['value']);
        return value == null ? null : { value };
      });
      const hottest = gameRef(s['hottest'], (x) => {
        const value = num(x['value']);
        return value == null ? null : { value };
      });
      const longest = gameRef(s['longest'], (x) => ({
        minutes: num(x['minutes']),
        periods: num(x['periods']),
      }));
      const highest = gameRef(s['highest_scoring'], (x) => {
        const total = num(x['total']);
        return total == null ? null : { total };
      });
      return {
        kind: 'superlative',
        superlatives: {
          ...(coldest ? { coldest } : {}),
          ...(hottest ? { hottest } : {}),
          ...(longest ? { longest } : {}),
          ...(highest ? { highest_scoring: highest } : {}),
        },
      };
    }
    case 'goals':
      return {
        kind: 'goals',
        goals: arr(o['goals']).flatMap((g) => {
          const go = obj(g);
          const id = go ? str(go['goal_id']) : null;
          const title = go ? str(go['title']) : null;
          return go && id && title ? [{ goal_id: id, title }] : [];
        }),
      };
    default:
      return null;
  }
}

/** Null when the server returned null (no games that season) or something unrecognizable. */
export function parseWrapped(input: unknown): WrappedPayload | null {
  const o = obj(input);
  if (!o) return null;
  const sport = str(o['sport_id']);
  const season = num(o['season']);
  if (!sport || season == null) return null;
  const cards = arr(o['cards']).flatMap((c) => {
    const card = parseWrappedCard(c);
    return card ? [card] : [];
  });
  if (cards.length === 0) return null;
  return { sport_id: sport, season, cards, generated_at: str(o['generated_at']) };
}
