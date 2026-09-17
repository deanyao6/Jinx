import React from 'react';
import { render } from '@testing-library/react-native';

import { VenueSeal } from '@/features/passport/seals';
import { REFERENCE_TEAMS } from '@/theme/reference/teams';

const mockSeal = jest.fn((_props: Record<string, unknown>) => null);
jest.mock('@/components/reference/Seal', () => ({
  Seal: (props: Record<string, unknown>) => mockSeal(props),
}));

const mockData = {
  palettes: new Map([
    ['nyg', REFERENCE_TEAMS.nyg],
    ['phi', REFERENCE_TEAMS.phi],
  ]),
  homeTeams: [
    {
      id: 'nyg',
      name: 'New York Giants',
      franchise_id: 'f-nyg',
      home_venue_id: 'metlife',
      active: true,
    },
    {
      id: 'nyj',
      name: 'New York Jets',
      franchise_id: 'f-nyj',
      home_venue_id: 'metlife',
      active: true,
    },
    {
      id: 'phi',
      name: 'Philadelphia Phillies',
      franchise_id: 'f-phi',
      home_venue_id: 'cbp',
      active: true,
    },
  ],
  favourites: [{ id: 'phi', franchise_id: 'f-phi' }],
  stamps: [
    { venue_id: 'cbp', visits: 12 },
    { venue_id: 'metlife', visits: 1 },
  ],
  rare: [{ sport: 'nfl', venueId: 'metlife', eventTypes: ['walk_off_score'], result: 'loss' }],
};

jest.mock('@/features/teams/queries', () => ({
  useTeamPalettes: () => ({ data: mockData.palettes }),
}));
jest.mock('@/features/profile/queries', () => ({
  useFavoriteTeams: () => ({ data: mockData.favourites }),
}));
jest.mock('@/features/passport/queries', () => ({
  useMyStats: () => ({ data: { stamps: mockData.stamps } }),
}));
jest.mock('@/features/passport/seals/queries', () => ({
  useVenueHomeTeams: () => ({ data: mockData.homeTeams }),
  useWitnessedRareGames: () => ({ data: mockData.rare }),
}));

const last = () => mockSeal.mock.calls[mockSeal.mock.calls.length - 1]?.[0] ?? {};

describe('VenueSeal', () => {
  beforeEach(() => mockSeal.mockClear());

  it('strikes a stadium in its team colours, worn by the visits in the stats payload', async () => {
    await render(
      <VenueSeal venueId="cbp" ring="CITIZENS BANK PARK" shapeKey="ballparkA" inkColor="#101318" />,
    );
    expect(last()).toMatchObject({
      metal: { fill: '#E81828', onFill: '#FFFFFF', second: '#002D72' },
      wear: 2,
      seed: 'cbp',
      ring: 'CITIZENS BANK PARK',
    });
  });

  it('takes the caller visits over the payload, and the pinned appearance over the system', async () => {
    await render(
      <VenueSeal
        venueId="cbp"
        ring=""
        shapeKey="ballparkA"
        inkColor="#FFFFFF"
        visits={6}
        scheme="dark"
      />,
    );
    expect(last()).toMatchObject({ metal: { second: '#7F9DE8' }, wear: 1 });
  });

  it('is gold where something rare was seen, and slate where nobody plays', async () => {
    await render(<VenueSeal venueId="metlife" ring="METLIFE" shapeKey="bowl" inkColor="#101318" />);
    expect(last()).toMatchObject({ metal: 'gold', wear: 0, still: false });

    await render(<VenueSeal venueId="the-vet" ring="THE VET" shapeKey="bowl" inkColor="#101318" />);
    expect(last()).toMatchObject({ metal: { fill: '#2E3641' }, wear: 0 });
  });

  it('holds the glint still on a seal too small to carry it', async () => {
    await render(
      <VenueSeal venueId="metlife" ring="" shapeKey="bowl" size={34} inkColor="#101318" />,
    );
    expect(last()).toMatchObject({ metal: 'gold', still: true });
  });
});
