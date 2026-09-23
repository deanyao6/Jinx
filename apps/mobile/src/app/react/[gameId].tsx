import { useRouter } from 'expo-router';
import React from 'react';

import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';

/**
 * Capture a reaction at a game, `?prompt=<promptId>` once prompt 3 builds the camera. Opened
 * full screen over everything, so it carries its own way out.
 */
export default function ReactRoute() {
  const router = useRouter();
  const close = () => (router.canGoBack() ? router.back() : router.replace('/games'));
  return (
    <Screen>
      <EmptyState
        icon="i-camera"
        title="Reactions are coming"
        body="A front and back photo at the big moment, pinned to the game for good."
      />
      <Button title="Close" variant="secondary" onPress={close} />
    </Screen>
  );
}
