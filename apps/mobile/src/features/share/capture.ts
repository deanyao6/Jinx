import * as Sharing from 'expo-sharing';
import type { RefObject } from 'react';
import type { View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { CARD_HEIGHT, CARD_SCALE, CARD_WIDTH } from './types';

/** Snapshots the hidden card at 1080x1920 and returns a temporary PNG uri. */
export async function captureCard(ref: RefObject<View | null>): Promise<string> {
  if (!ref.current) throw new Error('Card is not ready yet');
  return captureRef(ref.current, {
    format: 'png',
    quality: 1,
    width: CARD_WIDTH * CARD_SCALE,
    height: CARD_HEIGHT * CARD_SCALE,
    result: 'tmpfile',
  });
}

export async function sharePng(uri: string, title: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync()))
    throw new Error('Sharing is not available on this device');
  await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: title });
}
