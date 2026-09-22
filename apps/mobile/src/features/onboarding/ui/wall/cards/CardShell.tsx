import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { WALL } from '../styles';

/**
 * `.c`: the base card. 12px radius, `9px 10px` padding, a hairline at 12% white on a fill at
 * 8.5% white, and everything inside clipped to the corners. The wall cards are the one place
 * in the app outside `design/reference.html` that draw a border on a card: they are a literal
 * port of that file, which docs/subpage-style.md defers to.
 */
export function CardShell({
  style,
  children,
}: {
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  return (
    <View
      style={[
        {
          borderRadius: WALL.radius,
          paddingVertical: 9,
          paddingHorizontal: 10,
          overflow: 'hidden',
          backgroundColor: WALL.cardBg,
          borderWidth: 1,
          borderColor: WALL.cardBorder,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
