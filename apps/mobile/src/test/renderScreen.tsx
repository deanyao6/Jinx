import React from 'react';
import { render } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

/**
 * Renders a ported screen with the context it needs outside its own tree.
 *
 * Every reference screen reads the safe-area insets, because the app draws under the real
 * status bar where the reference draws a fake one. Without a provider they throw rather
 * than defaulting, so this supplies the iPhone 17 Pro's real metrics — the same device the
 * parity harness measures against.
 */
export const IPHONE_17_PRO: Metrics = {
  frame: { x: 0, y: 0, width: 402, height: 874 },
  insets: { top: 62, left: 0, right: 0, bottom: 34 },
};

export function renderScreen(ui: React.ReactElement) {
  return render(<SafeAreaProvider initialMetrics={IPHONE_17_PRO}>{ui}</SafeAreaProvider>);
}
