import React, { forwardRef } from 'react';
import { View } from 'react-native';

import { Text } from '@/components/Text';
import { APP_NAME } from '@/lib/app';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';
import { TemplateBody } from './templates';
import { CARD_HEIGHT, CARD_WIDTH, type ShareTemplate } from './types';

type Props = {
  template: ShareTemplate;
  handle: string;
  scheme: 'light' | 'dark';
};

function Frame({ template, handle }: Omit<Props, 'scheme'>) {
  const theme = useTheme();
  const c = theme.colors;
  return (
    <View
      style={{
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        backgroundColor: c.screen,
        padding: 28,
        justifyContent: 'space-between',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text variant="bodyStrong" style={{ letterSpacing: 2 }}>
          {APP_NAME}
        </Text>
        <Text variant="sub" color="muted">
          @{handle}
        </Text>
      </View>
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          marginVertical: 20,
          backgroundColor: c.card,
          borderColor: c.line,
          borderWidth: 1,
          borderRadius: theme.radius.lg,
          padding: 22,
        }}
      >
        <TemplateBody template={template} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {[c.red, c.blue, c.green, c.gold].map((color) => (
            <View
              key={color}
              style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }}
            />
          ))}
        </View>
        <Text variant="caption" color="muted">
          {APP_NAME} · a passport for sports fans · @{handle}
        </Text>
      </View>
    </View>
  );
}

/**
 * 360x640 card that captureRef snapshots at 3x for a 1080x1920 PNG. Renders in a forced theme so
 * the light and dark variants are independent of the phone's setting.
 */
export const ShareCard = forwardRef<View, Props>(function ShareCard({ scheme, ...rest }, ref) {
  return (
    <View ref={ref} collapsable={false} accessibilityLabel={`Share card, ${scheme}`}>
      <ThemeProvider scheme={scheme}>
        <Frame {...rest} />
      </ThemeProvider>
    </View>
  );
});
