// Web fallback: react-native-maps has no web implementation. Render a plain panel that lists the
// markers' titles so the screen still works in a browser preview.
import React, { forwardRef, useImperativeHandle } from 'react';
import { View, type ViewProps } from 'react-native';

import { Text } from '@/components/Text';

export type MapHandle = { fitToCoordinates: (...args: unknown[]) => void };

type MapViewProps = { children?: React.ReactNode; style?: ViewProps['style'] } & Record<
  string,
  unknown
>;

export const MapView = forwardRef<MapHandle, MapViewProps>(function MapView(
  { children, style },
  ref,
) {
  useImperativeHandle(ref, () => ({ fitToCoordinates: () => undefined }), []);
  const titles: string[] = [];
  React.Children.forEach(children, (child) => {
    if (React.isValidElement<{ title?: string }>(child) && child.props.title)
      titles.push(child.props.title);
  });
  return (
    <View style={[{ padding: 16, justifyContent: 'center' }, style]}>
      <Text variant="bodyStrong">Map is available on iPhone</Text>
      <Text color="muted" variant="sub" style={{ marginTop: 6 }}>
        {titles.length > 0 ? titles.join(' · ') : 'No venues to show yet.'}
      </Text>
    </View>
  );
});

export function Marker(_props: { [key: string]: unknown }): null {
  return null;
}

export function Polyline(_props: { [key: string]: unknown }): null {
  return null;
}
