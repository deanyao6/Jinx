import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ICONS } from '@/components/reference/icons';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme/ThemeProvider';

import type { PromptDelivery } from '../queries';

/** How long the in-app banner stays up after a prompt fires: the capture window plus a moment. */
export const BANNER_MS = 150_000;

/** The delivery to show now: the newest one still inside its window that was not opened. */
export function bannerDelivery(deliveries: readonly PromptDelivery[] | undefined, nowMs: number, dismissed: ReadonlySet<string>): PromptDelivery | null {
  let best: PromptDelivery | null = null;
  for (const d of deliveries ?? []) {
    if (d.opened_at || d.reacted_at || dismissed.has(d.prompt_id)) continue;
    const fired = Date.parse(d.fired_at);
    if (!Number.isFinite(fired) || nowMs - fired > BANNER_MS || fired > nowMs + 60_000) continue;
    if (!best || fired > Date.parse(best.fired_at)) best = d;
  }
  return best;
}

/**
 * The in-app half of a prompt (03, section 4, step 1): one line over whatever screen is up,
 * "Quick, react to Barkley's 90-yard touchdown run. Tap to react." Tapping opens the camera.
 */
export function PromptBanner({ delivery, onDismiss }: { delivery: PromptDelivery; onDismiss: () => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const Camera = ICONS['i-camera'];
  const a = theme.accent;
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 12, right: 12, top: insets.top + 6 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${delivery.copy} Tap to react.`}
        testID="reaction-prompt-banner"
        onPress={() => {
          onDismiss();
          router.push(`/react/${delivery.game_id}?prompt=${delivery.prompt_id}`);
        }}
        style={({ pressed }) => ({
          backgroundColor: a.fill,
          borderRadius: theme.radius.lg,
          paddingVertical: 12,
          paddingHorizontal: 14,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          opacity: pressed ? 0.9 : 1,
          shadowColor: '#000',
          shadowOpacity: 0.25,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
        })}
      >
        <Camera size={22} color={a.onFill} />
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong" numberOfLines={3} style={{ color: a.onFill }}>
            {delivery.copy}
          </Text>
          <Text variant="caption" style={{ color: a.onFill, opacity: 0.85 }}>
            Tap to react
          </Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Not now" onPress={onDismiss} hitSlop={10}>
          <Text variant="caption" style={{ color: a.onFill, opacity: 0.85 }}>
            Not now
          </Text>
        </Pressable>
      </Pressable>
    </View>
  );
}
