import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/Text';
import { useTheme } from '@/theme/ThemeProvider';

import { ParityMarker } from './ParityMarker';
import { SELFTEST_ID, SELFTEST_INK } from './marker';
import type { ParityScreenId } from './screens';
import { useParityControl } from './useParityControl';

/**
 * Renders whichever screen the parity harness has asked for, over the whole app.
 *
 * Development only, and only while the harness is actually serving; see
 * useParityControl. Screens are added here as they are ported against
 * design/reference.html. Anything not yet ported renders a placeholder and paints NO
 * marker, so the harness reports it as not built instead of scoring a placeholder
 * against the reference.
 */

/** Ported screens, keyed by the ids in scripts/parity/screens.mjs. */
const PORTED: Partial<Record<ParityScreenId, () => React.ReactNode>> = {};

function SelfTest() {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <View
        style={{
          position: 'absolute',
          top: insets.top,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: SELFTEST_INK,
        }}
      />
      <ParityMarker screenId={SELFTEST_ID} />
    </View>
  );
}

export function ParityHost({ children }: { children: React.ReactNode }) {
  const control = useParityControl();
  const theme = useTheme();

  if (!control.active) return <>{children}</>;

  if (control.screenId === SELFTEST_ID) return <SelfTest />;

  const render = control.screenId ? PORTED[control.screenId] : undefined;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.screen }}>
      {render ? (
        render()
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <Text variant="h2">Not ported yet</Text>
          <Text color="muted">{control.screenId ?? 'waiting for the parity harness'}</Text>
        </View>
      )}
      {control.screenId && render ? <ParityMarker screenId={control.screenId} /> : null}
    </View>
  );
}
