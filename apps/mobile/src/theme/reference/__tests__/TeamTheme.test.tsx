import React from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';

import { ReferenceThemeProvider, TeamTheme, useReferenceTheme } from '../TeamTheme';
import { REFERENCE_TEAMS } from '../teams';
import { darkBase, lightBase } from '../tokens';

function Probe() {
  const { team, base, teamKey, scheme } = useReferenceTheme();
  return <Text>{`${teamKey}|${scheme}|${team.accent}|${team.fill}|${base.ink}`}</Text>;
}

describe('TeamTheme', () => {
  it('defaults to the neutral theme', async () => {
    const { getByText } = await render(
      <ReferenceThemeProvider scheme="light">
        <Probe />
      </ReferenceThemeProvider>,
    );
    expect(
      getByText(
        `none|light|${REFERENCE_TEAMS.none.light.accent}|${REFERENCE_TEAMS.none.light.fill}|${lightBase.ink}`,
      ),
    ).toBeTruthy();
  });

  it('resolves the team palette for the current scheme', async () => {
    const { getByText } = await render(
      <ReferenceThemeProvider team="phi" scheme="dark">
        <Probe />
      </ReferenceThemeProvider>,
    );
    expect(
      getByText(
        `phi|dark|${REFERENCE_TEAMS.phi.dark.accent}|${REFERENCE_TEAMS.phi.light.fill}|${darkBase.ink}`,
      ),
    ).toBeTruthy();
  });

  it('lets a subtree take on another team, the way a nested .t-* class does', async () => {
    const { getByText } = await render(
      <ReferenceThemeProvider team="phi" scheme="light">
        <TeamTheme team="lad">
          <Probe />
        </TeamTheme>
      </ReferenceThemeProvider>,
    );
    expect(
      getByText(
        `lad|light|${REFERENCE_TEAMS.lad.light.accent}|${REFERENCE_TEAMS.lad.light.fill}|${lightBase.ink}`,
      ),
    ).toBeTruthy();
  });

  it('keeps the scheme when only the team changes', async () => {
    const { getByText } = await render(
      <ReferenceThemeProvider team="phi" scheme="dark">
        <TeamTheme team="gb">
          <Probe />
        </TeamTheme>
      </ReferenceThemeProvider>,
    );
    expect(
      getByText(
        `gb|dark|${REFERENCE_TEAMS.gb.dark.accent}|${REFERENCE_TEAMS.gb.light.fill}|${darkBase.ink}`,
      ),
    ).toBeTruthy();
  });

  it('falls back to neutral for an unknown team rather than crashing a screen', async () => {
    const { getByText } = await render(
      <ReferenceThemeProvider team="not-a-team" scheme="light">
        <Probe />
      </ReferenceThemeProvider>,
    );
    expect(
      getByText(
        `not-a-team|light|${REFERENCE_TEAMS.none.light.accent}|${REFERENCE_TEAMS.none.light.fill}|${lightBase.ink}`,
      ),
    ).toBeTruthy();
  });
});
