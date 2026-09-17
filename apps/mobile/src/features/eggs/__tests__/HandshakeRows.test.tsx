import { configure, fireEvent, waitFor } from '@testing-library/react-native';
import React from 'react';

import { useAuthStore } from '@/features/auth/store';
import { AlsoThere } from '@/features/social/ui/AlsoThere';
import { renderScreen } from '@/test/renderScreen';

const ME = '11111111-1111-4111-8111-111111111111';
const MAYA = '22222222-2222-4222-8222-222222222222';
const SAM = '33333333-3333-4333-8333-333333333333';
const GAME = 'game-1';

// Avatars are hidden from accessibility, and the queries skip hidden elements otherwise.
configure({ defaultIncludeHiddenElements: true });

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
  useIsFocused: () => true,
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light' },
}));

/** Every RPC the card makes, by name. Each test decides what the server says. */
const mockRpc = jest.fn();
jest.mock('@/lib/supabase', () => ({
  supabase: { rpc: (...a: unknown[]) => mockRpc(...a) },
}));

/**
 * Whether eggs may run (`useEggsLive`: not the demo build, status or repository). Mocked because
 * the real one reads the whole signed-in repository, which is a dozen queries this card does not
 * make; its own rule is tested where it lives.
 */
const mockLive = jest.fn();
jest.mock('@/features/eggs/runtime', () => ({
  ...jest.requireActual('@/features/eggs/runtime'),
  useEggsLive: () => mockLive(),
}));

const mockContext = jest.fn();
jest.mock('@/features/checkin/queries', () => ({
  useGameContext: () => mockContext(),
}));

jest.mock('@/features/profile/queries', () => ({
  useProfile: () => ({
    data: { id: ME, handle: 'dean', display_name: 'Dean Yao', avatar_path: null },
  }),
}));

const HOUR = 3_600_000;
const context = (over: Record<string, unknown> = {}) => ({
  data: {
    game_id: GAME,
    scheduled_start: new Date(Date.now() - HOUR).toISOString(),
    final_at: null,
    checked_in_at: new Date().toISOString(),
    home: { team_id: 'phi', name: 'Philadelphia Phillies' },
    away: { team_id: 'nym', name: 'New York Mets' },
    venue: { name: 'Citizens Bank Park' },
    attendance: { rooting_team_id: 'phi' },
    ...over,
  },
});

type Server = {
  candidates?: unknown[];
  mine?: unknown[];
  offer?: unknown;
};

function serve(server: Server) {
  mockRpc.mockImplementation((name: string) => {
    const data =
      name === 'mutuals_at_game'
        ? [
            { user_id: MAYA, handle: 'maya', display_name: 'Maya Chen' },
            { user_id: SAM, handle: 'sam', display_name: 'Sam' },
          ]
        : name === 'my_tags_at_game'
          ? []
          : name === 'handshake_candidates'
            ? (server.candidates ?? [])
            : name === 'my_handshakes'
              ? (server.mine ?? [])
              : name === 'offer_handshake'
                ? server.offer
                : null;
    return Promise.resolve({ data, error: null });
  });
}

const called = (name: string) => mockRpc.mock.calls.filter((c) => c[0] === name);

describe('the secret handshake on Also there', () => {
  beforeEach(() => {
    mockRpc.mockReset();
    mockPush.mockClear();
    mockContext.mockReturnValue(context());
    mockLive.mockReturnValue(true);
    useAuthStore.setState({ userId: ME });
  });

  it('is inert in demo mode: the plain rows, and the server is asked nothing about handshakes', async () => {
    mockLive.mockReturnValue(false);
    serve({ candidates: [{ user_id: MAYA, avatar_path: null }] });
    const { findByText, queryByTestId } = await renderScreen(<AlsoThere gameId={GAME} />);
    expect(await findByText('Maya Chen')).toBeTruthy();
    expect(queryByTestId(`handshake-avatar-${MAYA}`)).toBeNull();
    expect(called('handshake_candidates')).toHaveLength(0);
    expect(called('my_handshakes')).toHaveLength(0);
  });

  it('shows no avatar to tap when the viewer is not checked in, and does not ask who is', async () => {
    mockContext.mockReturnValue(context({ checked_in_at: null }));
    serve({ candidates: [{ user_id: MAYA, avatar_path: null }] });
    const { findByText, queryByTestId } = await renderScreen(<AlsoThere gameId={GAME} />);
    expect(await findByText('Maya Chen')).toBeTruthy();
    expect(queryByTestId(`handshake-avatar-${MAYA}`)).toBeNull();
    expect(called('handshake_candidates')).toHaveLength(0);
  });

  it('does not ask who is there once the check-in window has closed', async () => {
    mockContext.mockReturnValue(
      context({ scheduled_start: new Date(Date.now() - 48 * HOUR).toISOString() }),
    );
    serve({ candidates: [{ user_id: MAYA, avatar_path: null }] });
    const { findByText, queryByLabelText } = await renderScreen(<AlsoThere gameId={GAME} />);
    expect(await findByText('Maya Chen')).toBeTruthy();
    expect(queryByLabelText('Offer Maya Chen a handshake')).toBeNull();
    expect(called('handshake_candidates')).toHaveLength(0);
  });

  it('makes a checked-in mutual tappable, and a tap puts the waiting ring on them', async () => {
    serve({
      candidates: [{ user_id: MAYA, avatar_path: null }],
      offer: { offered: true, complete: false },
    });
    const { findByLabelText, queryByLabelText, findByTestId, queryByTestId } = await renderScreen(
      <AlsoThere gameId={GAME} />,
    );
    const avatar = await findByLabelText('Offer Maya Chen a handshake');
    // Sam is a mutual at the game who is not checked in: the plain row, nothing to tap.
    expect(queryByLabelText('Offer Sam a handshake')).toBeNull();

    await fireEvent.press(avatar);
    expect(await findByTestId('handshake-ring-waiting')).toBeTruthy();
    expect(called('offer_handshake')[0]?.[1]).toEqual({ p_game_id: GAME, p_to_user: MAYA });
    // One handshake per pair per game: the avatar is no longer a button.
    await waitFor(() => expect(queryByLabelText('Offer Maya Chen a handshake')).toBeNull());
    expect(queryByTestId('we-were-there-card')).toBeNull();
  });

  it('presents the card and the line when the offer completes the handshake', async () => {
    const server: Server = {
      candidates: [{ user_id: MAYA, avatar_path: null }],
      offer: { offered: true, complete: true },
      mine: [],
    };
    serve(server);
    const { findByLabelText, findByTestId, findByText, getByText } = await renderScreen(
      <AlsoThere gameId={GAME} />,
    );
    const avatar = await findByLabelText('Offer Maya Chen a handshake');
    // From here on the server knows about the completed pair.
    server.mine = [
      {
        user_id: MAYA,
        handle: 'maya',
        display_name: 'Maya Chen',
        avatar_path: null,
        state: 'complete',
      },
    ];
    await fireEvent.press(avatar);

    expect(await findByTestId('we-were-there-card')).toBeTruthy();
    expect(getByText('Dean & Maya')).toBeTruthy();
    expect(getByText('New York Mets at Philadelphia Phillies')).toBeTruthy();
    expect(await findByText('Secret handshake with Maya Chen.')).toBeTruthy();

    await fireEvent.press(getByText('Share'));
    expect(mockPush).toHaveBeenCalledTimes(1);
    const href = mockPush.mock.calls[0]?.[0] as { params: { template: string; payload: string } };
    expect(href.params.template).toBe('handshake');
    expect(JSON.parse(href.params.payload)).toMatchObject({
      kind: 'handshake',
      team: 'phi',
      me: { id: ME, name: 'Dean Yao' },
      them: { id: MAYA, name: 'Maya Chen' },
      venue: 'Citizens Bank Park',
    });
  });

  it('says why when the server refuses, and takes the ring back off', async () => {
    serve({
      candidates: [{ user_id: MAYA, avatar_path: null }],
      offer: { offered: false, reason: 'outside_window' },
    });
    const { findByLabelText, findByText, queryByTestId } = await renderScreen(
      <AlsoThere gameId={GAME} />,
    );
    await fireEvent.press(await findByLabelText('Offer Maya Chen a handshake'));
    expect(await findByText('Check-in for this game has closed.')).toBeTruthy();
    await waitFor(() => expect(queryByTestId('handshake-ring-waiting')).toBeNull());
  });

  it('shows the line for a handshake from an earlier visit without presenting the card again', async () => {
    serve({
      mine: [
        { user_id: SAM, handle: 'sam', display_name: 'Sam', avatar_path: null, state: 'complete' },
      ],
    });
    const { findByText, queryByTestId, findByTestId } = await renderScreen(
      <AlsoThere gameId={GAME} />,
    );
    expect(await findByText('Secret handshake with Sam.')).toBeTruthy();
    expect(queryByTestId('we-were-there-card')).toBeNull();
    expect(await findByTestId('handshake-ring-complete')).toBeTruthy();
  });
});
