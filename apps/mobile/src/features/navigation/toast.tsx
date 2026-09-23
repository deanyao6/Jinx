import React, { useEffect } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';

import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * One short line over the app for a few seconds. Used when a link cannot be followed: the app
 * lands on a tab root and says so, rather than showing an error screen (docs/prompts/social/01,
 * section 2).
 */
type ToastState = { message: string | null; show: (message: string) => void; clear: () => void };

export const useToastStore = create<ToastState>((set) => ({
  message: null,
  show: (message) => set({ message }),
  clear: () => set({ message: null }),
}));

export const showToast = (message: string) => useToastStore.getState().show(message);

const VISIBLE_MS = 3000;

export function Toast() {
  const message = useToastStore((s) => s.message);
  const clear = useToastStore((s) => s.clear);
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(clear, VISIBLE_MS);
    return () => clearTimeout(t);
  }, [message, clear]);
  if (!message) return null;
  return (
    <View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={{
        position: 'absolute',
        left: 16,
        right: 16,
        top: insets.top + 8,
        alignItems: 'center',
      }}
    >
      <View
        style={{
          backgroundColor: theme.colors.ink,
          borderRadius: 999,
          paddingHorizontal: 16,
          paddingVertical: 10,
        }}
      >
        <Text style={{ color: theme.colors.screen, fontFamily: fontFamily({ weight: 700 }), fontSize: 14 }}>
          {message}
        </Text>
      </View>
    </View>
  );
}
