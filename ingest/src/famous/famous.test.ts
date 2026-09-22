/**
 * The famous-games ingest parsers against real responses (ingest/fixtures/mlb, saved
 * 2026-09-17) and against the real seed files, so a bad edit to either fails here first.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  mlbJoins,
  type CuratedFamousGame,
  type MlbAwardRecipientsResponse,
  type MlbPeopleResponse,
  type MlbTransactionsResponse,
} from '@jinx/core';
import { describe, expect, it } from 'vitest';

import { honorsFromRecipients } from '../mlb/honors.js';
import { yearRanges } from '../mlb/moves.js';
import { NFL_AWARDS_FILE, validateNflAwards, type NflAwardRow } from '../nfl/honors.js';
import { teamForSeason, weekStarts } from '../nfl/moves.js';
import { CURATED_FILE, validateCurated } from './curated.js';
import { nflCandidates, normName } from './franchise.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MLB = path.resolve(HERE, '../../fixtures/mlb');
const ROOT = path.resolve(HERE, '../../..');
const load = <T>(file: string): T => JSON.parse(readFileSync(file, 'utf8')) as T;

describe('MLB award recipients', () => {
  it('reads the 2024 AL MVP as Aaron Judge', () => {
    const rows = honorsFromRecipients(
      'ALMVP',
      2024,
      load<MlbAwardRecipientsResponse>(path.join(MLB, 'awards_ALMVP_recipients_2024.json')),
    );
    expect(rows).toEqual([
      { providerPlayerId: '592450', fullName: 'Aaron Judge', season: 2024, honor: 'mvp' },
    ]);
  });
  it('reads every 2024 AL All-Star', () => {
    const rows = honorsFromRecipients(
      'ALAS',
      2024,
      load<MlbAwardRecipientsResponse>(path.join(MLB, 'awards_ALAS_recipients_2024.json')),
    );
    expect(rows).toHaveLength(37);
    expect(new Set(rows.map((r) => r.honor))).toEqual(new Set(['all_star']));
    expect(rows.find((r) => r.fullName === 'Bobby Witt Jr.')?.providerPlayerId).toBe('677951');
  });
  it('ignores an award it does not know', () => {
    expect(honorsFromRecipients('WSMVP', 2024, { awards: [] })).toEqual([]);
  });
});

describe('MLB people', () => {
  it('carries mlbDebutDate for a batch', () => {
    const res = load<MlbPeopleResponse>(path.join(MLB, 'people_547180_661395_660271.json'));
    const debut = new Map(res.people.map((p) => [p.id, p.mlbDebutDate]));
    expect(debut.get(547180)).toBe('2012-04-28');
    expect(debut.get(661395)).toBe('2022-04-08');
  });
});

describe('MLB transactions', () => {
  it('finds the Jhoan Duran trade to the Phillies and no rehab assignment', () => {
    const res = load<MlbTransactionsResponse>(
      path.join(MLB, 'transactions_143_PHI_2025-07-25_2025-08-05.json'),
    );
    const joins = mlbJoins(res.transactions, (id) => Number(id) < 1000);
    const toPhi = joins.filter((j) => j.providerTeamId === '143');
    expect(toPhi.find((j) => j.fullName === 'Jhoan Duran')).toEqual({
      providerPlayerId: '661395',
      providerTeamId: '143',
      joinedOn: '2025-07-30',
      kind: 'trade',
      fullName: 'Jhoan Duran',
    });
    expect(toPhi.map((j) => j.fullName)).toContain('Harrison Bader');
    expect(joins.some((j) => j.providerTeamId === '1410')).toBe(false);
  });
  it('splits a range at year ends', () => {
    expect(yearRanges('2024-11-01', '2026-02-01')).toEqual([
      ['2024-11-01', '2024-12-31'],
      ['2025-01-01', '2025-12-31'],
      ['2026-01-01', '2026-02-01'],
    ]);
  });
});

describe('seed/famous_games.json', () => {
  it('is valid: dates, categories, copy with no em dashes', () => {
    const entries = load<CuratedFamousGame[]>(CURATED_FILE);
    expect(entries.length).toBeGreaterThanOrEqual(21);
    expect(validateCurated(entries)).toEqual([]);
  });
  it('rejects an entry that breaks the rules', () => {
    const bad = {
      sport: 'nfl',
      local_date: '2025-2-9',
      home: 'PHI',
      away: 'KC',
      category: 'party',
      title: 'x' + String.fromCharCode(0x2014),
      story: '',
      about: 'league',
    };
    expect(validateCurated([bad as unknown as CuratedFamousGame])).toHaveLength(3);
  });
});

describe('seed/nfl_awards.json', () => {
  it('is valid and covers three seasons', () => {
    const rows = load<NflAwardRow[]>(NFL_AWARDS_FILE);
    expect(validateNflAwards(rows)).toEqual([]);
    expect(new Set(rows.map((r) => r.season))).toEqual(new Set([2023, 2024, 2025]));
    expect(rows.filter((r) => r.honor === 'mvp').map((r) => `${r.season} ${r.name}`)).toEqual([
      '2023 Lamar Jackson',
      '2024 Josh Allen',
      '2025 Matthew Stafford',
    ]);
  });
  it('holds MVP, MVP top five and first-team All-Pro only, no Pro Bowl', () => {
    const rows = load<NflAwardRow[]>(NFL_AWARDS_FILE);
    expect(new Set(rows.map((r) => r.honor))).toEqual(new Set(['mvp', 'mvp_top5', 'all_pro_1st']));
    expect(
      validateNflAwards([
        { season: 2024, honor: 'pro_bowl', gsis_id: '00-0034857', name: 'Josh Allen' },
      ]),
    ).toHaveLength(1);
  });
  it('names the quarterback Lamar Jackson, not the cornerback', () => {
    const rows = load<NflAwardRow[]>(NFL_AWARDS_FILE);
    expect(new Set(rows.filter((r) => r.name === 'Lamar Jackson').map((r) => r.gsis_id))).toEqual(
      new Set(['00-0034796']),
    );
  });
});

describe('NFL moves', () => {
  const seed = load<{ abbr: string; franchise: string; first: number; last: number | null }[]>(
    path.join(ROOT, 'seed', 'nfl_teams.json'),
  );
  it('puts a current code on the team row that played that season', () => {
    expect(teamForSeason(seed, 'LV', 2019)).toBe('OAK');
    expect(teamForSeason(seed, 'LV', 2020)).toBe('LV');
    expect(teamForSeason(seed, 'LA', 2015)).toBe('STL');
    expect(teamForSeason(seed, 'PHI', 2024)).toBe('PHI');
  });
  it('dates a roster week from its first game, less six days', () => {
    const starts = weekStarts([
      { season: 2024, week: 1, gameday: '2024-09-06' },
      { season: 2024, week: 1, gameday: '2024-09-05' },
      { season: 2024, week: 2, gameday: '2024-09-12' },
    ]);
    expect(starts.get('2024:1')).toBe('2024-08-30');
    expect(starts.get('2024:2')).toBe('2024-09-06');
  });
});

describe('franchise players', () => {
  it('matches names without accents or suffixes', () => {
    expect(normName('Ronald Acuña Jr.')).toBe(normName('Ronald Acuna'));
    expect(normName("Ja'Marr Chase")).toBe('ja marr chase');
  });
  it('limits NFL candidates to players active in the entry’s seasons', () => {
    const players = [
      {
        gsisId: 'a',
        name: 'Adrian Peterson',
        position: 'RB',
        rookieSeason: 2002,
        lastSeason: 2009,
      },
      {
        gsisId: 'b',
        name: 'Adrian Peterson',
        position: 'RB',
        rookieSeason: 2007,
        lastSeason: 2021,
      },
    ];
    expect(
      nflCandidates(players, { sport: 'nfl', name: 'Adrian Peterson', from: 2012, to: 2016 }).map(
        (p) => p.gsisId,
      ),
    ).toEqual(['b']);
    expect(
      nflCandidates(players, { sport: 'nfl', name: 'Adrian Peterson', from: 2007, to: 2016 }),
    ).toHaveLength(2);
  });
});
