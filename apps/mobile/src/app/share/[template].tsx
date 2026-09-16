import { Stack, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useRef, useState } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';

import { Button } from '@/components/Button';
import { Notice, errorMessage } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { Segmented } from '@/components/Segmented';
import { Text } from '@/components/Text';
import { useProfile } from '@/features/profile/queries';
import { captureCard, sharePng } from '@/features/share/capture';
import { ShareCard } from '@/features/share/ShareCard';
import { templateTitle } from '@/features/share/templates';
import { CARD_HEIGHT, CARD_WIDTH, parseShareTemplate } from '@/features/share/types';
import { useTheme } from '@/theme/ThemeProvider';

type Scheme = 'light' | 'dark';

const SCHEMES: { key: Scheme; label: string }[] = [
  { key: 'light', label: 'Light' },
  { key: 'dark', label: 'Dark' },
];

/**
 * Share sheet: previews a card, toggles light and dark, and shares the 1080x1920 PNG. The card is
 * rendered twice: a scaled preview on screen and an unscaled copy off screen that captureRef reads.
 */
export default function ShareScreen() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams<{ template?: string; payload?: string }>();
  const template = useMemo(
    () => parseShareTemplate(params.template, params.payload),
    [params.template, params.payload],
  );
  const profile = useProfile();
  const [scheme, setScheme] = useState<Scheme>(theme.scheme);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const cardRef = useRef<View>(null);

  const handle = profile.data?.handle ?? '';
  const previewWidth = Math.min(width - theme.spacing.lg * 2, 320);
  const scale = previewWidth / CARD_WIDTH;

  const onShare = async () => {
    if (!template) return;
    setBusy(true);
    setError(null);
    try {
      const uri = await captureCard(cardRef);
      await sharePng(uri, templateTitle(template));
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  if (!template) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Share' }} />
        <Notice tone="error">This card could not be opened. Go back and try again.</Notice>
      </Screen>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.screen }}>
      <Stack.Screen options={{ title: 'Share' }} />
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.md,
          alignItems: 'center',
        }}
      >
        <View style={{ alignSelf: 'stretch' }}>
          <Segmented options={SCHEMES} value={scheme} onChange={setScheme} />
        </View>
        <View
          accessibilityLabel="Card preview"
          style={{
            width: previewWidth,
            height: CARD_HEIGHT * scale,
            borderRadius: theme.radius.lg,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: theme.colors.line,
          }}
        >
          <View
            style={{
              width: CARD_WIDTH,
              height: CARD_HEIGHT,
              transformOrigin: 'top left',
              transform: [{ scale }],
            }}
          >
            <ShareCard template={template} handle={handle} scheme={scheme} />
          </View>
        </View>
        {error ? (
          <Notice tone="error" style={{ alignSelf: 'stretch', marginTop: theme.spacing.md }}>
            {errorMessage(error)}
          </Notice>
        ) : null}
        <Button
          title="Share image"
          onPress={() => void onShare()}
          loading={busy}
          disabled={!handle}
          style={{ alignSelf: 'stretch', marginTop: theme.spacing.md }}
        />
        <Text
          variant="caption"
          color="muted"
          align="center"
          style={{ marginTop: theme.spacing.sm }}
        >
          1080×1920 PNG with your handle. Team names only, never logos.
        </Text>
      </ScrollView>
      {/* Off-screen, unscaled copy that captureRef snapshots at 3x. */}
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{
          position: 'absolute',
          left: -10_000,
          top: 0,
          width: CARD_WIDTH,
          height: CARD_HEIGHT,
        }}
      >
        <ShareCard ref={cardRef} template={template} handle={handle} scheme={scheme} />
      </View>
    </View>
  );
}
