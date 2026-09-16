import { render } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';

import { toTeamTokens } from '@/features/teams/palettes';

import {
  ReferenceThemeProvider,
  TeamPaletteProvider,
  TeamTheme,
  useReferenceTheme,
} from '../TeamTheme';
import { REFERENCE_TEAMS, type TeamTokens } from '../teams';

function Probe() {
  const { team } = useReferenceTheme();
  return <Text>{`${team.fill}|${team.accent}|${team.second}|${team.onFill}`}</Text>;
}

/** A team that is NOT one of the 14 the reference defines. */
const BREWERS_ID = '11111111-1111-4111-8111-111111111111';
const BREWERS: TeamTokens = toTeamTokens({
  team_id: BREWERS_ID,
  fill_hex: '#12284B',
  on_fill_hex: '#FFFFFF',
  primary_light_hex: '#12284B',
  secondary_light_hex: '#FFC52F',
  primary_dark_hex: '#FFC52F',
  secondary_dark_hex: '#C7D2E3',
});

const loaded = new Map<string, TeamTokens>([[BREWERS_ID, BREWERS]]);

describe('team palettes from the database', () => {
  it('themes a team that is not one of the reference 14', async () => {
    const { getByText } = await render(
      <TeamPaletteProvider palettes={loaded}>
        <ReferenceThemeProvider team={BREWERS_ID} scheme="light">
          <Probe />
        </ReferenceThemeProvider>
      </TeamPaletteProvider>,
    );
    getByText('#12284B|#12284B|#FFC52F|#FFFFFF');
  });

  it('uses the stored dark accent rather than deriving one', async () => {
    const { getByText } = await render(
      <TeamPaletteProvider palettes={loaded}>
        <ReferenceThemeProvider team={BREWERS_ID} scheme="dark">
          <Probe />
        </ReferenceThemeProvider>
      </TeamPaletteProvider>,
    );
    // The fill is the same in both themes; only the accent and secondary change.
    getByText('#12284B|#FFC52F|#C7D2E3|#FFFFFF');
  });

  it('falls back to the static palettes before the query resolves', async () => {
    const { getByText } = await render(
      <TeamPaletteProvider palettes={undefined}>
        <ReferenceThemeProvider team="phi" scheme="light">
          <Probe />
        </ReferenceThemeProvider>
      </TeamPaletteProvider>,
    );
    const phi = REFERENCE_TEAMS.phi.light;
    getByText(`${phi.fill}|${phi.accent}|${phi.second}|${phi.onFill}`);
  });

  it('falls back to neutral for a team it has never heard of', async () => {
    const { getByText } = await render(
      <TeamPaletteProvider palettes={loaded}>
        <ReferenceThemeProvider team="not-a-team" scheme="light">
          <Probe />
        </ReferenceThemeProvider>
      </TeamPaletteProvider>,
    );
    const none = REFERENCE_TEAMS.none.light;
    getByText(`${none.fill}|${none.accent}|${none.second}|${none.onFill}`);
  });

  it('reaches loaded palettes from a nested TeamTheme too', async () => {
    const { getByText } = await render(
      <TeamPaletteProvider palettes={loaded}>
        <ReferenceThemeProvider team="phi" scheme="light">
          <TeamTheme team={BREWERS_ID}>
            <Probe />
          </TeamTheme>
        </ReferenceThemeProvider>
      </TeamPaletteProvider>,
    );
    getByText('#12284B|#12284B|#FFC52F|#FFFFFF');
  });

  it('works with no provider at all, which is demo mode', async () => {
    const { getByText } = await render(
      <ReferenceThemeProvider team="lad" scheme="dark">
        <Probe />
      </ReferenceThemeProvider>,
    );
    const lad = REFERENCE_TEAMS.lad.dark;
    getByText(`${lad.fill}|${lad.accent}|${lad.second}|${lad.onFill}`);
  });
});
