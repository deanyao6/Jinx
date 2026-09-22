import { fireEvent } from '@testing-library/react-native';
import React from 'react';

import { renderScreen } from '@/test/renderScreen';
import { FamousCard } from '../ui/FamousCard';

describe('FamousCard on a game page', () => {
  it('shows nothing for an ordinary game', async () => {
    const { queryByTestId } = await renderScreen(
      <FamousCard items={[]} sportId="nfl" homeTeamId={null} />,
    );
    expect(queryByTestId('famous-card')).toBeNull();
  });

  it('shows a famous game’s category, title and story', async () => {
    const { getByText } = await renderScreen(
      <FamousCard
        sportId="nfl"
        homeTeamId={null}
        items={[
          {
            gameId: 'g',
            source: 'schedule',
            category: 'championship',
            kind: 'schedule',
            title: 'Super Bowl LIX',
            story: 'The Eagles beat the Chiefs 40–22 to win Super Bowl LIX.',
            personal: false,
            playerName: null,
            teamId: null,
            teamNickname: null,
            sportId: '',
          },
        ]}
      />,
    );
    expect(getByText('Championship')).toBeTruthy();
    expect(getByText('Super Bowl LIX')).toBeTruthy();
    expect(getByText('The Eagles beat the Chiefs 40–22 to win Super Bowl LIX.')).toBeTruthy();
  });

  it('marks a personal badge as yours and explains it only when tapped', async () => {
    const { getByText, queryByText, getByRole, findByText } = await renderScreen(
      <FamousCard
        sportId="mlb"
        homeTeamId={null}
        items={[
          {
            gameId: 'g',
            source: 'personal',
            category: 'debut',
            kind: 'first_days',
            title: '',
            story: '',
            personal: true,
            playerName: 'Jhoan Duran',
            teamId: null,
            teamNickname: 'Phillies',
            sportId: '',
          },
        ]}
      />,
    );
    expect(getByText('Yours')).toBeTruthy();
    expect(getByText('Saw Jhoan Duran’s first days as a Phillie')).toBeTruthy();
    expect(queryByText(/within 14 days/)).toBeNull();
    fireEvent.press(getByRole('button'));
    expect(await findByText(/within 14 days/)).toBeTruthy();
  });
});
