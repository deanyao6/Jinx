import React from 'react';
import { Pressable, View, type ViewStyle } from 'react-native';

import { Text } from '@/components/Text';
import { useTheme } from '@/theme/ThemeProvider';

export type StampTone = 'visited' | 'closed' | 'ghost';

type Props = {
  name: string;
  caption: string;
  tone?: StampTone;
  /** Index in the grid; drives the color and rotation cycle from the mockup. */
  index?: number;
  onPress?: () => void;
  style?: ViewStyle;
};

const ROTATIONS = [-8, 6, -3, 9, 4, -6];

/** Round, slightly rotated venue stamp with a dashed inner ring. */
export function Stamp({ name, caption, tone = 'visited', index = 0, onPress, style }: Props) {
  const theme = useTheme();
  const c = theme.colors;
  const palette = [c.red, c.blue, c.green, c.gold];
  const color =
    tone === 'ghost' ? c.line : tone === 'closed' ? c.muted : palette[index % palette.length];
  const rotate = `${ROTATIONS[index % ROTATIONS.length]}deg`;
  const body = (
    <View
      style={[
        {
          aspectRatio: 1,
          borderRadius: 999,
          borderWidth: 2.5,
          borderColor: color,
          borderStyle: tone === 'ghost' ? 'dashed' : 'solid',
          alignItems: 'center',
          justifyContent: 'center',
          padding: theme.spacing.sm,
          transform: [{ rotate }],
          opacity: tone === 'closed' ? 0.75 : 1,
        },
        style,
      ]}
    >
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 4,
          left: 4,
          right: 4,
          bottom: 4,
          borderRadius: 999,
          borderWidth: 1,
          borderStyle: 'dashed',
          borderColor: color,
          opacity: 0.6,
        }}
      />
      <Text
        numberOfLines={3}
        align="center"
        style={{ fontSize: 10, lineHeight: 11, fontWeight: '800', color }}
      >
        {name}
      </Text>
      <Text
        numberOfLines={1}
        align="center"
        style={{
          fontSize: 9,
          lineHeight: 11,
          fontWeight: '500',
          color,
          opacity: 0.85,
          marginTop: 2,
        }}
      >
        {caption}
      </Text>
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${caption}`}
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
    >
      {body}
    </Pressable>
  );
}
