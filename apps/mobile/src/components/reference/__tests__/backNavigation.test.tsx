import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import FriendsStackLayout from '@/app/friends/_layout';
import GamesStackLayout from '@/app/games/_layout';
import InviteStackLayout from '@/app/invite/_layout';
import PassportStackLayout from '@/app/passport/_layout';
import SettingsRoute from '@/app/settings/index';
import ShareStackLayout from '@/app/share/_layout';
import ProfileStackLayout from '@/app/u/_layout';
import YouStackLayout from '@/app/you/_layout';

const mockBack = jest.fn();
const mockReplace = jest.fn();
const mockCanGoBack = jest.fn(() => true);

/**
 * Captures the `screenOptions` each group layout hands its Stack, so the back control the
 * layout installs can be rendered and pressed without standing up the router. `jest.mock`
 * is hoisted above the imports above, so the layouts see this Stack, not the real one.
 */
const mockScreenOptions: Record<string, unknown>[] = [];

jest.mock('expo-router', () => {
  const MockStack = ({ screenOptions }: { screenOptions?: Record<string, unknown> }) => {
    if (screenOptions) mockScreenOptions.push(screenOptions);
    return null;
  };
  MockStack.displayName = 'MockStack';
  const MockScreen = () => null;
  MockScreen.displayName = 'MockStack.Screen';
  MockStack.Screen = MockScreen;
  return {
    Stack: MockStack,
    useRouter: () => ({
      back: mockBack,
      replace: mockReplace,
      canGoBack: mockCanGoBack,
      push: jest.fn(),
    }),
  };
});

type HeaderLeft = () => React.ReactElement;

/**
 * Settings reads the safe-area inset, so it needs metrics. Deliberately not `renderScreen`:
 * that helper now supplies a repository too, which drags Supabase and AsyncStorage into a
 * test about one button. These are the iPhone 17 Pro's real metrics, as the helper uses.
 */
function renderWithInsets(ui: React.ReactElement) {
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

/**
 * Every one of these stacks is entered at its own first screen when you open it from a
 * tab, and a native stack draws no back button there. Before this, the edge-swipe gesture
 * was the only way out. The gesture is untouched; these assert the visible arrow.
 */
describe('group layouts install a back control', () => {
  beforeEach(() => {
    mockScreenOptions.length = 0;
    mockBack.mockClear();
    mockReplace.mockClear();
    mockCanGoBack.mockReturnValue(true);
  });

  const layouts: [string, () => React.ReactElement, string][] = [
    ['games', GamesStackLayout, '/games'],
    ['you', YouStackLayout, '/settings'],
    ['passport', PassportStackLayout, '/'],
    ['friends', FriendsStackLayout, '/profile'],
    ['u', ProfileStackLayout, '/profile'],
    ['invite', InviteStackLayout, '/'],
    ['share', ShareStackLayout, '/'],
  ];

  it.each(layouts)('%s pops when there is history', async (_name, Layout) => {
    await render(<Layout />);
    const headerLeft = mockScreenOptions[0]?.headerLeft as HeaderLeft | undefined;
    expect(headerLeft).toBeDefined();
    const { getByLabelText } = await render(headerLeft!());
    const button = getByLabelText('Back');
    expect(button.props.accessibilityRole).toBe('button');
    await fireEvent.press(button);
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it.each(layouts)(
    '%s falls back to a root on a cold deep link',
    async (_name, Layout, fallback) => {
      mockCanGoBack.mockReturnValue(false);
      await render(<Layout />);
      const headerLeft = mockScreenOptions[0]?.headerLeft as HeaderLeft | undefined;
      const { getByLabelText } = await render(headerLeft!());
      await fireEvent.press(getByLabelText('Back'));
      expect(mockReplace).toHaveBeenCalledWith(fallback);
    },
  );
});

describe('Settings', () => {
  beforeEach(() => {
    mockBack.mockClear();
    mockReplace.mockClear();
    mockCanGoBack.mockReturnValue(true);
  });

  it('uses the shared header and pops', async () => {
    const { getByLabelText, getByText } = await renderWithInsets(<SettingsRoute />);
    expect(getByText('Settings')).toBeTruthy();
    await fireEvent.press(getByLabelText('Back'));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('falls back to Profile when opened cold', async () => {
    mockCanGoBack.mockReturnValue(false);
    const { getByLabelText } = await renderWithInsets(<SettingsRoute />);
    await fireEvent.press(getByLabelText('Back'));
    expect(mockReplace).toHaveBeenCalledWith('/profile');
  });
});
