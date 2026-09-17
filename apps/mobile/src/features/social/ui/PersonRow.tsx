import React from 'react';
import { View } from 'react-native';

import { Text } from '@/components/Text';
import { RingedAvatar } from './RingedAvatar';

type Props = {
  /** Avatar key, normally the person's id. */
  seed: string;
  name: string;
  caption?: string | null;
  /** Opens the person. The name is the link, so a button on the right keeps its own press. */
  onPressName?: () => void;
  right?: React.ReactNode;
  /** Actions that belong to this person, drawn under the name and aligned with it. */
  children?: React.ReactNode;
};

/** A person in a list: ringed portrait, name, one line under it. No rule between rows. */
export function PersonRow({ seed, name, caption, onPressName, right, children }: Props) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 10 }}>
      <RingedAvatar seed={seed} />
      <View style={{ flex: 1, gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 46 }}>
          <View style={{ flex: 1 }}>
            <Text
              variant="bodyStrong"
              numberOfLines={1}
              onPress={onPressName}
              accessibilityRole={onPressName ? 'link' : undefined}
            >
              {name}
            </Text>
            {caption ? (
              <Text variant="caption" color="muted" numberOfLines={1}>
                {caption}
              </Text>
            ) : null}
          </View>
          {right}
        </View>
        {children}
      </View>
    </View>
  );
}
