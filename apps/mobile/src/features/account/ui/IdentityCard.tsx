import React from 'react';
import { View } from 'react-native';

import { Card } from '@/components/Card';
import { Avatar } from '@/components/reference/Avatar';
import { Text } from '@/components/Text';

type Props = {
  name: string;
  handle: string;
  /** A third line: a home city, say. */
  note?: string | null;
};

/** Who is signed in: the generated avatar, the name in the condensed face, the handle. */
export function IdentityCard({ name, handle, note }: Props) {
  const shown = name.trim() || `@${handle}`;
  const size = 52;
  return (
    <Card tone="accent">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden' }}>
          <Avatar name={shown} size={size} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="h2" numberOfLines={1}>
            {shown}
          </Text>
          <Text variant="sub" color="accent" weight={650} numberOfLines={1}>
            @{handle}
            {note ? ` · ${note}` : ''}
          </Text>
        </View>
      </View>
    </Card>
  );
}
