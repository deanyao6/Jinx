import { fireEvent, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Linking } from 'react-native';

import { renderScreen } from '@/test/renderScreen';

import { ReliveScreen } from '../ReliveScreen';

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: () => true,
  }),
}));

const mockAttendance: { id: string | undefined } = { id: 'att-1' };
jest.mock('../../useReliveGame', () => ({
  useReliveGame: () => ({
    relive: {
      away: { team: 'none', badge: 'CHI', name: 'Bears' },
      home: { team: 'none', badge: 'PHI', name: 'Eagles' },
      note: 'Nov 28, 2025, Lincoln Financial Field',
      idleHint: 'Tap play to relive it',
      chartLabels: { left: 'Kickoff', middle: 'Halftime', right: 'Final' },
      fanCount: '',
    },
    steps: [
      { label: 'Pregame', text: 'Eagles were 70% to win.', away: 0, home: 0, wp: 0 },
      { label: 'Final', text: 'Bears win 24–15.', away: 24, home: 15, wp: 1 },
    ],
    winProb: [0.7, 0.1],
    attendanceId: mockAttendance.id,
    highlights: {
      url: 'https://www.nfl.com/games/bears-at-eagles-2025-reg-13',
      meta: 'Opens on NFL.com',
    },
    isPending: false,
  }),
}));

const mockPick = jest.fn();
const mockUpload = jest.fn();
const mockPhotos = {
  mine: [
    {
      id: 'p1',
      userId: 'me',
      kind: 'photo',
      visibility: 'followers',
      storagePath: 'me/a/1.jpg',
      url: 'https://signed/1',
    },
  ],
  fans: [
    {
      id: 'f1',
      userId: 'fan',
      kind: 'photo',
      visibility: null,
      storagePath: 'fan/a/1.jpg',
      url: 'https://signed/f1',
    },
    {
      id: 'f2',
      userId: 'fan',
      kind: 'video',
      visibility: null,
      storagePath: 'fan/a/2.mp4',
      url: 'https://signed/f2',
    },
  ],
};
jest.mock('../../photos', () => ({
  ...jest.requireActual('../../photos'),
  pickMedia: () => mockPick(),
  useGamePhotos: () => ({ data: mockPhotos, isError: false }),
  useAddPhotos: () => ({ mutateAsync: mockUpload, isPending: false }),
  useSetPhotoVisibility: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useDeletePhoto: () => ({ mutateAsync: jest.fn(), isPending: false }),
}));
jest.mock('@/features/social/queries', () => ({
  ...jest.requireActual('@/features/social/queries'),
  REPORT_REASONS: ['Spam or scam'],
  useReport: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useBlock: () => ({ mutateAsync: jest.fn(), isPending: false }),
}));

describe('Relive for a real game', () => {
  beforeEach(() => {
    mockAttendance.id = 'att-1';
    mockPick.mockReset();
    mockUpload.mockReset().mockResolvedValue({ uploaded: 1, problems: [] });
    jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  });
  afterEach(() => jest.restoreAllMocks());

  it('uploads what was picked', async () => {
    const picked = [{ uri: 'file:///a.jpg', mimeType: 'image/jpeg', kind: 'photo', bytes: 10 }];
    mockPick.mockResolvedValue(picked);
    const { getByLabelText } = await renderScreen(<ReliveScreen gameId="g1" />);
    await fireEvent.press(getByLabelText('Add a photo from your library'));
    await waitFor(() => expect(mockUpload).toHaveBeenCalledWith(picked));
  });

  it('uploads nothing when the picker is cancelled', async () => {
    mockPick.mockResolvedValue([]);
    const { getByLabelText } = await renderScreen(<ReliveScreen gameId="g1" />);
    await fireEvent.press(getByLabelText('Add a photo'));
    await waitFor(() => expect(mockPick).toHaveBeenCalled());
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it('says why when part of an upload is refused', async () => {
    mockPick.mockResolvedValue([{ uri: 'x', mimeType: 'image/gif', kind: 'photo', bytes: 1 }]);
    mockUpload.mockResolvedValue({ uploaded: 0, problems: ['That file type is not supported.'] });
    const { getByLabelText, findByText } = await renderScreen(<ReliveScreen gameId="g1" />);
    await fireEvent.press(getByLabelText('Add a photo'));
    expect(await findByText('That file type is not supported.')).toBeTruthy();
  });

  it('shows other fans and counts them in the header', async () => {
    const { getByText, getAllByLabelText } = await renderScreen(<ReliveScreen gameId="g1" />);
    expect(getByText('From fans at this game')).toBeTruthy();
    expect(getByText('2 photos')).toBeTruthy();
    expect(getAllByLabelText('Open photo')).toHaveLength(2);
    expect(getAllByLabelText('Open video')).toHaveLength(1);
  });

  it('lets the owner choose who sees their photo', async () => {
    const { getAllByLabelText, findByLabelText } = await renderScreen(<ReliveScreen gameId="g1" />);
    await fireEvent.press(getAllByLabelText('Open photo')[0]!);
    const followers = await findByLabelText('Your followers');
    expect(followers.props.accessibilityState).toMatchObject({ selected: true });
    expect(await findByLabelText('Delete')).toBeTruthy();
  });

  it('gives a fan photo report and block, not the owner controls', async () => {
    const { getAllByLabelText, findByLabelText, queryByLabelText } = await renderScreen(
      <ReliveScreen gameId="g1" />,
    );
    await fireEvent.press(getAllByLabelText('Open photo')[1]!);
    expect(await findByLabelText('Report this')).toBeTruthy();
    expect(await findByLabelText('Block this person')).toBeTruthy();
    expect(queryByLabelText('Delete')).toBeNull();
  });

  it("opens this game's own page on its own league's site", async () => {
    const { getByLabelText, getByText } = await renderScreen(<ReliveScreen gameId="g1" />);
    expect(getByText('Opens on NFL.com')).toBeTruthy();
    await fireEvent.press(getByLabelText('Official highlights. Opens on NFL.com'));
    expect(Linking.openURL).toHaveBeenCalledWith(
      'https://www.nfl.com/games/bears-at-eagles-2025-reg-13',
    );
  });
});
