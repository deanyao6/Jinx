import { Stack, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useRef, useState } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
 * What the preview cannot have: the navigator header, and everything under the preview (label,
 * segments, button, caption) with the padding around the preview itself. Both err on the large side.
 */
const HEADER_HEIGHT = 56;
const FOOTER_HEIGHT = 200;

/**
 * Share sheet: previews a card, toggles light and dark, and shares the 1080x1920 PNG. The card is
 * rendered twice: a scaled preview on screen and an unscaled copy off screen that captureRef reads.
 */
export default function ShareScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
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
  // The card is 9:16, so it is the height that runs out first. Size the preview to what is left
  // once the header and the footer below have had theirs, so the whole sheet fits without a scroll
  // on most phones; the ScrollView is still there for the ones where it cannot.
  const room = height - insets.top - insets.bottom - HEADER_HEIGHT - FOOTER_HEIGHT;
  const previewWidth = Math.max(
    180,
    Math.min(width - theme.spacing.lg * 2, 320, (room * CARD_WIDTH) / CARD_HEIGHT),
  );
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
          flexGrow: 1,
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.md,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* The card straight on the canvas: its own fill is the edge, so no outline. */}
        <View
          accessibilityLabel="Card preview"
          style={{
            width: previewWidth,
            height: CARD_HEIGHT * scale,
            borderRadius: theme.radius.lg,
            overflow: 'hidden',
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
      </ScrollView>
      <View
        style={{
          paddingHorizontal: theme.spacing.lg,
          paddingTop: theme.spacing.sm,
          paddingBottom: insets.bottom + theme.spacing.md,
        }}
      >
        <Text variant="kicker" color="muted" style={{ marginBottom: theme.spacing.sm }}>
          Appearance
        </Text>
        <Segmented options={SCHEMES} value={scheme} onChange={setScheme} />
        {error ? <Notice tone="error">{errorMessage(error)}</Notice> : null}
        <Button
          title="Share image"
          onPress={() => void onShare()}
          loading={busy}
          disabled={!handle}
        />
        <Text
          variant="caption"
          color="muted"
          align="center"
          style={{ marginTop: theme.spacing.sm }}
        >
          1080×1920 PNG with your handle. Team names only, never logos.
        </Text>
      </View>
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
