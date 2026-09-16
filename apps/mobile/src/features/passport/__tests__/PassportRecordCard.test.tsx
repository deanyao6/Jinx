import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

import { parseStats } from '../format';
import { PassportRecordCard } from '../ui/PassportRecordCard';

const stats = parseStats({
  overall: { wins: 31, losses: 17, ties: 0 },
  teams: [
    {
      franchise_id: 'mlb-143',
      team_id: 't1',
      name: 'Philadelphia Phillies',
      abbreviation: 'PHI',
      sport_id: 'mlb',
      record: { wins: 12, losses: 5, ties: 0 },
    },
    {
      franchise_id: 'nfl-phi',
      team_id: 't2',
      name: 'Philadelphia Eagles',
      abbreviation: 'PHI',
      sport_id: 'nfl',
      record: { wins: 6, losses: 2, ties: 1 },
    },
  ],
  pledge: { record: { wins: 10, losses: 9, ties: 0 }, vs_expected: 2.4 },
});

describe('PassportRecordCard', () => {
  it('renders the overall record, win rate, team tiles and the pledge tile', async () => {
    const onPledgeInfo = jest.fn();
    const { getByText, getByLabelText } = await render(
      <PassportRecordCard
        overall={stats.overall}
        teams={stats.teams}
        pledge={stats.pledge}
        onPledgeInfo={onPledgeInfo}
      />,
    );
    expect(getByText('All-time record at games')).toBeTruthy();
    expect(getByText('31')).toBeTruthy();
    expect(getByText('17')).toBeTruthy();
    expect(getByText('.646')).toBeTruthy();
    expect(getByText('12–5')).toBeTruthy();
    expect(getByText('Philadelphia Phillies')).toBeTruthy();
    expect(getByText('6–2–1')).toBeTruthy();
    expect(getByText('10–9')).toBeTruthy();
    expect(getByText('Pledged, +2.4 vs expected')).toBeTruthy();
    fireEvent.press(getByLabelText('Pledge record. Tap to learn about vs expected'));
    expect(onPledgeInfo).toHaveBeenCalledTimes(1);
  });

  it('shows an empty pledge tile before any pledges', async () => {
    const { getByText } = await render(
      <PassportRecordCard overall={stats.overall} teams={[]} pledge={parseStats({}).pledge} />,
    );
    expect(getByText('0–0')).toBeTruthy();
    expect(getByText('Pledged, none yet')).toBeTruthy();
  });
});
