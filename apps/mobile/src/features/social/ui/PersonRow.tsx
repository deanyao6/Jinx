import React from 'react';
import { View } from 'react-native';

import { PersonAvatar } from '@/components/PersonAvatar';
import { Text } from '@/components/Text';

type Props = {
  /** The person's account id. It seeds the generated avatar. */
  userId: string;
  name: string;
  /** For the avatar's initials when there is no display name. */
  handle?: string | null;
  /** `profiles.avatar_path`, or null for the generated default. */
  avatarPath?: string | null;
  caption?: string | null;
  /** Opens the person. The name is the link, so a button on the right keeps its own press. */
  onPressName?: () => void;
  right?: React.ReactNode;
  /** Actions that belong to this person, drawn under the name and aligned with it. */
  children?: React.ReactNode;
};

/** A person in a list: ringed portrait, name, one line under it. No rule between rows. */
export function PersonRow({
  userId,
  name,
  handle,
  avatarPath,
  caption,
  onPressName,
  right,
  children,
}: Props) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 10 }}>
      <PersonAvatar userId={userId} name={name} handle={handle} path={avatarPath} size={38} ring />
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
