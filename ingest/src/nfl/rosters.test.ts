import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { collectCsv } from './csv.js';
import {
  currentRosters,
  NFL_ROSTER_STATUSES,
  resolveRosterTeam,
  toWeeklyRosterRow,
  type WeeklyRosterRow,
} from './rosters.js';

const FIXTURES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../fixtures/nfl');

// A slice of roster_weekly_2026.csv.gz taken 2026-09-17: every Eagles row for weeks 1 and 2,
// five Raiders rows from week 2, and the two rows in the whole file without a gsis id.
const sample = JSON.parse(
  readFileSync(path.join(FIXTURES, 'roster_weekly_2026_PHI_sample.json'), 'utf8'),
) as Record<string, string | null>[];

function toCsv(rows: Record<string, unknown>[]): string {
  const columns = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const cell = (v: unknown): string => {
    if (v == null) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return (
    [columns.join(','), ...rows.map((r) => columns.map((c) => cell(r[c])).join(','))].join('\n') +
    '\n'
  );
}

async function rows(): Promise<WeeklyRosterRow[]> {
  return (await collectCsv(toCsv(sample))).map(toWeeklyRosterRow);
}

describe('toWeeklyRosterRow', () => {
  it('reads the roster columns with numbers coerced and empty cells null', async () => {
    const parsed = await rows();
    expect(parsed).toHaveLength(sample.length);
    const dalton = parsed.find((r) => r.full_name === 'Andy Dalton' && r.week === 2);
    expect(dalton).toEqual({
      season: 2026,
      week: 2,
      game_type: 'REG',
      team: 'PHI',
      gsis_id: '00-0027973',
      full_name: 'Andy Dalton',
      position: 'QB',
      jersey_number: '14',
      status: 'ACT',
    });
    const noId = parsed.find((r) => r.full_name === 'Al-Jay Henderson');
    expect(noId?.gsis_id).toBeNull();
  });
});

describe('currentRosters', () => {
  it('takes the latest week and keeps only players under contract', async () => {
    const current = currentRosters(await rows())!;
    expect(current.season).toBe(2026);
    expect(current.week).toBe(2);
    expect([...current.byTeam.keys()].sort()).toEqual(['LV', 'PHI']);
    const phi = current.byTeam.get('PHI')!;
    // Week 2 Eagles: 52 ACT + 18 DEV + 7 RES; the one RET row is not on the team.
    expect(phi).toHaveLength(77);
    const statuses = new Map<string, number>();
    for (const p of phi) statuses.set(p.status!, (statuses.get(p.status!) ?? 0) + 1);
    expect(Object.fromEntries(statuses)).toEqual({ ACT: 52, DEV: 18, RES: 7 });
    expect(phi.every((p) => NFL_ROSTER_STATUSES.has(p.status!))).toBe(true);
  });

  it('maps a row into a RosterEntry', async () => {
    const phi = currentRosters(await rows())!.byTeam.get('PHI')!;
    expect(phi.find((p) => p.providerPlayerId === '00-0034844')).toEqual({
      providerPlayerId: '00-0034844',
      fullName: 'Saquon Barkley',
      position: 'RB',
      jersey: '26',
      status: 'ACT',
    });
  });

  it('ignores week 1 rows, including the players cut before week 2', async () => {
    const all = await rows();
    const cutInWeek1 = all.filter((r) => r.week === 1 && r.status === 'CUT');
    expect(cutInWeek1.length).toBeGreaterThan(0);
    const phi = currentRosters(all)!.byTeam.get('PHI')!;
    const ids = new Set(phi.map((p) => p.providerPlayerId));
    for (const r of cutInWeek1) expect(ids.has(r.gsis_id!)).toBe(false);
  });

  it('counts what it skipped', async () => {
    const current = currentRosters(await rows())!;
    // Week 2: PHI's retired row; the NYJ practice-squad player without a gsis id.
    expect(current.skipped).toEqual({ notOnTeam: 1, missingGsis: 1 });
  });

  it('returns null for a file with no usable rows', () => {
    expect(currentRosters([])).toBeNull();
  });

  it('lists a player once for a team even if the week repeats them', async () => {
    const all = await rows();
    const doubled = [...all, ...all.filter((r) => r.week === 2 && r.team === 'PHI')];
    expect(currentRosters(doubled)!.byTeam.get('PHI')).toHaveLength(77);
  });
});

describe('resolveRosterTeam', () => {
  const teamMap = new Map([
    ['PHI', 'phi-uuid'],
    ['OAK', 'oak-uuid'],
    ['LV', 'lv-uuid'],
  ]);

  it('resolves a current abbreviation directly', () => {
    expect(resolveRosterTeam(teamMap, 'PHI')).toBe('phi-uuid');
    expect(resolveRosterTeam(teamMap, 'LV')).toBe('lv-uuid');
  });

  it('falls back to the historical franchise code when the current one is missing', () => {
    expect(resolveRosterTeam(new Map([['OAK', 'oak-uuid']]), 'LV')).toBe('oak-uuid');
  });

  it('returns null for an unknown code', () => {
    expect(resolveRosterTeam(teamMap, 'XYZ')).toBeNull();
  });
});
