import { configure, render } from '@testing-library/react-native';
import React from 'react';

import { demoRepository } from '../demo';
import { emptyRepository } from '../empty';
import { RepositoryAvatar } from '../RepositoryAvatar';
import { personFromInputs, type PassportInputs } from '../supabase';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

// Avatars are hidden from accessibility: the name beside them is what gets read out.
configure({ defaultIncludeHiddenElements: true });

const ME = '11111111-1111-4111-8111-111111111111';
const ALEX = '22222222-2222-4222-8222-222222222222';

const inputs = {
  account: {
    handle: 'deanyao',
    displayName: 'Dean Yao',
    homeCity: null,
    avatarKey: ME,
    avatarPath: `${ME}/avatar-1.jpg`,
    favorites: [],
    followers: null,
    following: null,
    goals: null,
    wrapped: null,
  },
  companions: [
    {
      person_id: 'p-alex',
      display_name: 'Alex',
      linked_user_id: ALEX,
      linked_handle: 'alexk',
      linked_avatar_path: `${ALEX}/avatar-9.jpg`,
      games: 3,
      wins: 2,
      losses: 1,
      ties: 0,
    },
    { person_id: 'p-dad', display_name: 'Dad', games: 5, wins: 4, losses: 1, ties: 0 },
  ],
} as unknown as PassportInputs;

describe('personFromInputs', () => {
  it('resolves my own key to my account and my photo', () => {
    expect(personFromInputs(inputs, ME)).toEqual({
      userId: ME,
      name: 'Dean Yao',
      handle: 'deanyao',
      avatarPath: `${ME}/avatar-1.jpg`,
    });
  });

  it('resolves a linked companion to their account and their photo', () => {
    expect(personFromInputs(inputs, 'p-alex')).toEqual({
      userId: ALEX,
      name: 'Alex',
      handle: 'alexk',
      avatarPath: `${ALEX}/avatar-9.jpg`,
    });
  });

  it('gives a placeholder with no account a generated avatar seeded by their own id', () => {
    expect(personFromInputs(inputs, 'p-dad')).toEqual({
      userId: 'p-dad',
      name: 'Dad',
      handle: null,
      avatarPath: null,
    });
  });

  it('still treats an unknown key as a real person, never as fixture art', () => {
    expect(personFromInputs(inputs, 'p-unknown')).toEqual({
      userId: 'p-unknown',
      name: null,
      handle: null,
      avatarPath: null,
    });
  });
});

describe('RepositoryAvatar', () => {
  it('keeps the drawn faces in demo mode, so parity compares like with like', async () => {
    expect(demoRepository.person('maya')).toBeNull();
    const { queryByTestId } = await render(
      <RepositoryAvatar who="maya" person={demoRepository.person('maya')} size={38} />,
    );
    expect(queryByTestId('person-avatar-generated')).toBeNull();
    expect(queryByTestId('person-avatar-photo')).toBeNull();
  });

  it('draws a real person their own generated default', async () => {
    const { getByText, getByTestId } = await render(
      <RepositoryAvatar who="p-dad" person={personFromInputs(inputs, 'p-dad')} size={38} />,
    );
    expect(getByTestId('person-avatar-generated')).toBeTruthy();
    expect(getByText('D')).toBeTruthy();
  });

  it('never draws fixture art for a signed-in user whose data is still loading', () => {
    expect(emptyRepository.person('anyone')).not.toBeNull();
  });
});
