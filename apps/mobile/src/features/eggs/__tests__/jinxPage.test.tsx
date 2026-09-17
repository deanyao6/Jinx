import { configure } from '@testing-library/react-native';
import React from 'react';

import PersonScreen from '@/app/friends/person/[id]';
import { renderScreen } from '@/test/renderScreen';

configure({ defaultIncludeHiddenElements: true });

const mockId = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({ id: mockId() }),
  Stack: { Screen: () => null },
}));

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

jest.mock('@/features/people/queries', () => {
  const person = (person_id: string, display_name: string, wins: number, losses: number) => ({
    person_id,
    display_name,
    linked_user_id: null,
    linked_handle: null,
    linked_avatar_path: null,
    games: wins + losses,
    wins,
    losses,
    ties: 0,
    last_game: null,
  });
  const records = [
    person('p-dad', 'Dad', 7, 1),
    person('p-maya', 'Maya Chen', 4, 2),
    person('p-jordan', 'Jordan Ellis', 0, 4),
    person('p-sam', 'Sam', 1, 3),
  ];
  const idle = { mutate: jest.fn(), mutateAsync: jest.fn(), isPending: false, error: null };
  return {
    useCompanionRecords: () => ({ data: records, isPending: false, isError: false }),
    useCompanionGames: () => ({ data: [], isPending: false, isError: false }),
    useCreatePersonInvite: () => idle,
    useDeletePerson: () => idle,
    useRenamePerson: () => idle,
  };
});

describe('the certified jinx on the companion page', () => {
  it('says so in one line, with the record, and puts the cat on the avatar', async () => {
    mockId.mockReturnValue('p-jordan');
    const { getByText, getByTestId } = await renderScreen(<PersonScreen />);
    expect(getByText('Certified jinx. You are 0–4 together.')).toBeTruthy();
    expect(getByTestId('jinx-badge')).toBeTruthy();
  });

  it('gives the best companion the quieter line and no cat', async () => {
    mockId.mockReturnValue('p-dad');
    const { getByText, queryByTestId } = await renderScreen(<PersonScreen />);
    expect(getByText('Good luck charm. You are 7–1 together.')).toBeTruthy();
    expect(queryByTestId('jinx-badge')).toBeNull();
  });

  it('says nothing about anybody else: only one jinx at a time', async () => {
    // Sam is 1–3, which qualifies, but Jordan is worse.
    mockId.mockReturnValue('p-sam');
    const { queryByTestId, queryByText } = await renderScreen(<PersonScreen />);
    expect(queryByTestId('luck-jinx')).toBeNull();
    expect(queryByTestId('jinx-badge')).toBeNull();
    expect(queryByText(/Certified jinx/)).toBeNull();
  });
});
