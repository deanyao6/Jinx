import React from 'react';
import { Alert } from 'react-native';

import { Button } from '@/components/Button';
import { useFollow, useUnfollow, type FollowStatus } from '../queries';

type Props = {
  userId: string;
  name: string;
  status: FollowStatus;
  isPrivate: boolean;
  isMutual?: boolean;
  small?: boolean;
};

export function followButtonTitle(
  status: FollowStatus,
  isPrivate: boolean,
  isMutual = false,
): string {
  if (status === 'active') return isMutual ? 'Friends' : 'Following';
  if (status === 'requested') return 'Requested';
  return isPrivate ? 'Request to follow' : 'Follow';
}

/** Follow / Requested / Following / Friends button with confirm on unfollow. */
export function FollowButton({ userId, name, status, isPrivate, isMutual, small }: Props) {
  const follow = useFollow();
  const unfollow = useUnfollow();
  const busy = follow.isPending || unfollow.isPending;

  const onPress = () => {
    if (status === null) {
      follow.mutate({ userId });
      return;
    }
    if (status === 'requested') {
      unfollow.mutate({ userId });
      return;
    }
    Alert.alert(`Unfollow ${name}?`, 'Their games leave your feed and any rivalry ends.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Unfollow', style: 'destructive', onPress: () => unfollow.mutate({ userId }) },
    ]);
  };

  return (
    <Button
      title={followButtonTitle(status, isPrivate, isMutual)}
      variant={status === null ? 'primary' : 'secondary'}
      small={small}
      loading={busy}
      onPress={onPress}
      style={{ alignSelf: 'flex-start' }}
    />
  );
}
