import { Stack, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { PageIntro } from '@/components/PageIntro';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { EGG_CATALOG } from '@/features/eggs/catalog';
import { eggs } from '@/features/eggs/flags';

/**
 * Easter eggs, for development only: every egg, whether its switch is on, and a way to play it
 * on sample data without waiting for a seventh inning. The list is `EGG_CATALOG`.
 *
 * Reachable only from a row on About that exists when `__DEV__` is true. In a production build
 * the row is gone, and a deep link here finds an empty page.
 */
export default function EasterEggsScreen() {
  // `?play=<key>` shows that one egg and starts it, because nothing can tap Play in the simulator.
  const { play, sport } = useLocalSearchParams<{ play?: string; sport?: string }>();
  if (!__DEV__) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Easter eggs' }} />
        <EmptyState icon="i-spark" title="Nothing here" body="This page is for development." />
      </Screen>
    );
  }
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Easter eggs' }} />
      <PageIntro
        kicker="Development"
        title="Easter eggs"
        body="Each one plays here on sample data. The switches are in features/eggs/flags.ts."
      />
      {EGG_CATALOG.filter((egg) => !play || egg.key === play).map(
        ({ key, title, how, Preview }) => (
          <Card key={key}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
              <Text variant="bodyStrong" style={{ flex: 1 }}>
                {title}
              </Text>
              <Text variant="kicker" color={eggs[key] ? 'green' : 'muted'}>
                {eggs[key] ? 'On' : 'Off'}
              </Text>
            </View>
            <Text variant="sub" color="muted" style={{ marginTop: 2 }}>
              {how}
            </Text>
            {Preview ? <Preview autoPlay={play === key} {...(sport ? { sport } : {})} /> : null}
          </Card>
        ),
      )}
    </Screen>
  );
}
