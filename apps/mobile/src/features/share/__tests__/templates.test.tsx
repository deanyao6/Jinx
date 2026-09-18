import { render } from '@testing-library/react-native';
import React from 'react';

import { parseStats } from '@/features/passport/format';
import { ShareCard } from '../ShareCard';
import { templateTitle } from '../templates';
import {
  parseShareTemplate,
  type ShareGame,
  type ShareHandshake,
  type ShareRecord,
} from '../types';

// The handshake card draws two real people, and a PersonAvatar imports the client.
jest.mock('@/lib/supabase', () => ({ supabase: {} }));

const stats = parseStats({
  totals: { games: 48, venues: 14, states: 3, countries: 1 },
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
  ],
  pledge: { record: { wins: 10, losses: 9, ties: 0 }, vs_expected: 2.4 },
});

const record: ShareRecord = {
  kind: 'record',
  overall: stats.overall,
  teams: stats.teams.map((t) => ({ name: t.name, record: t.record })),
  pledge: stats.pledge,
  totals: stats.totals,
};

const game: ShareGame = {
  kind: 'game',
  sport: 'mlb',
  away: 'New York Mets',
  home: 'Philadelphia Phillies',
  awayScore: 2,
  homeScore: 5,
  status: 'final',
  venue: 'Citizens Bank Park, Philadelphia',
  date: '2026-08-14T23:05:00Z',
  side: 'Philadelphia Phillies',
  result: 'win',
  verified: true,
};

describe('ShareCard', () => {
  it('renders the passport record template with the app name and handle', async () => {
    const { getByText, getByLabelText } = await render(
      <ShareCard template={record} handle="dean" scheme="light" />,
    );
    expect(getByText('Jinx')).toBeTruthy();
    expect(getByText('@dean')).toBeTruthy();
    expect(getByText('31–17')).toBeTruthy();
    expect(getByText('12–5')).toBeTruthy();
    expect(getByText('Philadelphia Phillies')).toBeTruthy();
    expect(getByText('Pledged, +2.4 vs expected')).toBeTruthy();
    expect(getByText(/48 games, 14 venues, 3 states/)).toBeTruthy();
    expect(getByLabelText('Share card, light')).toBeTruthy();
  });

  it('renders the single game template in dark with score, venue, side and the verified badge', async () => {
    const { getByText, getByLabelText } = await render(
      <ShareCard template={game} handle="dean" scheme="dark" />,
    );
    expect(getByLabelText('Share card, dark')).toBeTruthy();
    expect(getByText('New York Mets')).toBeTruthy();
    expect(getByText('Philadelphia Phillies')).toBeTruthy();
    expect(getByText('5')).toBeTruthy();
    expect(getByText('2')).toBeTruthy();
    expect(getByText('Citizens Bank Park, Philadelphia')).toBeTruthy();
    expect(getByText('Rooting for the Philadelphia Phillies, win')).toBeTruthy();
    expect(getByText('Verified there')).toBeTruthy();
    expect(getByText('@dean')).toBeTruthy();
  });

  it('renders the secret handshake card: both people, the matchup, the stadium', async () => {
    const handshake: ShareHandshake = {
      kind: 'handshake',
      team: null,
      me: { id: 'u1', name: 'Dean Yao', handle: 'dean', avatarPath: null },
      them: { id: 'u2', name: 'Maya Chen', handle: 'maya', avatarPath: null },
      away: 'New York Mets',
      home: 'Philadelphia Phillies',
      venue: 'Citizens Bank Park',
      date: '2026-08-14T23:05:00Z',
    };
    const { getByText, getByTestId } = await render(
      <ShareCard template={handshake} handle="dean" scheme="light" />,
    );
    expect(getByTestId('we-were-there-card')).toBeTruthy();
    expect(getByText('We were there')).toBeTruthy();
    expect(getByText('Dean & Maya')).toBeTruthy();
    expect(getByText('New York Mets at Philadelphia Phillies')).toBeTruthy();
    expect(getByText(/Citizens Bank Park/)).toBeTruthy();
    expect(templateTitle(handshake)).toBe('We were there, New York Mets at Philadelphia Phillies');
    expect(parseShareTemplate('handshake', JSON.stringify(handshake))).toEqual(handshake);
  });

  it('round-trips a template through the route params', () => {
    const payload = JSON.stringify(game);
    expect(parseShareTemplate('game', payload)).toEqual(game);
    expect(parseShareTemplate('record', payload)).toBeNull();
    expect(parseShareTemplate('game', '{not json')).toBeNull();
    expect(parseShareTemplate('nope', payload)).toBeNull();
  });
});
