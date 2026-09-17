import React from 'react';

import { demoRepository } from '@/features/data/demo';
import { friendsFromRecords } from '@/features/data/supabase';
import type { Repository } from '@/features/data/types';
import { FriendsPanel } from '@/features/profile/reference/FriendsPanel';
import { renderScreen } from '@/test/renderScreen';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}));

const companions = [
  { person_id: 'p1', display_name: 'Dad', games: 11, wins: 7, losses: 1, ties: 0 },
  { person_id: 'p2', display_name: 'Maya Chen', games: 6, wins: 4, losses: 2, ties: 0 },
  { person_id: 'p4', display_name: 'Jordan Ellis', games: 4, wins: 0, losses: 4, ties: 0 },
];

/** The demo account with a real person's companion records in place of the fixture's. */
const live: Repository = {
  ...demoRepository,
  friends: () => friendsFromRecords(companions, [], []),
  person: () => null,
};

describe('the certified jinx on the Friends panel', () => {
  it('puts the cat and the line on the one jinx, and the quiet line on the charm', async () => {
    const { getAllByTestId, getByText, getByLabelText } = await renderScreen(<FriendsPanel />, {
      repository: live,
    });
    // The cat is decoration: the row's label says it, so the badge is hidden from a screen reader.
    expect(getAllByTestId('jinx-badge', { includeHiddenElements: true })).toHaveLength(1);
    expect(getByText('Certified jinx')).toBeTruthy();
    expect(getByText('Good luck charm')).toBeTruthy();
    expect(getByLabelText('Jordan Ellis, Certified jinx, 4 games together')).toBeTruthy();
    expect(getByLabelText('Dad, Good luck charm, 11 games together')).toBeTruthy();
  });

  // The fixture never carries the mark, and a repository that did is still ignored.
  it.each([
    ['the fixture account', demoRepository],
    ['a repository that carries the marks', live],
  ])('is inert in demo mode, where Jordan is 0–4: %s', async (_name, repository) => {
    const { queryByTestId, queryByText } = await renderScreen(<FriendsPanel />, {
      repository,
      status: 'demo',
    });
    expect(queryByTestId('jinx-badge', { includeHiddenElements: true })).toBeNull();
    expect(queryByText('Certified jinx')).toBeNull();
    expect(queryByText('Good luck charm')).toBeNull();
  });
});
