import { useLocalSearchParams } from 'expo-router';
import React from 'react';

import { CaptureScreen } from '@/features/reactions/capture/CaptureScreen';

/**
 * Capture a reaction at a game: `/react/<gameId>?prompt=<promptId>` from a push or the banner,
 * or without a prompt from the checked-in screen (self-triggered). Opened full screen over
 * everything, so the screen carries its own way out.
 */
export default function ReactRoute() {
  const { gameId, prompt } = useLocalSearchParams<{ gameId: string; prompt?: string }>();
  return <CaptureScreen gameId={gameId} promptId={prompt ?? null} />;
}
