import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

import { PledgeSides } from '../PledgeSides';

const away = { team_id: 'gb', name: 'Green Bay Packers', win_prob: 0.62 };
const home = { team_id: 'chi', name: 'Chicago Bears', win_prob: 0.38 };

describe('PledgeSides', () => {
  it('shows both teams with win probability and labels the underdog', async () => {
    const { getByText, getByLabelText } = await render(
      <PledgeSides away={away} home={home} selectedTeamId={null} onPick={() => {}} />,
    );
    expect(getByText('Green Bay Packers')).toBeTruthy();
    expect(getByText('Chicago Bears')).toBeTruthy();
    expect(getByText('62%')).toBeTruthy();
    expect(getByText('38%')).toBeTruthy();
    expect(getByText('Underdog')).toBeTruthy();
    expect(getByText('Favorite')).toBeTruthy();
    expect(getByLabelText('Chicago Bears, 38% to win, underdog')).toBeTruthy();
  });

  it('reports the tapped team and marks the selected one', async () => {
    const onPick = jest.fn();
    const { getByLabelText } = await render(
      <PledgeSides away={away} home={home} selectedTeamId="gb" onPick={onPick} />,
    );
    fireEvent.press(getByLabelText('Chicago Bears, 38% to win, underdog'));
    expect(onPick).toHaveBeenCalledWith('chi');
    expect(
      getByLabelText('Green Bay Packers, 62% to win, favorite').props.accessibilityState.selected,
    ).toBe(true);
  });

  it('ignores taps once locked', async () => {
    const onPick = jest.fn();
    const { getByLabelText } = await render(
      <PledgeSides away={away} home={home} selectedTeamId={null} disabled onPick={onPick} />,
    );
    fireEvent.press(getByLabelText('Chicago Bears, 38% to win, underdog'));
    expect(onPick).not.toHaveBeenCalled();
  });
});
