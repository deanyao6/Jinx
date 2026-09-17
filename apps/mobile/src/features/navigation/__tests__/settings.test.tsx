import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { Alert } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import SettingsRoute, { settingsRows } from '@/app/settings/index';

const mockSignOut = jest.fn();
const mockExport = jest.fn();
const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn(), canGoBack: () => true }),
}));
jest.mock('@/features/auth/hooks', () => ({ useSignOut: () => mockSignOut }));
jest.mock('@/features/account/queries', () => ({
  useExportData: () => ({ mutate: mockExport, isPending: false, isError: false }),
}));
jest.mock('@/features/profile/queries', () => ({
  useProfile: () => ({ data: { handle: 'deanyao6' } }),
}));

function renderSettings() {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 402, height: 874 },
        insets: { top: 62, left: 0, right: 0, bottom: 34 },
      }}
    >
      <SettingsRoute />
    </SafeAreaProvider>,
  );
}

describe('Settings', () => {
  beforeEach(() => {
    mockSignOut.mockClear();
    mockExport.mockClear();
    mockPush.mockClear();
  });

  it('can sign out, after asking', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const { getByLabelText } = await renderSettings();
    await fireEvent.press(getByLabelText('Sign out'));

    // Nothing happens until the person confirms.
    expect(mockSignOut).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalledTimes(1);
    const buttons = alert.mock.calls[0]?.[2] ?? [];
    const confirm = buttons.find((b) => b.text === 'Sign out');
    expect(confirm?.style).toBe('destructive');
    confirm?.onPress?.();
    expect(mockSignOut).toHaveBeenCalledTimes(1);
    alert.mockRestore();
  });

  it('exports the account data', async () => {
    const { getByLabelText } = await renderSettings();
    await fireEvent.press(getByLabelText('Export my data'));
    expect(mockExport).toHaveBeenCalledTimes(1);
  });

  it('opens your own public profile', async () => {
    const { getByLabelText } = await renderSettings();
    await fireEvent.press(getByLabelText('Public profile'));
    expect(mockPush).toHaveBeenCalledWith('/u/deanyao6');
  });

  it('keeps account deletion reachable', async () => {
    const { getByLabelText } = await renderSettings();
    await fireEvent.press(getByLabelText('Delete account'));
    expect(mockPush).toHaveBeenCalledWith('/you/delete-account');
  });
});

describe('settingsRows', () => {
  it('hides the forwarding address until a real inbound domain exists', () => {
    const titles = (forwarding: boolean) => settingsRows({ forwarding }).map((r) => r.title);
    expect(titles(false)).not.toContain('Forwarding address');
    expect(titles(true)).toContain('Forwarding address');
  });
});
