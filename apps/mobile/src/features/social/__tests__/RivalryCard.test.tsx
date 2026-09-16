import { render } from '@testing-library/react-native';
import React from 'react';

import { RivalryCard } from '../ui/RivalryCard';

describe('RivalryCard', () => {
  it('renders the rivalry label, head-to-head numbers, split, and meetings context', async () => {
    const screen = await render(
      <RivalryCard
        rivalry={{
          rival_handle: 'jordan',
          rival_display_name: 'Jordan',
          rival_teams: ['Dallas Cowboys'],
          my_wins: 5,
          rival_wins: 3,
          ties: 0,
          together_my_wins: 2,
          together_rival_wins: 1,
          my_meetings_attended: 9,
          rival_meetings_attended: 4,
        }}
      />,
    );
    expect(screen.getByText('Rivalry with Jordan, Dallas Cowboys fan')).toBeTruthy();
    expect(screen.getByText('5')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText('You')).toBeTruthy();
    expect(screen.getByText('Jordan')).toBeTruthy();
    expect(screen.getByText('2–1')).toBeTruthy();
    expect(screen.getByText('3–2')).toBeTruthy();
    expect(
      screen.getByText('Your teams’ meetings: you attended 9 games, Jordan attended 4 games.'),
    ).toBeTruthy();
  });

  it('says when there are no head-to-head games yet', async () => {
    const screen = await render(
      <RivalryCard
        rivalry={{
          rival_handle: 'sam',
          rival_display_name: null,
          rival_teams: [],
          my_wins: 0,
          rival_wins: 0,
          ties: 0,
          together_my_wins: 0,
          together_rival_wins: 0,
          my_meetings_attended: 1,
          rival_meetings_attended: 0,
        }}
      />,
    );
    expect(screen.getByText('Rivalry with @sam')).toBeTruthy();
    expect(screen.getByText('No head-to-head games yet')).toBeTruthy();
    expect(screen.queryByText('Together')).toBeNull();
  });
});
