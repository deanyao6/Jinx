import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import LeagueRoute from '@/app/settings/favorites/league';
import RosterRoute from '@/app/settings/favorites/roster';
import TeamsRoute, { rosterPromptHref } from '@/app/settings/favorites/teams';
import type { RosterPlayer } from '@/features/players/queries';
import type { Team } from '@/features/teams/queries';

/**
 * Adding a team in Settings > Favorites asks "any favorite players?" by opening the roster
 * picker in its prompt form (Dean, 2026-09-17). Removing one asks nothing, and the roster
 * page opened from the Players tab is unchanged.
 */

const mockPush = jest.fn();
const mockBack = jest.fn();
const mockParams = jest.fn<Record<string, string | undefined>, []>();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack, replace: jest.fn(), canGoBack: () => true }),
  useLocalSearchParams: () => mockParams(),
}));

const team = (id: string, city: string, nickname: string): Team => ({
  id,
  sport_id: 'mlb',
  name: `${city} ${nickname}`,
  city,
  nickname,
  abbreviation: id.toUpperCase(),
  franchise_id: `f-${id}`,
  active: true,
});
const mockPHI = team('phi', 'Philadelphia', 'Phillies');
const mockNYM = team('nym', 'New York', 'Mets');
const mockMLS = { ...team('union', 'Philadelphia', 'Union'), sport_id: 'mls' };

const mockSetTeams = jest.fn();
jest.mock('@/features/teams/queries', () => ({
  useTeams: () => ({ data: [mockPHI, mockNYM, mockMLS], isPending: false }),
}));
jest.mock('@/features/profile/queries', () => ({
  useFavoriteTeams: () => ({ data: [mockNYM] }),
  useSetFavoriteTeams: () => ({ mutate: mockSetTeams, isPending: false }),
}));

const mockToggle = jest.fn();
const mockRosterRows: RosterPlayer[] = [
  { id: 'harper', full_name: 'Bryce Harper', appearances: 40, seen_by_you: 2, position: '1B' },
  { id: 'hoskins', full_name: 'Rhys Hoskins', appearances: 12, seen_by_you: 1, on_roster: false },
  { id: 'wheeler', full_name: 'Zack Wheeler', appearances: 0, seen_by_you: 0, position: 'SP' },
];
jest.mock('@/features/players/queries', () => ({
  useTeamRoster: () => ({ data: mockRosterRows, isPending: false, isError: false }),
  useFavoritePlayers: () => ({ data: [] }),
  useToggleFavoritePlayer: () => ({ mutate: mockToggle, isPending: false }),
}));

function renderRoute(ui: React.ReactElement) {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 402, height: 874 },
        insets: { top: 62, left: 0, right: 0, bottom: 34 },
      }}
    >
      {ui}
    </SafeAreaProvider>,
  );
}

beforeEach(() => {
  mockPush.mockClear();
  mockBack.mockClear();
  mockSetTeams.mockClear();
  mockToggle.mockClear();
});

describe('adding a team in Settings', () => {
  beforeEach(() => mockParams.mockReturnValue({ sport: 'mlb' }));

  it('saves the team and then asks about its players', async () => {
    const { getByLabelText } = await renderRoute(<TeamsRoute />);
    await fireEvent.press(getByLabelText('Philadelphia Phillies, add to favorites'));
    expect(mockSetTeams).toHaveBeenCalledWith([mockNYM, mockPHI]);
    expect(mockPush).toHaveBeenCalledWith(rosterPromptHref(mockPHI));
    expect(rosterPromptHref(mockPHI)).toBe(
      '/settings/favorites/roster?teamId=phi&name=Philadelphia%20Phillies&nick=Phillies&sport=mlb&prompt=1',
    );
  });

  it('asks nothing when a team is removed', async () => {
    const { getByLabelText } = await renderRoute(<TeamsRoute />);
    await fireEvent.press(getByLabelText('New York Mets, remove from favorites'));
    expect(mockSetTeams).toHaveBeenCalledWith([]);
    expect(mockPush).not.toHaveBeenCalled();
  });
});

describe('the roster page as the prompt', () => {
  const params = {
    teamId: 'phi',
    name: 'Philadelphia Phillies',
    nick: 'Phillies',
    sport: 'mlb',
  };

  it('asks the question and offers Done and Not now, both of which go back', async () => {
    mockParams.mockReturnValue({ ...params, prompt: '1' });
    const { getByText, queryByText } = await renderRoute(<RosterRoute />);
    expect(getByText('Any favorite Phillies?')).toBeTruthy();
    expect(getByText('Pick from the current roster.')).toBeTruthy();
    expect(queryByText('Choose a player')).toBeNull();
    await fireEvent.press(getByText('Done'));
    expect(mockBack).toHaveBeenCalledTimes(1);
    await fireEvent.press(getByText('Not now'));
    expect(mockBack).toHaveBeenCalledTimes(2);
  });

  it('picks through the same mutation as the picker', async () => {
    mockParams.mockReturnValue({ ...params, prompt: '1' });
    const { getByLabelText } = await renderRoute(<RosterRoute />);
    await fireEvent.press(getByLabelText('Zack Wheeler, add to favorites'));
    expect(mockToggle).toHaveBeenCalledWith({
      player: { id: 'wheeler', full_name: 'Zack Wheeler' },
      on: true,
    });
  });

  it('marks positions, former players and who you have seen', async () => {
    mockParams.mockReturnValue({ ...params, prompt: '1' });
    const { getByText } = await renderRoute(<RosterRoute />);
    expect(getByText('1B · Seen 2 times')).toBeTruthy();
    expect(getByText('Former · Seen once')).toBeTruthy();
    expect(getByText('SP')).toBeTruthy();
  });

  it('is the plain picker without the prompt param', async () => {
    mockParams.mockReturnValue(params);
    const { getByText, queryByText } = await renderRoute(<RosterRoute />);
    expect(getByText('Choose a player')).toBeTruthy();
    expect(queryByText('Any favorite Phillies?')).toBeNull();
    expect(queryByText('Done')).toBeNull();
    expect(queryByText('Not now')).toBeNull();
  });
});

describe('MLS favorite capabilities', () => {
  // MLS has rosters since 2026-09-22 (next-wave E.3: ingest/src/mls/rosters.ts), so the league
  // is offered for players as well as teams, and adding a club asks about its players like any
  // other sport.
  it('offers MLS for teams and for players', async () => {
    mockParams.mockReturnValue({ mode: 'teams' });
    const teams = await renderRoute(<LeagueRoute />);
    await fireEvent.press(teams.getByText('Major League Soccer'));
    expect(mockPush).toHaveBeenCalledWith('/settings/favorites/teams?sport=mls');
    await teams.unmount();
    mockPush.mockClear();
    mockParams.mockReturnValue({ mode: 'players' });
    const players = await renderRoute(<LeagueRoute />);
    await fireEvent.press(players.getByText('Major League Soccer'));
    expect(mockPush).toHaveBeenCalledWith('/settings/favorites/players?sport=mls');
  });
  it('saves an MLS favorite and then asks about its players', async () => {
    mockParams.mockReturnValue({ sport: 'mls' });
    const { getByLabelText, queryByText } = await renderRoute(<TeamsRoute />);
    expect(queryByText('Philadelphia Phillies')).toBeNull();
    await fireEvent.press(getByLabelText('Philadelphia Union, add to favorites'));
    expect(mockSetTeams).toHaveBeenCalledWith([mockNYM, mockMLS]);
    expect(mockPush).toHaveBeenCalledWith(rosterPromptHref(mockMLS));
  });
});
