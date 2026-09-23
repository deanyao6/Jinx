import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import PlayersStep from '@/app/(onboarding)/players';
import { ONBOARDING_STEPS } from '@/features/onboarding/StepHeader';
import type { RosterPlayer } from '@/features/players/queries';
import { NO_ROSTER_NOTE } from '@/features/players/ui/TeamRosterSection';
import type { Team } from '@/features/teams/queries';
import { ReferenceThemeProvider } from '@/theme/reference/TeamTheme';

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack, replace: jest.fn() }),
}));

const team = (id: string, city: string, nickname: string, sport_id = 'mlb'): Team => ({
  id,
  sport_id,
  name: `${city} ${nickname}`,
  city,
  nickname,
  abbreviation: id.toUpperCase(),
  franchise_id: `f-${id}`,
  active: true,
});
const PHI = team('phi', 'Philadelphia', 'Phillies');
const NYJ = team('nyj', 'New York', 'Jets', 'nfl');

const player = (
  id: string,
  full_name: string,
  extra: Partial<RosterPlayer> = {},
): RosterPlayer => ({
  id,
  full_name,
  appearances: 10,
  seen_by_you: 0,
  ...extra,
});

type RosterState = { data?: RosterPlayer[]; isPending: boolean; isError: boolean };
const mockTeams = jest.fn<{ data?: Team[]; isLoading: boolean }, []>();
const mockRoster = jest.fn<RosterState, [string | undefined]>();
const mockFavorites = jest.fn<{ data?: { id: string; full_name: string }[] }, []>();
const mockToggle = jest.fn();

jest.mock('@/features/profile/queries', () => ({ useFavoriteTeams: () => mockTeams() }));
jest.mock('@/features/players/queries', () => ({
  useTeamRoster: (teamId: string | undefined) => mockRoster(teamId),
  useFavoritePlayers: () => mockFavorites(),
  useToggleFavoritePlayer: () => ({ mutate: mockToggle, isPending: false }),
}));

function renderStep() {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 402, height: 874 },
        insets: { top: 62, left: 0, right: 0, bottom: 34 },
      }}
    >
      <ReferenceThemeProvider>
        <PlayersStep />
      </ReferenceThemeProvider>
    </SafeAreaProvider>,
  );
}

const rosters: Record<string, RosterPlayer[]> = {
  phi: [
    player('harper', 'Bryce Harper', { seen_by_you: 3, position: '1B' }),
    player('wheeler', 'Zack Wheeler', { position: 'SP' }),
    player('hoskins', 'Rhys Hoskins', { seen_by_you: 1, on_roster: false }),
  ],
  nyj: [player('wilson', 'Garrett Wilson', { position: 'WR' })],
};

describe('the favorite players step', () => {
  it('lists an MLS club with the others now that MLS rosters exist (2026-09-22)', async () => {
    mockTeams.mockReturnValue({
      data: [PHI, team('union', 'Philadelphia', 'Union', 'mls')],
      isLoading: false,
    });
    const { getByTestId } = await renderStep();
    expect(getByTestId('roster-section-phi')).toBeTruthy();
    expect(getByTestId('roster-section-union')).toBeTruthy();
  });
  beforeEach(() => {
    mockPush.mockClear();
    mockToggle.mockClear();
    mockTeams.mockReturnValue({ data: [PHI, NYJ], isLoading: false });
    mockRoster.mockImplementation((teamId) => ({
      data: rosters[teamId ?? ''] ?? [],
      isPending: false,
      isError: false,
    }));
    mockFavorites.mockReturnValue({ data: [] });
  });

  it('is the step after the teams one, of six', async () => {
    const { getByText } = await renderStep();
    expect(ONBOARDING_STEPS).toBe(7);
    expect(getByText('Step 4 of 7')).toBeTruthy();
    expect(getByText('Any favorite players?')).toBeTruthy();
  });

  it('shows a section per picked team, with the roster inside', async () => {
    const { getByTestId, getByText, getByLabelText } = await renderStep();
    expect(getByTestId('roster-section-phi')).toBeTruthy();
    expect(getByTestId('roster-section-nyj')).toBeTruthy();
    expect(getByText('Phillies')).toBeTruthy();
    expect(getByText('Jets')).toBeTruthy();
    expect(getByLabelText('Zack Wheeler, add to favorites')).toBeTruthy();
    expect(getByLabelText('Garrett Wilson, add to favorites')).toBeTruthy();
  });

  it('marks the position, who you have seen, and who has left', async () => {
    const { getByText } = await renderStep();
    expect(getByText('1B')).toBeTruthy();
    expect(getByText('SP')).toBeTruthy();
    expect(getByText('Seen 3 times')).toBeTruthy();
    expect(getByText('Seen once')).toBeTruthy();
    expect(getByText('Former')).toBeTruthy();
  });

  it('lists the players you have seen first', async () => {
    mockRoster.mockImplementation(() => ({
      data: [
        player('a', 'Aaron Never'),
        player('b', 'Ben Seen', { seen_by_you: 2 }),
        player('c', 'Cal Never'),
      ],
      isPending: false,
      isError: false,
    }));
    const { getAllByRole } = await renderStep();
    const names = getAllByRole('checkbox').map((n) => n.props.accessibilityLabel as string);
    expect(names[0]).toMatch(/^Ben Seen/);
  });

  it('toggles a player through the favourites mutation', async () => {
    mockFavorites.mockReturnValue({ data: [{ id: 'harper', full_name: 'Bryce Harper' }] });
    const { getByLabelText } = await renderStep();
    await fireEvent.press(getByLabelText('Zack Wheeler, add to favorites'));
    expect(mockToggle).toHaveBeenCalledWith({
      player: { id: 'wheeler', full_name: 'Zack Wheeler' },
      on: true,
    });
    await fireEvent.press(getByLabelText('Bryce Harper, remove from favorites'));
    expect(mockToggle).toHaveBeenCalledWith({
      player: { id: 'harper', full_name: 'Bryce Harper' },
      on: false,
    });
  });

  it('continues and skips to the city step', async () => {
    const { getByText } = await renderStep();
    await fireEvent.press(getByText('Continue'));
    expect(mockPush).toHaveBeenCalledWith('/(onboarding)/city');
    mockPush.mockClear();
    await fireEvent.press(getByText('Skip for now'));
    expect(mockPush).toHaveBeenCalledWith('/(onboarding)/city');
  });

  it('offers a search only when a roster is long', async () => {
    mockRoster.mockImplementation((teamId) => ({
      data:
        teamId === 'nyj'
          ? Array.from({ length: 53 }, (_, i) => player(`p${i}`, `Player ${i}`))
          : rosters.phi,
      isPending: false,
      isError: false,
    }));
    const { queryByLabelText, getByLabelText } = await renderStep();
    expect(queryByLabelText('Search Phillies')).toBeNull();
    await fireEvent.changeText(getByLabelText('Search Jets'), 'Player 7');
    expect(getByLabelText('Player 7, add to favorites')).toBeTruthy();
    expect(queryByLabelText('Player 8, add to favorites')).toBeNull();
  });

  it('still lets the person continue when a roster is empty or failed', async () => {
    mockRoster.mockImplementation((teamId) =>
      teamId === 'phi'
        ? { data: [], isPending: false, isError: false }
        : { data: undefined, isPending: false, isError: true },
    );
    const { getAllByText, getByText } = await renderStep();
    expect(getAllByText(NO_ROSTER_NOTE)).toHaveLength(2);
    await fireEvent.press(getByText('Continue'));
    expect(mockPush).toHaveBeenCalledWith('/(onboarding)/city');
  });

  it('still lets the person continue with no teams at all', async () => {
    mockTeams.mockReturnValue({ data: [], isLoading: false });
    const { getByText } = await renderStep();
    expect(getByText(NO_ROSTER_NOTE)).toBeTruthy();
    await fireEvent.press(getByText('Skip for now'));
    expect(mockPush).toHaveBeenCalledWith('/(onboarding)/city');
  });
});
