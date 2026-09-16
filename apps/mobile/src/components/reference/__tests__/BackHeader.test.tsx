import React from 'react';
import { Text } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';

import { BackHeader, LegacyBackButton } from '@/components/reference/BackHeader';
import { ReferenceThemeProvider } from '@/theme/reference/TeamTheme';

const mockBack = jest.fn();
const mockReplace = jest.fn();
const mockCanGoBack = jest.fn(() => true);

// Minimal, like the tab bar test: the header only needs useRouter, and the real module
// drags the whole router runtime into a unit test for one button.
jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: mockBack,
    replace: mockReplace,
    canGoBack: mockCanGoBack,
    push: jest.fn(),
  }),
}));

function renderRef(ui: React.ReactElement) {
  return render(<ReferenceThemeProvider team="none">{ui}</ReferenceThemeProvider>);
}

describe('BackHeader', () => {
  beforeEach(() => {
    mockBack.mockClear();
    mockReplace.mockClear();
    mockCanGoBack.mockReturnValue(true);
  });

  it('pops when there is history', async () => {
    const { getByLabelText } = await renderRef(<BackHeader title="Settings" fallback="/profile" />);
    await fireEvent.press(getByLabelText('Back'));
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('replaces with the fallback when a deep link left nothing to pop', async () => {
    mockCanGoBack.mockReturnValue(false);
    const { getByLabelText } = await renderRef(<BackHeader title="Settings" fallback="/profile" />);
    await fireEvent.press(getByLabelText('Back'));
    expect(mockReplace).toHaveBeenCalledWith('/profile');
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('is announced as a button', async () => {
    const { getByLabelText } = await renderRef(<BackHeader title="Settings" />);
    expect(getByLabelText('Back').props.accessibilityRole).toBe('button');
  });

  it('shows the title and renders the right-hand slot', async () => {
    const { getByText } = await renderRef(<BackHeader title="Stamps" right={<Text>Share</Text>} />);
    expect(getByText('Stamps')).toBeTruthy();
    expect(getByText('Share')).toBeTruthy();
  });
});

describe('LegacyBackButton', () => {
  beforeEach(() => {
    mockBack.mockClear();
    mockReplace.mockClear();
    mockCanGoBack.mockReturnValue(true);
  });

  it('pops when there is history', async () => {
    const { getByLabelText } = await render(<LegacyBackButton fallback="/games" />);
    await fireEvent.press(getByLabelText('Back'));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('falls back to a root rather than dead-ending', async () => {
    mockCanGoBack.mockReturnValue(false);
    const { getByLabelText } = await render(<LegacyBackButton fallback="/games" />);
    await fireEvent.press(getByLabelText('Back'));
    expect(mockReplace).toHaveBeenCalledWith('/games');
  });

  it('defaults to the Passport root', async () => {
    mockCanGoBack.mockReturnValue(false);
    const { getByLabelText } = await render(<LegacyBackButton />);
    await fireEvent.press(getByLabelText('Back'));
    expect(mockReplace).toHaveBeenCalledWith('/');
  });
});
