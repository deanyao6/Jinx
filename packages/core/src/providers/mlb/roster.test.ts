import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { isMlbRosterStatus, parseMlbRoster, type MlbRosterResponse } from './parse.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = join(here, '../../../../../ingest/fixtures/mlb');

function load<T>(name: string): T {
  return JSON.parse(readFileSync(join(fixtures, name), 'utf8')) as T;
}

// Snapshot of v1/teams/143/roster?rosterType=40Man on 2026-09-17: 45 rows, of which 28 active,
// 6 on an injured list, 10 reassigned to minors and 1 not yet reported.
const phillies = () => load<MlbRosterResponse>('roster_143_PHI_40man_2026-09-17.json');

describe('parseMlbRoster', () => {
  it('keeps active and injured players and drops the minors and not-yet-reported', () => {
    const doc = phillies();
    expect(doc.roster).toHaveLength(45);
    const roster = parseMlbRoster(doc);
    expect(roster).toHaveLength(34);
    const statuses = new Map<string, number>();
    for (const r of roster) statuses.set(r.status ?? '', (statuses.get(r.status ?? '') ?? 0) + 1);
    expect(Object.fromEntries(statuses)).toEqual({ A: 28, D60: 5, D15: 1 });
    expect(roster.some((r) => r.fullName === 'Nestor Cortes')).toBe(false);
  });

  it('maps person, jersey, position and status', () => {
    const nola = parseMlbRoster(phillies()).find((r) => r.providerPlayerId === '605400');
    expect(nola).toEqual({
      providerPlayerId: '605400',
      fullName: 'Aaron Nola',
      position: 'P',
      jersey: '27',
      status: 'A',
    });
  });

  it('turns an empty jersey number into null rather than an empty string', () => {
    const garcia = parseMlbRoster(phillies()).find((r) => r.fullName === 'Adolis García');
    expect(garcia).toMatchObject({ status: 'D60', jersey: '53' });
    const doc: MlbRosterResponse = {
      roster: [
        {
          person: { id: 1, fullName: 'No Number' },
          jerseyNumber: '',
          position: { abbreviation: 'P' },
          status: { code: 'A' },
        },
      ],
    };
    expect(parseMlbRoster(doc)[0]?.jersey).toBeNull();
  });

  it('lists a player once even if the document repeats them', () => {
    const doc = phillies();
    doc.roster.push(doc.roster[0]!);
    expect(parseMlbRoster(doc)).toHaveLength(34);
  });
});

describe('isMlbRosterStatus', () => {
  it('accepts active and every injured list, nothing else', () => {
    for (const code of ['A', 'D7', 'D10', 'D15', 'D60']) expect(isMlbRosterStatus(code)).toBe(true);
    for (const code of ['RM', 'NYR', 'SU', '', null, undefined])
      expect(isMlbRosterStatus(code)).toBe(false);
  });
});
