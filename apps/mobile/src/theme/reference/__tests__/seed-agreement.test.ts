import { REFERENCE_TEAMS } from '../teams';

/**
 * The 14 reference palettes exist in two places, and they must not drift apart.
 *
 * `seed/team_colors.json` is the full set of 65 MLB and NFL palettes that loads into the
 * `team_colors` table and is what the app reads at runtime. `teams.ts` carries only the
 * 14 the reference itself defines, as the demo-mode and offline fallback, so a screen can
 * render before any query resolves.
 *
 * Keeping the fallback is deliberate: SPEC.md 8.9 needs demo mode to render the
 * reference's sample data with no backend at all. But a duplicated palette is a palette
 * that can silently disagree, so this test pins the 13 seeded ones to the seed file.
 * (`none` is the neutral theme and has no team row, so it is not seeded.)
 */
declare const __dirname: string;
declare function require(id: string): unknown;

const { readFileSync } = require('node:fs') as { readFileSync: (p: string, enc: string) => string };
const { join } = require('node:path') as { join: (...parts: string[]) => string };

type SeedRow = {
  provider: string;
  provider_team_id: string;
  abbr: string;
  team: string;
  fill_hex: string;
  on_fill_hex: string;
  primary_light_hex: string;
  secondary_light_hex: string;
  primary_dark_hex: string;
  secondary_dark_hex: string;
  source: string;
};

const raw = readFileSync(
  join(__dirname, '..', '..', '..', '..', '..', '..', 'seed', 'team_colors.json'),
  'utf8',
);
// The file is { _comment: string, teams: SeedRow[] }, so read `teams` explicitly rather
// than flattening every value — flattening spreads the comment string into characters.
const parsed = JSON.parse(raw) as { teams: SeedRow[] };
const rows: SeedRow[] = parsed.teams;

/** Which seed row each reference `.t-*` class corresponds to. */
const MAPPING: Record<string, { provider: string; team: string }> = {
  phi: { provider: 'mlb', team: 'Philadelphia Phillies' },
  nym: { provider: 'mlb', team: 'New York Mets' },
  lad: { provider: 'mlb', team: 'Los Angeles Dodgers' },
  sf: { provider: 'mlb', team: 'San Francisco Giants' },
  chc: { provider: 'mlb', team: 'Chicago Cubs' },
  bos: { provider: 'mlb', team: 'Boston Red Sox' },
  sd: { provider: 'mlb', team: 'San Diego Padres' },
  // NFL teams come from nflverse, so that is the provider on their rows.
  nyg: { provider: 'nflverse', team: 'New York Giants' },
  phl: { provider: 'nflverse', team: 'Philadelphia Eagles' },
  chi: { provider: 'nflverse', team: 'Chicago Bears' },
  gb: { provider: 'nflverse', team: 'Green Bay Packers' },
  lar: { provider: 'nflverse', team: 'Los Angeles Rams' },
  lv: { provider: 'nflverse', team: 'Las Vegas Raiders' },
};

const lower = (s: string) => s.toLowerCase();

describe('reference palettes agree with the seed data', () => {
  it('maps every reference class except the neutral theme', () => {
    const mapped = Object.keys(MAPPING).sort();
    const inTokens = Object.keys(REFERENCE_TEAMS)
      .filter((k) => k !== 'none')
      .sort();
    expect(mapped).toEqual(inTokens);
  });

  it('seeds exactly these 13 as source "reference"', () => {
    const seeded = rows.filter((r) => r.source === 'reference');
    expect(seeded).toHaveLength(13);
  });

  it.each(Object.keys(MAPPING))('%s matches its seed row', (key) => {
    const target = MAPPING[key];
    if (!target) throw new Error(`no mapping for ${key}`);
    const row = rows.find((r) => r.provider === target.provider && r.team === target.team);
    expect(row).toBeDefined();
    if (!row) return;

    expect(row.source).toBe('reference');

    const tokens = REFERENCE_TEAMS[key as keyof typeof REFERENCE_TEAMS];
    expect(lower(tokens.light.fill)).toBe(lower(row.fill_hex));
    expect(lower(tokens.light.onFill)).toBe(lower(row.on_fill_hex));
    expect(lower(tokens.light.accent)).toBe(lower(row.primary_light_hex));
    expect(lower(tokens.light.second)).toBe(lower(row.secondary_light_hex));
    expect(lower(tokens.dark.accent)).toBe(lower(row.primary_dark_hex));
    expect(lower(tokens.dark.second)).toBe(lower(row.secondary_dark_hex));
  });
});
