import { SEAL_SLATE } from '@/components/reference/palettes';
import {
  sealLook,
  slateTint,
  teamForVenue,
  teamTint,
  type HomeTeam,
} from '@/features/passport/seals/look';
import { toWitnessedGame } from '@/features/passport/seals/witnessed';
import { REFERENCE_TEAMS } from '@/theme/reference/teams';

const team = (id: string, name: string, venue: string | null, active = true): HomeTeam => ({
  id,
  name,
  franchise_id: `f-${id}`,
  home_venue_id: venue,
  active,
});

const TEAMS: HomeTeam[] = [
  team('phi', 'Philadelphia Phillies', 'cbp'),
  team('nyj', 'New York Jets', 'metlife'),
  team('nyg', 'New York Giants', 'metlife'),
  team('lar', 'Los Angeles Rams', 'sofi'),
  team('lac', 'Los Angeles Chargers', 'sofi'),
  team('lv', 'Las Vegas Raiders', 'allegiant'),
  // A relocated franchise's old row: inactive, and it no longer plays anywhere.
  team('oak', 'Oakland Raiders', 'coliseum', false),
];

describe('teamForVenue', () => {
  it('is the team that plays there', () => {
    expect(teamForVenue('cbp', TEAMS, [])).toBe('phi');
    // Whoever the person follows, when none of them play here.
    expect(teamForVenue('cbp', TEAMS, [{ id: 'nyg' }])).toBe('phi');
  });

  it('is the first by name at a shared stadium with no favourite there', () => {
    expect(teamForVenue('metlife', TEAMS, [])).toBe('nyg');
    expect(teamForVenue('sofi', TEAMS, [{ id: 'phi' }])).toBe('lac');
  });

  it('is the favourite at a shared stadium, whichever way the names sort', () => {
    expect(teamForVenue('metlife', TEAMS, [{ id: 'nyj' }])).toBe('nyj');
    expect(teamForVenue('sofi', TEAMS, [{ id: 'phi' }, { id: 'lar' }])).toBe('lar');
    // Both favourites: back to the first by name, so it never flips between renders.
    expect(teamForVenue('metlife', TEAMS, [{ id: 'nyj' }, { id: 'nyg' }])).toBe('nyg');
  });

  it('matches a favourite by franchise, so an old row of a moved team still counts', () => {
    const teams = [...TEAMS, { ...team('xyz', 'Aardvarks', 'allegiant'), franchise_id: 'f-other' }];
    expect(teamForVenue('allegiant', teams, [])).toBe('xyz');
    expect(teamForVenue('allegiant', teams, [{ id: 'oak', franchise_id: 'f-lv' }])).toBe('lv');
  });

  it('is nobody at a closed park or a neutral site', () => {
    expect(teamForVenue('veterans-stadium', TEAMS, [{ id: 'phi' }])).toBeNull();
    // An inactive team does not make its old stadium current.
    expect(teamForVenue('coliseum', TEAMS, [{ id: 'oak' }])).toBeNull();
    expect(teamForVenue('cbp', [], [])).toBeNull();
  });
});

describe('sealLook', () => {
  const ON = { wornStamps: true, goldenStamps: true } as const;
  const OFF = { wornStamps: false, goldenStamps: false } as const;
  const phi = REFERENCE_TEAMS.phi;

  it('is the team colours, for the appearance in force', () => {
    const light = sealLook({
      teamId: 'phi',
      tokens: phi,
      scheme: 'light',
      visits: 2,
      golden: false,
      flags: ON,
    });
    expect(light).toEqual({
      metal: { fill: '#E81828', onFill: '#FFFFFF', second: '#002D72' },
      wear: 0,
      teamId: 'phi',
      golden: false,
    });
    expect(teamTint(phi, 'dark').second).toBe('#7F9DE8');
  });

  it('is slate with no team, and with a team whose palette has not loaded', () => {
    const closed = sealLook({
      teamId: null,
      tokens: null,
      scheme: 'dark',
      visits: 1,
      golden: false,
      flags: ON,
    });
    expect(closed.metal).toEqual(slateTint('dark'));
    expect(closed.metal).toEqual({
      fill: SEAL_SLATE.fill,
      onFill: SEAL_SLATE.onFill,
      second: SEAL_SLATE.second.dark,
    });
    const loading = sealLook({
      teamId: 'phi',
      tokens: undefined,
      scheme: 'light',
      visits: 1,
      golden: false,
      flags: ON,
    });
    expect(loading.metal).toEqual(slateTint('light'));
  });

  it('lets gold win over the team colour, with the wear still on top', () => {
    const look = sealLook({
      teamId: 'phi',
      tokens: phi,
      scheme: 'light',
      visits: 14,
      golden: true,
      flags: ON,
    });
    expect(look.metal).toBe('gold');
    expect(look.wear).toBe(2);
    expect(look.golden).toBe(true);
  });

  it('is simply team-coloured and crisp with both eggs off', () => {
    const look = sealLook({
      teamId: 'phi',
      tokens: phi,
      scheme: 'light',
      visits: 14,
      golden: true,
      flags: OFF,
    });
    expect(look.metal).toEqual(teamTint(phi, 'light'));
    expect(look.wear).toBe(0);
    expect(look.golden).toBe(false);
  });

  it('switches each egg by itself', () => {
    const input = { teamId: 'phi', tokens: phi, scheme: 'light' as const, visits: 7, golden: true };
    expect(sealLook({ ...input, flags: { wornStamps: true, goldenStamps: false } })).toMatchObject({
      metal: teamTint(phi, 'light'),
      wear: 1,
    });
    expect(sealLook({ ...input, flags: { wornStamps: false, goldenStamps: true } })).toMatchObject({
      metal: 'gold',
      wear: 0,
    });
  });
});

describe('toWitnessedGame', () => {
  const row = (rooting: string | null, home: number, away: number) => ({
    rooting_team_id: rooting,
    game: {
      id: 'g1',
      sport_id: 'nfl',
      venue_id: 'linc',
      status: 'final',
      home_team_id: 'phl',
      away_team_id: 'dal',
      home_score: home,
      away_score: away,
      events: [{ type: 'overtime' }],
    },
  });

  it('works out how the game went for the side the person was pulling for', () => {
    expect(toWitnessedGame(row('phl', 26, 20))).toEqual({
      sport: 'nfl',
      venueId: 'linc',
      eventTypes: ['overtime'],
      result: 'win',
    });
    expect(toWitnessedGame(row('dal', 26, 20)).result).toBe('loss');
    expect(toWitnessedGame(row('phl', 20, 20)).result).toBe('tie');
  });

  it('has no result for a neutral', () => {
    expect(toWitnessedGame(row(null, 26, 20)).result).toBeNull();
  });
});
