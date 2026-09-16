import React from 'react';
import { LogBox, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/Text';
import { useTheme } from '@/theme/ThemeProvider';

import { PickASideScreen } from '@/features/checkin/reference/PickASideScreen';
import { StadiumGuideScreen } from '@/features/guide/reference/StadiumGuideScreen';
import { FriendsPanel } from '@/features/profile/reference/FriendsPanel';
import { ProfileScreen } from '@/features/profile/reference/ProfileScreen';
import { GameDayScreen } from '@/features/plan/reference/GameDayScreen';
import { ReliveScreen } from '@/features/relive/reference/ReliveScreen';
import { GamesScreen } from '@/features/games/reference/GamesScreen';
import { GameLogPanel } from '@/features/passport/reference/GameLogPanel';
import { PassportScreen } from '@/features/passport/reference/PassportScreen';

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
const PORTED: Partial<Record<ParityScreenId, () => React.ReactNode>> = {
  'passport-all': () => <PassportScreen initialPill="all" />,
  'passport-phi': () => <PassportScreen initialPill="phi" />,
  'passport-phl': () => <PassportScreen initialPill="phl" />,
  // The record cards that open these carry the record and the label, so the panel is
  // given the same values the reference passes from `data-rec` and `data-name`.
  'passport-log-phillies': () => <GameLogPanel log="phi" title="Phillies" record="12 – 5" />,
  'passport-log-neutral': () => <GameLogPanel log="neutral" title="As a neutral" record="10 – 9" />,
  games: () => <GamesScreen />,
  'pick-a-side': () => <PickASideScreen />,
  'pick-a-side-picked': () => <PickASideScreen picked="away" />,
  'relive-start': () => <ReliveScreen step={0} />,
  'relive-mid': () => <ReliveScreen step={5} />,
  'game-day': () => <GameDayScreen />,
  'guide-food': () => <StadiumGuideScreen tab="food" />,
  'guide-bathrooms': () => <StadiumGuideScreen tab="bath" />,
  'guide-seats': () => <StadiumGuideScreen tab="seats" />,
  profile: () => <ProfileScreen />,
  friends: () => <FriendsPanel />,
};

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

  // A development warning toast draws over the screen and is perfectly stable, so the
  // capture script's two-identical-frames check accepts it. One covered the tab bar on the
  // Stadium guide and scored it at 13.92% instead of about 5%. Parity shots must contain
  // the app and nothing else, so LogBox is silenced while the harness is driving.
  React.useEffect(() => {
    if (control.active) LogBox.ignoreAllLogs(true);
  }, [control.active]);

  if (!control.active) return <>{children}</>;

  if (control.screenId === SELFTEST_ID) return <SelfTest />;

  const render = control.screenId ? PORTED[control.screenId] : undefined;

  return (
    // Keyed by screen id so switching screens remounts rather than reusing the instance.
    // Without this, a screen whose state is seeded from a prop (Passport's selected pill)
    // keeps whatever it was first mounted with, and the harness captures three different
    // screen ids showing identical pixels. The duplicate-shot backstop in capture-app.mjs
    // caught exactly that. Parity screens must be a pure function of their id.
    <View
      key={control.screenId ?? 'none'}
      style={{ flex: 1, backgroundColor: theme.colors.screen }}
    >
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
