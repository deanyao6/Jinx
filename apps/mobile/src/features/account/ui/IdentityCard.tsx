import React from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { Card } from '@/components/Card';
import { PersonAvatar } from '@/components/PersonAvatar';
import { IconCamera } from '@/components/reference/icons';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme/ThemeProvider';

type Props = {
  /** The signed-in user's id. It seeds the generated avatar's colour. */
  userId?: string | null;
  name: string;
  handle: string;
  /** `profiles.avatar_path`, or null for the generated default. */
  avatarPath?: string | null;
  /** A third line: a home city, say. */
  note?: string | null;
  /** Makes the avatar a button with a camera badge: Edit profile changes the photo from here. */
  onPressAvatar?: () => void;
  /** A photo is uploading or being removed. */
  avatarBusy?: boolean;
};

const SIZE = 52;
const BADGE = 22;

/** Who is signed in: their photo or generated avatar, the name in the condensed face, the handle. */
export function IdentityCard({
  userId,
  name,
  handle,
  avatarPath,
  note,
  onPressAvatar,
  avatarBusy = false,
}: Props) {
  const theme = useTheme();
  const shown = name.trim() || `@${handle}`;
  const avatar = (
    <PersonAvatar userId={userId} name={name} handle={handle} path={avatarPath} size={SIZE} />
  );
  return (
    <Card tone="accent">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        {onPressAvatar ? (
          <Pressable
            testID="change-photo"
            accessibilityRole="button"
            accessibilityLabel={avatarPath ? 'Change profile photo' : 'Add a profile photo'}
            accessibilityState={{ busy: avatarBusy, disabled: avatarBusy }}
            disabled={avatarBusy}
            onPress={onPressAvatar}
            hitSlop={8}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <View style={{ opacity: avatarBusy ? 0.4 : 1 }}>{avatar}</View>
            {avatarBusy ? (
              <View
                style={{
                  position: 'absolute',
                  width: SIZE,
                  height: SIZE,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ActivityIndicator color={theme.accent.text} />
              </View>
            ) : null}
            <View
              style={{
                position: 'absolute',
                right: -4,
                bottom: -4,
                width: BADGE,
                height: BADGE,
                borderRadius: BADGE / 2,
                backgroundColor: theme.accent.fill,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <IconCamera size={13} color={theme.accent.onFill} />
            </View>
          </Pressable>
        ) : (
          avatar
        )}
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
