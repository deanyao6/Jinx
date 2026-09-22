import { TEAM_FILLS, teamFill } from '../teamFills';

/**
 * teamFills.ts is generated from the two palette seeds by scripts/design/build-team-fills.mjs.
 * This reads the seeds again and fails when the generated file is stale, so a palette change
 * cannot leave the welcome wall drawing last month's colour.
 */
declare const __dirname: string;
declare function require(id: string): unknown;

const { readFileSync } = require('node:fs') as { readFileSync: (p: string, enc: string) => string };
const { join } = require('node:path') as { join: (...parts: string[]) => string };

type SeedRow = { provider: string; provider_team_id: string; fill_hex: string };

const SEED = join(__dirname, '..', '..', '..', '..', '..', '..', '..', '..', 'seed');

function seed(file: string): SeedRow[] {
  return (JSON.parse(readFileSync(join(SEED, file), 'utf8')) as { teams: SeedRow[] }).teams;
}

describe('teamFills', () => {
  it('matches seed/team_colors.json and seed/mls_colors.json exactly', () => {
    const rows = [...seed('team_colors.json'), ...seed('mls_colors.json')];
    const expected: Record<string, string> = {};
    for (const r of rows)
      expected[`${r.provider}:${r.provider_team_id}`] = r.fill_hex.toUpperCase();
    expect(TEAM_FILLS).toEqual(expected);
    expect(Object.keys(TEAM_FILLS).length).toBeGreaterThanOrEqual(125);
  });

  it('answers null, not a guess, for a team it does not know', () => {
    expect(teamFill('mlb:143')).toBe('#E81828');
    expect(teamFill('nhl:1')).toBeNull();
  });
});
